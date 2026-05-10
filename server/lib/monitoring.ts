
import { createServiceLogger } from '../lib/logger';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

const logger = createServiceLogger('MetricsCollector');

// 指标类型定义
export interface MetricValue {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  contentLength: number;
  userId?: string;
  error?: string;
}

export interface BusinessMetrics {
  activeUsers: number;
  totalConversations: number;
  activeConversations: number;
  messagesSent: number;
  aiRequestsCount: number;
  errorRate: number;
}

export interface SystemMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  eventLoopLag: number;
  openFiles: number;
  databaseConnections: number;
}

// 分布式追踪上下文
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  userId?: string;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

// Span接口
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  tags: Record<string, string>;
  logs: Array<{
    timestamp: number;
      level: string;
      message: string;
    }>;
  metadata?: Record<string, any>;
  error?: Error;
}

// 指标收集器
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, number[]> = new Map();
  private timers: Map<string, number> = new Map();
  private activeSpans: Map<string, Span> = new Map();

  constructor() {
    // 定期清理旧数据
    setInterval(() => {
      this.cleanupOldData();
    }, 60000); // 每分钟清理一次
  }

  // 计数器相关方法
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.metrics.set(name, []);
    this.timers.set(name, Date.now());
    this.emit('metric', { name, value, type: 'counter', labels, timestamp: Date.now() });
  }

  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.set(name, []);
    this.emit('metric', { name, value, type: 'gauge', labels, timestamp: Date.now() });
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
    this.emit('metric', { name, value, type: 'histogram', labels, timestamp: Date.now() });
  }

  recordTimer(name: string, duration: number, labels?: Record<string, string>): void {
    this.emit('metric', { name, value: duration, type: 'timer', labels, timestamp: Date.now() });
  }

  startTimer(name: string, labels?: Record<string, string>): string {
    const timerId = `timer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.timers.set(timerId, Date.now());
    this.emit('timerStart', { name, timerId, labels, timestamp: Date.now() });
    return timerId;
  }

  endTimer(timerId: string): void {
    const startTime = this.timers.get(timerId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.recordTimer(timerId.split('_')[1], duration);
      this.timers.delete(timerId);
    }
  }

  // 获取指标统计
  getMetricStats(name: string): {
    count?: number;
    sum?: number;
    avg?: number;
    min?: number;
    max?: number;
    p95?: number;
    p99?: number;
  } {
    const values = this.metrics.get(name) || [];

    if (values.length === 0) return {};

    const sorted = values.sort((a, b) => a - b);

    return {
      count: values.length,
      sum: values.reduce((sum, val) => sum + val, 0),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  private percentile(sorted: number[], percentile: number): number {
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24小时前
    const now = Date.now();

    // 清理旧的指标数据
    for (const [name, values] of this.metrics.entries()) {
      const filteredValues = values.filter(timestamp => timestamp > cutoffTime);
      this.metrics.set(name, filteredValues);
    }
  }

  // 获取所有指标
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, values] of this.metrics.entries()) {
      result[name] = this.getMetricStats(name);
    }

    return result;
  }
}

// 分布式追踪管理器
export class TraceManager extends EventEmitter {
  private activeTraces: Map<string, TraceContext> = new Map();
  private completedSpans: Map<string, Span> = new Map();

  startTrace(context: Partial<TraceContext>): TraceContext {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const traceContext: TraceContext = {
      traceId,
      spanId,
      parentSpanId: context.parentSpanId,
      operationName: context.operationName || 'unknown',
      startTime: Date.now(),
      userId: context.userId,
      tags: context.tags || {},
      metadata: context.metadata || {},
    };

    this.activeTraces.set(traceId, traceContext);
    this.emit('traceStart', traceContext);

    logger.debug('开始追踪', { traceId, operationName: traceContext.operationName });

    return traceContext;
  }

  createSpan(traceContext: TraceContext, operationName: string, parentSpanId?: string): Span {
    const spanId = this.generateSpanId();

    const span: Span = {
      traceId: traceContext.traceId,
      spanId,
      parentSpanId: parentSpanId,
      operationName,
      startTime: Date.now(),
      status: 'running',
      tags: {},
      logs: [],
      metadata: {},
    };

    this.activeTraces.get(traceContext.traceId)!.spans[spanId] = span;
    this.emit('spanStart', span);

    return span;
  }

  finishSpan(span: Span, status: 'completed' | 'error' = 'completed', error?: Error): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
      };
      span.logs.push({
        timestamp: Date.now(),
        level: 'error',
        message: error.message,
      });
    }

    // 从活跃追踪中移除完成的span
    const traceContext = this.activeTraces.get(span.traceId);
    if (traceContext) {
      delete traceContext.spans[span.spanId];

      // 检查是否所有span都已完成
      const allSpansCompleted = Object.keys(traceContext.spans).every(id =>
        this.completedSpans.has(`${traceContext.traceId}_${id}`)
      );

      if (allSpansCompleted) {
        traceContext.endTime = Date.now();
        this.completedSpans.set(span.traceId, span); // 保存最后一个span作为代表
        this.activeTraces.delete(traceContext.traceId);
        this.emit('traceComplete', traceContext);
      }
    }

    this.emit('spanEnd', span);
  }

  addLog(span: Span, level: string, message: string, metadata?: Record<string, unknown>): void {
    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      metadata: metadata || {},
    });
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  getActiveTrace(traceId: string): TraceContext | undefined {
    return this.activeTraces.get(traceId);
  }

  getActiveTracesCount(): number {
    return this.activeTraces.size;
  }

  // 清理旧的追踪数据
  cleanupOldTraces(maxAge: number = 300000): void {
    const cutoffTime = Date.now() - maxAge;
    let cleaned = 0;

    for (const [traceId, context] of this.activeTraces.entries()) {
      if (context.startTime < cutoffTime) {
        this.activeTraces.delete(traceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('清理旧追踪数据', { cleaned });
    }
  }
}

// 系统性能监控器
export class SystemMonitor {
  private metricsCollector: MetricsCollector;
  private traceManager: TraceManager;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(metricsCollector: MetricsCollector, traceManager: TraceManager) {
    this.metricsCollector = metricsCollector;
    this.traceManager = traceManager;
    this.startPeriodicCollection();
  }

  private startPeriodicCollection(intervalMs: number = 30000): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }

  async collectSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // 内存指标
      this.metricsCollector.recordGauge('system.memory.used', memUsage.heapUsed, {
        source: 'nodejs',
        type: 'heap'
      });

      this.metricsCollector.recordGauge('system.memory.total', memUsage.heapTotal);
      this.metricsCollector.recordGauge('system.memory.percentage', (memUsage.heapUsed / memUsage.heapTotal) * 100, {
        source: 'nodejs',
        type: 'percentage'
      });

      // CPU指标
      this.metricsCollector.recordGauge('system.cpu.user', cpuUsage.user, {
        source: 'nodejs',
        type: 'user'
      });

      this.metricsCollector.recordGauge('system.cpu.system', cpuUsage.system, {
        source: 'nodejs',
        type: 'system'
      });

      // 事件循环延迟
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        this.metricsCollector.recordTimer('system.event_loop_lag', lag);
      });

    } catch (error) {
      logger.error('收集系统指标失败', { error: error.message });
    }
  }

  // 收集业务指标
  async collectBusinessMetrics(): Promise<void> {
    try {
      // 这里需要从数据库或缓存中获取实际数据
      const activeUsers = await this.getActiveUsersCount();
      const totalConversations = await this.getTotalConversationsCount();
      const activeConversations = await this.getActiveConversationsCount();
      const messagesSent = this.getMessagesSentCount();
      const aiRequestsCount = this.getAIRequestsCount();
      const errorRate = this.getErrorRate();

      this.metricsCollector.recordGauge('business.active_users', activeUsers);
      this.metricsCollector.recordGauge('business.total_conversations', totalConversations);
      this.metricsCollector.recordGauge('business.active_conversations', activeConversations);
      this.metricsCollector.recordCounter('business.messages_sent', messagesSent);
      this.metricsCollector.recordCounter('business.ai_requests', aiRequestsCount);
      this.metricsCollector.recordGauge('business.error_rate', errorRate);

    } catch (error) {
      logger.error('收集业务指标失败', { error: error.message });
    }
  }

  private async getActiveUsersCount(): Promise<number> {
    // 从数据库获取活跃用户数
    return 10; // 模拟值
  }

  private async getTotalConversationsCount(): Promise<number> {
    return 50; // 模拟值
  }

  private async getActiveConversationsCount(): Promise<number> {
    return 25; // 模拟值
  }

  private getMessagesSentCount(): number {
    return this.metricsCollector.getMetricStats('business.messages_sent').sum || 0;
  }

  private getAIRequestsCount(): number {
    return this.metricsCollector.getMetricStats('business.ai_requests').sum || 0;
  }

  private getErrorRate(): number {
    const totalRequests = this.getAIRequestsCount();
    const totalErrors = this.metricsCollector.getMetricStats('business.errors')?.sum || 0;
    return totalRequests > 0 ? (totalErrors / totalRequests) : 0;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// 请求指标中间件
export function createRequestMetricsMiddleware(metricsCollector: MetricsCollector) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const contentLength = req.body ? JSON.stringify(req.body).length : 0;

      metricsCollector.recordTimer('http.request_duration', responseTime, {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
      });

      if (res.statusCode >= 400) {
        metricsCollector.incrementCounter('http.errors', 1, {
          status_code: res.statusCode.toString(),
          method: req.method,
          path: req.path,
        });
      }

      metricsCollector.recordHistogram('http.request_content_length', contentLength, {
        method: req.method,
        path: req.path,
      });
    });

    next();
  };
}

// 性能报告生成器
export class PerformanceReporter {
  constructor(
    private metricsCollector: MetricsCollector,
    private traceManager: TraceManager
  ) {}

  async generateReport(): Promise<{
    summary: {
      totalMetrics: number;
      avgResponseTime: number;
      errorRate: number;
    };
    system: SystemMetrics;
    business: BusinessMetrics;
    topSlowQueries: Array<{
      query: string;
      meanTime: number;
      totalTime: number;
    }>;
    traces: {
      totalTraces: number;
      avgDuration: number;
      completedTraces: number;
      errorTraces: number;
    };
    recommendations: string[];
  }> {
    const metrics = this.metricsCollector.getAllMetrics();
    const traces = this.traceManager.getActiveTracesCount();

    // 生成性能摘要
    const totalMetrics = Object.values(metrics).reduce((sum, stats) => {
      return sum + (stats.count || 0);
    }, 0);

    const systemMetrics: SystemMetrics = {
      memoryUsage: {
        used: metrics['system.memory.used']?.avg || 0,
        total: metrics['system.memory.total']?.avg || 0,
        percentage: metrics['system.memory.percentage']?.avg || 0,
      },
      cpuUsage: metrics['system.cpu.user']?.avg || 0,
      eventLoopLag: metrics['system.event_loop_lag']?.avg || 0,
      openFiles: 0, // 需要从process获取
      databaseConnections: 10, // 需要从连接池获取
    };

    const businessMetrics: BusinessMetrics = {
      activeUsers: metrics['business.active_users']?.value || 0,
      totalConversations: metrics['business.total_conversations']?.value || 0,
      activeConversations: metrics['business.active_conversations']?.value || 0,
      messagesSent: metrics['business.messages_sent']?.sum || 0,
      aiRequestsCount: metrics['business.ai_requests']?.sum || 0,
      errorRate: metrics['business.error_rate']?.value || 0,
    };

    const avgResponseTime = metrics['http.request_duration']?.avg || 0;
    const errorRate = metrics['http.errors']?.sum / (metrics['http.request_duration']?.count || 1);

    // 生成建议
    const recommendations: string[] = [];

    // 分析错误率
    if (errorRate > 0.05) {
      recommendations.push('错误率过高，需要优化错误处理');
    }

    // 分析响应时间
    if (avgResponseTime > 1000) {
      recommendations.push('平均响应时间过长，需要优化查询性能');
    }

    // 分析内存使用率
    if (systemMetrics.memoryUsage.percentage > 80) {
      recommendations.push('内存使用率过高，需要优化内存管理');
    }

    return {
      summary: {
        totalMetrics,
        avgResponseTime,
        errorRate,
      },
      system: systemMetrics,
      business: businessMetrics,
      topSlowQueries: [],
      traces: {
        totalTraces: traces,
        avgDuration: 0, // 需要从完成的span计算
        completedTraces: this.traceManager.completedSpans.size,
        errorTraces: 0,
      },
      recommendations,
    };
  }
}

// 导出默认实例
export const metricsCollector = new MetricsCollector();
export const traceManager = new TraceManager();
export const systemMonitor = new SystemMonitor(metricsCollector, traceManager);
export const performanceReporter = new PerformanceReporter(metricsCollector, traceManager);
