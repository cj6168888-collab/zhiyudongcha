import { createServiceLogger } from '../lib/logger';
import { getDatabase } from '../db';
import { eq, and, desc, asc, gte, lte, inArray, sql } from 'drizzle-orm';

const logger = createServiceLogger('QueryOptimizer');

interface QueryResultRow {
  [key: string]: unknown;
}

interface QueryResult {
  rows: QueryResultRow[];
}

interface QueryPlanResult {
  'QUERY PLAN': QueryPlanNode[];
}

interface IndexInfo {
  schemaname: string;
  tablename: string;
  indexname: string;
  indexdef: string;
}

interface QueryStatRow {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  rows: number;
}

interface CountResult {
  count: string;
}

// 查询性能分析接口
export interface QueryAnalysis {
  query: string;
  executionTime: number;
  rowsExamined: number;
  rowsReturned: number;
  indexUsed: string | null;
  recommendations: string[];
}

// 查询优化建议接口
export interface OptimizationSuggestion {
  type: 'index' | 'query' | 'structure';
  severity: 'high' | 'medium' | 'low';
  description: string;
  sql: string;
  impact: string;
}

// 查询计划节点接口
interface QueryPlanNode {
  Plans?: QueryPlanNode[];
  'Actual Rows'?: number;
  'Node Type'?: string;
  'Index Name'?: string;
  [key: string]: unknown;
}

// 查询优化器类
export class QueryOptimizer {
  
  // 分析查询性能
  async analyzeQuery(query: string, params: unknown[] = []): Promise<QueryAnalysis> {
    const startTime = Date.now();
    
    try {
      const db = getDatabase();
      const result = await (db as unknown as QueryResult).execute(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`, params);
      if (!result.rows || result.rows.length === 0) {
        throw new Error('查询未返回结果');
      }
      const row = result.rows[0] as QueryPlanResult;
      if (!row || !row['QUERY PLAN'] || !Array.isArray(row['QUERY PLAN']) || row['QUERY PLAN'].length === 0) {
        throw new Error('无法获取查询计划');
      }
      const analysis = row['QUERY PLAN'][0] as QueryPlanNode;
      
      const executionTime = Date.now() - startTime;
      const rowsExamined = this.extractRowsExamined(analysis);
      const rowsReturned = analysis['Execution Time'] ? 0 : (analysis['Actual Rows'] || 0);
      const indexUsed = this.extractIndexUsed(analysis);
      const recommendations = this.generateRecommendations(analysis, query);
      
      logger.debug({
        query,
        executionTime,
        rowsExamined,
        rowsReturned,
        indexUsed,
        recommendations,
      }, '查询分析完成');
      
      return {
        query,
        executionTime,
        rowsExamined,
        rowsReturned,
        indexUsed,
        recommendations,
      };
    } catch (error) {
       logger.error({ query, error: (error as Error).message }, '查询分析失败');
      throw error;
    }
  }



  private extractRowsExamined(plan: QueryPlanNode): number {
    if (plan.Plans) {
      return plan.Plans.reduce((total: number, p: QueryPlanNode) => {
        return total + this.extractRowsFromPlan(p);
      }, 0);
    }
    return plan['Actual Rows'] || 0;
  }

  private extractRowsFromPlan(plan: QueryPlanNode): number {
    if (plan.Plans) {
      return plan.Plans.reduce((total: number, p: QueryPlanNode) => {
        return total + (p['Actual Rows'] || 0);
      }, 0);
    }
    return plan['Actual Rows'] || 0;
  }

  private extractIndexUsed(plan: QueryPlanNode): string | null {
    if (plan.Plans) {
      for (const p of plan.Plans) {
        if (p['Node Type']?.includes('Index')) {
          return p['Index Name'] || 'unknown';
        }
      }
    }
    return null;
  }

  private generateRecommendations(plan: QueryPlanNode, query: string): string[] {
    const recommendations: string[] = [];
    
    // 检查全表扫描
    if (plan['Node Type'] === 'Seq Scan') {
      recommendations.push('考虑在查询字段上添加索引以避免全表扫描');
      recommendations.push('检查WHERE条件是否充分利用索引');
    }
    
    // 检查排序操作
    if (plan['Node Type'] === 'Sort') {
      recommendations.push('考虑添加覆盖索引以优化排序性能');
      recommendations.push('检查排序字段是否适合索引使用');
    }
    
    // 检查哈希连接
    if (plan['Node Type'] === 'Hash Join') {
      recommendations.push('考虑将小表设为哈希表以提升连接性能');
    }
    
    // 检查嵌套循环
    if (plan['Node Type'] === 'Nested Loop') {
      recommendations.push('考虑重构查询以避免嵌套循环');
      recommendations.push('使用临时表或CTE（Common Table Expression）');
    }
    
    // 检查Materialize视图
    if (plan['Node Type'] === 'Materialize') {
      recommendations.push('定期刷新Materialized视图');
      recommendations.push('考虑使用物化视图替代复杂查询');
    }
    
    // 检查大结果集
    const execTime = Number(plan['Execution Time']);
    if (execTime && execTime > 1000) {
      recommendations.push('考虑添加分页限制返回行数');
      recommendations.push('使用更精确的WHERE条件');
    }
    
    return recommendations;
  }

  // 生成索引建议
  async analyzeIndexUsage(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    
    try {
      const db = getDatabase();
      // 分析未使用的索引
      const unusedIndexes = await (db as unknown as QueryResult).execute(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND NOT indisprimary
        AND indexdef !~*PARTITION*
      `);
      
      for (const index of unusedIndexes.rows as IndexInfo[]) {
        const usageQuery = `
          SELECT COUNT(*) as usage_count
          FROM pg_stat_user_indexes 
          WHERE schemaname = $1 AND indexrelname = $2
        `;
        
        const usage = await (db as unknown as QueryResult).execute(usageQuery, [index.schemaname, index.indexname]);
        
        if (usage.rows && usage.rows.length > 0 && usage.rows[0].usage_count === 0) {
          suggestions.push({
            type: 'index',
            severity: 'medium',
            description: `未使用的索引: ${index.indexname}`,
            sql: `DROP INDEX IF EXISTS ${index.schemaname}.${index.indexname};`,
            impact: '释放存储空间，提升写入性能',
          });
        }
      }
      
      // 分析索引选择性
      const db = getDatabase();
      const lowSelectivityIndexes = await (db as unknown as QueryResult).execute(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          CASE 
            WHEN n_distinct >= 0.95 THEN 'excellent'
            WHEN n_distinct >= 0.8 THEN 'good'
            WHEN n_distinct >= 0.6 THEN 'fair'
            ELSE 'poor'
          END as selectivity,
          n_distinct,
          total_rows
        FROM (
           SELECT 
             s.schemaname,
             c.relname as tablename,
             i.indexname,
             s.n_distinct as n_distinct,
             c.reltuples as total_rows
           FROM pg_stats s
           JOIN pg_class c ON c.oid = s.relid
           JOIN pg_index i ON i.indrelid = c.oid
           WHERE s.schemaname = 'public'
             AND i.indrelid = c.oid
           GROUP BY s.schemaname, c.relname, i.indexname, s.n_distinct, c.reltuples
        ) AS analysis
        WHERE schemaname = 'public'
      ORDER BY selectivity DESC, n_distinct DESC
      `);
      
      for (const index of lowSelectivityIndexes.rows) {
        if (index.selectivity === 'poor') {
          suggestions.push({
            type: 'index',
            severity: 'high',
            description: `选择性低的索引: ${index.indexname} (${index.selectivity})`,
            sql: `-- 考虑删除或重建这个索引`,
            impact: '提升查询性能，减少索引维护成本',
          });
        }
      }
      
       logger.info({
        totalIndexes: unusedIndexes.rows.length,
        lowSelectivityIndexes: lowSelectivityIndexes.rows.length,
        suggestions: suggestions.length,
      }, '索引使用分析完成');
      
      return suggestions;
    } catch (error) {
       logger.error({ error: (error as Error).message }, '索引分析失败');
      return [];
    }
  }

  // 生成查询优化建议
  async generateQueryOptimizations(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    
    try {
      const db = getDatabase();
      // 查找慢查询
      const slowQueries = await (db as unknown as QueryResult).execute(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT 10
      `);
      
      for (const queryStat of slowQueries.rows as QueryStatRow[]) {
        const analysis = await this.analyzeQuery(queryStat.query as string);
        
        // 基于查询分析生成建议
        analysis.recommendations.forEach(rec => {
          suggestions.push({
            type: 'query',
            severity: analysis.executionTime > 5000 ? 'high' : 'medium',
            description: `慢查询优化: ${rec}`,
            sql: `-- 优化建议: ${rec}`,
            impact: `提升查询性能 ${(((queryStat.mean_time as number) - analysis.executionTime) / (queryStat.mean_time as number) * 100).toFixed(1)}%`,
          });
        });
      }
      
      // 检查N+1查询问题
      const n1Queries = await this.detectN1Problems();
      suggestions.push(...n1Queries);
      
       logger.info({
        slowQueriesFound: slowQueries.rows.length,
        totalSuggestions: suggestions.length,
      }, '查询优化分析完成');
      
      return suggestions;
    } catch (error) {
       logger.error({ error: (error as Error).message }, '查询优化分析失败');
      return [];
    }
  }

  private async detectN1Problems(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    
    try {
      const db = getDatabase();
      // 查找可能的N+1查询模式（在循环中的单记录查询）
      const n1Patterns = await (db as unknown as QueryResult).execute(`
        SELECT 
          schemaname,
          tablename,
          query
        FROM pg_stat_statements
        WHERE query LIKE '%SELECT % FROM % WHERE id = %'
          AND calls > 100
          AND mean_time > 50
      `);
      
      const processedQueries = new Set();
      
      for (const stat of n1Patterns.rows as QueryStatRow[]) {
        if (processedQueries.has(stat.query)) continue;
        processedQueries.add(stat.query);
        
        // 提取表名和字段
        const match = stat.query.match(/FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*[^;]+/i);
        if (match) {
          const tableName = match[1];
          const field = match[2];
          
          suggestions.push({
            type: 'query',
            severity: 'high',
            description: `潜在的N+1查询问题: ${tableName}.${field} 在循环中被重复查询`,
            sql: `-- 建议使用批量查询: SELECT * FROM ${tableName} WHERE ${field} IN (...)`,
            impact: '显著提升性能，减少数据库往返',
          });
        }
      }
      
      return suggestions;
    } catch (error) {
       logger.error({ error: (error as Error).message }, 'N+1查询问题检测失败');
      return [];
    }
  }

  // 生成数据库统计报告
  async generatePerformanceReport(): Promise<{
    totalTables: number;
    totalIndexes: number;
    slowQueries: number;
    topSlowQueries: Array<{
      query: string;
      meanTime: number;
      totalTime: number;
      calls: number;
    }>;
    indexSuggestions: OptimizationSuggestion[];
    querySuggestions: OptimizationSuggestion[];
  }> {
    try {
      const db = getDatabase();
      // 获取表统计
      const tableCount = await (db as unknown as QueryResult).execute(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`);
      const totalTables = parseInt((tableCount.rows[0] as CountResult).count);
      
      // 获取索引统计
      const indexCount = await (db as unknown as QueryResult).execute(`SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indisprimary = false`);
      const totalIndexes = parseInt((indexCount.rows[0] as CountResult).count);
      
      // 获取慢查询
      const slowQueries = await (db as unknown as QueryResult).execute(`
        SELECT COUNT(*) as count
        FROM pg_stat_statements
        WHERE mean_time > 1000
      `);
      const slowQueryCount = parseInt((slowQueries.rows[0] as CountResult).count);
      
      // 获取最慢的查询
      const topSlowQueries = await (db as unknown as QueryResult).execute(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements
        WHERE mean_time > 500
        ORDER BY mean_time DESC
        LIMIT 5
      `);
      
      // 生成优化建议
      const indexSuggestions = await this.analyzeIndexUsage();
      const querySuggestions = await this.generateQueryOptimizations();
      
      return {
        totalTables,
        totalIndexes,
        slowQueries: slowQueryCount,
        topSlowQueries: (topSlowQueries.rows as QueryStatRow[]).map(row => ({
          query: row.query,
          meanTime: row.mean_time,
          totalTime: row.total_time,
          calls: row.calls
        })),
        indexSuggestions,
        querySuggestions,
      };
    } catch (error) {
             logger.error({ error: error instanceof Error ? error.message : String(error) }, '性能报告生成失败');
      throw error;
    }
  }

  // 应用推荐的优化
  async applyOptimizations(suggestions: OptimizationSuggestion[]): Promise<{
    applied: number;
    failed: number;
    errors: string[];
  }> {
    let applied = 0;
    let failed = 0;
    const errors: string[] = [];
    const db = getDatabase();
      
      for (const suggestion of suggestions) {
        if (suggestion.type === 'index' && suggestion.severity === 'high') {
          try {
            await (db as unknown as QueryResult).execute(suggestion.sql);
            applied++;
                         logger.info({ sql: suggestion.sql }, '应用索引优化');
          } catch (error) {
            failed++;
            errors.push(`${suggestion.description}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      return { applied, failed, errors };
    }

  // 监控查询性能趋势
  async monitorPerformanceTrends(hours: number = 24): Promise<{
      avgExecutionTime: number;
      totalQueries: number;
      slowQueriesRate: number;
    }> {
      try {
        const db = getDatabase();
        const result = await (db as unknown as QueryResult).execute(`
          SELECT 
            AVG(mean_time) as avg_execution_time,
            SUM(calls) as total_queries,
            SUM(CASE WHEN mean_time > 1000 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as slow_queries_rate
          FROM pg_stat_statements
          WHERE query_start >= NOW() - INTERVAL '${hours} hours'
        `);
        
        const stats = result.rows[0];
        
        return {
          avgExecutionTime: parseFloat(stats.avg_execution_time as string),
          totalQueries: parseInt(stats.total_queries as string),
          slowQueriesRate: parseFloat(stats.slow_queries_rate as string),
        };
      } catch (error) {
         logger.error({ error: (error as Error).message }, 'Performance trend monitoring failed');
        throw error;
      }
    }
  }

// 导出便捷函数
export const queryOptimizer = new QueryOptimizer();
export const createQueryOptimizationReport = () => queryOptimizer.generatePerformanceReport();
export const analyzeQueryPerformance = (query: string, params?: unknown[]) => queryOptimizer.analyzeQuery(query, params);
export const getPerformanceTrends = (hours?: number) => queryOptimizer.monitorPerformanceTrends(hours);
