/**
 * 小智 Risk Prediction Routes - 风险预测系统API
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RiskPrediction');

import { Router, Request, Response } from 'express';
import { riskPredictionService, type RiskType } from '../services/risk-prediction';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await riskPredictionService.getRiskStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const profiles = await riskPredictionService.getAllProfiles();
    res.json({ success: true, profiles });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/profiles/high-risk', async (req: Request, res: Response) => {
  try {
    const profiles = await riskPredictionService.getHighRiskMembers();
    res.json({ success: true, profiles });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/member/:memberId', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const profile = await riskPredictionService.getMemberProfile(memberId);
    if (!profile) {
      return res.status(404).json({ success: false, error: '该成员尚未进行风险评估' });
    }
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/member/:memberId/assess', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const profile = await riskPredictionService.assessMemberRisk(memberId);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { status, priority, riskType } = req.query;
    const alerts = await riskPredictionService.getAlerts({
      status: status as string | undefined,
      priority: priority as string | undefined,
      riskType: riskType as string | undefined,
    });
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/alert/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    const result = await riskPredictionService.acknowledgeAlert(alertId, operatorId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/alert/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolution } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!resolution) {
      return res.status(400).json({ success: false, error: '请提供解决说明' });
    }
    
    const result = await riskPredictionService.resolveAlert(alertId, resolution, operatorId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/alert/:alertId/dismiss', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!reason) {
      return res.status(400).json({ success: false, error: '请提供忽略原因' });
    }
    
    const result = await riskPredictionService.dismissAlert(alertId, reason, operatorId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/type/:riskType/description', (req: Request, res: Response) => {
  try {
    const { riskType } = req.params;
    const description = riskPredictionService.getRiskTypeDescription(riskType as RiskType);
    res.json({ success: true, riskType, description });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
