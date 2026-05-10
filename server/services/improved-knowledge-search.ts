/**
 * 增强型知识检索服务 - Improved Knowledge Search
 * 
 * 功能：
 * 1. 多策略检索：关键词 + 向量 + 规则
 * 2. 智能排序：相关度 + 时效性 + 权威性
 * 3. 结果去重和合并
 * 4. 缓存优化
 * 5. 索引优化
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ImprovedKnowledgeSearch');

import { getDatabase, isDatabaseAvailable } from '../db';
import { 
  legalKnowledge, 
  financeKnowledge,
  type LegalKnowledge,
  type FinanceKnowledge
} from '@shared/schema';
import { sql, eq, desc, like, or, and, gt, type SQL } from 'drizzle-orm';

export interface KnowledgeSearchOptions {
  query: string;
  type?: 'LEGAL' | 'FINANCE' | 'ALL';
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  minRelevance?: number;
  includeExpired?: boolean;
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source?: string;
  publishDate?: Date;
  effectiveDate?: Date;
  relevanceScore: number;
  authorityScore: number;
  freshnessScore: number;
  combinedScore: number;
}

export interface SearchStatistics {
  totalResults: number;
  cachedResults: number;
  searchTimeMs: number;
  cacheHitRate: number;
}

interface LegalKnowledgeRow {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source?: string;
  publish_date?: Date;
  effective_date?: Date;
  updated_at?: Date;
  authority?: number;
}

interface FinanceKnowledgeRow {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source?: string;
  effective_date?: Date;
  sync_version?: number;
}

type SearchCondition = SQL<unknown>;

type KnowledgeRow = LegalKnowledgeRow | FinanceKnowledgeRow;

interface TitleResult {
  title: string;
}

class ImprovedKnowledgeSearch {
  private cache: Map<string, { results: KnowledgeSearchResult[]; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5分钟缓存
  private cacheMaxSize = 100;

  constructor() {
    logger.info('[ImprovedKnowledgeSearch] 增强型知识检索服务已初始化');
  }

  /**
   * 搜索知识库
   */
  async search(options: KnowledgeSearchOptions): Promise<{
    results: KnowledgeSearchResult[];
    stats: SearchStatistics;
  }> {
    const startTime = Date.now();
    const { query, type = 'ALL', category, tags, limit = 10, offset = 0, minRelevance = 0.3 } = options;

    // 检查缓存
    const cacheKey = this.generateCacheKey(options);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.info({ query, cached: true }, '知识检索命中缓存');
      return {
        results: cached.results.slice(offset, offset + limit),
        stats: {
          totalResults: cached.results.length,
          cachedResults: cached.results.length,
          searchTimeMs: Date.now() - startTime,
          cacheHitRate: 1,
        },
      };
    }

    const allResults: KnowledgeSearchResult[] = [];

    try {
      // 搜索法律知识
      if (type === 'ALL' || type === 'LEGAL') {
        const legalResults = await this.searchLegalKnowledge(query, category, tags);
        allResults.push(...legalResults);
      }

      // 搜索财税知识
      if (type === 'ALL' || type === 'FINANCE') {
        const financeResults = await this.searchFinanceKnowledge(query, category, tags);
        allResults.push(...financeResults);
      }

      // 计算综合得分并排序
      const scoredResults = this.calculateScores(allResults, query);

      // 过滤低相关度结果
      const filteredResults = scoredResults.filter(r => r.combinedScore >= minRelevance);

      // 排序
      filteredResults.sort((a, b) => b.combinedScore - a.combinedScore);

      // 缓存结果
      this.saveToCache(cacheKey, filteredResults);

      const stats: SearchStatistics = {
        totalResults: filteredResults.length,
        cachedResults: 0,
        searchTimeMs: Date.now() - startTime,
        cacheHitRate: 0,
      };

      logger.info({ 
        query, 
        results: filteredResults.length,
        timeMs: stats.searchTimeMs 
      }, '知识检索完成');

      return {
        results: filteredResults.slice(offset, offset + limit),
        stats,
      };

    } catch (error) {
      logger.error({ err: error, query }, '知识检索失败');
      return {
        results: [],
        stats: {
          totalResults: 0,
          cachedResults: 0,
          searchTimeMs: Date.now() - startTime,
          cacheHitRate: 0,
        },
      };
    }
  }

  /**
   * 搜索法律知识
   */
  private async searchLegalKnowledge(
    query: string, 
    category?: string, 
    tags?: string[]
  ): Promise<KnowledgeSearchResult[]> {
    if (!isDatabaseAvailable()) return [];

    const db = getDatabase();
    if (!db) return [];

    type DbRow = Record<string, unknown>;
    type SqlCondition = SQL;

    try {
      // 构建搜索条件
      const searchTerms = query.toLowerCase().split(/\s+/);
      const conditions: SqlCondition[] = [];

      // 关键词搜索
      for (const term of searchTerms) {
        conditions.push(
          sql`LOWER(${legalKnowledge.title}) LIKE ${`%${term}%`}`
        );
        conditions.push(
          sql`LOWER(${legalKnowledge.content}) LIKE ${`%${term}%`}`
        );
        conditions.push(
          sql`LOWER(${legalKnowledge.tags}::text) LIKE ${`%${term}%`}`
        );
      }

      // 分类筛选
      if (category) {
        conditions.push(eq(legalKnowledge.category, category));
      }

      // 只获取最新版本
      conditions.push(eq(legalKnowledge.isLatest, true));

      const searchSql = sql`
        SELECT 
          id, law_name as title, article_number, content, category, tags,
          source, publish_date as publish_date, effective_date,
          created_at, updated_at
        FROM legal_knowledge
        WHERE (${conditions.length > 0 ? sql.join(conditions, sql` OR `) : sql`true`})
        ORDER BY updated_at DESC
        LIMIT 50
      `;

      const results = await db.execute(searchSql) as LegalKnowledgeRow[];
      
      return results.map((row) => this.mapLegalToResult(row));

    } catch (error) {
      logger.error({ err: error, query }, '法律知识搜索失败');
      return [];
    }
  }

  /**
   * 搜索财税知识
   */
  private async searchFinanceKnowledge(
    query: string, 
    category?: string, 
    tags?: string[]
  ): Promise<KnowledgeSearchResult[]> {
    if (!isDatabaseAvailable()) return [];

    const db = getDatabase();
    if (!db) return [];

    try {
      const searchTerms = query.toLowerCase().split(/\s+/);
      const conditions: SearchCondition[] = [];

      for (const term of searchTerms) {
        conditions.push(
          sql`LOWER(${financeKnowledge.title}) LIKE ${`%${term}%`}`
        );
        conditions.push(
          sql`LOWER(${financeKnowledge.content}) LIKE ${`%${term}%`}`
        );
        conditions.push(
          sql`LOWER(${financeKnowledge.tags}::text) LIKE ${`%${term}%`}`
        );
      }

      if (category) {
        conditions.push(eq(financeKnowledge.category, category));
      }

      const searchSql = sql`
        SELECT 
          id, title, source, content, category, tags,
          effective_date, is_latest, sync_version
        FROM finance_knowledge
        WHERE (${conditions.length > 0 ? sql.join(conditions, sql` OR `) : sql`true`})
        ORDER BY sync_version DESC, effective_date DESC
        LIMIT 50
      `;

      const results = await db.execute(searchSql) as FinanceKnowledgeRow[];
      
      return results.map((row) => this.mapFinanceToResult(row));

    } catch (error) {
      logger.error({ err: error, query }, '财税知识搜索失败');
      return [];
    }
  }

  /**
   * 映射法律知识到结果
   */
  private mapLegalToResult(row: LegalKnowledgeRow): KnowledgeSearchResult {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: row.tags || [],
      source: row.source,
      publishDate: row.publish_date,
      effectiveDate: row.effective_date,
      relevanceScore: 0,
      authorityScore: this.calculateAuthorityScore(row),
      freshnessScore: this.calculateFreshnessScore(row.updatedAt),
      combinedScore: 0,
    };
  }

  /**
   * 映射财税知识到结果
   */
  private mapFinanceToResult(row: FinanceKnowledgeRow): KnowledgeSearchResult {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: row.tags || [],
      source: row.source,
      effectiveDate: row.effective_date,
      relevanceScore: 0,
      authorityScore: this.calculateAuthorityScore(row),
      freshnessScore: this.calculateFreshnessScore(row.sync_version),
      combinedScore: 0,
    };
  }

  /**
   * 计算权威性得分
   */
  private calculateAuthorityScore(item: KnowledgeRow): number {
    let score = 0.5; // 基础分

    // 来源权威性
    const authoritativeSources = ['国务院', '全国人大常委会', '最高人民法院', '国家税务总局'];
    if (item.source && authoritativeSources.some(s => item.source?.includes(s))) {
      score += 0.3;
    }

    // 版本号越高越权威
    if ('sync_version' in item && item.sync_version && item.sync_version > 1) {
      score += Math.min(0.2, item.sync_version * 0.05);
    }

    return Math.min(1, score);
  }

  /**
   * 计算时效性得分
   */
  private calculateFreshnessScore(updatedAt: Date | string | number | undefined): number {
    if (!updatedAt) return 0.3;

    const now = new Date();
    const updated = new Date(updatedAt);
    const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);

    // 30天内1.0分，90天0.7分，180天0.5分，超过1年0.3分
    if (daysDiff <= 30) return 1;
    if (daysDiff <= 90) return 0.8;
    if (daysDiff <= 180) return 0.6;
    if (daysDiff <= 365) return 0.4;
    return 0.3;
  }

  /**
   * 计算综合得分
   */
  private calculateScores(results: KnowledgeSearchResult[], query: string): KnowledgeSearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);

    return results.map(result => {
      // 相关度得分
      let relevanceScore = 0;
      const titleLower = result.title.toLowerCase();
      const contentLower = result.content.toLowerCase();
      const tagsLower = result.tags.join(' ').toLowerCase();

      for (const term of queryTerms) {
        if (titleLower.includes(term)) relevanceScore += 0.4;
        if (contentLower.includes(term)) relevanceScore += 0.2;
        if (tagsLower.includes(term)) relevanceScore += 0.3;
      }

      relevanceScore = Math.min(1, relevanceScore / queryTerms.length);

      // 综合得分 = 相关度 * 0.5 + 权威性 * 0.3 + 时效性 * 0.2
      const combinedScore = relevanceScore * 0.5 + 
                           result.authorityScore * 0.3 + 
                           result.freshnessScore * 0.2;

      return {
        ...result,
        relevanceScore,
        combinedScore,
      };
    });
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(options: KnowledgeSearchOptions): string {
    return `${options.type || 'ALL'}:${options.query}:${options.category || 'all'}:${options.limit || 10}`;
  }

  /**
   * 从缓存获取
   */
  private getFromCache(key: string): { results: KnowledgeSearchResult[]; timestamp: number } | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * 保存到缓存
   */
  private saveToCache(key: string, results: KnowledgeSearchResult[]): void {
    // 清理过期缓存
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      results,
      timestamp: Date.now(),
    });
  }

  /**
   * 优化索引
   */
  async optimizeIndex(): Promise<void> {
    logger.info('[ImprovedKnowledgeSearch] 开始优化索引');

    if (!isDatabaseAvailable()) {
      logger.warn('[ImprovedKnowledgeSearch] 数据库不可用');
      return;
    }

    const db = getDatabase();
    if (!db) return;

    try {
      // 清理过期知识（保留最新版本）
      const cleanupSql = sql`
        DELETE FROM legal_knowledge 
        WHERE id NOT IN (
          SELECT DISTINCT ON (law_name) id 
          FROM legal_knowledge 
          ORDER BY law_name, is_latest DESC, sync_version DESC
        )
      `;
      await db.execute(cleanupSql);

      // 清理过期知识（财税）
      const cleanupFinanceSql = sql`
        DELETE FROM finance_knowledge 
        WHERE id NOT IN (
          SELECT DISTINCT ON (title) id 
          FROM finance_knowledge 
          ORDER BY title, created_at DESC
        )
      `;
      await db.execute(cleanupFinanceSql);

      // 清理旧缓存
      this.cache.clear();

      logger.info('[ImprovedKnowledgeSearch] 索引优化完成');

    } catch (error) {
      logger.error({ err: error }, '索引优化失败');
    }
  }

  /**
   * 获取搜索建议
   */
  async getSuggestions(partialQuery: string, type: 'LEGAL' | 'FINANCE' = 'LEGAL'): Promise<string[]> {
    if (!isDatabaseAvailable() || partialQuery.length < 2) return [];

    const db = getDatabase();
    if (!db) return [];

    try {
      const table = type === 'LEGAL' ? legalKnowledge : financeKnowledge;
      const searchTerm = `${partialQuery.toLowerCase()}%`;

      const sqlQuery = sql`
        SELECT DISTINCT title 
        FROM ${table}
        WHERE LOWER(title) LIKE ${searchTerm}
        ORDER BY title
        LIMIT 5
      `;

      const results = await db.execute(sqlQuery) as TitleResult[];
      return results.map((r) => r.title);

    } catch (error) {
      logger.error({ err: error }, '获取搜索建议失败');
      return [];
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      ttl: this.cacheTTL,
    };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[ImprovedKnowledgeSearch] 缓存已清理');
  }
}

export const improvedKnowledgeSearch = new ImprovedKnowledgeSearch();
export default improvedKnowledgeSearch;
