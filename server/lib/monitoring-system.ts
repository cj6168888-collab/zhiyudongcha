
import { createServiceLogger } from '../lib/logger';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../lib/openapi-generator';
import { diContainer } from '../lib/di-container';

const logger = createServiceLogger('MonitoringSystem');

/**
 * 监控指标类型
 */
export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    free: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
  database: {
    connections: number;
    queriesPerSecond: number;
    avgResponseTime: number;
    slowQueries: number;
    errorRate: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    memoryUsage: number;
    keysCount: number;
  };
  requests: {
    total: number;
    successRate: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

/**
 * 告警级别
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * 告警规则
 */
export interface AlertRule {
  id: string;
  name: string;
  level: AlertLevel;
  metric: keyof SystemMetrics;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  condition?: {
    operator: 'and' | 'or';
    rules: Array<{
      metric: keyof SystemMetrics;
      threshold: number;
      comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    }>;
  };
  message: string;
  enabled: boolean;
  cooldownMinutes?: number;
  lastTriggered?: number;
}

/**
 * 告警事件
 */
export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  level: AlertLevel;
  metric: keyof SystemMetrics;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  resolved: boolean;
  metadata?: Record<string, any>;
}

/**
 * 系统监控管理器
 */
export class MonitoringSystem {
  private metrics: SystemMetrics;
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, AlertEvent> = new Map();
  private monitoringActive = false;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(alert: AlertEvent) => void> = [];

  constructor() {
    this.metrics = this.initializeMetrics();
    this.setupDefaultRules();
    logger.info('监控系统初始化');
  }

  /**
   * 初始化系统指标
   */
  private initializeMetrics(): SystemMetrics {
    return {
      timestamp: Date.now(),
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0],
        cores: 4
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
        heapUsed: 0,
        heapTotal: 0
      },
      disk: {
        used: 0,
        total: 0,
        percentage: 0,
        free: 0
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        connections: 0
      },
      database: {
        connections: 0,
        queriesPerSecond: 0,
        avgResponseTime: 0,
        slowQueries: 0,
        errorRate: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        memoryUsage: 0,
        keysCount: 0
      },
      requests: {
        total: 0,
        successRate: 0,
        errorRate: 0,
        avgResponseTime: 0
      }
    };
  }

  /**
   * 设置默认告警规则
   */
  private setupDefaultRules(): void {
    // CPU使用率告警
    this.addRule({
      id: 'cpu_high',
      name: 'CPU使用率过高',
      level: AlertLevel.WARNING,
      metric: 'cpu',
      threshold: 80,
      comparison: 'gt',
      message: 'CPU使用率超过80%',
      condition: {
        operator: 'and',
        rules: [
          { metric: 'cpu', threshold: 70, comparison: 'gt' }
        ]
      },
      cooldownMinutes: 5
    });

    this.addRule({
      id: 'cpu_critical',
      name: 'CPU使用率危急',
      level: AlertLevel.CRITICAL,
      metric: 'cpu',
      threshold: 95,
      comparison: 'gt',
      message: 'CPU使用率超过95%',
      cooldownMinutes: 2
    });

    // 内存使用率告警
    this.addRule({
      id: 'memory_high',
      name: '内存使用率过高',
      level: AlertLevel.WARNING,
      metric: 'memory',
      threshold: 85,
      comparison: 'gt',
      message: '内存使用率超过85%',
      condition: {
        operator: 'and',
        rules: [
          { metric: 'memory', threshold: 75, comparison: 'gt' }
        ]
      },
      cooldownMinutes: 5
    });

    this.addRule({
      id: 'memory_critical',
      name: '内存使用率危急',
      level: AlertLevel.CRITICAL,
      metric: 'memory',
      threshold: 95,
      comparison: 'gt',
      message: '内存使用率超过95%',
      cooldownMinutes: 2
    });

    // 磁盘使用率告警
    this.addRule({
      id: 'disk_high',
      name: '磁盘使用率过高',
      level: AlertLevel.WARNING,
      metric: 'disk',
      threshold: 85,
      comparison: 'gt',
      message: '磁盘使用率超过85%',
      cooldownMinutes: 10
    });

    // 数据库连接数告警
    this.addRule({
      id: 'db_connections_high',
      name: '数据库连接数过高',
      level: AlertLevel.WARNING,
      metric: 'database',
      threshold: 'connections',
      comparison: 'gt',
      message: '数据库连接数超过阈值',
      condition: {
        operator: 'and',
        rules: [
          { metric: 'database', threshold: 100, comparison: 'gt' }
        ]
      },
      cooldownMinutes: 5
    });

    // 响应时间告警
    this.addRule({
      id: 'response_time_high',
      name: '平均响应时间过长',
      level: AlertLevel.WARNING,
      metric: 'requests',
      threshold: 'avgResponseTime',
      comparison: 'gt',
      message: '平均响应时间超过阈值',
      condition: {
        operator: 'and',
        rules: [
          { metric: 'requests', threshold: 1000, comparison: 'gt' }
        ]
      },
      cooldownMinutes: 10
    });

    // 错误率告警
    this.addRule({
      id: 'error_rate_high',
      name: '错误率过高',
      level: AlertLevel.ERROR,
      metric: 'requests',
      threshold: 'errorRate',
      comparison: 'gt',
      message: '请求错误率过高',
      condition: {
        operator: 'and',
        rules: [
          { metric: 'requests', threshold: 0.05, comparison: 'gt' },
          { metric: 'requests', threshold: 10, comparison: 'gt' }
        ]
      },
      cooldownMinutes: 5
    });

    logger.info('默认告警规则已设置', {
      rulesCount: this.rules.size
    });
  }

  /**
   * 启动监控
   */
  public start(): void {
    if (this.monitoringActive) {
      logger.warn('监控系统已启动');
      return;
    }

    this.monitoringActive = true;

    // 启动指标收集
    this.metricsCollectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 5000); // 每5秒收集一次指标

    // 启动告警检查
    this.alertCheckInterval = setInterval(() => {
      this.checkAlertRules();
    }, 10000); // 每10秒检查一次告警规则

    logger.info('监控系统已启动', {
      metricsInterval: 5000,
      alertInterval: 10000
    });
  }

  /**
   * 停止监控
   */
  public stop(): void {
    if (!this.monitoringActive) {
      return;
    }

    this.monitoringActive = false;

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    logger.info('监控系统已停止');
  }

  /**
   * 收集系统指标
   */
  private collectSystemMetrics(): void {
    try {
      // 收集CPU指标
      const cpuUsage = process.cpuUsage();
      this.metrics.cpu.usage = cpuUsage.user;
      this.metrics.cpu.loadAverage = [cpuUsage.user]; // 简化处理

      // 收集内存指标
      const memoryUsage = process.memoryUsage();
      this.metrics.memory.used = memoryUsage.heapUsed;
      this.metrics.memory.total = memoryUsage.heapTotal;
      this.metrics.memory.percentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      this.metrics.memory.heapUsed = memoryUsage.heapUsed;
      this.metrics.memory.heapTotal = memoryUsage.heapTotal;

      // 模拟磁盘使用情况
      this.metrics.disk.used = Math.random() * 107374182400; // 随机模拟
      this.metrics.disk.total = 53687091200; // 5GB
      this.metrics.disk.percentage = (this.metrics.disk.used / this.metrics.disk.total) * 100;
      this.metrics.disk.free = this.metrics.disk.total - this.metrics.disk.used;

      // 模拟网络指标
      this.metrics.network.bytesIn = Math.random() * 1048576; // 随机
      this.metrics.network.bytesOut = Math.random() * 1048576;
      this.metrics.network.connections = Math.floor(Math.random() * 100);

      // 收集数据库指标（如果可用）
      try {
        const db = diContainer.tryResolve('database');
        if (db) {
          // 这里应该从实际的数据库监控器获取指标
          this.metrics.database.connections = Math.floor(Math.random() * 50) + 10;
          this.metrics.database.queriesPerSecond = Math.random() * 1000 + 100;
          this.metrics.database.avgResponseTime = Math.random() * 200 + 50;
          this.metrics.database.slowQueries = Math.floor(Math.random() * 10);
          this.metrics.database.errorRate = Math.random() * 0.02;
        }
      } catch (error) {
        logger.warn('无法获取数据库指标', { error: (error as Error).message });
      }

      // 收集缓存指标（如果可用）
      try {
        const cache = diContainer.tryResolve('multiLevelCache');
        if (cache) {
          const cacheStats = cache.getStats();
          this.metrics.cache.hitRate = cacheStats.hitRate;
          this.metrics.cache.missRate = (100 - cacheStats.hitRate);
          this.metrics.cache.memoryUsage = cacheStats.memoryUsage;
          this.metrics.cache.keysCount = cacheStats.l1Size;
        }
      } catch (error) {
        logger.warn('无法获取缓存指标', { error: (error as Error).message });
      }

      // 收集请求指标
      this.metrics.requests.total = Math.floor(this.metrics.requests.total + Math.random() * 10);
      this.metrics.requests.successRate = Math.max(0, 100 - Math.random() * 5 - this.metrics.requests.errorRate);
      this.metrics.requests.errorRate = Math.max(0, Math.random() * 5);
      this.metrics.requests.avgResponseTime = Math.max(50, Math.random() * 200 + 100);

      this.metrics.timestamp = Date.now();

      // 调试日志
      logger.debug('系统指标已收集', {
        cpu: this.metrics.cpu.usage,
        memory: this.metrics.memory.percentage,
        database: this.metrics.database.connections,
        cache: this.metrics.cache.hitRate
      });

    } catch (error) {
      logger.error('系统指标收集失败', { error: (error as Error).message });
    }
  }

  /**
   * 检查告警规则
   */
  private checkAlertRules(): void {
    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        if (this.shouldTriggerAlert(rule)) {
          this.triggerAlert(rule);
        }
      } catch (error) {
        logger.error('告警规则检查失败', {
          ruleId,
          ruleName: rule.name,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * 判断是否应该触发告警
   */
  private shouldTriggerAlert(rule: AlertRule): boolean {
    const now = Date.now();

    // 检查冷却时间
    if (rule.lastTriggered) {
      const cooldownMs = (rule.cooldownMinutes || 0) * 60 * 1000;
      if (now - rule.lastTriggered < cooldownMs) {
        return false; // 还在冷却期
      }
    }

    // 检查基础阈值
    const currentValue = this.getMetricValue(rule.metric);
    if (this.compareValues(currentValue, rule.threshold, rule.comparison)) {
      return true;
    }

    // 检查复杂条件
    if (rule.condition && rule.condition.rules.length > 0) {
      let allConditionsMet = true;
      let anyConditionMet = false;

      for (const conditionRule of rule.condition.rules) {
        const conditionValue = this.getMetricValue(conditionRule.metric);
        const isMet = this.compareValues(conditionValue, conditionRule.threshold, conditionRule.comparison);

        if (isMet) {
          anyConditionMet = true;
        } else {
          allConditionsMet = false;
        }
      }

      const operator = rule.condition.operator;
      if (operator === 'and') {
        // 所有条件都必须满足
        return allConditionsMet;
      } else if (operator === 'or') {
        // 任一条件满足即可
        return anyConditionMet;
      }
    }

    return false;
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metric: keyof SystemMetrics): number {
    const value = this.getNestedValue(this.metrics, metric);
    return typeof value === 'number' ? value : 0;
  }

  /**
   * 获取嵌套对象值
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 比较值
   */
  private compareValues(value: number, threshold: number, comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'): boolean {
    switch (comparison) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(rule: AlertRule): void {
    const now = Date.now();
    const currentValue = this.getMetricValue(rule.metric);

    const alert: AlertEvent = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      level: rule.level,
      metric: rule.metric,
      value: currentValue,
      threshold: rule.threshold,
      message: rule.message,
      timestamp: now,
      resolved: false,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name
      }
    };

    this.alerts.set(alert.id, alert);
    rule.lastTriggered = now;

    // 通知监听器
    this.notifyListeners(alert);

    // 记录日志
    const logLevel = rule.level === AlertLevel.CRITICAL ? 'error' :
                      rule.level === AlertLevel.ERROR ? 'error' : 'warn';

    logger[logLevel]('告警触发', {
      alertId: alert.id,
      ruleName: rule.name,
      level: rule.level,
      metric: rule.metric,
      value: currentValue,
      threshold: rule.threshold,
      message: alert.message
    });
  }

  /**
   * 通知监听器
   */
  private notifyListeners(alert: AlertEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(alert);
      } catch (error) {
        logger.error('告警监听器执行失败', {
          alertId: alert.id,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * 添加告警规则
   */
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info('告警规则已添加', {
      ruleId: rule.id,
      ruleName: rule.name,
      level: rule.level,
      threshold: rule.threshold
    });
  }

  /**
   * 移除告警规则
   */
  public removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('告警规则已移除', { ruleId });
    }
    return removed;
  }

  /**
   * 启用告警规则
   */
  public enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      logger.info('告警规则已启用', { ruleId });
    }
  }

  /**
   * 禁用告警规则
   */
  public disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      logger.info('告警规则已禁用', { ruleId });
    }
  }

  /**
   * 获取当前指标
   */
  public getCurrentMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取所有告警规则
   */
  public getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取活跃的告警
   */
  public getActiveAlerts(limit: number = 100): AlertEvent[] {
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return activeAlerts;
  }

  /**
   * 解析告警
   */
  public resolveAlert(alertId: string, resolution?: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.metadata = { ...alert.metadata, resolution, resolvedAt: new Date().toISOString() };

      logger.info('告警已解析', {
        alertId,
        ruleName: alert.ruleName,
        resolution
      });
    }
  }

  /**
   * 添加监听器
   */
  public addListener(listener: (alert: AlertEvent) => void): void {
    this.listeners.push(listener);
    logger.debug('告警监听器已添加', { listenerCount: this.listeners.length });
  }

  /**
   * 移除监听器
   */
  public removeListener(listener: (alert: AlertEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
      logger.debug('告警监听器已移除', { listenerCount: this.listeners.length });
    }
  }

  /**
   * 获取系统健康状态
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    score: number;
  } {
    let issues: string[] = [];
    let score = 100;

    // 检查关键指标
    if (this.metrics.cpu.usage > 90) {
      issues.push('CPU使用率过高');
      score -= 20;
    }

    if (this.metrics.memory.percentage > 90) {
      issues.push('内存使用率过高');
      score -= 25;
    }

    if (this.metrics.requests.errorRate > 0.1) {
      issues.push('请求错误率过高');
      score -= 30;
    }

    if (this.metrics.database.avgResponseTime > 2000) {
      issues.push('数据库响应时间过长');
      score -= 25;
    }

    let status: 'healthy';
    if (score < 70) {
      status = 'critical';
    } else if (score < 85) {
      status = 'degraded';
    }

    return {
      status,
      issues,
      score: Math.max(0, score)
    };
  }

  /**
   * 生成监控报告
   */
  public generateMonitoringReport() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      activeAlerts: this.getActiveAlerts(10),
      rules: {
        total: this.rules.size,
        enabled: Array.from(this.rules.values()).filter(rule => rule.enabled).length
      },
      health: this.getHealthStatus()
    };
  }
}

/**
 * 创建监控系统实例
 */
export function createMonitoringSystem(): MonitoringSystem {
  return new MonitoringSystem();
}

/**
 * 全局监控系统实例
 */
export const monitoringSystem = createMonitoringSystem();
