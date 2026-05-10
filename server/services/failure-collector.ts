/**
 * 小智 Failure Collector - 失败标签收集器
 * Project Chrysalis (化蝶计划) - 进化触发机制
 * 
 * 功能：
 * 1. 收集"无法回答的问题"
 * 2. 记录"执行错误的指令"
 * 3. 追踪"用户手动修正的操作"
 * 4. 加密上传并打上 Failure_Tag
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('FailureCollector');

import { getDatabase } from '../db';
import { failureTags, avatarChatHistory, auditLogs } from '@shared/schema';
import { eq, desc, and, gte, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';

export type FailureTagType = 'UNANSWERED' | 'EXECUTION_ERROR' | 'USER_CORRECTION' | 'LOW_CONFIDENCE' | 'TIMEOUT';

export interface FailureContext {
  sessionId?: string;
  deviceId?: string;
  timestamp: Date;
  module: string;
  additionalData?: Record<string, unknown>;
}

export interface CollectedFailure {
  id: string;
  tagType: FailureTagType;
  originalQuery: string;
  failureReason: string;
  userCorrection?: string;
  context: FailureContext;
  createdAt: Date;
}

export interface FailureStats {
  totalUnprocessed: number;
  byType: Record<FailureTagType, number>;
  byModule: Record<string, number>;
  recentFailures: CollectedFailure[];
}

class FailureCollectorService {
  private encryptionKey: string;
  
  constructor() {
    this.encryptionKey = process.env.FAILURE_ENCRYPT_KEY || 'chrysalis-evolution-key-2024';
  }
  
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }
  
  private decrypt(encryptedText: string): string {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encryptedText;
    }
  }
  
  async collectUnanswered(query: string, reason: string, context: FailureContext): Promise<string> {
    logger.info(`[FailureCollector] Collecting UNANSWERED: "${query.slice(0, 50)}..."`);
    
    const encryptedQuery = this.encrypt(query);
    const encryptedReason = this.encrypt(reason);
    
    const [failure] = await getDatabase().insert(failureTags).values({
      tagType: 'UNANSWERED',
      sourceModule: context.module,
      originalQuery: encryptedQuery,
      failureReason: encryptedReason,
      context: context as unknown as Record<string, unknown>,
      deviceId: context.deviceId,
      isProcessed: 0,
    }).returning();
    
    return failure.id;
  }
  
  async collectExecutionError(
    operation: string,
    errorMessage: string,
    context: FailureContext
  ): Promise<string> {
    logger.info(`[FailureCollector] Collecting EXECUTION_ERROR: ${operation}`);
    
    const [failure] = await getDatabase().insert(failureTags).values({
      tagType: 'EXECUTION_ERROR',
      sourceModule: context.module,
      originalQuery: this.encrypt(operation),
      failureReason: this.encrypt(errorMessage),
      context: context as unknown as Record<string, unknown>,
      deviceId: context.deviceId,
      isProcessed: 0,
    }).returning();
    
    return failure.id;
  }
  
  async collectUserCorrection(
    originalAction: string,
    userCorrection: string,
    context: FailureContext
  ): Promise<string> {
    logger.info(`[FailureCollector] Collecting USER_CORRECTION`);
    
    const [failure] = await getDatabase().insert(failureTags).values({
      tagType: 'USER_CORRECTION',
      sourceModule: context.module,
      originalQuery: this.encrypt(originalAction),
      failureReason: this.encrypt('用户手动修正'),
      userCorrection: this.encrypt(userCorrection),
      context: context as unknown as Record<string, unknown>,
      deviceId: context.deviceId,
      isProcessed: 0,
    }).returning();
    
    return failure.id;
  }
  
  async collectLowConfidence(
    query: string,
    confidence: number,
    context: FailureContext
  ): Promise<string> {
    logger.info(`[FailureCollector] Collecting LOW_CONFIDENCE (${confidence})`);
    
    const [failure] = await getDatabase().insert(failureTags).values({
      tagType: 'LOW_CONFIDENCE',
      sourceModule: context.module,
      originalQuery: this.encrypt(query),
      failureReason: this.encrypt(`置信度过低: ${confidence}`),
      context: { ...context, confidence } as unknown as Record<string, unknown>,
      deviceId: context.deviceId,
      isProcessed: 0,
    }).returning();
    
    return failure.id;
  }
  
  async collectTimeout(
    operation: string,
    timeoutMs: number,
    context: FailureContext
  ): Promise<string> {
    logger.info(`[FailureCollector] Collecting TIMEOUT (${timeoutMs}ms)`);
    
    const [failure] = await getDatabase().insert(failureTags).values({
      tagType: 'TIMEOUT',
      sourceModule: context.module,
      originalQuery: this.encrypt(operation),
      failureReason: this.encrypt(`操作超时: ${timeoutMs}ms`),
      context: { ...context, timeoutMs } as unknown as Record<string, unknown>,
      deviceId: context.deviceId,
      isProcessed: 0,
    }).returning();
    
    return failure.id;
  }
  
  async scanChatHistoryForFailures(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const negativeFeedback = await getDatabase().select()
      .from(avatarChatHistory)
      .where(and(
        gte(avatarChatHistory.createdAt, today),
        eq(avatarChatHistory.feedback, -1)
      ));
    
    let collected = 0;
    
    for (const chat of negativeFeedback) {
      const prevUserChat = await getDatabase().select()
        .from(avatarChatHistory)
        .where(and(
          eq(avatarChatHistory.role, 'user'),
          chat.createdAt ? sql`${avatarChatHistory.createdAt} < ${chat.createdAt}` : sql`1=1`
        ))
        .orderBy(desc(avatarChatHistory.createdAt))
        .limit(1);
      
      if (prevUserChat.length > 0) {
        await this.collectUserCorrection(
          prevUserChat[0].content,
          chat.feedbackNote || '用户给出差评',
          {
            module: 'chat',
            timestamp: new Date(),
            additionalData: { chatId: chat.id, feedback: chat.feedback },
          }
        );
        collected++;
      }
    }
    
    return collected;
  }
  
  async scanAuditLogsForFailures(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const failedAudits = await getDatabase().select()
      .from(auditLogs)
      .where(and(
        gte(auditLogs.createdAt, today),
        eq(auditLogs.result, 'FAILURE')
      ));
    
    let collected = 0;
    
    for (const audit of failedAudits) {
      const details = audit.details as Record<string, unknown> || {};
      
      await this.collectExecutionError(
        audit.action,
        (details.errorMessage as string) || '执行失败',
        {
          module: audit.targetType || 'system',
          timestamp: new Date(),
          deviceId: audit.deviceInfo || undefined,
          additionalData: details,
        }
      );
      collected++;
    }
    
    return collected;
  }
  
  async getUnprocessedFailures(limit: number = 100): Promise<CollectedFailure[]> {
    const failures = await getDatabase().select()
      .from(failureTags)
      .where(eq(failureTags.isProcessed, 0))
      .orderBy(desc(failureTags.createdAt))
      .limit(limit);
    
    return failures.map(f => ({
      id: f.id,
      tagType: f.tagType as FailureTagType,
      originalQuery: f.originalQuery ? this.decrypt(f.originalQuery) : '',
      failureReason: f.failureReason ? this.decrypt(f.failureReason) : '',
      userCorrection: f.userCorrection ? this.decrypt(f.userCorrection) : undefined,
      context: f.context as FailureContext,
      createdAt: f.createdAt || new Date(),
    }));
  }
  
  async markAsProcessed(failureId: string, evolutionResult: Record<string, unknown>): Promise<void> {
    await getDatabase().update(failureTags)
      .set({
        isProcessed: 1,
        processedAt: new Date(),
        evolutionResult: evolutionResult as unknown as Record<string, unknown>,
      })
      .where(eq(failureTags.id, failureId));
  }
  
  async getStats(): Promise<FailureStats> {
    const unprocessed = await getDatabase().select()
      .from(failureTags)
      .where(eq(failureTags.isProcessed, 0));
    
    const byType: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    
    for (const f of unprocessed) {
      byType[f.tagType] = (byType[f.tagType] || 0) + 1;
      if (f.sourceModule) {
        byModule[f.sourceModule] = (byModule[f.sourceModule] || 0) + 1;
      }
    }
    
    const recent = await this.getUnprocessedFailures(10);
    
    return {
      totalUnprocessed: unprocessed.length,
      byType: byType as Record<FailureTagType, number>,
      byModule,
      recentFailures: recent,
    };
  }
}

export const failureCollector = new FailureCollectorService();

export { FailureCollectorService };
