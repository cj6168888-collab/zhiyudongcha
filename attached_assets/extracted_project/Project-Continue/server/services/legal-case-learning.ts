/**
 * 法律动态索引与案例学习服务 (Legal Index & Case Learning Service)
 * 
 * 功能：
 * 1. 法律法规动态索引 - 元数据存储，内容按需下载
 * 2. 律师辩护案例库 - 案例存储与策略提取
 * 3. 学习成果同步 - 策略模式推送到设备端
 */

import { db } from '../db';
import { 
  legalIndex, 
  caseStudies, 
  learnedPatterns,
  legalKnowledge
} from '@shared/schema';
import type { 
  LegalIndex, 
  InsertLegalIndex,
  CaseStudy,
  InsertCaseStudy,
  LearnedPattern,
  InsertLearnedPattern,
  InsertLegalKnowledge
} from '@shared/schema';
import { eq, desc, sql, and, or, ilike, gte, isNull, lt, asc } from 'drizzle-orm';

export type LawCategory = 'CONTRACT' | 'CORPORATE' | 'LABOR' | 'TAX' | 'TRADE' | 'IP' | 'CRIMINAL' | 'ADMINISTRATIVE';
export type CaseType = 'CIVIL' | 'CRIMINAL' | 'ADMINISTRATIVE' | 'LABOR' | 'IP';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'UPDATED';

export interface LegalIndexSearchResult {
  id: string;
  lawCode: string;
  lawName: string;
  category: string;
  summary: string | null;
  isDownloaded: boolean;
  hitCount: number;
  priority: number;
}

export interface CaseSearchResult {
  id: string;
  caseName: string;
  caseType: string;
  courtLevel: string | null;
  judgmentResult: string | null;
  winningStrategy: string | null;
  isAnalyzed: boolean;
}

export interface PatternSyncPackage {
  deviceId: string;
  patterns: LearnedPattern[];
  fromVersion: number;
  toVersion: number;
  syncType: 'FULL' | 'DELTA';
}

export interface CaseAnalysisResult {
  caseId: string;
  extractedPattern: Partial<InsertLearnedPattern>;
  confidence: number;
  suggestedActions: string[];
}

// ===== 法律索引服务 =====

export class LegalIndexService {
  
  /**
   * 搜索法律法规索引（元数据级别）
   */
  async searchIndex(
    query: string,
    options: {
      category?: LawCategory;
      onlyDownloaded?: boolean;
      limit?: number;
    } = {}
  ): Promise<LegalIndexSearchResult[]> {
    const { category, onlyDownloaded = false, limit = 20 } = options;
    
    const keywordCondition = or(
      ilike(legalIndex.lawName, `%${query}%`),
      ilike(legalIndex.summary, `%${query}%`),
      sql`${legalIndex.keywords}::text ILIKE ${'%' + query + '%'}`
    );
    
    const additionalConditions = [];
    if (category) {
      additionalConditions.push(eq(legalIndex.category, category));
    }
    if (onlyDownloaded) {
      additionalConditions.push(eq(legalIndex.isDownloaded, true));
    }
    
    const whereClause = additionalConditions.length > 0
      ? and(keywordCondition, ...additionalConditions)
      : keywordCondition;
    
    const results = await db
      .select({
        id: legalIndex.id,
        lawCode: legalIndex.lawCode,
        lawName: legalIndex.lawName,
        category: legalIndex.category,
        summary: legalIndex.summary,
        isDownloaded: legalIndex.isDownloaded,
        hitCount: legalIndex.hitCount,
        priority: legalIndex.priority,
      })
      .from(legalIndex)
      .where(whereClause)
      .orderBy(desc(legalIndex.priority), desc(legalIndex.hitCount))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      isDownloaded: r.isDownloaded ?? false,
      hitCount: r.hitCount ?? 0,
      priority: r.priority ?? 5,
    }));
  }
  
  /**
   * 获取法律索引详情
   */
  async getIndexById(id: string): Promise<LegalIndex | null> {
    const [result] = await db
      .select()
      .from(legalIndex)
      .where(eq(legalIndex.id, id));
    
    if (result) {
      await this.incrementHitCount(id);
    }
    
    return result || null;
  }
  
  /**
   * 增加访问计数
   */
  private async incrementHitCount(id: string): Promise<void> {
    await db
      .update(legalIndex)
      .set({
        hitCount: sql`COALESCE(${legalIndex.hitCount}, 0) + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(legalIndex.id, id));
  }
  
  /**
   * 下载法律法规内容（模拟从外部源获取）
   * 实际应用中，这里会调用外部API获取法规全文
   */
  async downloadLawContent(indexId: string): Promise<{
    success: boolean;
    knowledgeIds: string[];
    message: string;
  }> {
    const indexItem = await this.getIndexById(indexId);
    if (!indexItem) {
      return { success: false, knowledgeIds: [], message: '索引项不存在' };
    }
    
    if (indexItem.isDownloaded) {
      return { 
        success: true, 
        knowledgeIds: indexItem.knowledgeIds || [], 
        message: '该法规已下载' 
      };
    }
    
    // 模拟下载逻辑 - 实际应用中这里会调用外部法规API
    // 这里我们生成一个示例条目存入legalKnowledge
    const sampleContent: InsertLegalKnowledge = {
      lawName: indexItem.lawName,
      articleNumber: '第1条',
      chapterSection: '总则',
      content: `${indexItem.lawName}的核心内容概要。（此处应为从外部源下载的实际法规内容）`,
      category: indexItem.category,
      tags: indexItem.keywords,
      version: indexItem.version || '1.0',
      effectiveDate: indexItem.effectiveDate,
      isLatest: true,
      syncVersion: 1,
    };
    
    const [inserted] = await db
      .insert(legalKnowledge)
      .values(sampleContent)
      .returning({ id: legalKnowledge.id });
    
    // 更新索引项的下载状态
    await db
      .update(legalIndex)
      .set({
        isDownloaded: true,
        downloadedAt: new Date(),
        downloadSize: sampleContent.content.length,
        knowledgeIds: [inserted.id],
        updatedAt: new Date(),
      })
      .where(eq(legalIndex.id, indexId));
    
    return {
      success: true,
      knowledgeIds: [inserted.id],
      message: `成功下载 ${indexItem.lawName}`,
    };
  }
  
  /**
   * 添加法律索引项
   */
  async addIndex(data: InsertLegalIndex): Promise<LegalIndex> {
    const [result] = await db
      .insert(legalIndex)
      .values(data)
      .returning();
    return result;
  }
  
  /**
   * 批量添加法律索引
   */
  async bulkAddIndex(items: InsertLegalIndex[]): Promise<number> {
    if (items.length === 0) return 0;
    
    await db.insert(legalIndex).values(items);
    return items.length;
  }
  
  /**
   * 获取待下载的高优先级法规
   */
  async getPendingDownloads(limit: number = 10): Promise<LegalIndexSearchResult[]> {
    const results = await db
      .select({
        id: legalIndex.id,
        lawCode: legalIndex.lawCode,
        lawName: legalIndex.lawName,
        category: legalIndex.category,
        summary: legalIndex.summary,
        isDownloaded: legalIndex.isDownloaded,
        hitCount: legalIndex.hitCount,
        priority: legalIndex.priority,
      })
      .from(legalIndex)
      .where(eq(legalIndex.isDownloaded, false))
      .orderBy(desc(legalIndex.priority), desc(legalIndex.hitCount))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      isDownloaded: r.isDownloaded ?? false,
      hitCount: r.hitCount ?? 0,
      priority: r.priority ?? 5,
    }));
  }
  
  /**
   * 获取索引统计
   */
  async getStats(): Promise<{
    totalCount: number;
    downloadedCount: number;
    pendingCount: number;
    byCategory: Record<string, number>;
  }> {
    const [stats] = await db
      .select({
        totalCount: sql<number>`COUNT(*)`,
        downloadedCount: sql<number>`COUNT(*) FILTER (WHERE is_downloaded = true)`,
        pendingCount: sql<number>`COUNT(*) FILTER (WHERE is_downloaded = false)`,
      })
      .from(legalIndex);
    
    const categoryStats = await db
      .select({
        category: legalIndex.category,
        count: sql<number>`COUNT(*)`,
      })
      .from(legalIndex)
      .groupBy(legalIndex.category);
    
    const byCategory: Record<string, number> = {};
    for (const cat of categoryStats) {
      byCategory[cat.category] = Number(cat.count);
    }
    
    return {
      totalCount: Number(stats?.totalCount || 0),
      downloadedCount: Number(stats?.downloadedCount || 0),
      pendingCount: Number(stats?.pendingCount || 0),
      byCategory,
    };
  }
}

// ===== 案例学习服务 =====

export class CaseLearningService {
  
  /**
   * 搜索案例库
   */
  async searchCases(
    query: string,
    options: {
      caseType?: CaseType;
      onlyAnalyzed?: boolean;
      limit?: number;
    } = {}
  ): Promise<CaseSearchResult[]> {
    const { caseType, onlyAnalyzed = false, limit = 20 } = options;
    
    const keywordCondition = or(
      ilike(caseStudies.caseName, `%${query}%`),
      ilike(caseStudies.caseBackground, `%${query}%`),
      ilike(caseStudies.winningStrategy, `%${query}%`)
    );
    
    const additionalConditions = [];
    if (caseType) {
      additionalConditions.push(eq(caseStudies.caseType, caseType));
    }
    if (onlyAnalyzed) {
      additionalConditions.push(eq(caseStudies.isAnalyzed, true));
    }
    
    const whereClause = additionalConditions.length > 0
      ? and(keywordCondition, ...additionalConditions)
      : keywordCondition;
    
    const results = await db
      .select({
        id: caseStudies.id,
        caseName: caseStudies.caseName,
        caseType: caseStudies.caseType,
        courtLevel: caseStudies.courtLevel,
        judgmentResult: caseStudies.judgmentResult,
        winningStrategy: caseStudies.winningStrategy,
        isAnalyzed: caseStudies.isAnalyzed,
      })
      .from(caseStudies)
      .where(whereClause)
      .orderBy(desc(caseStudies.judgmentDate))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      isAnalyzed: r.isAnalyzed ?? false,
    }));
  }
  
  /**
   * 获取案例详情
   */
  async getCaseById(id: string): Promise<CaseStudy | null> {
    const [result] = await db
      .select()
      .from(caseStudies)
      .where(eq(caseStudies.id, id));
    return result || null;
  }
  
  /**
   * 添加案例
   */
  async addCase(data: InsertCaseStudy): Promise<CaseStudy> {
    const [result] = await db
      .insert(caseStudies)
      .values(data)
      .returning();
    return result;
  }
  
  /**
   * 批量添加案例
   */
  async bulkAddCases(cases: InsertCaseStudy[]): Promise<number> {
    if (cases.length === 0) return 0;
    
    await db.insert(caseStudies).values(cases);
    return cases.length;
  }
  
  /**
   * 分析案例并提取策略模式
   * 这是核心的AI学习功能
   */
  async analyzeCase(caseId: string): Promise<CaseAnalysisResult | null> {
    const caseData = await this.getCaseById(caseId);
    if (!caseData) return null;
    
    // 基于案例内容提取策略模式
    // 实际应用中这里会调用AI模型进行深度分析
    const extractedPattern: Partial<InsertLearnedPattern> = {
      patternName: `${caseData.caseType}策略模式 - ${caseData.caseName.slice(0, 20)}`,
      patternCode: `PAT_${caseData.caseType}_${Date.now()}`,
      category: caseData.caseType,
      description: caseData.winningStrategy || '从案例中提取的策略模式',
      coreLogic: caseData.lessonsLearned || '案例核心逻辑待提取',
      applicableScenarios: caseData.applicableScenarios || [],
      recommendedActions: caseData.successIndicators || [],
      successProbability: 0.7, // 基于案例结果估算
      confidenceScore: 0.6,
      derivedFromCases: [caseId],
      caseCount: 1,
      version: 1,
      syncStatus: 'PENDING',
    };
    
    // 更新案例分析状态
    await db
      .update(caseStudies)
      .set({
        isAnalyzed: true,
        analyzedAt: new Date(),
        analysisModel: 'rule-based-v1',
        updatedAt: new Date(),
      })
      .where(eq(caseStudies.id, caseId));
    
    // 保存提取的策略模式
    const [savedPattern] = await db
      .insert(learnedPatterns)
      .values(extractedPattern as InsertLearnedPattern)
      .returning();
    
    return {
      caseId,
      extractedPattern,
      confidence: 0.6,
      suggestedActions: [
        '建议收集更多同类案例以提高模式置信度',
        '可将此模式应用于类似场景验证效果',
      ],
    };
  }
  
  /**
   * 批量分析未分析的案例
   */
  async analyzeUnprocessedCases(limit: number = 10): Promise<{
    processed: number;
    patterns: string[];
  }> {
    const unprocessed = await db
      .select({ id: caseStudies.id })
      .from(caseStudies)
      .where(eq(caseStudies.isAnalyzed, false))
      .limit(limit);
    
    const patterns: string[] = [];
    
    for (const c of unprocessed) {
      const result = await this.analyzeCase(c.id);
      if (result?.extractedPattern?.patternName) {
        patterns.push(result.extractedPattern.patternName);
      }
    }
    
    return {
      processed: unprocessed.length,
      patterns,
    };
  }
  
  /**
   * 获取案例统计
   */
  async getStats(): Promise<{
    totalCases: number;
    analyzedCases: number;
    byCaseType: Record<string, number>;
    byCourtLevel: Record<string, number>;
  }> {
    const [stats] = await db
      .select({
        totalCases: sql<number>`COUNT(*)`,
        analyzedCases: sql<number>`COUNT(*) FILTER (WHERE is_analyzed = true)`,
      })
      .from(caseStudies);
    
    const typeStats = await db
      .select({
        caseType: caseStudies.caseType,
        count: sql<number>`COUNT(*)`,
      })
      .from(caseStudies)
      .groupBy(caseStudies.caseType);
    
    const levelStats = await db
      .select({
        courtLevel: caseStudies.courtLevel,
        count: sql<number>`COUNT(*)`,
      })
      .from(caseStudies)
      .groupBy(caseStudies.courtLevel);
    
    const byCaseType: Record<string, number> = {};
    for (const t of typeStats) {
      byCaseType[t.caseType] = Number(t.count);
    }
    
    const byCourtLevel: Record<string, number> = {};
    for (const l of levelStats) {
      if (l.courtLevel) {
        byCourtLevel[l.courtLevel] = Number(l.count);
      }
    }
    
    return {
      totalCases: Number(stats?.totalCases || 0),
      analyzedCases: Number(stats?.analyzedCases || 0),
      byCaseType,
      byCourtLevel,
    };
  }
}

// ===== 策略模式同步服务 =====

export class PatternSyncService {
  
  /**
   * 获取待同步的策略模式
   */
  async getPendingPatterns(deviceId: string): Promise<LearnedPattern[]> {
    const results = await db
      .select()
      .from(learnedPatterns)
      .where(eq(learnedPatterns.syncStatus, 'PENDING'))
      .orderBy(desc(learnedPatterns.successProbability));
    
    return results;
  }
  
  /**
   * 获取增量同步包
   */
  async getDeltaSyncPackage(
    deviceId: string,
    fromVersion: number
  ): Promise<PatternSyncPackage> {
    const patterns = await db
      .select()
      .from(learnedPatterns)
      .where(gte(learnedPatterns.version, fromVersion))
      .orderBy(asc(learnedPatterns.version));
    
    const maxVersion = patterns.reduce(
      (max, p) => Math.max(max, p.version || 1),
      fromVersion
    );
    
    return {
      deviceId,
      patterns,
      fromVersion,
      toVersion: maxVersion,
      syncType: fromVersion === 0 ? 'FULL' : 'DELTA',
    };
  }
  
  /**
   * 标记模式已同步到设备
   */
  async markSynced(patternIds: string[], deviceId: string): Promise<void> {
    for (const id of patternIds) {
      await db
        .update(learnedPatterns)
        .set({
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
        })
        .where(eq(learnedPatterns.id, id));
    }
  }
  
  /**
   * 获取策略模式统计
   */
  async getStats(): Promise<{
    totalPatterns: number;
    pendingSync: number;
    syncedPatterns: number;
    byCategory: Record<string, number>;
    avgSuccessRate: number;
  }> {
    const [stats] = await db
      .select({
        totalPatterns: sql<number>`COUNT(*)`,
        pendingSync: sql<number>`COUNT(*) FILTER (WHERE sync_status = 'PENDING')`,
        syncedPatterns: sql<number>`COUNT(*) FILTER (WHERE sync_status = 'SYNCED')`,
        avgSuccessRate: sql<number>`AVG(success_probability)`,
      })
      .from(learnedPatterns);
    
    const categoryStats = await db
      .select({
        category: learnedPatterns.category,
        count: sql<number>`COUNT(*)`,
      })
      .from(learnedPatterns)
      .groupBy(learnedPatterns.category);
    
    const byCategory: Record<string, number> = {};
    for (const c of categoryStats) {
      byCategory[c.category] = Number(c.count);
    }
    
    return {
      totalPatterns: Number(stats?.totalPatterns || 0),
      pendingSync: Number(stats?.pendingSync || 0),
      syncedPatterns: Number(stats?.syncedPatterns || 0),
      byCategory,
      avgSuccessRate: Number(stats?.avgSuccessRate || 0),
    };
  }
  
  /**
   * 按类别获取策略模式
   */
  async getPatternsByCategory(
    category: CaseType,
    limit: number = 20
  ): Promise<LearnedPattern[]> {
    return db
      .select()
      .from(learnedPatterns)
      .where(eq(learnedPatterns.category, category))
      .orderBy(desc(learnedPatterns.successProbability))
      .limit(limit);
  }
  
  /**
   * 更新策略使用次数
   */
  async incrementUsage(patternId: string): Promise<void> {
    await db
      .update(learnedPatterns)
      .set({
        usageCount: sql`COALESCE(${learnedPatterns.usageCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(learnedPatterns.id, patternId));
  }
}

// 导出服务实例
export const legalIndexService = new LegalIndexService();
export const caseLearningService = new CaseLearningService();
export const patternSyncService = new PatternSyncService();
