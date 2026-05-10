import { Router, type Request, type Response } from "express";
import { WebSocket } from "ws";
import { requireMaster, auditAction } from "../middleware/auth";
import { inmoBridgeService } from "../services/inmo-bridge";
import { perceptionCore } from "../services/perception-core";
import { createServiceLogger } from "../lib/logger";

const logger = createServiceLogger("ArInmo");
const router = Router();

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

interface ArHudMessage {
  id: string;
  type: 'info' | 'alert' | 'task' | 'message';
  title: string;
  content: string;
  time: string;
}

const inmoDevices: Map<string, InmoDevice> = new Map();
const arMessageQueue: ArHudMessage[] = [];

let broadcastToDevice: (deviceId: string, message: unknown) => void = () => {};

export function setBroadcastFunction(fn: (deviceId: string, message: unknown) => void): void {
  broadcastToDevice = fn;
}

router.get("/messages", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const formatTime = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    const defaultMessages: ArHudMessage[] = [
      { id: '1', type: 'info', title: '系统在线', content: '小智数字生命系统运行正常', time: formatTime(now) },
      { id: '2', type: 'task', title: '今日待办', content: '暂无紧急任务', time: '09:00' },
      { id: '3', type: 'message', title: '欢迎回来', content: '主人，有什么可以帮您？', time: formatTime(now) },
    ];
    
    const messages = arMessageQueue.length > 0 ? arMessageQueue : defaultMessages;
    res.json(messages);
  } catch (error) {
    logger.error({ error }, "获取AR消息失败");
    res.status(500).json({ error: "获取AR消息失败" });
  }
});

router.post("/messages", requireMaster, async (req: Request, res: Response) => {
  try {
    const { type = 'info', title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "标题和内容不能为空" });
    }
    
    const message: ArHudMessage = {
      id: `ar-${Date.now()}`,
      type,
      title,
      content,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
    
    arMessageQueue.unshift(message);
    if (arMessageQueue.length > 10) arMessageQueue.pop();
    
    logger.info({ messageId: message.id, type }, "AR消息已推送");
    res.status(201).json({ success: true, message });
  } catch (error) {
    logger.error({ error }, "推送AR消息失败");
    res.status(500).json({ error: "推送AR消息失败" });
  }
});

router.post("/inmo/devices", requireMaster, async (req: Request, res: Response) => {
  try {
    const { deviceName, bluetoothMac, autoConnect = true } = req.body;
    if (!deviceName) {
      return res.status(400).json({ error: "设备名称不能为空" });
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

    logger.info({ deviceId, deviceName }, "INMO设备已注册");
    res.status(201).json({
      ...deviceData.config,
      status: deviceData.status,
    });
  } catch (error) {
    logger.error({ error }, "注册INMO设备失败");
    res.status(400).json({ error: "注册INMO设备失败" });
  }
});

router.get("/inmo/devices", requireMaster, async (_req: Request, res: Response) => {
  try {
    const devices = Array.from(inmoDevices.entries()).map(([_id, data]) => ({
      ...data.config,
      status: data.status,
      lastUpdate: data.lastUpdate,
    }));
    res.json(devices);
  } catch (error) {
    logger.error({ error }, "获取INMO设备列表失败");
    res.status(500).json({ error: "获取INMO设备列表失败" });
  }
});

router.get("/inmo/devices/:id", requireMaster, async (req: Request, res: Response) => {
  try {
    const device = inmoDevices.get(req.params.id);
    if (!device) {
      return res.status(404).json({ error: "设备不存在" });
    }
    res.json({
      ...device.config,
      status: device.status,
      lastUpdate: device.lastUpdate,
    });
  } catch (error) {
    logger.error({ error }, "获取设备状态失败");
    res.status(500).json({ error: "获取设备状态失败" });
  }
});

router.post("/inmo/devices/:id/display", requireMaster, async (req: Request, res: Response) => {
  try {
    const device = inmoDevices.get(req.params.id);
    if (!device) {
      return res.status(404).json({ error: "设备不存在" });
    }

    const { type = 'TEXT', content, duration, position = 'CENTER', priority = 'NORMAL' } = req.body;
    if (!content) {
      return res.status(400).json({ error: "消息内容不能为空" });
    }

    device.status.displayOn = true;
    device.lastUpdate = new Date();

    broadcastToDevice(req.params.id, {
      type: 'INMO_DISPLAY',
      message: { type, content, duration, position, priority },
    });

    logger.info({ deviceId: req.params.id, contentPreview: content.substring(0, 50) }, "向INMO设备发送显示消息");

    res.json({
      success: true,
      message: '消息已发送到眼镜',
      displayMessage: { type, content, duration, position, priority },
    });
  } catch (error) {
    logger.error({ error }, "发送显示消息失败");
    res.status(500).json({ error: "发送显示消息失败" });
  }
});

router.post("/inmo/devices/:id/notify", requireMaster, async (req: Request, res: Response) => {
  try {
    const device = inmoDevices.get(req.params.id);
    if (!device) {
      return res.status(404).json({ error: "设备不存在" });
    }

    const { title, body, priority = 'NORMAL' } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "标题和内容不能为空" });
    }

    device.status.displayOn = true;
    device.lastUpdate = new Date();

    broadcastToDevice(req.params.id, {
      type: 'INMO_NOTIFICATION',
      notification: { title, body, priority },
    });

    res.json({ success: true, message: '通知已推送' });
  } catch (error) {
    logger.error({ error }, "发送通知失败");
    res.status(500).json({ error: "发送通知失败" });
  }
});

router.post("/inmo/devices/:id/translate", requireMaster, async (req: Request, res: Response) => {
  try {
    const device = inmoDevices.get(req.params.id);
    if (!device) {
      return res.status(404).json({ error: "设备不存在" });
    }

    const { text, targetLang = 'en', sourceLang = 'auto' } = req.body;
    if (!text) {
      return res.status(400).json({ error: "翻译文本不能为空" });
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
    logger.error({ error }, "翻译请求失败");
    res.status(500).json({ error: "翻译请求失败" });
  }
});

router.post("/inmo/devices/:id/ocr", requireMaster, async (req: Request, res: Response) => {
  try {
    const device = inmoDevices.get(req.params.id);
    if (!device) {
      return res.status(404).json({ error: "设备不存在" });
    }

    const { imageBase64, targetLang } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "图片数据不能为空" });
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
    logger.error({ error }, "OCR识别失败");
    res.status(500).json({ error: "OCR识别失败" });
  }
});

router.post("/inmo/devices/:id/voice-command", requireMaster, async (req: Request, res: Response) => {
  try {
    const device = inmoDevices.get(req.params.id);
    if (!device) {
      return res.status(404).json({ error: "设备不存在" });
    }

    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "语音指令不能为空" });
    }

    const command = inmoBridgeService.parseVoiceCommand(transcript);

    if (!command) {
      res.json({
        success: false,
        message: "未识别到有效指令",
        transcript,
      });
      return;
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
    logger.error({ error }, "语音指令处理失败");
    res.status(500).json({ error: "语音指令处理失败" });
  }
});

router.get("/inmo/bridge/stats", requireMaster, async (_req: Request, res: Response) => {
  try {
    const stats = inmoBridgeService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, "获取桥接服务状态失败");
    res.status(500).json({ error: "获取桥接服务状态失败" });
  }
});

router.delete("/inmo/devices/:id", requireMaster, async (req: Request, res: Response) => {
  try {
    if (!inmoDevices.has(req.params.id)) {
      return res.status(404).json({ error: "设备不存在" });
    }
    
    inmoDevices.delete(req.params.id);
    await auditAction('INMO_DEVICE_REMOVED', req.userRole || 'MASTER', 'inmo_device', req.params.id, {}, 'SUCCESS', req);
    
    logger.info({ deviceId: req.params.id }, "INMO设备已删除");
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, "删除设备失败");
    res.status(500).json({ error: "删除设备失败" });
  }
});

router.post("/perception/session", requireMaster, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: "设备ID不能为空" });
    }
    const userRole = req.userRole || 'MASTER';
    const session = await perceptionCore.createSession(deviceId, userRole);
    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        deviceId: session.deviceId,
        visionEnabled: session.visionEnabled,
        audioEnabled: session.audioEnabled,
      },
    });
  } catch (error) {
    logger.error({ error }, "创建感知会话失败");
    res.status(500).json({ error: "创建感知会话失败" });
  }
});

router.delete("/perception/session/:sessionId", requireMaster, async (req: Request, res: Response) => {
  try {
    const success = await perceptionCore.endSession(req.params.sessionId);
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    res.json({ success: true, message: "感知会话已结束" });
  } catch (error) {
    logger.error({ error }, "结束感知会话失败");
    res.status(500).json({ error: "结束感知会话失败" });
  }
});

router.post("/perception/session/:sessionId/vision", requireMaster, async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "图片数据不能为空" });
    }
    const result = await perceptionCore.processVisionFrame(req.params.sessionId, imageBase64);
    if (result.response && result.response.type !== 'SILENT') {
      await perceptionCore.sendResponseToGlasses(req.params.sessionId, result.response);
    }
    res.json({
      success: true,
      frame: result.frame,
      response: result.response,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "视觉处理失败";
    logger.error({ error }, "视觉处理失败");
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/perception/session/:sessionId/audio", requireMaster, async (req: Request, res: Response) => {
  try {
    const { transcript, speaker, language } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "语音内容不能为空" });
    }
    const result = await perceptionCore.processAudioSegment(
      req.params.sessionId,
      transcript,
      speaker || 'unknown',
      language || 'zh-CN'
    );
    if (result.response && result.response.type !== 'SILENT') {
      await perceptionCore.sendResponseToGlasses(req.params.sessionId, result.response);
    }
    res.json({
      success: true,
      segment: result.segment,
      response: result.response,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "听觉处理失败";
    logger.error({ error }, "听觉处理失败");
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/perception/session/:sessionId/perceive", requireMaster, async (req: Request, res: Response) => {
  try {
    const { imageBase64, transcript } = req.body;
    if (!imageBase64 && !transcript) {
      return res.status(400).json({ error: "需要提供图片或语音内容" });
    }
    const result = await perceptionCore.processCombinedInput(
      req.params.sessionId,
      imageBase64,
      transcript
    );
    if (result.response.type !== 'SILENT') {
      await perceptionCore.sendResponseToGlasses(req.params.sessionId, result.response);
    }
    res.json({
      success: true,
      response: result.response,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "感知处理失败";
    logger.error({ error }, "感知处理失败");
    res.status(500).json({ error: errorMessage });
  }
});

router.get("/perception/stats", requireMaster, async (_req: Request, res: Response) => {
  try {
    const stats = perceptionCore.getStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, "获取感知核心状态失败");
    res.status(500).json({ error: "获取感知核心状态失败" });
  }
});

logger.info("AR/INMO路由模块已加载");

export default router;
