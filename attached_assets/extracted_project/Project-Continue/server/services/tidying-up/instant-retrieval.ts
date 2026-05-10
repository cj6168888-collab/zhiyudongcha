/**
 * 断舍离协议 - 即时调用模块
 * 
 * 功能：
 * 1. 语音/文字提及时快速检索相关文件
 * 2. 基于语义匹配找到相关文件
 * 3. 支持模糊搜索和智能联想
 * 4. 实时弹窗展示搜索结果
 */

import type { FileMetadata } from './types';
import { db } from '../../db';
import { fileScanCache } from '@shared/schema';
import { eq, like, sql, or, desc } from 'drizzle-orm';

export interface RetrievalQuery {
  text: string;
  deviceId?: string;
  context?: string;
  maxResults?: number;
  includeArchived?: boolean;
}

export interface RetrievalResult {
  file: FileMetadata;
  matchScore: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'context';
  highlights: string[];
  previewPath?: string;
}

export interface RetrievalResponse {
  query: string;
  results: RetrievalResult[];
  suggestions: string[];
  searchTime: number;
  totalMatches: number;
}

export interface FileIndex {
  filePath: string;
  fileName: string;
  keywords: string[];
  category: string;
  lastAccessed: Date;
  deviceId: string;
  content?: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'file' | 'folder' | 'category' | 'recent';
  icon?: string;
}

export class InstantRetrieval {
  private searchIndex: Map<string, FileIndex> = new Map();
  private recentSearches: string[] = [];
  private maxRecentSearches: number = 10;

  async indexFile(file: FileMetadata, keywords?: string[]): Promise<void> {
    const key = `${file.deviceId}:${file.filePath}`;
    
    const derivedKeywords = this.extractKeywords(file.fileName);
    
    this.searchIndex.set(key, {
      filePath: file.filePath,
      fileName: file.fileName,
      keywords: [...derivedKeywords, ...(keywords || [])],
      category: this.guessCategory(file.fileName),
      lastAccessed: file.accessedAt,
      deviceId: file.deviceId,
    });
  }

  async indexFiles(files: FileMetadata[]): Promise<void> {
    for (const file of files) {
      await this.indexFile(file);
    }
    console.log(`[InstantRetrieval] Indexed ${files.length} files`);
  }

  async search(query: RetrievalQuery): Promise<RetrievalResponse> {
    const startTime = Date.now();
    const results: RetrievalResult[] = [];
    const queryLower = query.text.toLowerCase();
    const queryWords = this.tokenize(queryLower);
    
    this.addToRecentSearches(query.text);
    
    const indexEntries = Array.from(this.searchIndex.entries());
    for (const [key, fileIndex] of indexEntries) {
      if (query.deviceId && fileIndex.deviceId !== query.deviceId) {
        continue;
      }
      
      const match = this.calculateMatch(queryWords, fileIndex, queryLower);
      
      if (match.score > 0.1) {
        results.push({
          file: {
            fileName: fileIndex.fileName,
            filePath: fileIndex.filePath,
            fileType: this.getExtension(fileIndex.fileName),
            fileSize: 0,
            createdAt: new Date(),
            modifiedAt: new Date(),
            accessedAt: fileIndex.lastAccessed,
            deviceId: fileIndex.deviceId,
          },
          matchScore: match.score,
          matchType: match.type,
          highlights: match.highlights,
        });
      }
    }
    
    results.sort((a, b) => b.matchScore - a.matchScore);
    
    const maxResults = query.maxResults || 20;
    const topResults = results.slice(0, maxResults);
    
    const suggestions = this.generateSuggestions(query.text, results);
    
    return {
      query: query.text,
      results: topResults,
      suggestions,
      searchTime: Date.now() - startTime,
      totalMatches: results.length,
    };
  }

  async searchFromDatabase(query: RetrievalQuery): Promise<RetrievalResponse> {
    const startTime = Date.now();
    
    try {
      const searchPattern = `%${query.text}%`;
      
      const cached = await db
        .select()
        .from(fileScanCache)
        .where(
          or(
            like(fileScanCache.fileName, searchPattern),
            like(fileScanCache.filePath, searchPattern)
          )
        )
        .limit(query.maxResults || 20);
      
      const results: RetrievalResult[] = cached.map(row => ({
        file: {
          fileName: row.fileName,
          filePath: row.filePath,
          fileType: row.fileType || 'unknown',
          fileSize: row.fileSize || 0,
          createdAt: row.createdAtFile || new Date(),
          modifiedAt: row.modifiedAtFile || new Date(),
          accessedAt: row.accessedAtFile || new Date(),
          deviceId: row.deviceId,
          fileHash: row.fileHash || undefined,
        },
        matchScore: 0.8,
        matchType: 'fuzzy' as const,
        highlights: [query.text],
      }));
      
      return {
        query: query.text,
        results,
        suggestions: [],
        searchTime: Date.now() - startTime,
        totalMatches: results.length,
      };
    } catch (error) {
      console.error('[InstantRetrieval] Database search failed:', error);
      return this.search(query);
    }
  }

  async findRelatedFiles(filePath: string, deviceId: string): Promise<RetrievalResult[]> {
    const key = `${deviceId}:${filePath}`;
    const sourceFile = this.searchIndex.get(key);
    
    if (!sourceFile) {
      return [];
    }
    
    const results: RetrievalResult[] = [];
    const sourceWords = this.tokenize(sourceFile.fileName.toLowerCase());
    
    const indexEntries = Array.from(this.searchIndex.entries());
    for (const [k, fileIndex] of indexEntries) {
      if (k === key) continue;
      if (fileIndex.deviceId !== deviceId) continue;
      
      let score = 0;
      const highlights: string[] = [];
      
      if (fileIndex.category === sourceFile.category) {
        score += 0.3;
        highlights.push(`同类别: ${fileIndex.category}`);
      }
      
      const dir1 = this.getDirectory(sourceFile.filePath);
      const dir2 = this.getDirectory(fileIndex.filePath);
      if (dir1 === dir2) {
        score += 0.2;
        highlights.push('同目录');
      }
      
      const targetWords = this.tokenize(fileIndex.fileName.toLowerCase());
      const commonWords = sourceWords.filter(w => targetWords.includes(w));
      if (commonWords.length > 0) {
        score += 0.3 * (commonWords.length / Math.max(sourceWords.length, targetWords.length));
        highlights.push(`共同关键词: ${commonWords.join(', ')}`);
      }
      
      const timeDiff = Math.abs(
        sourceFile.lastAccessed.getTime() - fileIndex.lastAccessed.getTime()
      );
      if (timeDiff < 24 * 60 * 60 * 1000) {
        score += 0.1;
        highlights.push('同时使用');
      }
      
      if (score > 0.2) {
        results.push({
          file: {
            fileName: fileIndex.fileName,
            filePath: fileIndex.filePath,
            fileType: this.getExtension(fileIndex.fileName),
            fileSize: 0,
            createdAt: new Date(),
            modifiedAt: new Date(),
            accessedAt: fileIndex.lastAccessed,
            deviceId: fileIndex.deviceId,
          },
          matchScore: score,
          matchType: 'context',
          highlights,
        });
      }
    }
    
    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);
  }

  async autocomplete(prefix: string, deviceId?: string): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const prefixLower = prefix.toLowerCase();
    
    const recentMatches = this.recentSearches
      .filter(s => s.toLowerCase().startsWith(prefixLower))
      .map(s => ({ text: s, type: 'recent' as const, icon: '🕐' }));
    suggestions.push(...recentMatches.slice(0, 3));
    
    const indexEntries = Array.from(this.searchIndex.values());
    const fileMatches = indexEntries
      .filter(f => {
        if (deviceId && f.deviceId !== deviceId) return false;
        return f.fileName.toLowerCase().includes(prefixLower);
      })
      .slice(0, 5)
      .map(f => ({
        text: f.fileName,
        type: 'file' as const,
        icon: this.getFileIcon(f.fileName),
      }));
    suggestions.push(...fileMatches);
    
    const categories = new Set(indexEntries.map(f => f.category));
    const categoryMatches = Array.from(categories)
      .filter(c => c.toLowerCase().includes(prefixLower))
      .map(c => ({ text: c, type: 'category' as const, icon: '📁' }));
    suggestions.push(...categoryMatches.slice(0, 3));
    
    return suggestions;
  }

  getRecentSearches(): string[] {
    return [...this.recentSearches];
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
  }

  private calculateMatch(
    queryWords: string[],
    fileIndex: FileIndex,
    queryLower: string
  ): { score: number; type: RetrievalResult['matchType']; highlights: string[] } {
    const fileNameLower = fileIndex.fileName.toLowerCase();
    const highlights: string[] = [];
    let score = 0;
    let matchType: RetrievalResult['matchType'] = 'fuzzy';
    
    if (fileNameLower === queryLower) {
      score = 1.0;
      matchType = 'exact';
      highlights.push(`精确匹配: ${fileIndex.fileName}`);
      return { score, type: matchType, highlights };
    }
    
    if (fileNameLower.includes(queryLower)) {
      score = 0.8;
      matchType = 'exact';
      highlights.push(`包含: "${queryLower}"`);
      return { score, type: matchType, highlights };
    }
    
    const fileWords = this.tokenize(fileNameLower);
    let matchedWords = 0;
    
    for (const qWord of queryWords) {
      if (fileWords.some(fWord => fWord.includes(qWord) || qWord.includes(fWord))) {
        matchedWords++;
        highlights.push(qWord);
      }
    }
    
    if (matchedWords > 0) {
      score = 0.5 * (matchedWords / queryWords.length);
      matchType = 'fuzzy';
    }
    
    const keywordMatches = fileIndex.keywords.filter(kw => 
      queryWords.some(qw => kw.includes(qw) || qw.includes(kw))
    );
    
    if (keywordMatches.length > 0) {
      score += 0.3 * (keywordMatches.length / fileIndex.keywords.length);
      highlights.push(`关键词: ${keywordMatches.join(', ')}`);
      if (matchType === 'fuzzy') matchType = 'semantic';
    }
    
    return { score, type: matchType, highlights };
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
  }

  private extractKeywords(fileName: string): string[] {
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const words = this.tokenize(baseName.toLowerCase());
    
    const keywords = new Set<string>();
    for (const word of words) {
      keywords.add(word);
    }
    
    return Array.from(keywords);
  }

  private guessCategory(fileName: string): string {
    const ext = this.getExtension(fileName).toLowerCase();
    
    const categoryMap: Record<string, string[]> = {
      '文档': ['doc', 'docx', 'pdf', 'txt', 'md', 'rtf', 'odt'],
      '表格': ['xls', 'xlsx', 'csv', 'numbers'],
      '演示': ['ppt', 'pptx', 'key'],
      '图片': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'],
      '视频': ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'],
      '音频': ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
      '代码': ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb'],
      '压缩': ['zip', 'rar', '7z', 'tar', 'gz'],
      '可执行': ['exe', 'dmg', 'app', 'msi', 'deb', 'rpm'],
    };
    
    for (const [category, extensions] of Object.entries(categoryMap)) {
      if (extensions.includes(ext)) {
        return category;
      }
    }
    
    return '其他';
  }

  private getExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.slice(lastDot + 1) : '';
  }

  private getDirectory(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
  }

  private getFileIcon(fileName: string): string {
    const ext = this.getExtension(fileName).toLowerCase();
    
    const iconMap: Record<string, string> = {
      pdf: '📕',
      doc: '📘', docx: '📘',
      xls: '📗', xlsx: '📗',
      ppt: '📙', pptx: '📙',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
      mp3: '🎵', wav: '🎵',
      mp4: '🎬', avi: '🎬', mov: '🎬',
      zip: '📦', rar: '📦', '7z': '📦',
      js: '📜', ts: '📜', py: '🐍',
      exe: '⚙️', app: '⚙️',
    };
    
    return iconMap[ext] || '📄';
  }

  private addToRecentSearches(query: string): void {
    const existing = this.recentSearches.indexOf(query);
    if (existing !== -1) {
      this.recentSearches.splice(existing, 1);
    }
    
    this.recentSearches.unshift(query);
    
    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches.pop();
    }
  }

  private generateSuggestions(query: string, results: RetrievalResult[]): string[] {
    const suggestions: string[] = [];
    
    if (results.length === 0) {
      const words = this.tokenize(query);
      for (const word of words) {
        suggestions.push(`尝试搜索: ${word}`);
      }
      suggestions.push('检查拼写或使用更短的关键词');
    } else {
      const categories = new Set(results.map(r => this.guessCategory(r.file.fileName)));
      const categoryArray = Array.from(categories);
      for (const cat of categoryArray) {
        suggestions.push(`筛选: ${cat}`);
      }
    }
    
    return suggestions.slice(0, 5);
  }

  getIndexSize(): number {
    return this.searchIndex.size;
  }

  clearIndex(): void {
    this.searchIndex.clear();
  }
}

export const instantRetrieval = new InstantRetrieval();
