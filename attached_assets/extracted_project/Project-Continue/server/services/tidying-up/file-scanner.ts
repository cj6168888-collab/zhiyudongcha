import type { FileMetadata, ScanResult, DuplicateGroup, HotColdAnalysis } from './types';
import { classifyFile } from './classification-rules';
import crypto from 'crypto';

export interface ScanRequest {
  deviceId: string;
  scanPath: string;
  files: RemoteFileInfo[];
}

export interface RemoteFileInfo {
  fileName: string;
  filePath: string;
  fileSize: number;
  createdAt: string;
  modifiedAt: string;
  accessedAt: string;
  fileHash?: string;
}

export class FileScanner {
  async processScanResult(request: ScanRequest): Promise<ScanResult> {
    const files: FileMetadata[] = request.files.map(f => ({
      fileName: f.fileName,
      filePath: f.filePath,
      fileType: this.getFileType(f.fileName),
      fileSize: f.fileSize,
      createdAt: new Date(f.createdAt),
      modifiedAt: new Date(f.modifiedAt),
      accessedAt: new Date(f.accessedAt),
      deviceId: request.deviceId,
      fileHash: f.fileHash,
    }));
    
    return {
      files,
      totalSize: files.reduce((sum, f) => sum + f.fileSize, 0),
      totalCount: files.length,
      scanTime: new Date(),
      deviceId: request.deviceId,
      scanPath: request.scanPath,
    };
  }
  
  private getFileType(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : 'unknown';
  }
  
  findDuplicates(files: FileMetadata[]): DuplicateGroup[] {
    const hashGroups = new Map<string, FileMetadata[]>();
    
    for (const file of files) {
      if (!file.fileHash) continue;
      
      const existing = hashGroups.get(file.fileHash) || [];
      existing.push(file);
      hashGroups.set(file.fileHash, existing);
    }
    
    const duplicates: DuplicateGroup[] = [];
    
    const hashKeys = Array.from(hashGroups.keys());
    for (const hash of hashKeys) {
      const group = hashGroups.get(hash)!;
      if (group.length > 1) {
        const sorted = group.sort((a: FileMetadata, b: FileMetadata) => {
          if (a.accessedAt.getTime() !== b.accessedAt.getTime()) {
            return b.accessedAt.getTime() - a.accessedAt.getTime();
          }
          return a.fileName.length - b.fileName.length;
        });
        
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
  
  findSimilarNames(files: FileMetadata[]): Map<string, FileMetadata[]> {
    const groups = new Map<string, FileMetadata[]>();
    
    for (const file of files) {
      const baseName = this.getBaseName(file.fileName);
      const existing = groups.get(baseName) || [];
      existing.push(file);
      groups.set(baseName, existing);
    }
    
    const result = new Map<string, FileMetadata[]>();
    const groupKeys = Array.from(groups.keys());
    for (const name of groupKeys) {
      const group = groups.get(name)!;
      if (group.length > 1) {
        result.set(name, group);
      }
    }
    
    return result;
  }
  
  private getBaseName(fileName: string): string {
    return fileName
      .replace(/\([0-9]+\)/g, '')
      .replace(/-\s*副本/g, '')
      .replace(/\s*copy\s*\d*/gi, '')
      .replace(/[-_]\d+(?=\.[^.]+$)/, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  }
  
  analyzeHotCold(files: FileMetadata[], coldThresholdDays: number = 90): HotColdAnalysis {
    const now = new Date();
    const threshold = new Date(now.getTime() - coldThresholdDays * 24 * 60 * 60 * 1000);
    
    const hotFiles: FileMetadata[] = [];
    const coldFiles: FileMetadata[] = [];
    
    for (const file of files) {
      if (file.accessedAt >= threshold) {
        hotFiles.push(file);
      } else {
        coldFiles.push(file);
      }
    }
    
    const recommendations = coldFiles.map(file => {
      const daysSinceAccess = Math.floor((now.getTime() - file.accessedAt.getTime()) / (24 * 60 * 60 * 1000));
      const category = classifyFile(file);
      
      let action: 'ARCHIVE' | 'DELETE' | 'KEEP' | 'MOVE' = 'ARCHIVE';
      let reason = '';
      
      if (category === 'TEMP') {
        action = 'DELETE';
        reason = `临时文件，${daysSinceAccess}天未访问`;
      } else if (daysSinceAccess > 365) {
        action = 'ARCHIVE';
        reason = `超过一年未访问，建议归档`;
      } else if (daysSinceAccess > 180) {
        action = 'ARCHIVE';
        reason = `半年未访问，建议归档`;
      } else {
        action = 'KEEP';
        reason = `${daysSinceAccess}天未访问，暂时保留`;
      }
      
      return {
        action,
        reason,
        daysSinceAccess,
        targetPath: action === 'ARCHIVE' ? `Archive/${new Date().getFullYear()}/${category}` : undefined,
      };
    });
    
    return {
      hotFiles: hotFiles.sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime()),
      coldFiles: coldFiles.sort((a, b) => a.accessedAt.getTime() - b.accessedAt.getTime()),
      threshold: coldThresholdDays,
      coldThresholdDays,
      recommendations,
    };
  }
  
  generateFileHash(content: Buffer): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  getStatistics(files: FileMetadata[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const file of files) {
      const category = classifyFile(file);
      stats[category] = (stats[category] || 0) + 1;
    }
    
    return stats;
  }
  
  getSizeStatistics(files: FileMetadata[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const file of files) {
      const category = classifyFile(file);
      stats[category] = (stats[category] || 0) + file.fileSize;
    }
    
    return stats;
  }
}

export const fileScanner = new FileScanner();
