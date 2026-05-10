/**
 * Android Companion App 控制 API 路由
 * 
 * 提供Companion App注册、配置、命令下发等功能
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import {
  companionAppService,
  weChatFileService,
  autoProcessWorkflow,
  mobileExecutorService,
} from '../services/mobile';

const logger = createServiceLogger('CompanionRoutes');

const router = Router();

const registerSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  osVersion: z.string().optional(),
});

const fileWatchConfigSchema = z.object({
  enabled: z.boolean().optional(),
  watchPaths: z.array(z.string()).optional(),
  fileTypes: z.array(z.string()).optional(),
  autoUpload: z.boolean().optional(),
  notifyOnDetect: z.boolean().optional(),
});

const companionConfigSchema = z.object({
  fileWatch: fileWatchConfigSchema.optional(),
  notificationMonitor: z.boolean().optional(),
  screenshotOnDemand: z.boolean().optional(),
  autoStart: z.boolean().optional(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);
    
    const result = await companionAppService.registerCompanionApp(
      body.deviceId,
      body.deviceName,
      {
        osVersion: body.osVersion,
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Companion app registered successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to register companion app');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register companion app',
    });
  }
});

router.get('/status/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const isConnected = companionAppService.isConnected(deviceId);
    const config = companionAppService.getDeviceConfig(deviceId);

    res.json({
      success: true,
      data: {
        deviceId,
        connected: isConnected,
        config,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get companion status');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

router.post('/config/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const body = companionConfigSchema.parse(req.body);

    const success = companionAppService.updateConfig(deviceId, body);

    res.json({
      success,
      message: success ? 'Config updated' : 'Device not found',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update companion config');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config',
    });
  }
});

router.post('/command/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { type, params } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Command type is required',
      });
    }

    const validCommands = [
      'START_FILE_WATCH',
      'STOP_FILE_WATCH',
      'UPLOAD_FILE',
      'TAKE_SCREENSHOT',
      'GET_STATUS',
    ];

    if (!validCommands.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid command type. Valid types: ${validCommands.join(', ')}`,
      });
    }

    const messageId = companionAppService.sendCommand(deviceId, {
      type: type as any,
      params,
    });

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: 'Device not connected',
      });
    }

    res.json({
      success: true,
      data: { messageId },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send command');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send command',
    });
  }
});

router.get('/wechat/files/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { category, limit } = req.query;

    let documents;
    
    if (category) {
      documents = weChatFileService.getDocumentsByCategory(
        deviceId, 
        category as any
      );
    } else {
      documents = weChatFileService.getRecentDocuments(
        deviceId, 
        limit ? parseInt(limit as string, 10) : 10
      );
    }

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get WeChat files');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get files',
    });
  }
});

router.get('/wechat/config', async (_req: Request, res: Response) => {
  try {
    const config = weChatFileService.getConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get WeChat config');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get config',
    });
  }
});

router.post('/wechat/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    weChatFileService.updateConfig(config);

    res.json({
      success: true,
      message: 'WeChat config updated',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update WeChat config');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config',
    });
  }
});

router.get('/workflow/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const workflow = autoProcessWorkflow.getWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get workflow');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workflow',
    });
  }
});

router.get('/workflows/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { limit } = req.query;

    const workflows = autoProcessWorkflow.getRecentWorkflows(
      deviceId,
      limit ? parseInt(limit as string, 10) : 10
    );

    res.json({
      success: true,
      data: workflows,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get workflows');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workflows',
    });
  }
});

router.get('/workflow/config', async (_req: Request, res: Response) => {
  try {
    const config = autoProcessWorkflow.getConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get workflow config');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get config',
    });
  }
});

router.post('/workflow/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    autoProcessWorkflow.updateConfig(config);

    res.json({
      success: true,
      message: 'Workflow config updated',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update workflow config');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config',
    });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const companionStats = companionAppService.getStatistics();
    const weChatStats = weChatFileService.getStatistics();
    const workflowStats = autoProcessWorkflow.getStatistics();
    const mobileStats = mobileExecutorService.getStatistics();

    res.json({
      success: true,
      data: {
        companion: companionStats,
        weChat: weChatStats,
        workflow: workflowStats,
        mobile: mobileStats,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get stats');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
});

export default router;
