/**
 * 断舍离协议 - 冷热数据分离器
 * 
 * 功能：
 * 1. 追踪文件使用频率
 * 2. 自动识别冷数据（长期未访问）
 * 3. 生成归档建议和执行计划
 * 4. 支持定时自动归档触发
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('HotColdSeparator');

import type { FileMetadata, HotColdAnalysis } from './types';
import { classifyFile } from './classification-rules';
import { getDatabase } from '../../db';
import { fileAccessLogs } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export interface AccessPattern {
  filePath: string;
  deviceId: string;
  accessCount: number;
  lastAccess: Date;
  firstAccess: Date;
  avgAccessInterval: number;
  isFrequent: boolean;
  trend: 'increasing' | 'stable' | 'decreasing' | 'dormant';
}

export interface ArchiveCandidate {
  file: FileMetadata;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  suggestedLocation: string;
  estimatedSavings: number;
  daysSinceAccess: number;
  accessPattern?: AccessPattern;
}

export interface ArchivePlan {
  id: string;
  deviceId: string;
  candidates: ArchiveCandidate[];
  totalFiles: number;
  totalSize: number;
  targetLocation: string;
  createdAt: Date;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'cancelled';
  compressionEnabled: boolean;
}

export interface AutoArchiveConfig {
  enabled: boolean;
  coldThresholdDays: number;
  minFileSizeMB: number;
  excludePatterns: string[];
  protectedCategories: string[];
  scheduleHour: number;
  maxArchiveSizeGB: number;
  notifyBeforeArchive: boolean;
}

export interface SeparationResult {
  hot: FileMetadata[];
  warm: FileMetadata[];
  cold: FileMetadata[];
  frozen: FileMetadata[];
  statistics: SeparationStats;
}

export interface SeparationStats {
  hotCount: number;
  warmCount: number;
  coldCount: number;
  frozenCount: number;
  hotSize: number;
  warmSize: number;
  coldSize: number;
  frozenSize: number;
  potentialArchiveSavings: number;
}

const DEFAULT_CONFIG: AutoArchiveConfig = {
  enabled: false,
  coldThresholdDays: 90,
  minFileSizeMB: 0,
  excludePatterns: ['.git', 'node_modules', '.env', 'config'],
  protectedCategories: ['SYSTEM', 'CONFIG'],
  scheduleHour: 3,
  maxArchiveSizeGB: 10,
  notifyBeforeArchive: true,
};

export class HotColdSeparator {
  private config: AutoArchiveConfig = DEFAULT_CONFIG;
  private accessPatterns: Map<string, AccessPattern> = new Map();

  async separateFiles(files: FileMetadata[]): Promise<SeparationResult> {
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    
    const thresholds = {
      hot: 7 * day,
      warm: 30 * day,
      cold: this.config.coldThresholdDays * day,
    };
    
    const result: SeparationResult = {
      hot: [],
      warm: [],
      cold: [],
      frozen: [],
      statistics: {
        hotCount: 0,
        warmCount: 0,
        coldCount: 0,
        frozenCount: 0,
        hotSize: 0,
        warmSize: 0,
        coldSize: 0,
        frozenSize: 0,
        potentialArchiveSavings: 0,
      },
    };
    
    for (const file of files) {
      const age = now.getTime() - file.accessedAt.getTime();
      
      if (age <= thresholds.hot) {
        result.hot.push(file);
        result.statistics.hotCount++;
        result.statistics.hotSize += file.fileSize;
      } else if (age <= thresholds.warm) {
        result.warm.push(file);
        result.statistics.warmCount++;
        result.statistics.warmSize += file.fileSize;
      } else if (age <= thresholds.cold) {
        result.cold.push(file);
        result.statistics.coldCount++;
        result.statistics.coldSize += file.fileSize;
        result.statistics.potentialArchiveSavings += file.fileSize;
      } else {
        result.frozen.push(file);
        result.statistics.frozenCount++;
        result.statistics.frozenSize += file.fileSize;
        result.statistics.potentialArchiveSavings += file.fileSize;
      }
    }
    
    return result;
  }

  async logAccess(deviceId: string, filePath: string): Promise<void> {
    try {
      await getDatabase().insert(fileAccessLogs).values({
        deviceId,
        filePath,
        accessedAt: new Date(),
        accessType: 'read',
      });
      
      this.updateAccessPattern(deviceId, filePath);
    } catch (error) {
      logger.error({ error }, 'Failed to log access');
    }
  }

  private updateAccessPattern(deviceId: string, filePath: string): void {
    const key = `${deviceId}:${filePath}`;
    const existing = this.accessPatterns.get(key);
    const now = new Date();
    
    if (existing) {
      const newCount = existing.accessCount + 1;
      const totalInterval = now.getTime() - existing.firstAccess.getTime();
      const avgInterval = totalInterval / newCount;
      
      let trend: AccessPattern['trend'] = 'stable';
      if (existing.accessCount >= 3) {
        const recentInterval = now.getTime() - existing.lastAccess.getTime();
        if (recentInterval < avgInterval * 0.7) {
          trend = 'increasing';
        } else if (recentInterval > avgInterval * 1.5) {
          trend = 'decreasing';
        }
      }
      
      this.accessPatterns.set(key, {
        ...existing,
        accessCount: newCount,
        lastAccess: now,
        avgAccessInterval: avgInterval,
        isFrequent: avgInterval < 7 * 24 * 60 * 60 * 1000,
        trend,
      });
    } else {
      this.accessPatterns.set(key, {
        filePath,
        deviceId,
        accessCount: 1,
        lastAccess: now,
        firstAccess: now,
        avgAccessInterval: 0,
        isFrequent: false,
        trend: 'stable',
      });
    }
  }

  async getAccessPattern(deviceId: string, filePath: string): Promise<AccessPattern | null> {
    const key = `${deviceId}:${filePath}`;
    return this.accessPatterns.get(key) || null;
  }

  async generateArchiveCandidates(
    deviceId: string, 
    files: FileMetadata[]
  ): Promise<ArchiveCandidate[]> {
    const separation = await this.separateFiles(files);
    const candidates: ArchiveCandidate[] = [];
    const now = new Date();
    
    for (const file of [...separation.cold, ...separation.frozen]) {
      if (this.shouldExclude(file)) continue;
      
      const daysSinceAccess = Math.floor(
        (now.getTime() - file.accessedAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      
      const category = classifyFile(file);
      const pattern = await this.getAccessPattern(deviceId, file.filePath);
      
      let priority: ArchiveCandidate['priority'] = 'low';
      let reason = '';
      
      if (daysSinceAccess > 365) {
        priority = 'high';
        reason = `超过一年未访问 (${daysSinceAccess}天)`;
      } else if (daysSinceAccess > 180) {
        priority = 'medium';
        reason = `半年未访问 (${daysSinceAccess}天)`;
      } else {
        reason = `${daysSinceAccess}天未访问`;
      }
      
      if (category === 'TEMP') {
        priority = 'high';
        reason = '临时文件，' + reason;
      }
      
      if (pattern?.trend === 'dormant') {
        priority = priority === 'low' ? 'medium' : 'high';
        reason += '，访问趋势为休眠状态';
      }
      
      const year = new Date().getFullYear();
      const suggestedLocation = `Archive/${year}/${category}/${this.getMonthFolder(file.modifiedAt)}`;
      
      candidates.push({
        file,
        reason,
        priority,
        suggestedLocation,
        estimatedSavings: file.fileSize,
        daysSinceAccess,
        accessPattern: pattern || undefined,
      });
    }
    
    return candidates.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return b.estimatedSavings - a.estimatedSavings;
    });
  }

  async createArchivePlan(
    deviceId: string,
    candidates: ArchiveCandidate[],
    options: { targetLocation?: string; compressionEnabled?: boolean } = {}
  ): Promise<ArchivePlan> {
    const plan: ArchivePlan = {
      id: `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceId,
      candidates,
      totalFiles: candidates.length,
      totalSize: candidates.reduce((sum, c) => sum + c.estimatedSavings, 0),
      targetLocation: options.targetLocation || 'Archive',
      createdAt: new Date(),
      status: 'pending',
      compressionEnabled: options.compressionEnabled ?? true,
    };
    
    return plan;
  }

  async executeArchivePlan(
    plan: ArchivePlan,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; archivedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let archivedCount = 0;
    
    plan.status = 'executing';
    
    for (let i = 0; i < plan.candidates.length; i++) {
      const candidate = plan.candidates[i];
      
      try {
        archivedCount++;
        
        onProgress?.(i + 1, plan.candidates.length);
      } catch (error) {
        errors.push(`Failed to archive ${candidate.file.fileName}: ${error}`);
      }
    }
    
    plan.status = errors.length === 0 ? 'completed' : 'completed';
    
    return {
      success: errors.length === 0,
      archivedCount,
      errors,
    };
  }

  async getAccessHistory(
    deviceId: string, 
    filePath: string, 
    days: number = 30
  ): Promise<Date[]> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const logs = await db
        .select({ accessedAt: fileAccessLogs.accessedAt })
        .from(fileAccessLogs)
        .where(
          and(
            eq(fileAccessLogs.deviceId, deviceId),
            eq(fileAccessLogs.filePath, filePath),
            gte(fileAccessLogs.accessedAt, since)
          )
        )
        .orderBy(desc(fileAccessLogs.accessedAt));
      
      return logs.map(l => l.accessedAt);
    } catch (error) {
      logger.error({ error }, 'Failed to get access history');
      return [];
    }
  }

  async getDeviceHeatMap(deviceId: string, files: FileMetadata[]): Promise<Map<string, number>> {
    const heatMap = new Map<string, number>();
    const now = new Date();
    const maxAge = 365 * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      const age = now.getTime() - file.accessedAt.getTime();
      const heat = Math.max(0, 1 - age / maxAge);
      
      const dir = file.filePath.substring(0, file.filePath.lastIndexOf('/')) || '/';
      const currentHeat = heatMap.get(dir) || 0;
      heatMap.set(dir, currentHeat + heat);
    }
    
    return heatMap;
  }

  analyzeAccessTrends(files: FileMetadata[]): Record<string, {
    avgDaysSinceAccess: number;
    trend: 'aging' | 'active' | 'mixed';
    recommendation: string;
  }> {
    const categories = new Map<string, FileMetadata[]>();
    
    for (const file of files) {
      const category = classifyFile(file);
      const existing = categories.get(category) || [];
      existing.push(file);
      categories.set(category, existing);
    }
    
    const result: Record<string, any> = {};
    const now = new Date();
    
    const categoryEntries = Array.from(categories.entries());
    for (const [category, categoryFiles] of categoryEntries) {
      const ages = categoryFiles.map((f: FileMetadata) => 
        (now.getTime() - f.accessedAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      
      const avgAge = ages.reduce((a: number, b: number) => a + b, 0) / ages.length;
      const recentCount = ages.filter((a: number) => a < 30).length;
      const recentRatio = recentCount / ages.length;
      
      let trend: 'aging' | 'active' | 'mixed';
      let recommendation: string;
      
      if (recentRatio > 0.7) {
        trend = 'active';
        recommendation = '此类文件活跃度高，保持当前位置';
      } else if (recentRatio < 0.2) {
        trend = 'aging';
        recommendation = '此类文件整体老化，建议批量归档';
      } else {
        trend = 'mixed';
        recommendation = '混合使用模式，建议按时间筛选归档';
      }
      
      result[category] = {
        avgDaysSinceAccess: Math.round(avgAge),
        trend,
        recommendation,
      };
    }
    
    return result;
  }

  private shouldExclude(file: FileMetadata): boolean {
    const category = classifyFile(file);
    if (this.config.protectedCategories.includes(category)) {
      return true;
    }
    
    for (const pattern of this.config.excludePatterns) {
      if (file.filePath.includes(pattern)) {
        return true;
      }
    }
    
    if (this.config.minFileSizeMB > 0) {
      if (file.fileSize < this.config.minFileSizeMB * 1024 * 1024) {
        return true;
      }
    }
    
    return false;
  }

  private getMonthFolder(date: Date): string {
    const month = date.getMonth() + 1;
    return `${month.toString().padStart(2, '0')}`;
  }

  setConfig(config: Partial<AutoArchiveConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AutoArchiveConfig {
    return { ...this.config };
  }

  async getStorageStats(files: FileMetadata[]): Promise<{
    totalSize: number;
    hotSize: number;
    coldSize: number;
    archivableSize: number;
    sizeByCategory: Record<string, number>;
  }> {
    const separation = await this.separateFiles(files);
    
    const sizeByCategory: Record<string, number> = {};
    for (const file of files) {
      const category = classifyFile(file);
      sizeByCategory[category] = (sizeByCategory[category] || 0) + file.fileSize;
    }
    
    return {
      totalSize: files.reduce((sum, f) => sum + f.fileSize, 0),
      hotSize: separation.statistics.hotSize + separation.statistics.warmSize,
      coldSize: separation.statistics.coldSize + separation.statistics.frozenSize,
      archivableSize: separation.statistics.potentialArchiveSavings,
      sizeByCategory,
    };
  }
}

export const hotColdSeparator = new HotColdSeparator();
