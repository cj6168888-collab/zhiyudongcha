/**
 * 安全审计API路由
 * Phase 4.1 - 免疫系统激活
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SecurityAudit');

import { Router, Request, Response } from 'express';
import { threatDetector } from '../services/threat-detector';
import { immuneOrchestrator } from '../services/immune-orchestrator';
import { killSwitchService } from '../services/kill-switch';

const router = Router();

interface HandleThreatBody {
  handledBy?: string;
  additionalActions?: string[];
}

interface SimulateAttackBody {
  attackType?: string;
}

interface SecurityRuleBody {
  id?: string;
  name?: string;
  threatType?: string;
  [key: string]: unknown;
}

interface SecurityEventBody {
  action?: string;
  actor?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  deviceId?: string;
  result?: string;
}

interface ScanBody {
  deviceId?: string;
  scanType?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

router.get('/threats', async (_req: Request, res: Response) => {
  try {
    const active = threatDetector.getActiveThreats();
    res.json({
      success: true,
      data: {
        active,
        count: active.length,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/threats/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = threatDetector.getThreatHistory(limit);
    res.json({
      success: true,
      data: history,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/threats/stats', async (_req: Request, res: Response) => {
  try {
    const stats = threatDetector.getThreatStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/threats/:threatId/handle', async (req: Request<{ threatId: string }, unknown, HandleThreatBody>, res: Response) => {
  try {
    const { threatId } = req.params;
    const { handledBy, additionalActions } = req.body;
    
    const result = await threatDetector.handleThreat(
      threatId,
      handledBy || 'MASTER',
      additionalActions
    );
    
    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/threats/simulate', async (req: Request<unknown, unknown, SimulateAttackBody>, res: Response) => {
  try {
    const { attackType } = req.body;
    
    if (!attackType) {
      return res.status(400).json({ 
        success: false, 
        error: '请指定攻击类型 (attackType)' 
      });
    }
    
    const threat = await threatDetector.simulateAttack(attackType);
    
    res.json({
      success: true,
      message: threat ? '攻击模拟成功，已触发威胁检测' : '攻击模拟完成，未达到触发阈值',
      data: threat,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/rules', async (_req: Request, res: Response) => {
  try {
    const rules = threatDetector.getRules();
    res.json({
      success: true,
      data: rules,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.put('/rules/:ruleId', async (req: Request<{ ruleId: string }, unknown, Partial<SecurityRuleBody>>, res: Response) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;
    
    const success = threatDetector.updateRule(ruleId, updates);
    
    res.json({
      success,
      message: success ? '规则已更新' : '规则不存在',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/rules', async (req: Request<unknown, unknown, SecurityRuleBody>, res: Response) => {
  try {
    const rule = req.body;
    
    if (!rule.id || !rule.name || !rule.threatType) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要字段: id, name, threatType' 
      });
    }
    
    const success = threatDetector.addRule(rule);
    
    res.json({
      success,
      message: success ? '规则已添加' : '规则ID已存在',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete('/rules/:ruleId', async (req: Request<{ ruleId: string }>, res: Response) => {
  try {
    const { ruleId } = req.params;
    const success = threatDetector.deleteRule(ruleId);
    
    res.json({
      success,
      message: success ? '规则已删除' : '规则不存在',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { actor, action, limit, startDate, endDate } = req.query;
    
    const logs = await threatDetector.getAuditLogs({
      actor: actor as string,
      action: action as string,
      limit: limit ? parseInt(limit as string) : 100,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/event', async (req: Request<unknown, unknown, SecurityEventBody>, res: Response) => {
  try {
    const event = req.body;
    
    if (!event.action || !event.actor) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要字段: action, actor' 
      });
    }
    
    await threatDetector.logSecurityEvent({
      action: event.action,
      actor: event.actor,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata,
      ipAddress: event.ipAddress || req.ip,
      deviceId: event.deviceId,
      result: event.result || 'SUCCESS',
    });
    
    res.json({
      success: true,
      message: '安全事件已记录',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string;
    
    if (!deviceId) {
      return res.status(400).json({ 
        success: false, 
        error: '请指定设备ID (deviceId)' 
      });
    }
    
    const report = immuneOrchestrator.getHealthReport(deviceId);
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/scan', async (req: Request<unknown, unknown, ScanBody>, res: Response) => {
  try {
    const { deviceId, scanType } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ 
        success: false, 
        error: '请指定设备ID (deviceId)' 
      });
    }
    
    const result = await immuneOrchestrator.performScan(deviceId, scanType || 'FULL');
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const threatStats = threatDetector.getThreatStats();
    const activeThreats = threatDetector.getActiveThreats();
    const rules = threatDetector.getRules();
    
    res.json({
      success: true,
      data: {
        summary: {
          activeThreats: threatStats.active,
          totalThreats: threatStats.total,
          rulesEnabled: rules.filter(r => r.enabled).length,
          totalRules: rules.length,
        },
        threatsByServeity: threatStats.bySeverity,
        threatsByType: threatStats.byType,
        recentThreats: activeThreats.slice(0, 5),
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
