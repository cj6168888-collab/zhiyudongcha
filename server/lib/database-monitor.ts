/**
 * 数据库连接池监控
 * 实时监控数据库连接池状态
 */

import { pool } from '../db';
import { logger } from './logger';

export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  minConnections: number;
  utilization: number;
}

export interface QueryMetrics {
  queryId: string;
  query: string;
  duration: number;
  timestamp: number;
}

/**
 * 获取数据库连接池状态
 */
export function getPoolStatus(): PoolMetrics | null {
  if (!pool) {
    return null;
  }

  const poolState = pool;

  return {
    totalConnections: poolState.totalCount,
    idleConnections: poolState.idleCount,
    waitingClients: poolState.waitingCount,
    maxConnections: poolState.options.max ?? 20,
    minConnections: poolState.options.min ?? 2,
    utilization: Math.round(
      ((poolState.totalCount - poolState.idleCount) / (poolState.options.max ?? 20)) * 100
    ),
  };
}

/**
 * 检查连接池健康状态
 */
export function checkPoolHealth(): { healthy: boolean; issues: string[] } {
  const status = getPoolStatus();

  if (!status) {
    return {
      healthy: false,
      issues: ['数据库连接池未初始化'],
    };
  }

  const issues: string[] = [];

  // 检查连接池使用率
  if (status.utilization > 80) {
    issues.push(`连接池使用率过高: ${status.utilization}%`);
  }

  // 检查等待队列
  if (status.waitingClients > 5) {
    issues.push(`等待连接客户端过多: ${status.waitingClients}`);
  }

  // 检查空闲连接
  if (status.idleConnections === 0 && status.totalConnections >= status.maxConnections) {
    issues.push('无可用空闲连接');
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

/**
 * 记录查询指标
 */
const queryHistory: QueryMetrics[] = [];
const MAX_QUERY_HISTORY = 1000;

export function recordQuery(queryId: string, query: string, duration: number): void {
  queryHistory.push({
    queryId,
    query,
    duration,
    timestamp: Date.now(),
  });

  // 保持历史记录在限制内
  if (queryHistory.length > MAX_QUERY_HISTORY) {
    queryHistory.shift();
  }
}

/**
 * 获取慢查询统计
 */
export function getSlowQueries(thresholdMs: number = 1000): QueryMetrics[] {
  return queryHistory
    .filter((q) => q.duration > thresholdMs)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);
}

/**
 * 获取查询性能统计
 */
export function getQueryStats(): {
  total: number;
  avgDuration: number;
  p50: number;
  p95: number;
  p99: number;
} {
  if (queryHistory.length === 0) {
    return {
      total: 0,
      avgDuration: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const durations = queryHistory.map((q) => q.duration).sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);

  const percentile = (arr: number[], p: number): number => {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  return {
    total: queryHistory.length,
    avgDuration: Math.round(total / durations.length),
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
  };
}

/**
 * 定期检查连接池健康状态
 */
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startPoolMonitoring(intervalMs: number = 30000): void {
  if (healthCheckInterval) {
    return;
  }

  healthCheckInterval = setInterval(() => {
    const health = checkPoolHealth();

    if (!health.healthy) {
      logger.warn({
        component: 'DatabasePool',
        issues: health.issues,
      }, '数据库连接池健康检查异常');
    }

    const status = getPoolStatus();
    if (status) {
      logger.debug({
        component: 'DatabasePool',
        total: status.totalConnections,
        idle: status.idleConnections,
        waiting: status.waitingClients,
        utilization: status.utilization,
      }, '数据库连接池状态');
    }
  }, intervalMs);
}

export function stopPoolMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}
