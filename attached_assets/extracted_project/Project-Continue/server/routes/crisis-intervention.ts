/**
 * 小智 Crisis Intervention Routes - 危机介入系统API
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, Request, Response } from 'express';
import { crisisInterventionService, type CrisisLevel, type EvidenceType } from '../services/crisis-intervention';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await crisisInterventionService.getCrisisStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/active', async (req: Request, res: Response) => {
  try {
    const crises = await crisisInterventionService.getActiveCrises();
    res.json({ success: true, crises });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/case/:crisisId', async (req: Request, res: Response) => {
  try {
    const { crisisId } = req.params;
    const crisis = await crisisInterventionService.getCrisisById(crisisId);
    if (!crisis) {
      return res.status(404).json({ success: false, error: '危机案例不存在' });
    }
    res.json({ success: true, crisis });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, level, targetDevices, targetMembers, reason } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!name || !level || !targetDevices || !Array.isArray(targetDevices)) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const crisis = await crisisInterventionService.createCrisis({
      name,
      level: level as CrisisLevel,
      targetDevices,
      targetMembers,
      reason: reason || '未指定原因',
      createdBy: operatorId,
    });
    
    res.json({ success: true, crisis });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/case/:crisisId/escalate', async (req: Request, res: Response) => {
  try {
    const { crisisId } = req.params;
    const { newLevel, reason } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!newLevel || !reason) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const result = await crisisInterventionService.escalateCrisis(
      crisisId,
      newLevel as CrisisLevel,
      reason,
      operatorId
    );
    
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/case/:crisisId/resolve', async (req: Request, res: Response) => {
  try {
    const { crisisId } = req.params;
    const { resolution } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!resolution) {
      return res.status(400).json({ success: false, error: '请提供解决说明' });
    }
    
    const result = await crisisInterventionService.resolveCrisis(crisisId, resolution, operatorId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/case/:crisisId/evidence', async (req: Request, res: Response) => {
  try {
    const { crisisId } = req.params;
    const evidence = await crisisInterventionService.getCrisisEvidence(crisisId);
    res.json({ success: true, evidence });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/case/:crisisId/evidence', async (req: Request, res: Response) => {
  try {
    const { crisisId } = req.params;
    const { deviceId, type, description, dataPath, metadata } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!deviceId || !type || !description || !dataPath) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const evidence = await crisisInterventionService.collectEvidence({
      crisisId,
      deviceId,
      type: type as EvidenceType,
      description,
      dataPath,
      metadata,
      operatorId,
    });
    
    res.json({ success: true, evidence });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/case/:crisisId/verify-chain', async (req: Request, res: Response) => {
  try {
    const { crisisId } = req.params;
    const result = await crisisInterventionService.verifyEvidenceChain(crisisId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/device/:deviceId/lock', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { crisisId, functions } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!crisisId || !functions || !Array.isArray(functions)) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const lockdown = await crisisInterventionService.lockDevice(crisisId, deviceId, functions, operatorId);
    res.json({ success: true, lockdown });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/device/:deviceId/unlock', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { crisisId } = req.body;
    const operatorId = req.headers['x-avatar-role'] === 'MASTER' ? 'MASTER' : 'GUEST';
    
    if (!crisisId) {
      return res.status(400).json({ success: false, error: '缺少危机ID' });
    }
    
    const result = await crisisInterventionService.unlockDevice(crisisId, deviceId, operatorId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/device/:deviceId/lock-status', (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const status = crisisInterventionService.getDeviceLockStatus(deviceId);
    res.json({ success: true, locked: !!status, status });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/device/:deviceId/commands', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const commands = await crisisInterventionService.getPendingCommands(deviceId);
    res.json({ success: true, commands });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/device/:deviceId/command/:commandId/confirm', async (req: Request, res: Response) => {
  try {
    const { deviceId, commandId } = req.params;
    const { result } = req.body;
    
    const success = await crisisInterventionService.confirmCommandExecution(commandId, deviceId, result);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/level/:level/description', (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const description = crisisInterventionService.getLevelDescription(level as CrisisLevel);
    res.json({ success: true, level, description });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
