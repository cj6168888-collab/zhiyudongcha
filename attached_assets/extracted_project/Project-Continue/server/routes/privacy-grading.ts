/**
 * 小智 Privacy Grading Routes - 动态隐私分级API
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, Request, Response } from 'express';
import { privacyGradingService, type PrivacyLevel } from '../services/privacy-grading';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const devices = await privacyGradingService.getAllDevicesStatus();
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/device/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const status = await privacyGradingService.getDeviceStatus(deviceId);
    if (!status) {
      return res.status(404).json({ success: false, error: '设备未注册' });
    }
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/device/:deviceId/level', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const levelInfo = await privacyGradingService.getCurrentLevel(deviceId);
    res.json({ success: true, ...levelInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/device/:deviceId/initialize', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { memberId } = req.body;
    const config = await privacyGradingService.initializeDevice(deviceId, memberId);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/device/:deviceId/override', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { level, durationMinutes, reason } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!level || !durationMinutes || !reason) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const result = await privacyGradingService.setTemporaryOverride(
      deviceId,
      level as PrivacyLevel,
      durationMinutes,
      reason,
      operatorId
    );
    
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.delete('/device/:deviceId/override', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    const result = await privacyGradingService.clearOverride(deviceId, operatorId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/device/:deviceId/rule', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { name, level, conditions, priority, isActive } = req.body;
    
    const rule = await privacyGradingService.addRule(deviceId, {
      name,
      level,
      conditions: conditions || {},
      priority: priority || 0,
      isActive: isActive !== false,
    });
    
    res.json({ success: true, rule });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.delete('/device/:deviceId/rule/:ruleId', async (req: Request, res: Response) => {
  try {
    const { deviceId, ruleId } = req.params;
    const result = await privacyGradingService.removeRule(deviceId, ruleId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/global-rule', async (req: Request, res: Response) => {
  try {
    const { name, level, conditions, priority, isActive } = req.body;
    
    const rule = await privacyGradingService.addGlobalRule({
      name,
      level,
      conditions: conditions || {},
      priority: priority || 0,
      isActive: isActive !== false,
    });
    
    res.json({ success: true, rule });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/emergency/blackout', async (req: Request, res: Response) => {
  try {
    const { deviceIds, reason } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!deviceIds || !Array.isArray(deviceIds)) {
      return res.status(400).json({ success: false, error: '缺少设备ID列表' });
    }
    
    const result = await privacyGradingService.emergencyBlackout(deviceIds, reason || '紧急隐私保护', operatorId);
    res.json({ ...result, success: result.failed === 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/emergency/full-access', async (req: Request, res: Response) => {
  try {
    const { deviceIds, reason } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!deviceIds || !Array.isArray(deviceIds)) {
      return res.status(400).json({ success: false, error: '缺少设备ID列表' });
    }
    
    const result = await privacyGradingService.emergencyFullAccess(deviceIds, reason || '紧急监控', operatorId);
    res.json({ ...result, success: result.failed === 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/policy/:level', (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const policy = privacyGradingService.getPolicy(level as PrivacyLevel);
    const description = privacyGradingService.getLevelDescription(level as PrivacyLevel);
    res.json({ success: true, level, policy, description });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
