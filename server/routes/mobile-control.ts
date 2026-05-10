/**
 * 移动设备控制 API 路由
 * 
 * 提供完整的移动设备操控 REST API
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger';
import {
  mobileExecutorService,
  smsService,
  phoneService,
  fileService,
  visionRecognitionService,
  type DevicePlatform,
} from '../services/mobile';
import type { ActionType } from '../services/mobile/types';

const logger = createServiceLogger('MobileRoutes');

const router = Router();

const registerDeviceSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  platform: z.enum(['ANDROID', 'IOS', 'WINDOWS', 'MACOS', 'LINUX', 'WEB']),
  osVersion: z.string().optional(),
  capabilities: z.object({
    screenCapture: z.boolean().optional(),
    touchInput: z.boolean().optional(),
    keyboardInput: z.boolean().optional(),
    fileSystem: z.boolean().optional(),
    sms: z.boolean().optional(),
    phone: z.boolean().optional(),
    contacts: z.boolean().optional(),
    location: z.boolean().optional(),
    camera: z.boolean().optional(),
    microphone: z.boolean().optional(),
    notifications: z.boolean().optional(),
    accessibility: z.boolean().optional(),
    adb: z.boolean().optional(),
  }).optional(),
});

const executeActionSchema = z.object({
  type: z.enum([
    'CLICK', 'LONG_PRESS', 'DOUBLE_CLICK', 'SWIPE', 'SCROLL',
    'TYPE', 'PRESS_KEY', 'BACK', 'HOME', 'RECENT_APPS',
    'NOTIFICATION_CENTER', 'QUICK_SETTINGS', 'TAKE_SCREENSHOT',
    'OPEN_APP', 'CLOSE_APP', 'WAIT', 'TEXT_SELECT'
  ]),
  targetType: z.enum(['COORDINATES', 'ELEMENT_ID', 'TEXT', 'RESOURCE_ID', 'DESCRIPTION']),
  targetValue: z.string(),
  params: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    text: z.string().optional(),
    duration: z.number().optional(),
    direction: z.enum(['UP', 'DOWN', 'LEFT', 'RIGHT']).optional(),
    startX: z.number().optional(),
    startY: z.number().optional(),
    endX: z.number().optional(),
    endY: z.number().optional(),
    keyCode: z.number().optional(),
    appPackage: z.string().optional(),
  }).optional(),
  timeout: z.number().optional(),
  retryCount: z.number().optional(),
});

const sendSmsSchema = z.object({
  to: z.string().min(1),
  body: z.string().min(1).max(1000),
  simSlot: z.number().optional(),
});

const dialSchema = z.object({
  number: z.string().min(1),
  simSlot: z.number().optional(),
});

const listFilesSchema = z.object({
  path: z.string().min(1),
  includeHidden: z.boolean().optional(),
  sortBy: z.enum(['name', 'date', 'size']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const readFileSchema = z.object({
  path: z.string().min(1),
  encoding: z.enum(['utf-8', 'base64', 'binary']).default('utf-8'),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

const writeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
  base64: z.string().optional(),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  createDirectories: z.boolean().optional(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = registerDeviceSchema.parse(req.body);
    
    const result = await mobileExecutorService.registerDevice({
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      platform: body.platform as DevicePlatform,
      osVersion: body.osVersion || 'Unknown',
      capabilities: body.capabilities,
    });

    res.json({
      success: true,
      data: result,
      message: 'Device registered successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to register device');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register device',
    });
  }
});

router.delete('/unregister/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const success = mobileExecutorService.unregisterDevice(deviceId);
    
    res.json({
      success,
      message: success ? 'Device unregistered' : 'Device not found',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to unregister device');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unregister device',
    });
  }
});

router.get('/devices', async (_req: Request, res: Response) => {
  try {
    const devices = mobileExecutorService.getAllDevices();
    const connected = mobileExecutorService.getConnectedDevices();
    
    res.json({
      success: true,
      data: {
        all: devices,
        connected,
        total: devices.length,
        connectedCount: connected.length,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get devices');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get devices',
    });
  }
});

router.get('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const device = mobileExecutorService.getDevice(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
      });
    }
    
    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get device');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get device',
    });
  }
});

router.post('/action/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const body = executeActionSchema.parse(req.body);
    
    const result = await mobileExecutorService.executeAction(deviceId, {
      type: body.type as ActionType,
      target: {
        type: body.targetType,
        value: body.targetValue,
      },
      params: body.params,
      timeout: body.timeout || 10000,
      retryCount: body.retryCount || 0,
    });
    
    res.json({
      success: result.success,
      data: result,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to execute action');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute action',
    });
  }
});

router.post('/action/:deviceId/click', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { x, y } = req.body;
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'x and y coordinates are required',
      });
    }
    
    const result = await mobileExecutorService.click(deviceId, x, y);
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to click');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to click',
    });
  }
});

router.post('/action/:deviceId/swipe', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { direction, distance, duration } = req.body;
    
    if (!['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(direction)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid direction',
      });
    }
    
    const result = await mobileExecutorService.swipe(deviceId, direction, distance || 500, duration || 300);
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to swipe');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to swipe',
    });
  }
});

router.post('/action/:deviceId/type', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }
    
    const result = await mobileExecutorService.typeText(deviceId, text);
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to type text');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to type text',
    });
  }
});

router.get('/screen/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const result = await mobileExecutorService.analyzeScreen(deviceId, {
      includeElements: true,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to analyze screen');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze screen',
    });
  }
});

router.get('/screen/:deviceId/capture', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const capture = await mobileExecutorService.takeScreenshot(deviceId);
    
    res.json({
      success: true,
      data: {
        id: capture.id,
        width: capture.width,
        height: capture.height,
        format: capture.format,
        timestamp: capture.timestamp,
        data: capture.data,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to capture screenshot');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to capture screenshot',
    });
  }
});

router.get('/sms/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { limit, offset, address, unreadOnly } = req.query;
    
    const messages = await smsService.getMessages(deviceId, {
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      address: address as string,
      unreadOnly: unreadOnly === 'true',
    });
    
    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get SMS messages');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get SMS messages',
    });
  }
});

router.post('/sms/:deviceId/send', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const body = sendSmsSchema.parse(req.body);
    
    const result = await smsService.sendSms(deviceId, {
      to: body.to,
      body: body.body,
      simSlot: body.simSlot,
    });
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'SMS sent successfully' : 'Failed to send SMS',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send SMS');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    });
  }
});

router.get('/sms/:deviceId/conversations', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const conversations = await smsService.getConversations(deviceId);
    
    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get conversations');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversations',
    });
  }
});

router.get('/call/:deviceId/logs', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { limit, type } = req.query;
    
    const logs = await phoneService.getCallLogs(deviceId, {
      limit: limit ? parseInt(limit as string, 10) : 50,
      type: type as 'INCOMING' | 'OUTGOING' | 'MISSED' | 'REJECTED' | 'VOICEMAIL' | undefined,
    });
    
    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get call logs');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get call logs',
    });
  }
});

router.post('/call/:deviceId/dial', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const body = dialSchema.parse(req.body);
    
    const result = await phoneService.dialNumber(deviceId, {
      number: body.number,
      simSlot: body.simSlot,
    });
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Dial request sent' : 'Failed to dial',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to dial number');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dial number',
    });
  }
});

router.get('/files/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { path, includeHidden, sortBy, sortOrder } = req.query;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required',
      });
    }
    
    const files = await fileService.listFiles(deviceId, {
      path: path as string,
      includeHidden: includeHidden === 'true',
      sortBy: sortBy as 'name' | 'date' | 'size' | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });
    
    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list files');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list files',
    });
  }
});

router.post('/files/:deviceId/read', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const body = readFileSchema.parse(req.body);
    
    const content = await fileService.readFile(deviceId, {
      path: body.path,
      encoding: body.encoding,
      offset: body.offset,
      limit: body.limit,
    });
    
    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to read file');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    });
  }
});

router.post('/files/:deviceId/write', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const body = writeFileSchema.parse(req.body);
    
    const result = await fileService.writeFile(deviceId, {
      path: body.path,
      content: body.content,
      base64: body.base64,
      encoding: body.encoding,
      createDirectories: body.createDirectories,
    });
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'File written successfully' : 'Failed to write file',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to write file');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to write file',
    });
  }
});

router.delete('/files/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { path, recursive } = req.query;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required',
      });
    }
    
    const result = await fileService.deleteFile(deviceId, path as string, recursive === 'true');
    
    res.json({
      success: result.success,
      message: result.success ? 'File deleted successfully' : 'Failed to delete file',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to delete file');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file',
    });
  }
});

router.get('/vision/:deviceId/analyze', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { includeElements, includeText, includeLayout } = req.query;
    
    const analysis = await visionRecognitionService.analyzeScreen(deviceId, {
      includeElements: includeElements !== 'false',
      includeText: includeText !== 'false',
      includeLayout: includeLayout !== 'false',
    });
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to analyze screen');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze screen',
    });
  }
});

router.get('/vision/:deviceId/elements', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { text, type, clickable, editable, scrollable, visible } = req.query;
    
    const elements = await visionRecognitionService.findElements(deviceId, {
      text: text as string | undefined,
      type: type as string | undefined,
      clickable: clickable === 'true' ? true : clickable === 'false' ? false : undefined,
      editable: editable === 'true' ? true : editable === 'false' ? false : undefined,
      scrollable: scrollable === 'true' ? true : scrollable === 'false' ? false : undefined,
      visible: visible === 'true' ? true : visible === 'false' ? false : undefined,
    });
    
    res.json({
      success: true,
      data: elements,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to find elements');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find elements',
    });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = mobileExecutorService.getStatistics();
    
    res.json({
      success: true,
      data: stats,
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
