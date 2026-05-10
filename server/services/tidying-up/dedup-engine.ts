/**
 * 断舍离协议 - 跨设备去重引擎
 * 
 * 功能：
 * 1. 基于文件哈希进行精确去重
 * 2. 基于内容相似度进行模糊去重
 * 3. 跨设备文件索引和同步
 * 4. 智能保留策略（保留最新/访问最多/路径最短）
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('DedupEngine');

import type { FileMetadata, DuplicateGroup } from './types';
import { getDatabase } from '../../db';
import { fileScanCache, fileAccessLogs } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface CrossDeviceDuplicate {
  hash: string;
  files: DeviceFile[];
  totalSize: number;
  duplicateCount: number;
  recommendation: DuplicateRecommendation;
}

export interface DeviceFile {
  deviceId: string;
  deviceName?: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  modifiedAt: Date;
  accessedAt: Date;
  accessCount?: number;
}

export interface DuplicateRecommendation {
  keepFile: DeviceFile;
  deleteFiles: DeviceFile[];
  reason: string;
  confidence: number;
  potentialSavings: number;
}

export interface SimilarityMatch {
  file1: FileMetadata;
  file2: FileMetadata;
  similarity: number;
  matchType: 'name' | 'content' | 'size' | 'combined';
  suggestion: string;
}

export interface DedupReport {
  totalFilesScanned: number;
  exactDuplicates: CrossDeviceDuplicate[];
  similarFiles: SimilarityMatch[];
  potentialSavings: number;
  deviceSummary: Record<string, DeviceDedupSummary>;
  generatedAt: Date;
}

export interface DeviceDedupSummary {
  deviceId: string;
  totalFiles: number;
  duplicateFiles: number;
  duplicateSize: number;
  uniqueFiles: number;
}

export interface RetentionPolicy {
  preferDevice?: string;
  preferNewest: boolean;
  preferMostAccessed: boolean;
  preferShortestPath: boolean;
  protectedPaths: string[];
}

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  preferNewest: true,
  preferMostAccessed: true,
  preferShortestPath: true,
  protectedPaths: ['/System', '/Windows', '/Program Files', '/Applications'],
};

export class DedupEngine {
  private fileIndex: Map<string, DeviceFile[]> = new Map();
  private retentionPolicy: RetentionPolicy = DEFAULT_RETENTION_POLICY;

  async indexFiles(deviceId: string, files: FileMetadata[]): Promise<void> {
    for (const file of files) {
      if (!file.fileHash) continue;
      
      const deviceFile: DeviceFile = {
        deviceId,
        filePath: file.filePath,
        fileName: file.fileName,
        fileSize: file.fileSize,
        modifiedAt: file.modifiedAt,
        accessedAt: file.accessedAt,
      };
      
      const existing = this.fileIndex.get(file.fileHash) || [];
      const isDuplicate = existing.some(f => 
        f.deviceId === deviceId && f.filePath === file.filePath
      );
      
      if (!isDuplicate) {
        existing.push(deviceFile);
        this.fileIndex.set(file.fileHash, existing);
      }
    }
    
    logger.info(`[DedupEngine] Indexed ${files.length} files from device ${deviceId}`);
  }

  async findCrossDeviceDuplicates(): Promise<CrossDeviceDuplicate[]> {
    const duplicates: CrossDeviceDuplicate[] = [];
    
    const entries = Array.from(this.fileIndex.entries());
    for (const [hash, files] of entries) {
      if (files.length > 1) {
        const recommendation = this.generateRecommendation(files);
        
        duplicates.push({
          hash,
          files,
          totalSize: files.reduce((sum: number, f: DeviceFile) => sum + f.fileSize, 0),
          duplicateCount: files.length - 1,
          recommendation,
        });
      }
    }
    
    return duplicates.sort((a, b) => b.totalSize - a.totalSize);
  }

  async findDuplicatesForDevice(deviceId: string, files: FileMetadata[]): Promise<DuplicateGroup[]> {
    const hashGroups = new Map<string, FileMetadata[]>();
    
    for (const file of files) {
      if (!file.fileHash) continue;
      
      const existing = hashGroups.get(file.fileHash) || [];
      existing.push(file);
      hashGroups.set(file.fileHash, existing);
    }
    
    const duplicates: DuplicateGroup[] = [];
    
    const entries = Array.from(hashGroups.entries());
    for (const [hash, group] of entries) {
      if (group.length > 1) {
        const sorted = this.sortByRetentionPolicy(group);
        
        duplicates.push({
          hash,
          files: group,
          totalSize: group.reduce((sum: number, f: FileMetadata) => sum + f.fileSize, 0),
          recommendedKeep: sorted[0].filePath,
          duplicateCount: group.length - 1,
        });
      }
    }
    
    return duplicates.sort((a, b) => b.totalSize - a.totalSize);
  }

  findSimilarFiles(files: FileMetadata[], threshold: number = 0.8): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];
    
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const similarity = this.calculateSimilarity(files[i], files[j]);
        
        if (similarity.score >= threshold) {
          matches.push({
            file1: files[i],
            file2: files[j],
            similarity: similarity.score,
            matchType: similarity.type,
            suggestion: this.getSimilaritySuggestion(files[i], files[j], similarity),
          });
        }
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  async generateDedupReport(deviceFiles: Map<string, FileMetadata[]>): Promise<DedupReport> {
    const allFiles: FileMetadata[] = [];
    const deviceSummary: Record<string, DeviceDedupSummary> = {};
    
    const deviceEntries = Array.from(deviceFiles.entries());
    for (const [deviceId, files] of deviceEntries) {
      await this.indexFiles(deviceId, files);
      allFiles.push(...files);
      
      const duplicates = await this.findDuplicatesForDevice(deviceId, files);
      const duplicateFiles = new Set(duplicates.flatMap(d => d.files.slice(1).map(f => f.filePath)));
      
      deviceSummary[deviceId] = {
        deviceId,
        totalFiles: files.length,
        duplicateFiles: duplicateFiles.size,
        duplicateSize: duplicates.reduce((sum, d) => sum + (d.files.length - 1) * d.files[0].fileSize, 0),
        uniqueFiles: files.length - duplicateFiles.size,
      };
    }
    
    const exactDuplicates = await this.findCrossDeviceDuplicates();
    const similarFiles = this.findSimilarFiles(allFiles.slice(0, 1000), 0.85);
    
    const potentialSavings = exactDuplicates.reduce((sum, d) => 
      sum + d.recommendation.potentialSavings, 0
    );
    
    return {
      totalFilesScanned: allFiles.length,
      exactDuplicates,
      similarFiles: similarFiles.slice(0, 100),
      potentialSavings,
      deviceSummary,
      generatedAt: new Date(),
    };
  }

  private generateRecommendation(files: DeviceFile[]): DuplicateRecommendation {
    const sorted = [...files].sort((a, b) => {
      if (this.retentionPolicy.preferNewest) {
        const timeDiff = b.modifiedAt.getTime() - a.modifiedAt.getTime();
        if (Math.abs(timeDiff) > 86400000) return timeDiff;
      }
      
      if (this.retentionPolicy.preferMostAccessed) {
        const accessDiff = (b.accessCount || 0) - (a.accessCount || 0);
        if (accessDiff !== 0) return accessDiff;
      }
      
      if (this.retentionPolicy.preferShortestPath) {
        return a.filePath.length - b.filePath.length;
      }
      
      if (this.retentionPolicy.preferDevice) {
        if (a.deviceId === this.retentionPolicy.preferDevice) return -1;
        if (b.deviceId === this.retentionPolicy.preferDevice) return 1;
      }
      
      return 0;
    });
    
    const keepFile = sorted[0];
    const deleteFiles = sorted.slice(1).filter(f => 
      !this.isProtectedPath(f.filePath)
    );
    
    const reasons: string[] = [];
    if (this.retentionPolicy.preferNewest && keepFile.modifiedAt >= sorted[1]?.modifiedAt) {
      reasons.push('最新修改');
    }
    if (this.retentionPolicy.preferShortestPath && keepFile.filePath.length <= sorted[1]?.filePath.length) {
      reasons.push('路径最短');
    }
    
    return {
      keepFile,
      deleteFiles,
      reason: `保留原因: ${reasons.join(', ') || '默认策略'}`,
      confidence: this.calculateConfidence(sorted),
      potentialSavings: deleteFiles.reduce((sum, f) => sum + f.fileSize, 0),
    };
  }

  private sortByRetentionPolicy(files: FileMetadata[]): FileMetadata[] {
    return [...files].sort((a, b) => {
      if (this.retentionPolicy.preferNewest) {
        const timeDiff = b.modifiedAt.getTime() - a.modifiedAt.getTime();
        if (Math.abs(timeDiff) > 86400000) return timeDiff;
      }
      
      const accessDiff = b.accessedAt.getTime() - a.accessedAt.getTime();
      if (Math.abs(accessDiff) > 86400000) return accessDiff;
      
      if (this.retentionPolicy.preferShortestPath) {
        return a.filePath.length - b.filePath.length;
      }
      
      return a.fileName.length - b.fileName.length;
    });
  }

  private calculateSimilarity(file1: FileMetadata, file2: FileMetadata): { score: number; type: SimilarityMatch['matchType'] } {
    const nameSim = this.calculateStringSimilarity(
      this.normalizeFileName(file1.fileName),
      this.normalizeFileName(file2.fileName)
    );
    
    const sizeSim = 1 - Math.abs(file1.fileSize - file2.fileSize) / Math.max(file1.fileSize, file2.fileSize, 1);
    
    const extMatch = this.getExtension(file1.fileName) === this.getExtension(file2.fileName);
    
    if (nameSim > 0.9) {
      return { score: nameSim, type: 'name' };
    }
    
    if (sizeSim > 0.99 && extMatch) {
      return { score: sizeSim, type: 'size' };
    }
    
    const combined = (nameSim * 0.6 + sizeSim * 0.3 + (extMatch ? 0.1 : 0));
    return { score: combined, type: 'combined' };
  }

  private calculateStringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longerLength - editDistance) / longerLength;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[s2.length][s1.length];
  }

  private normalizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\([0-9]+\)/g, '')
      .replace(/-\s*副本/g, '')
      .replace(/\s*copy\s*\d*/gi, '')
      .replace(/[-_]\d+(?=\.[^.]+$)/, '')
      .replace(/\s+/g, '')
      .replace(/\.[^.]+$/, '');
  }

  private getExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';
  }

  private getSimilaritySuggestion(
    file1: FileMetadata, 
    file2: FileMetadata, 
    similarity: { score: number; type: string }
  ): string {
    switch (similarity.type) {
      case 'name':
        return `文件名高度相似 (${Math.round(similarity.score * 100)}%)，可能是副本`;
      case 'size':
        return '文件大小完全一致，可能是重复文件';
      case 'combined':
        return '综合相似度较高，建议人工确认';
      default:
        return '可能存在关联';
    }
  }

  private calculateConfidence(files: DeviceFile[]): number {
    if (files.length <= 1) return 1;
    
    const timeDiffs = files.slice(1).map(f => 
      Math.abs(files[0].modifiedAt.getTime() - f.modifiedAt.getTime())
    );
    const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    
    if (avgTimeDiff < 60000) return 0.6;
    if (avgTimeDiff < 86400000) return 0.8;
    return 0.95;
  }

  private isProtectedPath(path: string): boolean {
    return this.retentionPolicy.protectedPaths.some(p => 
      path.toLowerCase().includes(p.toLowerCase())
    );
  }

  setRetentionPolicy(policy: Partial<RetentionPolicy>): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };
  }

  getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }

  clearIndex(): void {
    this.fileIndex.clear();
  }

  getIndexStats(): { totalHashes: number; totalFiles: number; duplicateHashes: number } {
    let totalFiles = 0;
    let duplicateHashes = 0;
    
    const values = Array.from(this.fileIndex.values());
    for (const files of values) {
      totalFiles += files.length;
      if (files.length > 1) duplicateHashes++;
    }
    
    return {
      totalHashes: this.fileIndex.size,
      totalFiles,
      duplicateHashes,
    };
  }
}

export const dedupEngine = new DedupEngine();
