/**
 * 小智 Last Stand Protocol - API路由
 * Project "Meltdown & Homeward" (熔断与归位协议)
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, Request, Response } from 'express';
import { lastStand, TriggerType, MeltdownLevel } from '../services/last-stand';
import { requireMaster } from '../middleware/auth';

const router = Router();

// 所有最后防线路由都需要MASTER权限
router.use(requireMaster);

// ============ 状态查询 ============

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = lastStand.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: '获取状态失败' });
  }
});

// ============ 触发检测 ============

router.post('/check/voice', async (req: Request, res: Response) => {
  try {
    const { transcript, voiceprintMatch } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: '缺少语音文本' });
    }

    const result = await lastStand.checkVoiceTrigger(transcript, voiceprintMatch);
    
    if (result.triggered) {
      res.json({
        triggered: true,
        trigger: result.trigger,
        level: result.level,
        message: '检测到紧急语音指令',
      });
    } else {
      res.json({ triggered: false });
    }
  } catch (error) {
    res.status(500).json({ error: '语音检测失败' });
  }
});

router.post('/check/biometric', async (req: Request, res: Response) => {
  try {
    const { heartRate, stressIndex, voiceTremor, hostileVoiceDetected } = req.body;

    const result = await lastStand.checkBiometricTrigger({
      heartRate,
      stressIndex,
      voiceTremor,
      hostileVoiceDetected,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '生物特征检测失败' });
  }
});

router.post('/check/remote', async (req: Request, res: Response) => {
  try {
    const { deviceId, authToken, level, reason } = req.body;

    if (!deviceId || !authToken || !level) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await lastStand.checkRemoteTrigger({
      deviceId,
      authToken,
      level: level as MeltdownLevel,
      reason,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '远程触发检测失败' });
  }
});

router.post('/check/geo', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: '缺少位置信息' });
    }

    const result = await lastStand.checkGeoFenceTrigger({ latitude, longitude });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '地理围栏检测失败' });
  }
});

router.post('/check/deadman', async (_req: Request, res: Response) => {
  try {
    const result = await lastStand.checkDeadmanSwitch();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '死人开关检测失败' });
  }
});

router.post('/confirm-deadman', async (_req: Request, res: Response) => {
  try {
    lastStand.confirmDeadmanSwitch();
    res.json({ success: true, message: '死人开关已确认' });
  } catch (error) {
    res.status(500).json({ error: '确认失败' });
  }
});

// ============ 熔断执行 ============

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { 
      triggerType, 
      level, 
      skipBackup, 
      injectDecoy, 
      targetDevices 
    } = req.body;

    if (!triggerType || !level) {
      return res.status(400).json({ error: '缺少触发类型或等级' });
    }

    const report = await lastStand.executeMeltdown(
      triggerType as TriggerType,
      level as MeltdownLevel,
      { skipBackup, injectDecoy, targetDevices }
    );

    res.json({
      success: true,
      report,
      message: '熔断协议已执行完成',
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: '熔断执行失败', 
      details: error.message 
    });
  }
});

router.post('/execute/quick', async (req: Request, res: Response) => {
  try {
    const { level = 'LEVEL_1_VISUAL' } = req.body;

    const report = await lastStand.executeMeltdown(
      'REMOTE_COMMAND',
      level as MeltdownLevel,
      { skipBackup: level === 'LEVEL_1_VISUAL' }
    );

    res.json({
      success: true,
      report,
      message: '快速熔断已执行',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 复活协议 ============

router.post('/recovery/initiate', async (req: Request, res: Response) => {
  try {
    const { method, credential, deviceId } = req.body;

    if (!method || !credential || !deviceId) {
      return res.status(400).json({ error: '缺少验证信息' });
    }

    const result = await lastStand.initiateRecovery({
      method,
      credential,
      deviceId,
    });

    if (result.success) {
      res.json({
        success: true,
        token: result.token?.token,
        expiresAt: result.token?.expiresAt,
        message: result.message,
      });
    } else {
      res.status(401).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    res.status(500).json({ error: '启动复活协议失败' });
  }
});

router.post('/recovery/execute', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: '缺少恢复令牌' });
    }

    const result = await lastStand.executeRecovery(token);
    
    if (result.success) {
      res.json({
        success: true,
        restoredItems: result.restoredItems,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    res.status(500).json({ error: '执行复活失败' });
  }
});

// ============ 配置管理 ============

router.get('/config/voice-triggers', async (_req: Request, res: Response) => {
  try {
    const triggers = lastStand.getVoiceTriggers();
    res.json(triggers);
  } catch (error) {
    res.status(500).json({ error: '获取语音触发词失败' });
  }
});

router.post('/config/voice-triggers', async (req: Request, res: Response) => {
  try {
    const { triggers } = req.body;
    
    if (!Array.isArray(triggers)) {
      return res.status(400).json({ error: '无效的触发词格式' });
    }

    lastStand.setVoiceTriggers(triggers);
    res.json({ success: true, count: triggers.length });
  } catch (error) {
    res.status(500).json({ error: '设置语音触发词失败' });
  }
});

router.post('/config/voice-triggers/add', async (req: Request, res: Response) => {
  try {
    const { phrase, similarity, requireVoiceprint, isEmergency } = req.body;

    if (!phrase) {
      return res.status(400).json({ error: '缺少触发短语' });
    }

    lastStand.addVoiceTrigger({
      phrase,
      similarity: similarity || 0.85,
      requireVoiceprint: requireVoiceprint ?? true,
      isEmergency: isEmergency ?? false,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '添加触发词失败' });
  }
});

router.get('/config/geo-fences', async (_req: Request, res: Response) => {
  try {
    const fences = lastStand.getGeoFences();
    res.json(fences);
  } catch (error) {
    res.status(500).json({ error: '获取地理围栏失败' });
  }
});

router.post('/config/geo-fences', async (req: Request, res: Response) => {
  try {
    const { fences } = req.body;
    
    if (!Array.isArray(fences)) {
      return res.status(400).json({ error: '无效的围栏格式' });
    }

    lastStand.setGeoFences(fences);
    res.json({ success: true, count: fences.length });
  } catch (error) {
    res.status(500).json({ error: '设置地理围栏失败' });
  }
});

router.post('/config/deadman-switch', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    lastStand.configureDeadmanSwitch(config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '配置死人开关失败' });
  }
});

router.post('/config/trigger/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const config = req.body;

    lastStand.updateTriggerConfig(type as TriggerType, config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新触发器配置失败' });
  }
});

console.log('[LastStand] Routes registered at /api/last-stand/*');

export default router;
