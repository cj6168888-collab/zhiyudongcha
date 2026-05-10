/**
 * Spirit Singleton API Routes (灵魂单例API路由)
 */

import { Router, Request, Response } from 'express';
import spiritSingleton, { 
  type DevicePresenceInfo, 
  type AvatarMode,
  type AvatarPose 
} from '../services/spirit-singleton';

const router = Router();

router.get('/status', (req: Request, res: Response) => {
  const status = spiritSingleton.getStatus();
  res.json({
    success: true,
    data: status,
    timestamp: Date.now(),
  });
});

router.get('/token', (req: Request, res: Response) => {
  const token = spiritSingleton.getPresenceToken();
  res.json({
    success: true,
    data: token,
  });
});

router.get('/devices', (req: Request, res: Response) => {
  const devices = spiritSingleton.getAllDevices();
  res.json({
    success: true,
    data: devices,
    count: devices.length,
  });
});

router.post('/devices/register', (req: Request, res: Response) => {
  try {
    const { deviceId, deviceType, deviceName, hasCamera, hasMicrophone, proximity, screenPosition } = req.body;
    
    if (!deviceId || !deviceType || !deviceName) {
      res.status(400).json({ success: false, error: '缺少必要参数' });
      return;
    }
    
    const deviceInfo: DevicePresenceInfo = {
      deviceId,
      deviceType,
      deviceName,
      lastActivity: Date.now(),
      isOnline: true,
      proximity: proximity || 50,
      hasCamera: hasCamera ?? true,
      hasMicrophone: hasMicrophone ?? true,
      screenPosition,
    };
    
    const result = spiritSingleton.registerDevice(deviceInfo);
    
    res.json({
      success: true,
      data: {
        ...result,
        token: spiritSingleton.getPresenceToken(),
      },
    });
  } catch (error) {
    console.error('[SpiritSingleton] Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '注册失败' 
    });
  }
});

router.post('/devices/unregister', (req: Request, res: Response) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    res.status(400).json({ success: false, error: '缺少deviceId' });
    return;
  }
  
  spiritSingleton.unregisterDevice(deviceId);
  
  res.json({
    success: true,
    message: `设备 ${deviceId} 已注销`,
  });
});

router.post('/devices/heartbeat', (req: Request, res: Response) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    res.status(400).json({ success: false, error: '缺少deviceId' });
    return;
  }
  
  spiritSingleton.updateDeviceActivity(deviceId);
  
  const isActive = spiritSingleton.isDeviceActive(deviceId);
  const shouldSleep = spiritSingleton.shouldDeviceSleep(deviceId);
  
  res.json({
    success: true,
    data: {
      isActive,
      shouldSleep,
      token: spiritSingleton.getPresenceToken(),
    },
  });
});

router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const { targetDeviceId, immediate, preservePose } = req.body;
    
    if (!targetDeviceId) {
      res.status(400).json({ success: false, error: '缺少目标设备ID' });
      return;
    }
    
    const migration = await spiritSingleton.requestMigration(targetDeviceId, {
      immediate,
      preservePose,
    });
    
    res.json({
      success: true,
      data: migration,
    });
  } catch (error) {
    console.error('[SpiritSingleton] Migration error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '迁移失败' 
    });
  }
});

router.get('/migration-history', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const history = spiritSingleton.getMigrationHistory(limit);
  
  res.json({
    success: true,
    data: history,
    count: history.length,
  });
});

router.post('/avatar/mode', (req: Request, res: Response) => {
  const { mode } = req.body;
  
  if (!mode || !['DEFAULT', 'WORK', 'PROTECT'].includes(mode)) {
    res.status(400).json({ success: false, error: '无效的模式' });
    return;
  }
  
  spiritSingleton.setAvatarMode(mode as AvatarMode);
  
  res.json({
    success: true,
    data: spiritSingleton.getPresenceToken().avatarPose,
  });
});

router.post('/avatar/pose', (req: Request, res: Response) => {
  const poseUpdate: Partial<AvatarPose> = req.body;
  
  spiritSingleton.updateAvatarPose(poseUpdate);
  
  res.json({
    success: true,
    data: spiritSingleton.getPresenceToken().avatarPose,
  });
});

router.get('/avatar/pose', (req: Request, res: Response) => {
  const token = spiritSingleton.getPresenceToken();
  
  res.json({
    success: true,
    data: token.avatarPose,
  });
});

router.post('/hibernate', (req: Request, res: Response) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    res.status(400).json({ success: false, error: '缺少deviceId' });
    return;
  }
  
  spiritSingleton.forceHibernate(deviceId);
  
  res.json({
    success: true,
    message: `设备 ${deviceId} 已进入休眠`,
  });
});

router.get('/active-device', (req: Request, res: Response) => {
  const device = spiritSingleton.getActiveDevice();
  
  res.json({
    success: true,
    data: device,
  });
});

export default router;
