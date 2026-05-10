/**
 * RAG知识库增强服务 - Phase 9.1
 * 
 * 功能：
 * 1. 向量化存储 - 使用DashScope文本嵌入
 * 2. 语义检索 - 余弦相似度搜索
 * 3. 混合检索 - 关键词 + 语义结合
 * 4. 知识分块 - 智能文本分割
 * 5. 缓存优化 - 嵌入向量缓存
 * 6. 来源追踪 - 引用和来源管理
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RagKnowledge');

import { EventEmitter } from 'events';
import crypto from 'crypto';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const EMBEDDING_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings';

export interface KnowledgeChunk {
  id: string;
  content: string;
  embedding: number[];
  source: string;
  sourceType: 'document' | 'webpage' | 'conversation' | 'manual' | 'system';
  category?: string;
  tags?: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface SearchResult {
  chunk: KnowledgeChunk;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface RAGConfig {
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  minScore: number;
  hybridWeight: number;  // 0-1, semantic weight
  cacheEnabled: boolean;
  maxCacheSize: number;
}

const DEFAULT_CONFIG: RAGConfig = {
  embeddingModel: 'text-embedding-v3',
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  minScore: 0.6,
  hybridWeight: 0.7,
  cacheEnabled: true,
  maxCacheSize: 10000,
};

function generateChunkId(): string {
  return 'chunk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [RAG] ${message}`);
}

class RAGKnowledgeService extends EventEmitter {
  private chunks: Map<string, KnowledgeChunk> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();
  private config: RAGConfig;

  constructor(config: Partial<RAGConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log('RAG知识库服务已初始化 (Phase 9.1)');
  }

  async addDocument(
    content: string,
    source: string,
    options: {
      sourceType?: KnowledgeChunk['sourceType'];
      category?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string[]> {
    const chunks = this.splitIntoChunks(content);
    const chunkIds: string[] = [];

    log(`添加文档: ${source}, ${chunks.length}个块`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const embedding = await this.getEmbedding(chunkContent);
      
      if (!embedding) {
        log(`警告: 块 ${i} 嵌入失败`);
        continue;
      }

      const chunk: KnowledgeChunk = {
        id: generateChunkId(),
        content: chunkContent,
        embedding,
        source,
        sourceType: options.sourceType || 'document',
        category: options.category,
        tags: options.tags,
        metadata: {
          ...options.metadata,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.chunks.set(chunk.id, chunk);
      chunkIds.push(chunk.id);
    }

    this.emit('document_added', { source, chunks: chunkIds.length });
    return chunkIds;
  }

  async addChunk(
    content: string,
    source: string,
    options: {
      sourceType?: KnowledgeChunk['sourceType'];
      category?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string | null> {
    const embedding = await this.getEmbedding(content);
    
    if (!embedding) {
      return null;
    }

    const chunk: KnowledgeChunk = {
      id: generateChunkId(),
      content,
      embedding,
      source,
      sourceType: options.sourceType || 'manual',
      category: options.category,
      tags: options.tags,
      metadata: options.metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.chunks.set(chunk.id, chunk);
    return chunk.id;
  }

  async search(
    query: string,
    options: {
      topK?: number;
      minScore?: number;
      sourceType?: KnowledgeChunk['sourceType'];
      category?: string;
      tags?: string[];
      hybridSearch?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const topK = options.topK ?? this.config.topK;
    const minScore = options.minScore ?? this.config.minScore;
    const useHybrid = options.hybridSearch ?? true;

    const queryEmbedding = await this.getEmbedding(query);
    if (!queryEmbedding) {
      log('查询嵌入失败');
      return [];
    }

    // 语义搜索
    const semanticResults = this.semanticSearch(queryEmbedding, topK * 2, options);
    
    // 关键词搜索
    const keywordResults = useHybrid ? this.keywordSearch(query, topK * 2, options) : [];

    // 合并结果（混合搜索）
    let results: SearchResult[];
    if (useHybrid && keywordResults.length > 0) {
      results = this.mergeResults(semanticResults, keywordResults, this.config.hybridWeight);
    } else {
      results = semanticResults;
    }

    // 过滤和排序
    return results
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private semanticSearch(
    queryEmbedding: number[],
    limit: number,
    filters: {
      sourceType?: KnowledgeChunk['sourceType'];
      category?: string;
      tags?: string[];
    }
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const chunks = Array.from(this.chunks.values());

    for (const chunk of chunks) {
      // 应用过滤器
      if (filters.sourceType && chunk.sourceType !== filters.sourceType) continue;
      if (filters.category && chunk.category !== filters.category) continue;
      if (filters.tags?.length) {
        const hasTag = filters.tags.some(tag => chunk.tags?.includes(tag));
        if (!hasTag) continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      results.push({
        chunk,
        score,
        matchType: 'semantic',
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private keywordSearch(
    query: string,
    limit: number,
    filters: {
      sourceType?: KnowledgeChunk['sourceType'];
      category?: string;
      tags?: string[];
    }
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const queryTerms = this.tokenize(query);
    const chunks = Array.from(this.chunks.values());

    for (const chunk of chunks) {
      // 应用过滤器
      if (filters.sourceType && chunk.sourceType !== filters.sourceType) continue;
      if (filters.category && chunk.category !== filters.category) continue;
      if (filters.tags?.length) {
        const hasTag = filters.tags.some(tag => chunk.tags?.includes(tag));
        if (!hasTag) continue;
      }

      const contentTerms = this.tokenize(chunk.content);
      const score = this.bm25Score(queryTerms, contentTerms);
      
      if (score > 0) {
        results.push({
          chunk,
          score,
          matchType: 'keyword',
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private mergeResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    semanticWeight: number
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();
    const keywordWeight = 1 - semanticWeight;

    // 归一化语义分数
    const maxSemantic = Math.max(...semanticResults.map(r => r.score), 0.001);
    for (const result of semanticResults) {
      const normalizedScore = result.score / maxSemantic;
      merged.set(result.chunk.id, {
        ...result,
        score: normalizedScore * semanticWeight,
        matchType: 'hybrid',
      });
    }

    // 归一化关键词分数并合并
    const maxKeyword = Math.max(...keywordResults.map(r => r.score), 0.001);
    for (const result of keywordResults) {
      const normalizedScore = result.score / maxKeyword;
      const existing = merged.get(result.chunk.id);
      
      if (existing) {
        existing.score += normalizedScore * keywordWeight;
      } else {
        merged.set(result.chunk.id, {
          ...result,
          score: normalizedScore * keywordWeight,
          matchType: 'hybrid',
        });
      }
    }

    return Array.from(merged.values());
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private bm25Score(queryTerms: string[], docTerms: string[]): number {
    const k1 = 1.5;
    const b = 0.75;
    const avgDocLength = 100; // 简化假设
    
    const docTermSet = new Set(docTerms);
    const docLength = docTerms.length;
    let score = 0;

    for (const term of queryTerms) {
      if (!docTermSet.has(term)) continue;
      
      const termFreq = docTerms.filter(t => t === term).length;
      const idf = Math.log((this.chunks.size - 1 + 0.5) / (1 + 0.5));
      
      const numerator = termFreq * (k1 + 1);
      const denominator = termFreq + k1 * (1 - b + b * (docLength / avgDocLength));
      
      score += idf * (numerator / denominator);
    }

    return score;
  }

  private tokenize(text: string): string[] {
    // 简单的中英文分词
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  private splitIntoChunks(text: string): string[] {
    const { chunkSize, chunkOverlap } = this.config;
    const chunks: string[] = [];
    
    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length <= chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // 如果单段落太长，进一步分割
        if (para.length > chunkSize) {
          const subChunks = this.splitLongParagraph(para);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = para;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private splitLongParagraph(text: string): string[] {
    const { chunkSize, chunkOverlap } = this.config;
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      
      // 尝试在句子边界分割
      if (end < text.length) {
        const lastPunctuation = text.slice(start, end).lastIndexOf('。');
        if (lastPunctuation > chunkSize / 2) {
          end = start + lastPunctuation + 1;
        }
      }

      chunks.push(text.slice(start, end));
      start = end - chunkOverlap;
    }

    return chunks;
  }

  private async getEmbedding(text: string): Promise<number[] | null> {
    // 检查缓存
    const hash = hashContent(text);
    if (this.config.cacheEnabled && this.embeddingCache.has(hash)) {
      return this.embeddingCache.get(hash)!;
    }

    if (!DASHSCOPE_API_KEY) {
      log('警告: DASHSCOPE_API_KEY 未配置');
      return null;
    }

    try {
      const response = await fetch(EMBEDDING_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`嵌入API错误: ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;

      if (!embedding) {
        throw new Error('无效的嵌入响应');
      }

      // 缓存
      if (this.config.cacheEnabled) {
        if (this.embeddingCache.size >= this.config.maxCacheSize) {
          // 简单的LRU策略：删除第一个
          const firstKey = this.embeddingCache.keys().next().value;
          if (firstKey) {
            this.embeddingCache.delete(firstKey);
          }
        }
        this.embeddingCache.set(hash, embedding);
      }

      return embedding;

    } catch (error) {
      log(`嵌入错误: ${error}`);
      return null;
    }
  }

  deleteChunk(chunkId: string): boolean {
    return this.chunks.delete(chunkId);
  }

  deleteBySource(source: string): number {
    let deleted = 0;
    const chunks = Array.from(this.chunks.entries());
    
    for (const [id, chunk] of chunks) {
      if (chunk.source === source) {
        this.chunks.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  getChunk(chunkId: string): KnowledgeChunk | undefined {
    return this.chunks.get(chunkId);
  }

  getChunksBySource(source: string): KnowledgeChunk[] {
    return Array.from(this.chunks.values()).filter(c => c.source === source);
  }

  getStats(): {
    totalChunks: number;
    bySourceType: Record<string, number>;
    byCategory: Record<string, number>;
    cacheSize: number;
    avgEmbeddingDim: number;
  } {
    const chunks = Array.from(this.chunks.values());
    const bySourceType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalEmbeddingDim = 0;

    for (const chunk of chunks) {
      bySourceType[chunk.sourceType] = (bySourceType[chunk.sourceType] || 0) + 1;
      if (chunk.category) {
        byCategory[chunk.category] = (byCategory[chunk.category] || 0) + 1;
      }
      totalEmbeddingDim += chunk.embedding.length;
    }

    return {
      totalChunks: chunks.length,
      bySourceType,
      byCategory,
      cacheSize: this.embeddingCache.size,
      avgEmbeddingDim: chunks.length > 0 ? Math.round(totalEmbeddingDim / chunks.length) : 0,
    };
  }

  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
    log(`配置已更新: ${JSON.stringify(config)}`);
  }

  getConfig(): RAGConfig {
    return { ...this.config };
  }

  clearCache(): void {
    this.embeddingCache.clear();
    log('嵌入缓存已清除');
  }

  clearAll(): void {
    this.chunks.clear();
    this.embeddingCache.clear();
    log('所有知识已清除');
  }
}

export const ragKnowledgeService = new RAGKnowledgeService();
logger.info('[RAG] 知识库增强服务 v1.0 已加载 (Phase 9.1)');
