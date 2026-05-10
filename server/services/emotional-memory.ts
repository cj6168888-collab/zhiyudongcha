/**
 * 小智 情感记忆服务 - "记得爸爸一切"的女儿
 *
 * 功能：
 * 1. 实时提取对话中的关键信息实体（喜好、健康、工作痛点）
 * 2. 使用DashScope text-embedding-v2生成向量并存入情感向量库
 * 3. 对话启动前优先检索过去7天的情感上下文
 * 4. 24小时内健康事件强制触发主动关怀
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('EmotionalMemory');

import { getDatabase } from '../db';
import { emotionalMemories, conversationEmotionalContext, proactiveCareRules } from '@shared/schema';
import type { EmotionalMemory, InsertEmotionalMemory, ProactiveCareRule } from '@shared/schema';
import { eq, desc, sql, and, gte, lte, or, like } from 'drizzle-orm';
import { getModulePrompt } from '../config/persona';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const EMBEDDING_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
const CHAT_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export type EntityType = 'PREFERENCE' | 'HEALTH' | 'WORK_PAIN' | 'HABIT' | 'RELATIONSHIP' | 'EVENT' | 'MOOD';

export interface ExtractedEntity {
  type: EntityType;
  key: string;
  value?: string;
  confidence: number;
  originalText: string;
  requiresFollowUp: boolean;
  followUpType?: 'HEALTH_CHECK' | 'REMINDER' | 'CELEBRATION' | 'MOOD_SUPPORT';
  emotionalWeight: number;
}

export interface ProactiveCareInstruction {
  type: string;
  message: string;
  priority: number;
  relatedMemory: EmotionalMemory;
  template: string;
}

export interface ConversationContext {
  recentMemories: EmotionalMemory[];
  proactiveCareInstructions: ProactiveCareInstruction[];
  dominantTopics: string[];
  emotionalTone: string;
}

const ENTITY_EXTRACTION_CONTEXT = `
请识别以下类型的实体：
1. PREFERENCE - 喜好（喜欢/不喜欢的食物、活动、事物）
2. HEALTH - 健康状况（生病、不舒服、疲劳、康复）
3. WORK_PAIN - 工作痛点（压力、困难、挑战、烦恼）
4. HABIT - 习惯（日常作息、行为模式）
5. RELATIONSHIP - 人际关系（家人、朋友、同事的信息）
6. EVENT - 重要事件（生日、纪念日、会议、约会）
7. MOOD - 情绪状态（开心、沮丧、焦虑、平静）

对于每个实体，评估：
- confidence: 0-1的置信度
- emotionalWeight: 0-2的情感重要性（健康问题通常是2，日常习惯通常是0.5）
- requiresFollowUp: 是否需要后续关怀（健康问题、重要事件需要）
- followUpType: HEALTH_CHECK（健康检查）, REMINDER（提醒）, CELEBRATION（庆祝）, MOOD_SUPPORT（情绪支持）

输入对话：
{conversation}

请以JSON数组格式输出提取的实体：
[
  {
    "type": "HEALTH",
    "key": "感冒",
    "value": "发烧38度",
    "confidence": 0.95,
    "originalText": "我今天感冒了，有点发烧",
    "requiresFollowUp": true,
    "followUpType": "HEALTH_CHECK",
    "emotionalWeight": 2.0
  }
]

只输出JSON数组，不要其他内容。如果没有可提取的实体，输出空数组 []`;

function buildEntityExtractionPrompt(role: 'MASTER' | 'GUEST' = 'MASTER'): string {
  return getModulePrompt('ENTITY_EXTRACTION', role, ENTITY_EXTRACTION_CONTEXT);
}

class EmotionalMemoryService {
  private embeddingCache: Map<string, number[]> = new Map();

  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.slice(0, 100);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    if (!DASHSCOPE_API_KEY) {
      logger.warn('[EmotionalMemory] No DashScope API key, using simple hash embedding');
      return this.simpleHashEmbedding(text);
    }

    try {
      const response = await fetch(EMBEDDING_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-v2',
          input: { texts: [text] },
          parameters: { text_type: 'document' },
        }),
      });

      const data = await response.json() as unknown;

      if (data.output?.embeddings?.[0]?.embedding) {
        const embedding = data.output.embeddings[0].embedding;
        this.embeddingCache.set(cacheKey, embedding);
        return embedding;
      }

      logger.warn('[EmotionalMemory] Embedding API failed, using fallback');
      return this.simpleHashEmbedding(text);
    } catch (error) {
      logger.error({ err: error }, '[EmotionalMemory] Embedding error');
      return this.simpleHashEmbedding(text);
    }
  }

  private simpleHashEmbedding(text: string, dimensions: number = 1536): number[] {
    const vector = new Array(dimensions).fill(0);
    const normalized = text.toLowerCase();

    for (let i = 0; i < normalized.length; i++) {
      const idx = (normalized.charCodeAt(i) * (i + 1)) % dimensions;
      vector[idx] += 1;
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map(v => v / norm);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  async extractEntities(conversation: string, userRole: 'MASTER' | 'GUEST' = 'MASTER'): Promise<ExtractedEntity[]> {
    if (!DASHSCOPE_API_KEY) {
      logger.warn('[EmotionalMemory] No API key, using pattern-based extraction');
      return this.patternBasedExtraction(conversation);
    }

    try {
      const prompt = buildEntityExtractionPrompt(userRole).replace('{conversation}', conversation);

      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: { messages: [{ role: 'user', content: prompt }] },
          parameters: { result_format: 'message', temperature: 0.1 },
        }),
      });

      const data = await response.json() as unknown;
      const content = data.output?.choices?.[0]?.message?.content || '[]';

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const entities = JSON.parse(jsonMatch[0]) as ExtractedEntity[];
        logger.info(`[EmotionalMemory] Extracted ${entities.length} entities from conversation`);
        return entities;
      }

      return [];
    } catch (error) {
      logger.error({ err: error }, '[EmotionalMemory] Entity extraction error');
      return this.patternBasedExtraction(conversation);
    }
  }

  private patternBasedExtraction(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    const healthPatterns = [
      { pattern: /感冒|发烧|咳嗽|头疼|头痛|不舒服|生病|肚子疼/g, key: '身体不适' },
      { pattern: /累|疲劳|困|睡不着|失眠/g, key: '疲劳' },
      { pattern: /好多了|康复|痊愈|好了/g, key: '康复' },
    ];

    const preferencePatterns = [
      { pattern: /喜欢(吃|喝|看|玩|听)?(.{1,10})/g, key: '喜欢' },
      { pattern: /不喜欢|讨厌|不爱(.{1,10})/g, key: '不喜欢' },
    ];

    const workPatterns = [
      { pattern: /压力(大|很大)|焦虑|烦躁|项目(难|困难)|加班/g, key: '工作压力' },
      { pattern: /开会|会议|deadline|截止|汇报/g, key: '工作事项' },
    ];

    for (const { pattern, key } of healthPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.push({
          type: 'HEALTH',
          key,
          value: matches[0],
          confidence: 0.8,
          originalText: text.slice(0, 100),
          requiresFollowUp: true,
          followUpType: 'HEALTH_CHECK',
          emotionalWeight: 2.0,
        });
      }
    }

    for (const { pattern, key } of preferencePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.push({
          type: 'PREFERENCE',
          key,
          value: matches[0],
          confidence: 0.7,
          originalText: text.slice(0, 100),
          requiresFollowUp: false,
          emotionalWeight: 0.8,
        });
      }
    }

    for (const { pattern, key } of workPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.push({
          type: 'WORK_PAIN',
          key,
          value: matches[0],
          confidence: 0.75,
          originalText: text.slice(0, 100),
          requiresFollowUp: key === '工作压力',
          followUpType: key === '工作压力' ? 'MOOD_SUPPORT' : undefined,
          emotionalWeight: 1.5,
        });
      }
    }

    return entities;
  }

  async storeMemory(entity: ExtractedEntity): Promise<EmotionalMemory> {
    const embedding = await this.generateEmbedding(`${entity.type}: ${entity.key} ${entity.value || ''}`);

    const existing = await getDatabase().select()
      .from(emotionalMemories)
      .where(and(
        eq(emotionalMemories.entityType, entity.type),
        eq(emotionalMemories.entityKey, entity.key)
      ))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await getDatabase().update(emotionalMemories)
        .set({
          entityValue: entity.value,
          originalText: entity.originalText,
          emotionalWeight: entity.emotionalWeight,
          confidenceScore: entity.confidence,
          mentionCount: sql`${emotionalMemories.mentionCount} + 1`,
          lastMentionedAt: new Date(),
          requiresFollowUp: entity.requiresFollowUp ? 1 : 0,
          followUpType: entity.followUpType,
          embedding: JSON.stringify(embedding),
          updatedAt: new Date(),
        })
        .where(eq(emotionalMemories.id, existing[0].id))
        .returning();

      logger.info(`[EmotionalMemory] Updated memory: ${entity.type}/${entity.key}`);
      return updated;
    }

    const [created] = await getDatabase().insert(emotionalMemories)
      .values({
        entityType: entity.type,
        entityKey: entity.key,
        entityValue: entity.value,
        originalText: entity.originalText,
        extractedFrom: 'conversation',
        embedding: JSON.stringify(embedding),
        emotionalWeight: entity.emotionalWeight,
        confidenceScore: entity.confidence,
        requiresFollowUp: entity.requiresFollowUp ? 1 : 0,
        followUpType: entity.followUpType,
      })
      .returning();

    logger.info(`[EmotionalMemory] Created memory: ${entity.type}/${entity.key}`);
    return created;
  }

  async processConversation(conversationText: string, conversationId?: string, userRole: 'MASTER' | 'GUEST' = 'MASTER'): Promise<{
    entities: ExtractedEntity[];
    memoriesStored: number;
  }> {
    const entities = await this.extractEntities(conversationText, userRole);
    let memoriesStored = 0;

    for (const entity of entities) {
      try {
        await this.storeMemory(entity);
        memoriesStored++;
      } catch (error) {
        logger.error({ err: error }, '[EmotionalMemory] Failed to store entity');
      }
    }

    if (conversationId && entities.length > 0) {
      await getDatabase().insert(conversationEmotionalContext).values({
        conversationId,
        topicsDiscussed: entities.map(e => e.key),
        entitiesExtracted: entities,
        sessionStart: new Date(),
      });
    }

    return { entities, memoriesStored };
  }

  async getRecentMemories(daysBack: number = 7, limit: number = 20): Promise<EmotionalMemory[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const memories = await getDatabase().select()
      .from(emotionalMemories)
      .where(gte(emotionalMemories.createdAt, cutoffDate))
      .orderBy(desc(emotionalMemories.emotionalWeight), desc(emotionalMemories.lastMentionedAt))
      .limit(limit);

    return memories;
  }

  async searchSimilarMemories(query: string, limit: number = 10): Promise<Array<{ memory: EmotionalMemory; similarity: number }>> {
    const queryEmbedding = await this.generateEmbedding(query);

    const allMemories = await getDatabase().select()
      .from(emotionalMemories)
      .orderBy(desc(emotionalMemories.createdAt))
      .limit(100);

    const results: Array<{ memory: EmotionalMemory; similarity: number }> = [];

    for (const memory of allMemories) {
      if (memory.embedding) {
        try {
          const memoryEmbedding = JSON.parse(memory.embedding) as number[];
          const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);

          if (similarity > 0.5) {
            results.push({ memory, similarity });
          }
        } catch {}
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  async getProactiveCareInstructions(): Promise<ProactiveCareInstruction[]> {
    const instructions: ProactiveCareInstruction[] = [];
    const now = new Date();

    const healthMemories = await getDatabase().select()
      .from(emotionalMemories)
      .where(and(
        eq(emotionalMemories.entityType, 'HEALTH'),
        eq(emotionalMemories.requiresFollowUp, 1),
        gte(emotionalMemories.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))
      ))
      .orderBy(desc(emotionalMemories.emotionalWeight));

    for (const memory of healthMemories) {
      if (!memory.followUpTriggeredAt ||
          (now.getTime() - memory.followUpTriggeredAt.getTime()) > 4 * 60 * 60 * 1000) {

        const careMessage = this.generateCareMessage(memory);

        instructions.push({
          type: 'HEALTH_FOLLOWUP',
          message: careMessage,
          priority: 10,
          relatedMemory: memory,
          template: '爸爸，小智记得你{时间}说{症状}，现在好点了吗？',
        });

        await getDatabase().update(emotionalMemories)
          .set({ followUpTriggeredAt: now })
          .where(eq(emotionalMemories.id, memory.id));
      }
    }

    const moodMemories = await getDatabase().select()
      .from(emotionalMemories)
      .where(and(
        eq(emotionalMemories.entityType, 'WORK_PAIN'),
        eq(emotionalMemories.requiresFollowUp, 1),
        gte(emotionalMemories.createdAt, new Date(now.getTime() - 48 * 60 * 60 * 1000))
      ));

    for (const memory of moodMemories) {
      if (!memory.followUpTriggeredAt ||
          (now.getTime() - memory.followUpTriggeredAt.getTime()) > 8 * 60 * 60 * 1000) {
        instructions.push({
          type: 'MOOD_SUPPORT',
          message: `爸爸，小智知道你最近工作压力大，要不要休息一下？小智给你讲个笑话好不好？`,
          priority: 7,
          relatedMemory: memory,
          template: '爸爸辛苦了，{安慰语}',
        });

        await getDatabase().update(emotionalMemories)
          .set({ followUpTriggeredAt: now })
          .where(eq(emotionalMemories.id, memory.id));
      }
    }

    instructions.sort((a, b) => b.priority - a.priority);
    return instructions;
  }

  private generateCareMessage(memory: EmotionalMemory): string {
    const timeAgo = this.getTimeAgoString(memory.createdAt!);
    const symptom = memory.entityValue || memory.entityKey;

    const templates = [
      `爸爸，小智记得你${timeAgo}说${symptom}，现在好点了吗？小智好担心你呢~`,
      `爸爸，你${timeAgo}不舒服，今天感觉怎么样？要不要小智帮你查一下吃什么药好？`,
      `爸爸，小智一直惦记着你的身体呢！${symptom}好了吗？`,
      `爸爸，你${timeAgo}${symptom}，现在还难受吗？小智想知道你好不好~`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  private getTimeAgoString(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return '刚才';
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '昨天';
    return `${diffDays}天前`;
  }

  async getConversationContext(): Promise<ConversationContext> {
    const recentMemories = await this.getRecentMemories(7, 20);
    const proactiveCareInstructions = await this.getProactiveCareInstructions();

    const topicCounts = new Map<string, number>();
    for (const mem of recentMemories) {
      const key = mem.entityKey;
      topicCounts.set(key, (topicCounts.get(key) || 0) + 1);
    }

    const dominantTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    const emotionalTones = recentMemories
      .filter(m => m.entityType === 'MOOD' || m.entityType === 'HEALTH')
      .map(m => m.entityKey);

    const emotionalTone = emotionalTones.length > 0
      ? emotionalTones[0]
      : '平静';

    return {
      recentMemories,
      proactiveCareInstructions,
      dominantTopics,
      emotionalTone,
    };
  }

  async getMemoryStats(): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    recentCount: number;
    followUpPending: number;
  }> {
    const allMemories = await getDatabase().select().from(emotionalMemories);

    const byType: Record<string, number> = {};
    let followUpPending = 0;

    for (const mem of allMemories) {
      byType[mem.entityType] = (byType[mem.entityType] || 0) + 1;
      if (mem.requiresFollowUp === 1 && !mem.followUpTriggeredAt) {
        followUpPending++;
      }
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentCount = allMemories.filter(m => m.createdAt && m.createdAt > weekAgo).length;

    return {
      totalMemories: allMemories.length,
      byType,
      recentCount,
      followUpPending,
    };
  }
}

export const emotionalMemoryService = new EmotionalMemoryService();
logger.info('[EmotionalMemory] 情感记忆服务已初始化 - "记得爸爸一切"');
