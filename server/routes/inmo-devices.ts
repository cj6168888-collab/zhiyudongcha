import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireMaster, auditAction } from '../middleware/auth';
import { inmoBridgeService } from '../services/inmo-bridge';

const logger = createServiceLogger('InmoDevicesRoutes');

interface InmoDeviceConfig {
  deviceId: string;
  deviceName: string;
  bluetoothMac?: string;
  autoConnect: boolean;
  displayBrightness: number;
  volume: number;
  language: string;
  voiceWakeWord: string;
  notificationFilter: string;
}

interface InmoDeviceStatus {
  isConnected: boolean;
  batteryLevel: number;
  isCharging: boolean;
  displayOn: boolean;
  microphoneActive: boolean;
  bluetoothConnected: boolean;
  wifiConnected: boolean;
  firmwareVersion: string;
}

interface InmoDevice {
  config: InmoDeviceConfig;
  status: InmoDeviceStatus;
  lastUpdate: Date;
}

const inmoDevices = new Map<string, InmoDevice>();

function broadcastToDevice(deviceId: string, payload: unknown): void {
  logger.info({ deviceId, payloadType: (payload as { type?: string })?.type }, 'Broadcasting to device');
}

export function registerInmoDevicesRoutes(app: Express, _context: RouteContext): void {
  app.post('/api/inmo/devices', requireMaster, async (req, res) => {
    try {
      const { deviceName, bluetoothMac, autoConnect = true } = req.body;
      if (!deviceName) {
        return res.status(400).json({ error: '设备名称不能为空' });
      }

      const deviceId = `inmo-go3-${Date.now()}`;
      const deviceData: InmoDevice = {
        config: {
          deviceId,
          deviceName,
          bluetoothMac,
          autoConnect,
          displayBrightness: 70,
          volume: 50,
          language: 'zh-CN',
          voiceWakeWord: '小智',
          notificationFilter: 'IMPORTANT',
        },
        status: {
          isConnected: autoConnect,
          batteryLevel: 100,
          isCharging: false,
          displayOn: false,
          microphoneActive: false,
          bluetoothConnected: autoConnect,
          wifiConnected: false,
          firmwareVersion: '1.0.0',
        },
        lastUpdate: new Date(),
      };

      inmoDevices.set(deviceId, deviceData);

      await auditAction('INMO_DEVICE_REGISTERED', req.userRole || 'MASTER', 'inmo_device', deviceId, { deviceName }, 'SUCCESS', req);

      res.status(201).json({
        ...deviceData.config,
        status: deviceData.status,
      });
    } catch (error) {
      logger.error({ err: error }, 'Register INMO device error');
      res.status(400).json({ error: '注册INMO设备失败' });
    }
  });

  app.get('/api/inmo/devices', requireMaster, async (_req, res) => {
    try {
      const devices = Array.from(inmoDevices.entries()).map(([id, data]) => {
        const { deviceId: _, ...configRest } = data.config;
        return {
          deviceId: id,
          ...configRest,
          status: data.status,
          lastUpdate: data.lastUpdate,
        };
      });
      res.json(devices);
    } catch (error) {
      logger.error({ err: error }, 'Get INMO devices error');
      res.status(500).json({ error: '获取INMO设备列表失败' });
    }
  });

  app.get('/api/inmo/devices/:id', requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: '设备不存在' });
      }
      const { deviceId: _, ...configRest } = device.config;
      res.json({
        deviceId: req.params.id,
        ...configRest,
        status: device.status,
        lastUpdate: device.lastUpdate,
      });
    } catch (error) {
      logger.error({ err: error }, 'Get INMO device error');
      res.status(500).json({ error: '获取设备状态失败' });
    }
  });

  app.post('/api/inmo/devices/:id/display', requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: '设备不存在' });
      }

      const { type = 'TEXT', content, duration, position = 'CENTER', priority = 'NORMAL' } = req.body;
      if (!content) {
        return res.status(400).json({ error: '消息内容不能为空' });
      }

      device.status.displayOn = true;
      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_DISPLAY',
        message: { type, content, duration, position, priority },
      });

      logger.info({ deviceId: req.params.id, contentPreview: content.substring(0, 50) }, 'Display message sent');

      res.json({
        success: true,
        message: '消息已发送到眼镜',
        displayMessage: { type, content, duration, position, priority },
      });
    } catch (error) {
      logger.error({ err: error }, 'Send display message error');
      res.status(500).json({ error: '发送显示消息失败' });
    }
  });

  app.post('/api/inmo/devices/:id/notify', requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: '设备不存在' });
      }

      const { title, body, priority = 'NORMAL' } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: '标题和内容不能为空' });
      }

      device.status.displayOn = true;
      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_NOTIFICATION',
        notification: { title, body, priority },
      });

      res.json({ success: true, message: '通知已推送' });
    } catch (error) {
      logger.error({ err: error }, 'Send notification error');
      res.status(500).json({ error: '发送通知失败' });
    }
  });

  app.post('/api/inmo/devices/:id/translate', requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: '设备不存在' });
      }

      const { text, targetLang = 'en', sourceLang = 'auto' } = req.body;
      if (!text) {
        return res.status(400).json({ error: '翻译文本不能为空' });
      }

      const translationResult = await inmoBridgeService.translateText(text, targetLang, sourceLang);

      device.status.displayOn = true;
      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_TRANSLATION',
        translation: {
          sourceText: translationResult.sourceText,
          targetText: translationResult.targetText,
          sourceLang: translationResult.sourceLanguage,
          targetLang: translationResult.targetLanguage,
          confidence: translationResult.confidence,
          processingTimeMs: translationResult.processingTimeMs,
        },
      });

      res.json({
        success: true,
        sourceText: translationResult.sourceText,
        targetText: translationResult.targetText,
        sourceLang: translationResult.sourceLanguage,
        targetLang: translationResult.targetLanguage,
        confidence: translationResult.confidence,
        processingTimeMs: translationResult.processingTimeMs,
      });
    } catch (error) {
      logger.error({ err: error }, 'Translation error');
      res.status(500).json({ error: '翻译请求失败' });
    }
  });

  app.post('/api/inmo/devices/:id/ocr', requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: '设备不存在' });
      }

      const { imageBase64, targetLang } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: '图片数据不能为空' });
      }

      const ocrRequest = { imageBase64, timestamp: Date.now() };

      if (targetLang) {
        const result = await inmoBridgeService.performOCRAndTranslate(ocrRequest, targetLang);

        device.status.displayOn = true;
        device.lastUpdate = new Date();

        broadcastToDevice(req.params.id, {
          type: 'INMO_OCR_TRANSLATION',
          ocr: result.ocr,
          translation: result.translation,
        });

        res.json({
          success: true,
          ocr: result.ocr,
          translation: result.translation,
        });
      } else {
        const ocrResult = await inmoBridgeService.performOCR(ocrRequest);

        device.status.displayOn = true;
        device.lastUpdate = new Date();

        broadcastToDevice(req.params.id, {
          type: 'INMO_OCR',
          ocr: ocrResult,
        });

        res.json({
          success: true,
          ocr: ocrResult,
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'OCR error');
      res.status(500).json({ error: 'OCR识别失败' });
    }
  });

  app.post('/api/inmo/devices/:id/voice-command', requireMaster, async (req, res) => {
    try {
      const device = inmoDevices.get(req.params.id);
      if (!device) {
        return res.status(404).json({ error: '设备不存在' });
      }

      const { transcript } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: '语音指令不能为空' });
      }

      const command = inmoBridgeService.parseVoiceCommand(transcript);

      if (!command) {
        return res.json({
          success: false,
          message: '未识别到有效指令',
          transcript,
        });
      }

      device.lastUpdate = new Date();

      broadcastToDevice(req.params.id, {
        type: 'INMO_VOICE_COMMAND',
        command,
      });

      res.json({
        success: true,
        command,
        transcript,
      });
    } catch (error) {
      logger.error({ err: error }, 'Voice command error');
      res.status(500).json({ error: '语音指令处理失败' });
    }
  });

  app.get('/api/inmo/bridge/stats', requireMaster, async (_req, res) => {
    try {
      const stats = inmoBridgeService.getStats();
      res.json(stats);
    } catch (error) {
      logger.error({ err: error }, 'Get bridge stats error');
      res.status(500).json({ error: '获取桥接服务状态失败' });
    }
  });

  logger.info('INMO Devices routes registered');
}

export function getInmoDevices(): Map<string, InmoDevice> {
  return inmoDevices;
}
