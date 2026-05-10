/**
 * 小智 Action Power Routes - 执行力协议API
 * 三级执行阈值 + 震动暗号 + 感知-决策-执行闭环
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ActionPower');

import { Router } from 'express';
import { z } from 'zod';
import { getErrorMessage } from '../lib/errors';
import { actionThreshold } from '../services/action-threshold';
import { hapticCodes } from '../services/haptic-codes';
import { actionOrchestrator } from '../services/action-orchestrator';
import { requireMaster, attachRole } from '../middleware/auth';

const router = Router();

router.use(attachRole);

const ActionProposalSchema = z.object({
  action: z.string().min(1),
  description: z.string().min(1),
  domain: z.enum(['DEVICE_CONTROL', 'COMMUNICATION', 'DOCUMENT', 'SCHEDULE', 'PAYMENT', 'CONTRACT', 'HEALTH_INTERVENTION']),
  riskCategories: z.array(z.enum(['FINANCIAL', 'LEGAL', 'SOCIAL', 'HEALTH', 'PRIVACY', 'OPERATIONAL'])).optional(),
  confidence: z.number().min(0).max(1).optional(),
  reversible: z.boolean().optional(),
  estimatedImpact: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  context: z.record(z.unknown()).optional(),
});

const ConfirmActionSchema = z.object({
  approved: z.boolean(),
  selectedOption: z.number().optional(),
});

const HapticSignalSchema = z.object({
  code: z.enum(['ALERT', 'OPPORTUNITY', 'CAUTION', 'CONFIRM', 'URGENT', 'RELAX', 'LIE_DETECTED', 'PRICE_HIGH', 'DEAL_GOOD', 'HEALTH_ALERT', 'MEETING_END', 'SILENT_EXIT']),
  context: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  devices: z.array(z.enum(['PHONE', 'GLASSES', 'WATCH'])).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
});

const PerceptionSignalSchema = z.object({
  type: z.enum(['VISUAL', 'AUDIO', 'BIOMETRIC', 'LOCATION', 'CONTEXT', 'DOCUMENT', 'COMMUNICATION']),
  source: z.string().min(1),
  data: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).optional(),
});

router.post('/threshold/evaluate', requireMaster, async (req, res) => {
  try {
    const parseResult = ActionProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: parseResult.error.errors });
    }
    const proposal = actionThreshold.createProposal(parseResult.data);
    const decision = await actionThreshold.evaluateAction(proposal);
    res.json({ success: true, proposal, decision });
  } catch (error) {
    logger.error({ err: error }, '风险评估失败');
    res.status(500).json({ success: false, error: '风险评估失败' });
  }
});

router.post('/threshold/confirm/:proposalId', requireMaster, async (req, res) => {
  try {
    const parseResult = ConfirmActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: '参数验证失败' });
    }
    const result = await actionThreshold.confirmAction(req.params.proposalId, parseResult.data.approved, parseResult.data.selectedOption);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: '确认操作失败' });
  }
});

router.get('/threshold/pending', async (req, res) => {
  try {
    const confirmations = actionThreshold.getPendingConfirmations();
    const shadows = actionThreshold.getShadowPlans();
    res.json({ success: true, pendingConfirmations: confirmations, shadowPlans: shadows });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取待处理操作失败' });
  }
});

router.get('/threshold/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = actionThreshold.getExecutionHistory(limit);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取执行历史失败' });
  }
});

router.get('/threshold/stats', async (req, res) => {
  try {
    const stats = actionThreshold.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取统计信息失败' });
  }
});

router.post('/haptic/send', requireMaster, async (req, res) => {
  try {
    const parseResult = HapticSignalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: parseResult.error.errors });
    }
    const message = await hapticCodes.sendHapticSignal(parseResult.data);
    res.json({ success: true, message });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) || '发送触觉信号失败' });
  }
});

router.post('/haptic/quick/:alertType', requireMaster, async (req, res) => {
  try {
    const alertType = req.params.alertType.toUpperCase() as 'LIE' | 'OPPORTUNITY' | 'DANGER' | 'SUCCESS' | 'HEALTH';
    const message = await hapticCodes.sendQuickAlert(alertType);
    res.json({ success: true, message });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/haptic/negotiation/:hint', async (req, res) => {
  try {
    const hint = req.params.hint.toUpperCase() as 'PUSH' | 'HOLD' | 'RETREAT' | 'CLOSE';
    const message = await hapticCodes.sendNegotiationHint(hint);
    res.json({ success: true, message });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/haptic/patterns', async (req, res) => {
  try {
    const patterns = hapticCodes.getAllPatterns();
    res.json({ success: true, patterns });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取震动模式失败' });
  }
});

router.get('/haptic/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const messages = hapticCodes.getRecentMessages(limit);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取消息历史失败' });
  }
});

router.post('/haptic/acknowledge/:messageId', async (req, res) => {
  try {
    const success = hapticCodes.acknowledgeMessage(req.params.messageId);
    res.json({ success, message: success ? '已确认' : '消息未找到' });
  } catch (error) {
    res.status(500).json({ success: false, error: '确认消息失败' });
  }
});

router.get('/haptic/devices', async (req, res) => {
  try {
    const devices = hapticCodes.getDeviceStatus();
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取设备状态失败' });
  }
});

router.post('/orchestrate/signal', requireMaster, async (req, res) => {
  try {
    const parseResult = PerceptionSignalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: parseResult.error.errors });
    }
    const signal = actionOrchestrator.createSignal(parseResult.data);
    const result = await actionOrchestrator.processSignal(signal);
    res.json({ success: true, result });
  } catch (error) {
    logger.error({ err: error }, '信号编排处理失败');
    res.status(500).json({ success: false, error: '信号处理失败' });
  }
});

router.get('/orchestrate/scenarios', async (req, res) => {
  try {
    const scenarios = actionOrchestrator.getScenarios();
    res.json({ success: true, scenarios });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取场景失败' });
  }
});

router.post('/orchestrate/scenarios/:id/toggle', requireMaster, async (req, res) => {
  try {
    const { enabled } = req.body;
    const success = actionOrchestrator.toggleScenario(req.params.id, enabled);
    res.json({ success, message: success ? '场景已更新' : '场景未找到' });
  } catch (error) {
    res.status(500).json({ success: false, error: '切换场景失败' });
  }
});

router.post('/orchestrate/simulate/:scenarioId', requireMaster, async (req, res) => {
  try {
    const result = await actionOrchestrator.simulateScenario(req.params.scenarioId, req.body);
    if (!result) {
      return res.status(404).json({ success: false, error: '场景未找到' });
    }
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: '模拟失败' });
  }
});

router.get('/orchestrate/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = actionOrchestrator.getOrchestrationHistory(limit);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取历史失败' });
  }
});

router.get('/orchestrate/stats', async (req, res) => {
  try {
    const stats = actionOrchestrator.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

export default router;
