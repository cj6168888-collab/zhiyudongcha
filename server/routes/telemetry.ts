/**
 * 遥测监控 API 路由
 * Phase 4.3 - 系统运行状态可视化
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Telemetry');

import { Router, Request, Response } from 'express';
import { telemetryService } from '../services/telemetry-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

const router = Router();

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = telemetryService.getDashboardData();
    res.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = telemetryService.getSystemHealth();
    res.json({
      success: true,
      data: health,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/requests', async (_req: Request, res: Response) => {
  try {
    const metrics = telemetryService.getRequestMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/models', async (_req: Request, res: Response) => {
  try {
    const metrics = telemetryService.getModelMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/hp', async (_req: Request, res: Response) => {
  try {
    const metrics = telemetryService.getHPMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/cost', async (_req: Request, res: Response) => {
  try {
    const cost = telemetryService.getTotalCost();
    res.json({
      success: true,
      data: cost,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/endpoints', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const endpoints = telemetryService.getTopEndpoints(limit);
    res.json({
      success: true,
      data: endpoints,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const unacknowledgedOnly = req.query.unacknowledged === 'true';
    
    const alerts = unacknowledgedOnly 
      ? telemetryService.getUnacknowledgedAlerts()
      : telemetryService.getRecentAlerts(limit);
    
    res.json({
      success: true,
      data: alerts,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const success = telemetryService.acknowledgeAlert(alertId);
    
    res.json({
      success,
      message: success ? '告警已确认' : '告警不存在',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/record', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;
    
    switch (type) {
      case 'request':
        telemetryService.recordRequest(data.path, data.durationMs, data.success);
        break;
      case 'model':
        telemetryService.recordModelCall(
          data.model, 
          data.inputTokens, 
          data.outputTokens, 
          data.durationMs, 
          data.success
        );
        break;
      case 'hp':
        telemetryService.consumeHP(data.amount, data.module);
        break;
      case 'error':
        telemetryService.recordError(data.message, data.source);
        break;
      default:
        return res.status(400).json({ success: false, error: '无效的记录类型' });
    }
    
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const dashboard = telemetryService.getDashboardData();
    const cost = telemetryService.getTotalCost();
    
    res.json({
      success: true,
      data: {
        status: dashboard.systemHealth.status,
        uptime: dashboard.systemHealth.uptime,
        requests: dashboard.requestMetrics,
        hp: dashboard.hpMetrics,
        cost,
        alertCount: dashboard.recentAlerts.length,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
