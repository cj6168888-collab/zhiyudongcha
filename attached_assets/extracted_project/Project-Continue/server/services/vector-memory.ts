/**
 * 小智 Vector Memory - 向量记忆系统
 * 
 * 功能：
 * 1. 长期记忆存储（使用向量嵌入）
 * 2. 相似性检索（找到相关历史）
 * 3. 决策DNA学习（记录并复用成功模式）
 * 
 * 实现方式：
 * - 使用PostgreSQL + 余弦相似度（简单实现）
 * - 预留pgvector扩展接口
 */

import { db } from '../db';
import { shadowMemories, persons, vaultItems } from '@shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

export interface MemoryVector {
  embedding: number[];
  dimensions: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  category: 'decision' | 'interaction' | 'learning' | 'pattern';
  embedding?: number[];
  weight: number;
  context?: Record<string, any>;
  createdAt: Date;
}

export interface SearchResult {
  entry: MemoryEntry;
  similarity: number;
  relevanceScore: number;
}

export interface VectorMemoryConfig {
  embeddingDimensions: number;
  maxResults: number;
  similarityThreshold: number;
  decayFactor: number;
}

const DEFAULT_CONFIG: VectorMemoryConfig = {
  embeddingDimensions: 384,
  maxResults: 10,
  similarityThreshold: 0.7,
  decayFactor: 0.95,
};

function simpleTextToVector(text: string, dimensions: number = 384): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash = hash & hash;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1;
  }
  
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map(v => v / norm);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

class VectorMemoryService {
  private config: VectorMemoryConfig;
  private memoryCache: Map<string, MemoryEntry> = new Map();
  
  constructor(config?: Partial<VectorMemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  async storeMemory(
    content: string,
    category: MemoryEntry['category'],
    contextData?: Record<string, any>,
    weight: number = 1.0
  ): Promise<string> {
    try {
      const [result] = await db.insert(shadowMemories).values({
        context: contextData ? JSON.stringify(contextData) : content,
        choiceMade: content,
        field: category,
        mimicryWeight: weight,
        expPoints: 0,
      }).returning({ id: shadowMemories.id });
      
      this.memoryCache.set(result.id, {
        id: result.id,
        content,
        category,
        embedding: simpleTextToVector(content, this.config.embeddingDimensions),
        weight,
        context: contextData,
        createdAt: new Date(),
      });
      
      console.log(`[VectorMemory] Stored memory #${result.id}: ${content.slice(0, 50)}...`);
      return result.id;
      
    } catch (error) {
      console.error('[VectorMemory] Failed to store memory:', error);
      throw error;
    }
  }
  
  async searchSimilar(
    query: string,
    category?: MemoryEntry['category'],
    limit?: number
  ): Promise<SearchResult[]> {
    const queryVector = simpleTextToVector(query, this.config.embeddingDimensions);
    const maxResults = limit || this.config.maxResults;
    
    try {
      const conditions: ReturnType<typeof eq>[] = [];
      if (category) {
        conditions.push(eq(shadowMemories.field, category));
      }
      
      const memories = await db.select()
        .from(shadowMemories)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(shadowMemories.createdAt))
        .limit(100);
      
      const results: SearchResult[] = [];
      
      for (const mem of memories) {
        const memContent = mem.choiceMade || '';
        const memVector = simpleTextToVector(memContent, this.config.embeddingDimensions);
        const similarity = cosineSimilarity(queryVector, memVector);
        
        if (similarity >= this.config.similarityThreshold) {
          const weight = mem.mimicryWeight || 1.0;
          let parsedContext: Record<string, any> | undefined;
          
          try {
            if (mem.context) {
              parsedContext = JSON.parse(mem.context);
            }
          } catch {
            parsedContext = { raw: mem.context };
          }
          
          results.push({
            entry: {
              id: mem.id,
              content: memContent,
              category: (mem.field as MemoryEntry['category']) || 'learning',
              embedding: memVector,
              weight,
              context: parsedContext,
              createdAt: mem.createdAt || new Date(),
            },
            similarity,
            relevanceScore: similarity * weight,
          });
        }
      }
      
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return results.slice(0, maxResults);
      
    } catch (error) {
      console.error('[VectorMemory] Search failed:', error);
      return [];
    }
  }
  
  async updateWeight(memoryId: string, newWeight: number): Promise<boolean> {
    try {
      await db.update(shadowMemories)
        .set({ mimicryWeight: newWeight })
        .where(eq(shadowMemories.id, memoryId));
      
      const cached = this.memoryCache.get(memoryId);
      if (cached) {
        cached.weight = newWeight;
      }
      
      return true;
    } catch (error) {
      console.error('[VectorMemory] Failed to update weight:', error);
      return false;
    }
  }
  
  async reinforce(memoryId: string, positive: boolean): Promise<void> {
    const cached = this.memoryCache.get(memoryId);
    const currentWeight = cached?.weight || 1.0;
    
    const delta = positive ? 0.1 : -0.1;
    const newWeight = Math.max(0.1, Math.min(2.0, currentWeight + delta));
    
    await this.updateWeight(memoryId, newWeight);
    console.log(`[VectorMemory] Reinforced #${memoryId}: ${currentWeight.toFixed(2)} -> ${newWeight.toFixed(2)}`);
  }
  
  async applyDecay(): Promise<number> {
    try {
      const memories = await db.select()
        .from(shadowMemories)
        .where(sql`${shadowMemories.mimicryWeight} > 0.1`);
      
      let decayed = 0;
      for (const mem of memories) {
        const currentWeight = mem.mimicryWeight || 1.0;
        const newWeight = currentWeight * this.config.decayFactor;
        
        if (newWeight < currentWeight - 0.01) {
          await this.updateWeight(mem.id, newWeight);
          decayed++;
        }
      }
      
      console.log(`[VectorMemory] Applied decay to ${decayed} memories`);
      return decayed;
      
    } catch (error) {
      console.error('[VectorMemory] Decay failed:', error);
      return 0;
    }
  }
  
  async getDecisionDNA(domain: string): Promise<SearchResult[]> {
    return this.searchSimilar(domain, 'decision', 5);
  }
  
  async recordDecisionPattern(
    situation: string,
    decision: string,
    outcome: 'success' | 'failure' | 'neutral',
    context?: Record<string, any>
  ): Promise<string> {
    const content = `情境: ${situation}\n决策: ${decision}\n结果: ${outcome}`;
    const weight = outcome === 'success' ? 1.2 : outcome === 'failure' ? 0.5 : 1.0;
    
    return this.storeMemory(content, 'decision', {
      ...context,
      situation,
      decision,
      outcome,
    }, weight);
  }
  
  async getStats(): Promise<{
    totalMemories: number;
    byCategory: Record<string, number>;
    avgWeight: number;
  }> {
    try {
      const memories = await db.select().from(shadowMemories);
      
      const byCategory: Record<string, number> = {};
      let totalWeight = 0;
      
      for (const mem of memories) {
        const cat = mem.field || 'unknown';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        totalWeight += mem.mimicryWeight || 1.0;
      }
      
      return {
        totalMemories: memories.length,
        byCategory,
        avgWeight: memories.length > 0 ? totalWeight / memories.length : 0,
      };
      
    } catch (error) {
      console.error('[VectorMemory] Stats failed:', error);
      return { totalMemories: 0, byCategory: {}, avgWeight: 0 };
    }
  }
}

export const vectorMemory = new VectorMemoryService();

export { VectorMemoryService, simpleTextToVector, cosineSimilarity };
