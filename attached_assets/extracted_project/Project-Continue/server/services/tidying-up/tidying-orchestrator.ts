import type { 
  TidyingTask, 
  TidyingFileAction, 
  FileMetadata, 
  ScanResult,
  DuplicateGroup,
  HotColdAnalysis,
  DesktopAnalysis,
  RenameSuggestion,
  SemanticAnalysis
} from './types';
import { fileScanner, type ScanRequest } from './file-scanner';
import { semanticAnalyzer } from './semantic-analyzer';
import { suggestBatchRenames } from './rename-engine';
import { classifyFile, isTemporaryFile, isDuplicateLikeName } from './classification-rules';
import { db } from '../../db';
import { tidyingTasks, fileAccessLogs, type InsertTidyingTask } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export interface TidyingReport {
  scanResult: ScanResult;
  duplicates: DuplicateGroup[];
  renameSuggestions: RenameSuggestion[];
  hotColdAnalysis: HotColdAnalysis;
  desktopAnalysis?: DesktopAnalysis;
  totalIssues: number;
  recommendations: string[];
}

export interface TidyingPlan {
  taskId: string;
  actions: TidyingFileAction[];
  estimatedTime: number;
  warnings: string[];
}

export class TidyingOrchestrator {
  async createScanTask(deviceId: string, scanPath: string): Promise<string> {
    const [task] = await db.insert(tidyingTasks).values({
      deviceId,
      taskType: 'SCAN',
      status: 'PENDING',
      targetPath: scanPath,
      actions: [],
    }).returning();
    
    return task.id;
  }
  
  async processScan(taskId: string, scanRequest: ScanRequest): Promise<TidyingReport> {
    await db.update(tidyingTasks)
      .set({ status: 'RUNNING', startedAt: new Date() })
      .where(eq(tidyingTasks.id, taskId));
    
    try {
      const scanResult = await fileScanner.processScanResult(scanRequest);
      const duplicates = fileScanner.findDuplicates(scanResult.files);
      const renameSuggestions = suggestBatchRenames(scanResult.files);
      const hotColdAnalysis = fileScanner.analyzeHotCold(scanResult.files);
      
      let desktopAnalysis: DesktopAnalysis | undefined;
      if (scanRequest.scanPath.toLowerCase().includes('desktop') || 
          scanRequest.scanPath.includes('桌面')) {
        desktopAnalysis = this.analyzeDesktop(scanResult.files);
      }
      
      const totalIssues = 
        duplicates.reduce((sum, d) => sum + d.duplicateCount, 0) +
        renameSuggestions.length +
        hotColdAnalysis.coldFiles.filter(f => hotColdAnalysis.recommendations.find(r => r.action !== 'KEEP')).length;
      
      const recommendations = this.generateRecommendations(scanResult, duplicates, hotColdAnalysis, desktopAnalysis);
      
      await db.update(tidyingTasks).set({
        status: 'COMPLETED',
        completedAt: new Date(),
        result: {
          totalFiles: scanResult.totalCount,
          totalSize: scanResult.totalSize,
          duplicateGroups: duplicates.length,
          renameSuggestions: renameSuggestions.length,
          coldFiles: hotColdAnalysis.coldFiles.length,
        },
      }).where(eq(tidyingTasks.id, taskId));
      
      return {
        scanResult,
        duplicates,
        renameSuggestions,
        hotColdAnalysis,
        desktopAnalysis,
        totalIssues,
        recommendations,
      };
    } catch (error) {
      await db.update(tidyingTasks).set({
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      }).where(eq(tidyingTasks.id, taskId));
      throw error;
    }
  }
  
  private analyzeDesktop(files: FileMetadata[]): DesktopAnalysis {
    const categories: Record<string, number> = {};
    let tempFiles = 0;
    let duplicates = 0;
    
    for (const file of files) {
      const category = classifyFile(file);
      categories[category] = (categories[category] || 0) + 1;
      
      if (isTemporaryFile(file)) {
        tempFiles++;
      }
      if (isDuplicateLikeName(file.fileName)) {
        duplicates++;
      }
    }
    
    const iconCount = files.length;
    let chaosScore = 0;
    
    if (iconCount > 50) chaosScore += 30;
    else if (iconCount > 30) chaosScore += 20;
    else if (iconCount > 15) chaosScore += 10;
    
    chaosScore += Math.min(30, tempFiles * 3);
    chaosScore += Math.min(20, duplicates * 5);
    
    const categoryCount = Object.keys(categories).length;
    if (categoryCount > 6) chaosScore += 20;
    else if (categoryCount > 4) chaosScore += 10;
    
    chaosScore = Math.min(100, chaosScore);
    
    const suggestions: string[] = [];
    
    if (iconCount > 30) {
      suggestions.push(`桌面有${iconCount}个文件，建议控制在15个以内`);
    }
    if (tempFiles > 0) {
      suggestions.push(`发现${tempFiles}个临时文件，建议清理`);
    }
    if (duplicates > 0) {
      suggestions.push(`发现${duplicates}个疑似副本文件，建议检查`);
    }
    if (categoryCount > 4) {
      suggestions.push('桌面文件类型过于混杂，建议按类别整理到文件夹');
    }
    
    return {
      iconCount,
      chaosScore,
      suggestions,
      categories: categories as Record<any, number>,
      duplicates,
      tempFiles,
    };
  }
  
  private generateRecommendations(
    scanResult: ScanResult,
    duplicates: DuplicateGroup[],
    hotCold: HotColdAnalysis,
    desktop?: DesktopAnalysis
  ): string[] {
    const recommendations: string[] = [];
    
    if (duplicates.length > 0) {
      const totalDupSize = duplicates.reduce((sum, d) => sum + d.totalSize, 0);
      recommendations.push(`发现${duplicates.length}组重复文件，可释放${formatSize(totalDupSize)}空间`);
    }
    
    if (hotCold.coldFiles.length > 10) {
      const coldSize = hotCold.coldFiles.reduce((sum, f) => sum + f.fileSize, 0);
      recommendations.push(`${hotCold.coldFiles.length}个文件超过${hotCold.coldThresholdDays}天未访问，建议归档，可释放${formatSize(coldSize)}`);
    }
    
    if (desktop) {
      if (desktop.chaosScore > 60) {
        recommendations.push('桌面混乱度较高('+desktop.chaosScore+'/100)，建议进行一次彻底整理');
      }
      recommendations.push(...desktop.suggestions);
    }
    
    return recommendations;
  }
  
  async createTidyingPlan(
    deviceId: string,
    report: TidyingReport,
    options: {
      handleDuplicates?: boolean;
      handleRenames?: boolean;
      handleColdFiles?: boolean;
      archivePath?: string;
    } = {}
  ): Promise<TidyingPlan> {
    const actions: TidyingFileAction[] = [];
    const warnings: string[] = [];
    
    if (options.handleDuplicates && report.duplicates.length > 0) {
      for (const group of report.duplicates) {
        for (const file of group.files) {
          if (file.filePath !== group.recommendedKeep) {
            actions.push({
              filePath: file.filePath,
              action: 'DELETE',
              status: 'PENDING',
            });
          }
        }
      }
      if (report.duplicates.length > 5) {
        warnings.push(`将删除${actions.filter(a => a.action === 'DELETE').length}个重复文件，请确认`);
      }
    }
    
    if (options.handleRenames && report.renameSuggestions.length > 0) {
      for (const suggestion of report.renameSuggestions) {
        const existingDelete = actions.find(a => a.filePath.endsWith(suggestion.originalName));
        if (!existingDelete) {
          actions.push({
            filePath: report.scanResult.files.find(f => f.fileName === suggestion.originalName)?.filePath || '',
            action: 'RENAME',
            newName: suggestion.suggestedName,
            status: 'PENDING',
          });
        }
      }
    }
    
    if (options.handleColdFiles && report.hotColdAnalysis.coldFiles.length > 0) {
      const archiveBase = options.archivePath || 'Archive';
      for (let i = 0; i < report.hotColdAnalysis.recommendations.length; i++) {
        const rec = report.hotColdAnalysis.recommendations[i];
        const file = report.hotColdAnalysis.coldFiles[i];
        
        if (rec.action === 'ARCHIVE' || rec.action === 'MOVE') {
          const category = classifyFile(file);
          actions.push({
            filePath: file.filePath,
            action: 'MOVE',
            newPath: `${archiveBase}/${category}/${file.fileName}`,
            status: 'PENDING',
          });
        } else if (rec.action === 'DELETE') {
          actions.push({
            filePath: file.filePath,
            action: 'DELETE',
            status: 'PENDING',
          });
        }
      }
    }
    
    const [task] = await db.insert(tidyingTasks).values({
      deviceId,
      taskType: 'MOVE',
      status: 'PENDING',
      actions: actions,
    }).returning();
    
    return {
      taskId: task.id,
      actions,
      estimatedTime: actions.length * 100,
      warnings,
    };
  }
  
  async executePlan(taskId: string): Promise<TidyingTask> {
    const [task] = await db.select().from(tidyingTasks).where(eq(tidyingTasks.id, taskId));
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    await db.update(tidyingTasks).set({
      status: 'RUNNING',
      startedAt: new Date(),
    }).where(eq(tidyingTasks.id, taskId));
    
    return {
      id: task.id,
      deviceId: task.deviceId,
      taskType: task.taskType as any,
      status: 'RUNNING',
      files: (task.actions as TidyingFileAction[]) || [],
      createdAt: task.createdAt || new Date(),
      startedAt: new Date(),
    };
  }
  
  async updateActionStatus(
    taskId: string,
    filePath: string,
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED',
    error?: string
  ): Promise<void> {
    const [task] = await db.select().from(tidyingTasks).where(eq(tidyingTasks.id, taskId));
    
    if (!task) return;
    
    const actions = (task.actions as TidyingFileAction[]) || [];
    const actionIndex = actions.findIndex(a => a.filePath === filePath);
    
    if (actionIndex >= 0) {
      actions[actionIndex].status = status;
      if (error) actions[actionIndex].error = error;
      
      await db.update(tidyingTasks).set({ actions }).where(eq(tidyingTasks.id, taskId));
    }
    
    const allDone = actions.every(a => ['COMPLETED', 'FAILED', 'SKIPPED'].includes(a.status));
    if (allDone) {
      await db.update(tidyingTasks).set({
        status: 'COMPLETED',
        completedAt: new Date(),
      }).where(eq(tidyingTasks.id, taskId));
    }
  }
  
  async getTaskHistory(deviceId: string, limit: number = 10): Promise<TidyingTask[]> {
    const tasks = await db.select()
      .from(tidyingTasks)
      .where(eq(tidyingTasks.deviceId, deviceId))
      .orderBy(desc(tidyingTasks.createdAt))
      .limit(limit);
    
    return tasks.map(t => ({
      id: t.id,
      deviceId: t.deviceId,
      taskType: t.taskType as any,
      status: t.status as any,
      files: (t.actions as TidyingFileAction[]) || [],
      createdAt: t.createdAt || new Date(),
      startedAt: t.startedAt || undefined,
      completedAt: t.completedAt || undefined,
      error: t.error || undefined,
    }));
  }
  
  async logFileAccess(deviceId: string, filePath: string, accessType: 'OPEN' | 'MODIFY' | 'DELETE'): Promise<void> {
    await db.insert(fileAccessLogs).values({
      deviceId,
      filePath,
      accessType,
      accessedAt: new Date(),
    });
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export const tidyingOrchestrator = new TidyingOrchestrator();
