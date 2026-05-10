import { Request, Response } from 'express';
import { createServiceLogger } from '../lib/logger';
import { metricsCollector, traceManager, systemMonitor, createRequestMetricsMiddleware } from '../lib/monitoring';
import { ApiResponseSchema } from '../types/common';

const logger = createServiceLogger('PerformanceAPI');

// 性能监控API端点
export class PerformanceAPIController {
  // 获取实时指标
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = metricsCollector.getAllMetrics();
      const performanceReport = { summary: 'Performance report unavailable' };
      const performanceTrends = await systemMonitor.getPerformanceTrends?.() ?? { trend: 'stable' };
      
      const response = {
        success: true,
        data: {
          metrics,
          performanceReport,
          performanceTrends,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('获取性能指标失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: '获取性能指标失败',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 获取查询性能分析
  async getQueryAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: '缺少query参数',
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      const analysis = await metricsCollector.analyzePerformance(query as string);
      
      const response = {
        success: true,
        data: analysis,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('查询分析失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYSIS_ERROR',
          message: '查询分析失败',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 获取系统健康检查
  async getHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const performanceTrends = await systemMonitor.monitorPerformanceTrends(1); // 最近1小时
      
      // 判断系统健康状况
      let status = 'healthy';
      const issues: string[] = [];
      
      if (performanceTrends.avgResponseTime > 2000) {
        status = 'degraded';
        issues.push('响应时间过长');
      }
      
      if (performanceTrends.errorRate > 0.1) {
        status = 'degraded';
        issues.push('错误率过高');
      }
      
      if (performanceTrends.memoryUsage.percentage > 85) {
        status = 'degraded';
        issues.push('内存使用率过高');
      }
      
      const response = {
        success: true,
        data: {
          status,
          issues,
          performanceTrends,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      const statusCode = status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error('健康检查失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: '健康检查失败',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 获取慢查询列表
  async getSlowQueries(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const performanceReport = await performanceReporter.generateReport();
      
      const response = {
        success: true,
        data: {
          slowQueries: performanceReport.topSlowQueries.slice(0, limit),
          totalSlowQueries: performanceReport.summary.slowQueries,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('获取慢查询失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'SLOW_QUERIES_ERROR',
          message: '获取慢查询列表失败',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 创建追踪会话
  async createTrace(req: Request, res: Response): Promise<void> {
    try {
      const { operationName, tags, metadata } = req.body;
      
      const traceId = await traceManager.startTrace({
        operationName: operationName || 'unknown',
        userId: req.session?.user?.id,
        tags,
        metadata,
      });
      
      const response = {
        success: true,
        data: {
          traceId,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('创建追踪失败', { error: error.message });
      logger.error('创建追踪失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'TRACE_ERROR',
          message: '创建追踪失败',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 结束追踪会话
  async endTrace(req: Request, res: Response): Promise<void> {
    try {
      const { traceId, status, logs, error } = req.body;
      
      const traceContext = traceManager.getActiveTrace(traceId);
      if (!traceContext) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TRACE_NOT_FOUND',
            message: '追踪不存在',
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      if (status) {
        traceManager.finishSpan(traceId, status, error);
      }
      
      const response = {
        success: true,
        data: {
          traceId,
          status: 'completed',
          duration: traceContext ? Date.now() - traceContext.startTime : 0,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('结束追踪失败', { error: error.message });
      res.status(500).json({
        error: 'TRACE_END_ERROR',
        message: '结束追踪失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 创建操作span
  async createSpan(req: Request, res: Response): Promise<void> {
    try {
      const { traceId, operationName, parentSpanId, tags, metadata } = req.body;
      
      const span = traceManager.createSpan(traceContext || '', operationName || 'unknown', parentSpanId);
      
      const response = {
        success: true,
        data: {
          traceId,
          spanId: span.spanId,
          parentSpanId,
          operationName,
          startTime: span.startTime,
          status: 'running',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('创建span失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: {
          code: 'SPAN_ERROR',
          completed: '创建span失败',
          message: '创建span失败',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 添加span日志
  async addSpanLog(req: Request, res: Response): Promise<void> {
    try {
      const { traceId, spanId, level, message, metadata } = req.body;
      
      const traceContext = traceManager.getActiveTrace(traceId);
      if (!traceContext) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TRACE_NOT_FOUND',
            message: '追踪不存在',
          },
          timestamp: Date.now().toISOString(),
        });
      }
      
      traceManager.addLog(spanId, level || 'info', message, metadata);
      
      const response = {
        success: true,
        timestamp: Date.now().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'SPAN_LOG_ERROR',
        message: '添加span日志失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 获取活跃追踪
  async getActiveTraces(req: Request, res: Response): Promise<void> {
    try {
      const activeTracesCount = traceManager.getActiveTracesCount();
      
      const traces = [];
      
      // 获取所有活跃追踪的基本信息
      for (const [traceId, context] of traceManager.activeTraces.entries()) {
        traces.push({
          traceId,
          operationName: context.operationName,
          startTime: context.startTime,
          status: context.status,
          tags: context.tags,
          metadata: context.metadata,
        });
      }
      
      const response = {
        success: true,
        data: {
          activeTracesCount,
          traces,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('获取活跃追踪失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'ACTIVE_TRACES_ERROR',
        message: '获取活跃追踪失败',
        timestamp: Date.now().toISOString(),
      });
    }
  }
}

// 导出API路由配置
export const performanceRoutes = [
  {
    method: 'get',
    path: '/metrics',
    handler: getMetrics,
  },
  {
    method: 'get',
    path: '/metrics/performance',
    handler: getPerformanceTrends,
  },
  {
    method: 'get',
    path: '/health/performance',
    handler: getHealthCheck,
  },
  {
    method: 'get',
    path: '/queries/slow',
    handler: getSlowQueries,
  },
  {
    method: 'post',
    path: '/traces',
    handler: createTrace,
  },
  {
    method: 'post',
    path: '/traces/:traceId/end',
    handler: endTrace,
  },
  {
    method: 'post',
    path: '/traces/:traceId/spans',
    handler: createSpan,
  },
  {
    method: 'post',
    path: '/traces/:traceId/logs',
    handler: addSpanLog,
  },
  {
    method: 'get',
    path: '/traces/active',
    handler: getActiveTraces,
  },
];