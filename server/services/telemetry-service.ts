/**
 * 小智遥测与监控服务 (Telemetry Service)
 * Phase 4.3 - 系统运行状态可视化
 * 
 * 功能：
 * 1. 核心指标收集（请求量、响应时间、错误率）
 * 2. 模型调用分布统计
 * 3. HP消耗追踪
 * 4. API成本计算
 * 5. 实时状态仪表盘数据
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('Telemetry');

export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  requestsPerMinute: number;
}

export interface ModelMetrics {
  model: string;
  calls: number;
  totalTokens: number;
  avgResponseTimeMs: number;
  errors: number;
  estimatedCostUsd: number;
}

export interface HPMetrics {
  totalConsumed: number;
  regenerated: number;
  currentBalance: number;
  consumptionByModule: Record<string, number>;
  consumptionByHour: MetricPoint[];
}

export interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  uptime: number;
  memoryUsage: { used: number; total: number; percent: number };
  cpuUsage: number;
  activeConnections: number;
  queueDepth: number;
  lastError?: { message: string; timestamp: number };
}

export interface DashboardData {
  systemHealth: SystemHealth;
  requestMetrics: RequestMetrics;
  modelMetrics: ModelMetrics[];
  hpMetrics: HPMetrics;
  recentAlerts: Alert[];
  topEndpoints: { path: string; count: number; avgTime: number }[];
}

export interface Alert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  source: string;
  timestamp: number;
  acknowledged: boolean;
}

const MODEL_COSTS: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'qwen-turbo': { inputPer1k: 0.0008, outputPer1k: 0.002 },
  'qwen-plus': { inputPer1k: 0.004, outputPer1k: 0.012 },
  'qwen-max': { inputPer1k: 0.04, outputPer1k: 0.12 },
  'qwen-vl-plus': { inputPer1k: 0.008, outputPer1k: 0.008 },
  'deepseek-chat': { inputPer1k: 0.0001, outputPer1k: 0.0002 },
  'doubao': { inputPer1k: 0.0008, outputPer1k: 0.002 },
};

class TelemetryService {
  private startTime: number = Date.now();
  private requestTimes: number[] = [];
  private requestCounts = { total: 0, success: 0, failed: 0 };
  private endpointStats: Map<string, { count: number; totalTime: number }> = new Map();
  private modelStats: Map<string, ModelMetrics> = new Map();
  private hpBalance: number = 10000;
  private hpConsumed: number = 0;
  private hpRegenerated: number = 0;
  private moduleConsumption: Record<string, number> = {};
  private hourlyConsumption: MetricPoint[] = [];
  private alerts: Alert[] = [];
  private lastError?: { message: string; timestamp: number };

  constructor() {
    logger.info('[Telemetry] 遥测监控服务已启动');
    
    setInterval(() => this.recordHourlyMetrics(), 60 * 60 * 1000);
    setInterval(() => this.regenerateHP(), 60 * 1000);
    setInterval(() => this.cleanupOldData(), 24 * 60 * 60 * 1000);
  }

  recordRequest(path: string, durationMs: number, success: boolean): void {
    this.requestCounts.total++;
    if (success) {
      this.requestCounts.success++;
    } else {
      this.requestCounts.failed++;
    }

    this.requestTimes.push(durationMs);
    if (this.requestTimes.length > 10000) {
      this.requestTimes = this.requestTimes.slice(-10000);
    }

    const stats = this.endpointStats.get(path) || { count: 0, totalTime: 0 };
    stats.count++;
    stats.totalTime += durationMs;
    this.endpointStats.set(path, stats);

    if (durationMs > 5000) {
      this.addAlert('WARNING', `慢请求检测: ${path} 耗时 ${durationMs}ms`, 'REQUEST_MONITOR');
    }
  }

  recordModelCall(
    model: string, 
    inputTokens: number, 
    outputTokens: number, 
    durationMs: number, 
    success: boolean
  ): void {
    const stats = this.modelStats.get(model) || {
      model,
      calls: 0,
      totalTokens: 0,
      avgResponseTimeMs: 0,
      errors: 0,
      estimatedCostUsd: 0,
    };

    stats.calls++;
    stats.totalTokens += inputTokens + outputTokens;
    stats.avgResponseTimeMs = (stats.avgResponseTimeMs * (stats.calls - 1) + durationMs) / stats.calls;
    
    if (!success) {
      stats.errors++;
    }

    const costs = MODEL_COSTS[model] || { inputPer1k: 0.001, outputPer1k: 0.002 };
    stats.estimatedCostUsd += (inputTokens * costs.inputPer1k + outputTokens * costs.outputPer1k) / 1000;

    this.modelStats.set(model, stats);

    const hpCost = Math.ceil((inputTokens + outputTokens) / 100);
    this.consumeHP(hpCost, 'AI_MODEL');
  }

  consumeHP(amount: number, module: string): void {
    this.hpBalance = Math.max(0, this.hpBalance - amount);
    this.hpConsumed += amount;
    this.moduleConsumption[module] = (this.moduleConsumption[module] || 0) + amount;

    if (this.hpBalance < 1000) {
      this.addAlert('WARNING', `HP余量不足: ${this.hpBalance}`, 'HP_MONITOR');
    }
    if (this.hpBalance <= 0) {
      this.addAlert('CRITICAL', 'HP耗尽！系统进入节能模式', 'HP_MONITOR');
    }
  }

  private regenerateHP(): void {
    const regenAmount = 10;
    this.hpBalance = Math.min(10000, this.hpBalance + regenAmount);
    this.hpRegenerated += regenAmount;
  }

  recordError(message: string, source: string): void {
    this.lastError = { message, timestamp: Date.now() };
    this.addAlert('ERROR', message, source);
  }

  addAlert(severity: Alert['severity'], message: string, source: string): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      severity,
      message,
      source,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }

    logger.info(`[Telemetry] ${severity}: ${message}`);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  getRequestMetrics(): RequestMetrics {
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const len = sorted.length;

    const uptimeMinutes = (Date.now() - this.startTime) / 60000;
    const rpm = uptimeMinutes > 0 ? this.requestCounts.total / uptimeMinutes : 0;

    return {
      totalRequests: this.requestCounts.total,
      successfulRequests: this.requestCounts.success,
      failedRequests: this.requestCounts.failed,
      avgResponseTimeMs: len > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / len) : 0,
      p50ResponseTimeMs: len > 0 ? sorted[Math.floor(len * 0.5)] : 0,
      p95ResponseTimeMs: len > 0 ? sorted[Math.floor(len * 0.95)] : 0,
      p99ResponseTimeMs: len > 0 ? sorted[Math.floor(len * 0.99)] : 0,
      requestsPerMinute: Math.round(rpm * 100) / 100,
    };
  }

  getModelMetrics(): ModelMetrics[] {
    return Array.from(this.modelStats.values())
      .sort((a, b) => b.calls - a.calls);
  }

  getHPMetrics(): HPMetrics {
    return {
      totalConsumed: this.hpConsumed,
      regenerated: this.hpRegenerated,
      currentBalance: this.hpBalance,
      consumptionByModule: { ...this.moduleConsumption },
      consumptionByHour: [...this.hourlyConsumption],
    };
  }

  getSystemHealth(): SystemHealth {
    const memoryUsage = process.memoryUsage();
    const usedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const totalMb = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    const errorRate = this.requestCounts.total > 0 
      ? this.requestCounts.failed / this.requestCounts.total 
      : 0;

    let status: SystemHealth['status'] = 'HEALTHY';
    if (errorRate > 0.1 || this.hpBalance < 500) {
      status = 'CRITICAL';
    } else if (errorRate > 0.05 || this.hpBalance < 2000) {
      status = 'DEGRADED';
    }

    return {
      status,
      uptime: Date.now() - this.startTime,
      memoryUsage: {
        used: usedMb,
        total: totalMb,
        percent: Math.round((usedMb / totalMb) * 100),
      },
      cpuUsage: 0,
      activeConnections: 0,
      queueDepth: 0,
      lastError: this.lastError,
    };
  }

  getTopEndpoints(limit: number = 10): { path: string; count: number; avgTime: number }[] {
    return Array.from(this.endpointStats.entries())
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        avgTime: Math.round(stats.totalTime / stats.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getRecentAlerts(limit: number = 20): Alert[] {
    return this.alerts.slice(0, limit);
  }

  getUnacknowledgedAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  getDashboardData(): DashboardData {
    return {
      systemHealth: this.getSystemHealth(),
      requestMetrics: this.getRequestMetrics(),
      modelMetrics: this.getModelMetrics(),
      hpMetrics: this.getHPMetrics(),
      recentAlerts: this.getRecentAlerts(10),
      topEndpoints: this.getTopEndpoints(5),
    };
  }

  private recordHourlyMetrics(): void {
    this.hourlyConsumption.push({
      timestamp: Date.now(),
      value: this.hpConsumed,
    });

    if (this.hourlyConsumption.length > 168) {
      this.hourlyConsumption = this.hourlyConsumption.slice(-168);
    }
  }

  private cleanupOldData(): void {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(a => a.timestamp > oneWeekAgo);
    this.hourlyConsumption = this.hourlyConsumption.filter(p => p.timestamp > oneWeekAgo);
    logger.info('[Telemetry] 已清理过期数据');
  }

  getTotalCost(): { totalUsd: number; byModel: Record<string, number> } {
    const byModel: Record<string, number> = {};
    let totalUsd = 0;

    for (const [model, stats] of Array.from(this.modelStats.entries())) {
      byModel[model] = Math.round(stats.estimatedCostUsd * 10000) / 10000;
      totalUsd += stats.estimatedCostUsd;
    }

    return {
      totalUsd: Math.round(totalUsd * 10000) / 10000,
      byModel,
    };
  }
}

export const telemetryService = new TelemetryService();
export default telemetryService;
