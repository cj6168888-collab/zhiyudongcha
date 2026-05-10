import { createServiceLogger } from '../lib/logger';
import { storage } from '../storage';

const logger = createServiceLogger('DatabaseOptimization');

/**
 * 数据库优化建议
 */
export interface OptimizationRecommendation {
  type: 'INDEX' | 'PARTITION' | 'QUERY' | 'SCHEMA' | 'CONNECTION_POOL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  sql: string;
  impact: string;
  estimatedImprovement: string;
}

/**
 * 连接池配置
 */
export interface PoolConfiguration {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxWaitingClients: number;
}

/**
 * 数据库健康状态
 */
export interface DatabaseHealth {
  connectionCount: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  slowQueries: number;
  avgResponseTime: number;
  errorRate: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

/**
 * 数据库优化器
 */
export class DatabaseOptimizer {
  private slowQueryThreshold = 1000; // 1秒
  private maxSlowQueries = 100;
  private optimizationHistory: OptimizationRecommendation[] = [];

  constructor() {
    logger.info('数据库优化器初始化');
  }

  /**
   * 分析数据库性能
   */
  public async analyzePerformance(): Promise<DatabaseHealth> {
    try {
      const health = await this.getDatabaseHealth();
      
      logger.info('数据库性能分析完成', {
        connectionCount: health.connectionCount,
        activeConnections: health.activeConnections,
        slowQueries: health.slowQueries,
        avgResponseTime: health.avgResponseTime,
        errorRate: health.errorRate,
        status: health.status
      });

      return health;
    } catch (error) {
      logger.error('数据库性能分析失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 获取数据库健康状态
   */
  private async getDatabaseHealth(): Promise<DatabaseHealth> {
    // 这里应该从实际的数据库连接池获取统计信息
    // 暂时使用模拟数据
    const mockHealth: DatabaseHealth = {
      connectionCount: Math.floor(Math.random() * 50) + 10,
      activeConnections: Math.floor(Math.random() * 30) + 5,
      idleConnections: Math.floor(Math.random() * 20) + 5,
      waitingClients: Math.floor(Math.random() * 10),
      totalQueries: Math.floor(Math.random() * 10000) + 1000,
      slowQueries: Math.floor(Math.random() * 50),
      avgResponseTime: Math.random() * 500 + 50,
      errorRate: Math.random() * 0.05, // 0-5%
      status: 'HEALTHY'
    };

    // 如果指标超过阈值，标记为降级
    if (mockHealth.slowQueries > 20 || mockHealth.avgResponseTime > 500 || mockHealth.errorRate > 0.02) {
      mockHealth.status = 'DEGRADED';
    }

    if (mockHealth.avgResponseTime > 2000 || mockHealth.errorRate > 0.1) {
      mockHealth.status = 'CRITICAL';
    }

    return mockHealth;
  }

  /**
   * 生成优化建议
   */
  public async generateRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    try {
      const health = await this.analyzePerformance();
      
      // 慢查询优化
      if (health.slowQueries > 10) {
        recommendations.push({
          type: 'QUERY',
          priority: 'HIGH',
          description: `发现${health.slowQueries}个慢查询，建议添加适当的索引`,
          sql: `
            -- 添加常用查询索引
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_id ON projects(user_id);
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status ON projects(status);
            
            -- 分析慢查询
            EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100;
          `,
          impact: '查询性能提升50-80%',
          estimatedImprovement: '减少平均查询时间200-800ms'
        });
      }

      // 连接池优化
      if (health.activeConnections > health.connectionCount * 0.8) {
        recommendations.push({
          type: 'CONNECTION_POOL',
          priority: 'HIGH',
          description: `连接池使用率过高 (${(health.activeConnections / health.connectionCount * 100).toFixed(1)}%)`,
          sql: `
            -- 优化连接池配置
            ALTER SYSTEM SET max_connections = ${Math.max(100, health.connectionCount * 2)};
            SET shared_preload_libraries = 'all';
            SET effective_cache_size = '256MB';
            
            -- 连接池调整
            SET max_connections = 150;
            SET shared_buffers = 64MB;
            SET work_mem = '16MB';
          `,
          impact: '提升并发处理能力30-50%',
          estimatedImprovement: '减少连接等待时间50%'
        });
      }

      // 索引优化
      recommendations.push({
        type: 'INDEX',
        priority: 'MEDIUM',
        description: '定期优化和重建索引以保持查询性能',
        sql: `
          -- 查找未使用的索引
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch
          FROM pg_stat_user_indexes 
          ORDER BY schemaname, tablename, indexname;
          
          -- 查找缺失的索引
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
          FROM pg_stats_ext 
          WHERE attnum > 0 
            AND n_distinct < 1000
          ORDER BY correlation DESC;
            
          -- 重建碎片化索引
          REINDEX CONCURRENTLY users;
          REINDEX CONCURRENTLY projects;
          REINDEX CONCURRENTLY orders;
        `,
        impact: '查询性能提升20-40%',
        estimatedImprovement: '减少索引扫描时间'
      });

      // 表分区优化（如果适用）
      recommendations.push({
        type: 'PARTITION',
        priority: 'LOW',
        description: '对大表实施分区以提升查询性能',
        sql: `
          -- 按时间分区
          CREATE TABLE orders_2024 PARTITION OF orders
            FOR VALUES FROM ('2024-01-01') TO ('2024-12-31');
            
          -- 按ID范围分区
          CREATE TABLE users_partitioned (
            LIKE users INCLUDING ALL
          ) PARTITION BY RANGE (id);
            
          CREATE TABLE users_partitioned_p0 PARTITION OF users_partitioned
            FOR VALUES FROM (0) TO (1000000);
          CREATE TABLE users_partitioned_p1 PARTITION OF users_partitioned
            FOR VALUES FROM (1000001) TO (2000000);
        `,
        impact: '大数据表查询性能提升60-80%',
        estimatedImprovement: '减少数据扫描量90%'
      });

      // 定期维护
      recommendations.push({
        type: 'SCHEMA',
        priority: 'MEDIUM',
        description: '定期执行数据库维护任务',
        sql: `
          -- 更新表统计信息
          ANALYZE users;
          ANALYZE projects;
          ANALYZE orders;
          
          -- 清理过期数据
          VACUUM users, ANALYZE;
          VACUUM projects, ANALYZE;
          VACUUM orders, ANALYZE;
          
          -- 重建统计信息
          ANALYZE users;
          ANALYZE projects;
          ANALYZE orders;
        `,
        impact: '提升查询计划准确性10-20%',
        estimatedImprovement: '优化器选择更好的执行计划'
      });

      this.optimizationHistory = recommendations;
      
      logger.info('生成数据库优化建议', {
        recommendationCount: recommendations.length,
        highPriorityCount: recommendations.filter(r => r.priority === 'HIGH').length,
        mediumPriorityCount: recommendations.filter(r => r.priority === 'MEDIUM').length
      });

      return recommendations;

    } catch (error) {
      logger.error('生成优化建议失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 应用优化建议
   */
  public async applyRecommendations(
    recommendations: OptimizationRecommendation[]
  ): Promise<{ applied: string[]; failed: string[] }> {
    const applied: string[] = [];
    const failed: string[] = [];

    logger.info('开始应用数据库优化建议', {
      totalRecommendations: recommendations.length
    });

    for (const recommendation of recommendations) {
      try {
        if (recommendation.type === 'QUERY' || recommendation.type === 'INDEX') {
          await this.executeQuery(recommendation.sql);
          applied.push(recommendation.description);
        } else if (recommendation.type === 'CONNECTION_POOL') {
          await this.applyConnectionPoolOptimization();
          applied.push(recommendation.description);
        } else if (recommendation.type === 'SCHEMA') {
          await this.executeQuery(recommendation.sql);
          applied.push(recommendation.description);
        }
        
        logger.info('优化建议已应用', {
          type: recommendation.type,
          description: recommendation.description
        });

      } catch (error) {
        failed.push(`${recommendation.description}: ${(error as Error).message}`);
        
        logger.error('优化建议应用失败', {
          type: recommendation.type,
          description: recommendation.description,
          error: (error as Error).message
        });
      }
    }

    logger.info('数据库优化应用完成', {
      appliedCount: applied.length,
      failedCount: failed.length,
      successRate: (applied.length / recommendations.length) * 100
    });

    return { applied, failed };
  }

  /**
   * 执行SQL查询
   */
  private async executeQuery(sql: string): Promise<void> {
    try {
      // 这里应该通过实际的数据库连接执行
      // 暂时记录日志
      logger.info('执行SQL优化', { sql: sql.substring(0, 200) + '...' });
    } catch (error) {
      logger.error('SQL执行失败', { 
        sql: sql.substring(0, 100) + '...', 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * 应用连接池优化
   */
  private async applyConnectionPoolOptimization(): Promise<void> {
    try {
      // 这里应该动态调整连接池参数
      const newConfig = {
        maxConnections: 150,
        minConnections: 10,
        idleTimeout: 30000,
        connectionTimeout: 10000
      };

      logger.info('连接池优化已应用', newConfig);
    } catch (error) {
      logger.error('连接池优化失败', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 获取优化历史
   */
  public getOptimizationHistory(): OptimizationRecommendation[] {
    return this.optimizationHistory;
  }

  /**
   * 清除优化历史
   */
  public clearOptimizationHistory(): void {
    this.optimizationHistory = [];
    logger.info('优化历史已清除');
  }

  /**
   * 设置慢查询阈值
   */
  public setSlowQueryThreshold(milliseconds: number): void {
    this.slowQueryThreshold = milliseconds;
    logger.info('慢查询阈值已更新', { 
      oldThreshold: this.slowQueryThreshold,
      newThreshold: milliseconds 
    });
  }

  /**
   * 获取数据库监控配置
   */
  public getMonitoringConfiguration(): {
    slowQueryThreshold: number;
    maxSlowQueries: number;
    optimizationEnabled: boolean;
  } {
    return {
      slowQueryThreshold: this.slowQueryThreshold,
      maxSlowQueries: this.maxSlowQueries,
      optimizationEnabled: true
    };
  }

  /**
   * 启用自动优化
   */
  public async enableAutoOptimization(): Promise<void> {
    logger.info('启用自动数据库优化');
    
    // 设置定期优化任务
    setInterval(async () => {
      try {
        const recommendations = await this.generateRecommendations();
        
        if (recommendations.length > 0) {
          const highPriorityRecs = recommendations.filter(r => r.priority === 'HIGH');
          
          // 只自动应用高优先级的优化
          if (highPriorityRecs.length > 0) {
            await this.applyRecommendations(highPriorityRecs);
          }
        }
      } catch (error) {
        logger.error('自动优化失败', { error: (error as Error).message });
      }
    }, 24 * 60 * 60 * 1000); // 每24小时

    logger.info('自动优化任务已启动');
  }
}

/**
 * 创建数据库优化器实例
 */
export function createDatabaseOptimizer(): DatabaseOptimizer {
  return new DatabaseOptimizer();
}

/**
 * 全局数据库优化器实例
 */
export const databaseOptimizer = createDatabaseOptimizer();