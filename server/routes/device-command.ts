/**
 * 设备控制 API 路由
 *
 * 提供跨设备指令执行接口
 * 支持从PC端/服务器端向手机端发送指令
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { deviceConnectionService } from '../services/mobile/DeviceConnectionService';
import { deviceRegistry } from '../services/device/DeviceRegistry';
import { crossDeviceRouter } from '../services/device/CrossDeviceRouter';
import { createServiceLogger } from '../lib/logger';

const router = Router();
const logger = createServiceLogger('DeviceCommandAPI');

// 验证中间件
const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * 获取所有设备
 * GET /api/devices
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const devices = deviceConnectionService.getAllDevices();
    res.json({
      success: true,
      data: devices,
      total: devices.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get devices');
    res.status(500).json({ success: false, error: 'Failed to get devices' });
  }
});

/**
 * 获取已连接设备
 * GET /api/devices/connected
 */
router.get('/connected', async (req: Request, res: Response) => {
  try {
    const devices = deviceConnectionService.getConnectedDevices();
    res.json({
      success: true,
      data: devices,
      total: devices.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get connected devices');
    res.status(500).json({ success: false, error: 'Failed to get devices' });
  }
});

/**
 * 获取单个设备信息
 * GET /api/devices/:deviceId
 */
router.get('/:deviceId',
  param('deviceId').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const device = deviceConnectionService.getDevice(deviceId);

      if (!device) {
        return res.status(404).json({ success: false, error: 'Device not found' });
      }

      res.json({ success: true, data: device });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to get device');
      res.status(500).json({ success: false, error: 'Failed to get device' });
    }
  }
);

/**
 * 获取设备程序列表
 * GET /api/devices/:deviceId/programs
 */
router.get('/:deviceId/programs',
  param('deviceId').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const device = deviceConnectionService.getDevice(deviceId);

      if (!device) {
        return res.status(404).json({ success: false, error: 'Device not found' });
      }

      // 从 DeviceRegistry 获取该设备的程序列表
      const programs = deviceRegistry.getProgramsByDevice(deviceId);

      res.json({
        success: true,
        data: programs,
        total: programs.length,
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to get device programs');
      res.status(500).json({ success: false, error: 'Failed to get programs' });
    }
  }
);

/**
 * 发送指令到设备
 * POST /api/devices/:deviceId/command
 */
router.post('/:deviceId/command',
  param('deviceId').isString().notEmpty(),
  body('command').isString().notEmpty(),
  body('parameters').optional().isObject(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { command, parameters = {} } = req.body;

      // 检查设备是否存在
      if (!deviceConnectionService.getDevice(deviceId)) {
        return res.status(404).json({ success: false, error: 'Device not found' });
      }

      // 检查设备是否在线
      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      // 发送指令
      const messageId = deviceConnectionService.sendCommand(deviceId, command, parameters);

      if (typeof messageId === 'object') {
        return res.status(500).json({ success: false, error: messageId.message });
      }

      logger.info({ deviceId, command, messageId }, 'Command sent to device');

      res.json({
        success: true,
        data: {
          messageId,
          deviceId,
          command,
          status: 'sent',
        },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to send command');
      res.status(500).json({ success: false, error: 'Failed to send command' });
    }
  }
);

/**
 * 发送动作到设备
 * POST /api/devices/:deviceId/action
 */
router.post('/:deviceId/action',
  param('deviceId').isString().notEmpty(),
  body('action').isString().notEmpty(),
  body('parameters').optional().isObject(),
  body('taskId').optional().isString(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { action, parameters = {}, taskId } = req.body;

      if (!deviceConnectionService.getDevice(deviceId)) {
        return res.status(404).json({ success: false, error: 'Device not found' });
      }

      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      const messageId = deviceConnectionService.sendAction(deviceId, action, parameters, taskId);

      if (typeof messageId === 'object') {
        return res.status(500).json({ success: false, error: messageId.message });
      }

      logger.info({ deviceId, action, taskId, messageId }, 'Action sent to device');

      res.json({
        success: true,
        data: {
          messageId,
          deviceId,
          action,
          taskId,
          status: 'sent',
        },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to send action');
      res.status(500).json({ success: false, error: 'Failed to send action' });
    }
  }
);

/**
 * 启动设备上的应用
 * POST /api/devices/:deviceId/launch
 */
router.post('/:deviceId/launch',
  param('deviceId').isString().notEmpty(),
  body('packageName').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { packageName } = req.body;

      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      const result = deviceConnectionService.launchApp(deviceId, packageName);

      if (typeof result === 'object') {
        return res.status(500).json({ success: false, error: result.message });
      }

      res.json({
        success: true,
        data: { messageId: result, packageName },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to launch app');
      res.status(500).json({ success: false, error: 'Failed to launch app' });
    }
  }
);

/**
 * 打开URL
 * POST /api/devices/:deviceId/open-url
 */
router.post('/:deviceId/open-url',
  param('deviceId').isString().notEmpty(),
  body('url').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { url } = req.body;

      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      const result = deviceConnectionService.openUrl(deviceId, url);

      if (typeof result === 'object') {
        return res.status(500).json({ success: false, error: result.message });
      }

      res.json({
        success: true,
        data: { messageId: result, url },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to open URL');
      res.status(500).json({ success: false, error: 'Failed to open URL' });
    }
  }
);

/**
 * 导航到地址
 * POST /api/devices/:deviceId/navigate
 */
router.post('/:deviceId/navigate',
  param('deviceId').isString().notEmpty(),
  body('address').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { address } = req.body;

      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      const result = deviceConnectionService.navigateTo(deviceId, address);

      if (typeof result === 'object') {
        return res.status(500).json({ success: false, error: result.message });
      }

      res.json({
        success: true,
        data: { messageId: result, address },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to navigate');
      res.status(500).json({ success: false, error: 'Failed to navigate' });
    }
  }
);

/**
 * 拨打电话
 * POST /api/devices/:deviceId/dial
 */
router.post('/:deviceId/dial',
  param('deviceId').isString().notEmpty(),
  body('phoneNumber').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { phoneNumber } = req.body;

      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      const result = deviceConnectionService.dialPhone(deviceId, phoneNumber);

      if (typeof result === 'object') {
        return res.status(500).json({ success: false, error: result.message });
      }

      res.json({
        success: true,
        data: { messageId: result, phoneNumber },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to dial');
      res.status(500).json({ success: false, error: 'Failed to dial' });
    }
  }
);

/**
 * 发送短信
 * POST /api/devices/:deviceId/sms
 */
router.post('/:deviceId/sms',
  param('deviceId').isString().notEmpty(),
  body('phoneNumber').isString().notEmpty(),
  body('message').isString(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { phoneNumber, message } = req.body;

      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      const result = deviceConnectionService.sendSms(deviceId, phoneNumber, message);

      if (typeof result === 'object') {
        return res.status(500).json({ success: false, error: result.message });
      }

      res.json({
        success: true,
        data: { messageId: result, phoneNumber },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to send SMS');
      res.status(500).json({ success: false, error: 'Failed to send SMS' });
    }
  }
);

/**
 * 复制到剪贴板
 * POST /api/devices/:deviceId/clipboard
 */
router.post('/:deviceId/clipboard',
  param('deviceId').isString().notEmpty(),
  body('text').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.params;
      const { text } = req.body;

      if (!deviceConnectionService.isDeviceConnected(deviceId)) {
        return res.status(503).json({ success: false, error: 'Device is not connected' });
      }

      const result = deviceConnectionService.copyToClipboard(deviceId, text);

      if (typeof result === 'object') {
        return res.status(500).json({ success: false, error: result.message });
      }

      res.json({
        success: true,
        data: { messageId: result },
      });
    } catch (error) {
      logger.error({ error, deviceId: req.params.deviceId }, 'Failed to copy to clipboard');
      res.status(500).json({ success: false, error: 'Failed to copy' });
    }
  }
);

/**
 * 获取设备统计信息
 * GET /api/devices/stats
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const stats = deviceConnectionService.getStatistics();
    const programs = deviceRegistry.getAllPrograms();

    res.json({
      success: true,
      data: {
        devices: stats,
        programs: {
          total: programs.length,
          categories: deviceRegistry.getCategories(),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get stats');
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
