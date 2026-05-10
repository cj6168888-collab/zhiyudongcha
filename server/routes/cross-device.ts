/**
 * Cross Device Assistant API - 跨设备助手接口
 */

import { Router, Request, Response } from 'express';
import { crossDeviceAssistant } from '../services/assistant/CrossDeviceAssistant';
import { cloudHub } from '../services/cloud/CloudHub';
import { deviceRegistry } from '../services/device/DeviceRegistry';
import { crossDeviceRouter } from '../services/device/CrossDeviceRouter';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('CrossDeviceRoutes');

router.use(attachRole);

/**
 * POST /api/cross-device/chat
 *
 * 跨设备对话接口
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

    if (!message) {
      res.status(400).json({ success: false, error: '消息不能为空' });
      return;
    }

    const response = await crossDeviceAssistant.processRequest(message, {
      userId,
      devices: cloudHub.getAllDevices().filter(d => d.metadata.owner === userId),
      preferences: {},
    });

    res.json({
      success: true,
      response,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process request');
    res.status(500).json({ success: false, error: '处理失败' });
  }
});

/**
 * GET /api/cross-device/devices
 *
 * 获取用户设备列表
 */
router.get('/devices', (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

  const devices = cloudHub.getAllDevices()
    .filter(d => d.metadata.owner === userId);

  res.json({
    success: true,
    devices: devices.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
      programsCount: d.programs.length,
      capabilities: {
        canExecuteCommand: d.capabilities.execution.canExecuteCommand,
        canControlOther: d.capabilities.execution.canControlOther,
        hasScreen: d.capabilities.output.screen,
        hasCamera: d.capabilities.input.camera,
      },
    })),
  });
});

/**
 * GET /api/cross-device/devices/:id
 *
 * 获取设备详情
 */
router.get('/devices/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const device = cloudHub.getDevice(id);

  if (!device) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }

  res.json({
    success: true,
    device,
    programsDescription: cloudHub.getDeviceCapabilityDescription(id),
  });
});

/**
 * GET /api/cross-device/devices/:id/programs
 *
 * 获取设备程序列表
 */
router.get('/devices/:id/programs', (req: Request, res: Response) => {
  const { id } = req.params;
  const device = cloudHub.getDevice(id);

  if (!device) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }

  res.json({
    success: true,
    programs: device.programs.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      actions: p.actions.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
      })),
    })),
  });
});

/**
 * POST /api/cross-device/execute
 *
 * 直接执行操作
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { deviceId, action, params } = req.body;

    if (!deviceId || !action) {
      res.status(400).json({ success: false, error: '缺少参数' });
      return;
    }

    // 发送到设备
    const sent = cloudHub.sendToDevice(deviceId, {
      type: 'action:execute',
      action,
      parameters: params || {},
    });

    if (!sent) {
      res.status(400).json({ success: false, error: '设备不在线或无法连接' });
      return;
    }

    res.json({
      success: true,
      message: '操作已发送',
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '执行失败' });
  }
});

/**
 * POST /api/cross-device/tools/wechat
 *
 * 微信操作
 */
router.post('/tools/wechat', async (req: Request, res: Response) => {
  try {
    const { deviceId, action, contact, message } = req.body;

    if (!deviceId) {
      res.status(400).json({ success: false, error: '缺少设备ID' });
      return;
    }

    const result = await crossDeviceAssistant.sendWeChatMessage(contact, message, deviceId);

    res.json({
      success: result.success,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

/**
 * POST /api/cross-device/tools/desktop
 *
 * 电脑操作
 */
router.post('/tools/desktop', async (req: Request, res: Response) => {
  try {
    const { action, params } = req.body;

    const result = await crossDeviceAssistant.executeDesktopAction(action, params);

    res.json({
      success: result.success,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

/**
 * POST /api/cross-device/tools/open-app
 *
 * 打开应用
 */
router.post('/tools/open-app', async (req: Request, res: Response) => {
  try {
    const { appName } = req.body;

    if (!appName) {
      res.status(400).json({ success: false, error: '缺少应用名称' });
      return;
    }

    const result = await crossDeviceAssistant.openDesktopApp(appName);

    res.json({
      success: result.success,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

/**
 * POST /api/cross-device/tools/call
 *
 * 拨打电话
 */
router.post('/tools/call', async (req: Request, res: Response) => {
  try {
    const { deviceId, phoneNumber } = req.body;

    if (!deviceId || !phoneNumber) {
      res.status(400).json({ success: false, error: '缺少参数' });
      return;
    }

    const result = await crossDeviceAssistant.makePhoneCall(phoneNumber, deviceId);

    res.json({
      success: result.success,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

/**
 * POST /api/cross-device/tools/navigate
 *
 * 导航
 */
router.post('/tools/navigate', async (req: Request, res: Response) => {
  try {
    const { deviceId, destination } = req.body;

    if (!deviceId || !destination) {
      res.status(400).json({ success: false, error: '缺少参数' });
      return;
    }

    const result = await crossDeviceAssistant.navigate(destination, deviceId);

    res.json({
      success: result.success,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

/**
 * POST /api/cross-device/plan
 *
 * 规划任务
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

    if (!description) {
      res.status(400).json({ success: false, error: '缺少描述' });
      return;
    }

    const plan = await crossDeviceRouter.planTask({
      description,
      userId,
    });

    res.json({
      success: true,
      plan,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '规划失败' });
  }
});

/**
 * POST /api/cross-device/execute-plan
 *
 * 执行任务
 */
router.post('/execute-plan', async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;

    if (!plan) {
      res.status(400).json({ success: false, error: '缺少计划' });
      return;
    }

    const result = await crossDeviceRouter.executeTask(plan);

    res.json({
      success: result.success,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '执行失败' });
  }
});

/**
 * GET /api/cross-device/summary
 *
 * 获取设备状态摘要
 */
router.get('/summary', (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

  const summary = crossDeviceAssistant.getDeviceSummary(userId);

  res.json({
    success: true,
    summary,
  });
});

/**
 * GET /api/cross-device/programs
 *
 * 获取所有设备的程序能力
 */
router.get('/programs', (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id?: string } }).user?.id || 'default';

  const capabilities = cloudHub.getAllCapabilitiesDescription(userId);

  res.json({
    success: true,
    capabilities,
  });
});

/**
 * POST /api/cross-device/device/register
 *
 * 注册设备（由设备端调用）
 */
router.post('/device/register', async (req: Request, res: Response) => {
  try {
    const {
      name, type, owner, os, osVersion, model,
      capabilities, programs
    } = req.body;

    // 创建设备
    const device = deviceRegistry.createDevice({
      name,
      type,
      owner,
      os,
      osVersion,
      model,
    });

    // 设置能力
    if (capabilities) {
      device.capabilities = capabilities;
    }

    // 注册到云端
    deviceRegistry.registerDevice(device);

    // 解析并更新程序列表
    if (programs) {
      const parsedPrograms = deviceRegistry.parsePrograms(programs);
      cloudHub.updateDevicePrograms(device.id, parsedPrograms);
    }

    // 更新状态为在线
    cloudHub.updateDeviceStatus(device.id, 'online');

    res.json({
      success: true,
      deviceId: device.id,
      message: '设备注册成功',
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

/**
 * POST /api/cross-device/device/heartbeat
 *
 * 设备心跳（由设备端调用）
 */
router.post('/device/heartbeat', (req: Request, res: Response) => {
  try {
    const { deviceId, resources } = req.body;

    cloudHub.updateDeviceStatus(deviceId, 'online');

    if (resources) {
      cloudHub.updateDeviceResources(deviceId, resources);
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, error: '心跳失败' });
  }
});

/**
 * POST /api/cross-device/device/programs
 *
 * 更新设备程序列表
 */
router.post('/device/programs', (req: Request, res: Response) => {
  try {
    const { deviceId, programs } = req.body;

    if (!deviceId || !programs) {
      res.status(400).json({ success: false, error: '缺少参数' });
      return;
    }

    const parsedPrograms = deviceRegistry.parsePrograms(programs);
    cloudHub.updateDevicePrograms(deviceId, parsedPrograms);

    res.json({
      success: true,
      count: parsedPrograms.length,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

export default router;
