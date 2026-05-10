/**
 * Device Bindings API — P1
 * POST   /api/device-bindings/bind-code
 * POST   /api/device-bindings/bind
 * GET    /api/device-bindings
 * GET    /api/device-bindings/awakening-status
 * GET    /api/device-bindings/:deviceId
 * PATCH  /api/device-bindings/:deviceId
 * POST   /api/device-bindings/:deviceId/revoke
 * GET    /api/device-bindings/:deviceId/status
 */

import { Router, Request, Response } from 'express';
import { attachRole } from '../middleware/auth';
import { deviceBindingService } from '../services/devices/DeviceBindingService';
import { createServiceLogger } from '../lib/logger';

const router = Router();
const logger = createServiceLogger('DeviceBindingRoutes');

router.use(attachRole);

function getUserId(req: Request): string {
  return req.user?.id || 'default';
}

// 觉醒状态检查
router.get('/awakening-status', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const complete = await deviceBindingService.isAwakeningComplete(ownerId);
    res.json({ success: true, complete });
  } catch (err) {
    logger.error('Awakening status check failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 生成绑定码
router.post('/bind-code', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { identityId = ownerId } = req.body;

    const entry = await deviceBindingService.generateBindCode(ownerId, identityId);

    res.json({
      success: true,
      code: entry.code,
      expiresAt: new Date(entry.expiresAt).toISOString(),
      expiresInSec: Math.floor((entry.expiresAt - Date.now()) / 1000),
    });
  } catch (err) {
    if (err.message === 'AWAKENING_REQUIRED') {
      res.status(403).json({ success: false, error: 'AWAKENING_REQUIRED', message: '请先完成身份觉醒再绑定外设' });
      return;
    }
    logger.error('Generate bind code failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 确认绑定（设备侧调用）
router.post('/bind', async (req: Request, res: Response) => {
  try {
    const { code, deviceId, deviceType, provider, displayName, capabilities } = req.body;

    if (!code || !deviceId || !deviceType) {
      res.status(400).json({ success: false, error: 'code, deviceId, deviceType are required' });
      return;
    }

    const device = await deviceBindingService.confirmBinding({
      code,
      deviceId,
      deviceType,
      provider,
      displayName,
      capabilities,
    });

    res.status(201).json({ success: true, device });
  } catch (err) {
    if (err.message === 'INVALID_OR_EXPIRED_CODE') {
      res.status(400).json({ success: false, error: 'INVALID_OR_EXPIRED_CODE', message: '绑定码无效或已过期' });
      return;
    }
    logger.error('Confirm binding failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 设备列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const devices = await deviceBindingService.listDevices(ownerId);
    res.json({ success: true, devices });
  } catch (err) {
    logger.warn('Device list unavailable; returning empty list', { err });
    res.json({ success: true, devices: [] });
  }
});

// 单个设备详情
router.get('/:deviceId', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const device = await deviceBindingService.getDevice(req.params.deviceId, ownerId);
    if (!device) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, device });
  } catch (err) {
    logger.error('Get device failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 更新设备（名称、允许模式）
router.patch('/:deviceId', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const { displayName, allowedModes } = req.body;
    const device = await deviceBindingService.updateDevice(req.params.deviceId, ownerId, { displayName, allowedModes });
    if (!device) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, device });
  } catch (err) {
    logger.error('Update device failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 撤销设备
router.post('/:deviceId/revoke', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const ok = await deviceBindingService.revokeDevice(req.params.deviceId, ownerId);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Device not found or already revoked' });
      return;
    }
    res.json({ success: true, message: '设备已撤销，后续请求将被拒绝' });
  } catch (err) {
    logger.error('Revoke device failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// 设备状态
router.get('/:deviceId/status', async (req: Request, res: Response) => {
  try {
    const ownerId = getUserId(req);
    const device = await deviceBindingService.getDevice(req.params.deviceId, ownerId);
    if (!device) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    const isOnline = device.lastSeenAt
      ? Date.now() - device.lastSeenAt.getTime() < 60_000
      : false;

    res.json({
      success: true,
      status: device.status,
      online: isOnline,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      allowedModes: device.allowedModes,
    });
  } catch (err) {
    logger.error('Device status failed', { err });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export { router as deviceBindingsRouter };
