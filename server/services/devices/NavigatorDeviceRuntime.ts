/**
 * NavigatorDeviceRuntime
 * 管理 ESP32 外设 WebSocket 连接
 * 路径: /ws/devices/esp32
 *
 * 消息流:
 *   device → hello         → hello_ack | binding_required
 *   device → text_intent   → PerceptionGateway → Conversation
 *   device → audio_segment → 确认接收（全量转写为未来工作）
 *   device → heartbeat     → 更新 lastSeenAt
 *   server → set_state     → 通知外设更新显示/状态灯
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createServiceLogger } from '../../lib/logger';
import { deviceBindingService } from './DeviceBindingService';
import { perceptionGateway } from '../perception/PerceptionGateway';
import { randomUUID } from 'crypto';

const logger = createServiceLogger('NavigatorDeviceRuntime');

// ── 高风险动作关键词（外设不可直接执行） ─────────────────
const HIGH_RISK_PATTERNS = /发送|删除|外传|付款|支付|授权|分享|广播/;

// ── 会话记录 ─────────────────────────────────────────────

interface DeviceSession {
  ws: WebSocket;
  sessionId: string;
  deviceId: string;
  ownerId: string;
  identityId: string;
  mode: string;
  allowedModes: string[];
  connectedAt: Date;
  lastHeartbeat: Date;
}

// ── Runtime ──────────────────────────────────────────────

class NavigatorDeviceRuntime {
  private sessions = new Map<string, DeviceSession>(); // sessionId → session
  private deviceSessions = new Map<string, string>();  // deviceId → sessionId

  // ── WebSocket 初始化 ──────────────────────────────────

  init(httpServer: Server): WebSocketServer {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws/devices/esp32' });

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);
      const deviceId = url.searchParams.get('deviceId') ?? '';
      const protocolVersion = url.searchParams.get('protocolVersion') ?? '1.0';

      logger.info({ deviceId, protocolVersion }, 'ESP32 connected');

      ws.on('message', (raw) => this.onMessage(ws, deviceId, raw));
      ws.on('close', () => this.onClose(deviceId));
      ws.on('error', (err) => {
        logger.error({ deviceId, err: err.message }, 'WebSocket error');
        this.onClose(deviceId);
      });

      // 30 秒心跳检测
      const hb = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.send(ws, { type: 'ping', ts: Date.now() });
        }
      }, 30_000);

      ws.on('close', () => clearInterval(hb));
    });

    logger.info('NavigatorDeviceRuntime WebSocket listening at /ws/devices/esp32');
    return wss;
  }

  // ── 消息处理 ──────────────────────────────────────────

  private async onMessage(ws: WebSocket, urlDeviceId: string, raw: unknown) {
    let msg: Record<string, any>;
    try {
      msg = JSON.parse(raw as string);
    } catch {
      this.send(ws, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' });
      return;
    }

    const { type } = msg;

    switch (type) {
      case 'hello':
        await this.handleHello(ws, msg);
        break;
      case 'text_intent':
        await this.handleTextIntent(ws, msg);
        break;
      case 'audio_segment':
        this.handleAudioSegment(ws, msg);
        break;
      case 'heartbeat':
      case 'pong':
        this.handleHeartbeat(msg);
        break;
      default:
        logger.warn({ type, deviceId: urlDeviceId }, 'Unknown message type');
    }
  }

  private async handleHello(ws: WebSocket, msg: Record<string, any>) {
    const deviceId: string = msg.deviceId ?? '';
    if (!deviceId) {
      this.send(ws, { type: 'error', code: 'MISSING_DEVICE_ID' });
      return;
    }

    // 验证绑定状态
    const binding = await deviceBindingService.validateDevice(deviceId);

    if (!binding) {
      // 设备未绑定，生成绑定码让设备显示
      try {
        const codeEntry = await deviceBindingService.generateBindCode('default', 'default');
        this.send(ws, {
          type: 'binding_required',
          displayCode: codeEntry.code,
          expiresInSec: Math.floor((codeEntry.expiresAt - Date.now()) / 1000),
        });
        logger.info({ deviceId }, 'Sent binding_required');
      } catch {
        this.send(ws, { type: 'binding_required', displayCode: '------', expiresInSec: 0 });
      }
      return;
    }

    // 已绑定 — 创建会话
    const sessionId = `sess-${randomUUID().slice(0, 8)}`;
    const session: DeviceSession = {
      ws,
      sessionId,
      deviceId,
      ownerId: binding.ownerId,
      identityId: binding.identityId,
      mode: 'casual_chat',
      allowedModes: binding.allowedModes,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.deviceSessions.set(deviceId, sessionId);

    // 更新在线状态
    await deviceBindingService.touchDevice(deviceId);

    this.send(ws, {
      type: 'hello_ack',
      sessionId,
      identity: {
        name: '小语',
        wakeWord: '小语小语',
        voiceId: 'voice-default',
        tone: 'warm',
      },
      allowedModes: binding.allowedModes,
      riskPolicyVersion: '2026-04-30',
    });

    logger.info({ deviceId, sessionId, ownerId: binding.ownerId }, 'Device session started');
  }

  private async handleTextIntent(ws: WebSocket, msg: Record<string, any>) {
    const sessionId: string = msg.sessionId ?? '';
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.send(ws, { type: 'error', code: 'SESSION_NOT_FOUND', message: '请先发送 hello' });
      return;
    }

    const text: string = msg.text ?? '';
    const mode: string = msg.mode ?? session.mode;

    // 检查模式是否被允许
    if (session.allowedModes.length > 0 && !session.allowedModes.includes(mode)) {
      this.send(ws, {
        type: 'set_state',
        state: 'mode_denied',
        displayText: '此模式未被允许',
        light: 'red_flash',
      });
      return;
    }

    // 高风险动作检测
    if (HIGH_RISK_PATTERNS.test(text)) {
      this.send(ws, {
        type: 'set_state',
        state: 'needs_confirmation',
        displayText: '请在手机确认',
        light: 'amber_pulse',
      });
      logger.warn({ deviceId: session.deviceId, text: text.slice(0, 50) }, 'High-risk text blocked at device layer');
      return;
    }

    // 通知设备正在处理
    this.send(ws, {
      type: 'set_state',
      state: 'processing',
      displayText: '正在处理…',
      light: 'blue_breathe',
    });

    try {
      const perceptionMode = this.resolveMode(mode);
      await perceptionGateway.ingestText({
        ownerId: session.ownerId,
        source: 'xiaozhi_device',
        mode: perceptionMode,
        text,
        speaker: 'user',
        speakerType: 'user',
        sourceDeviceId: session.deviceId,
        autoProcess: perceptionMode === 'task_request' || perceptionMode === 'record_note',
      });

      const replyText = this.buildReply(perceptionMode);
      this.send(ws, {
        type: 'navigator_reply',
        sessionId,
        text: replyText,
        mode,
      });
      this.send(ws, {
        type: 'set_state',
        state: 'idle',
        displayText: replyText.slice(0, 20),
        light: 'green_pulse',
      });

      logger.info({ deviceId: session.deviceId, mode, textLen: text.length }, 'Text intent processed');
    } catch (err) {
      logger.error({ err, deviceId: session.deviceId }, 'Text intent processing failed');
      this.send(ws, {
        type: 'set_state',
        state: 'error',
        displayText: '处理失败，请重试',
        light: 'red_flash',
      });
    }
  }

  private handleAudioSegment(ws: WebSocket, msg: Record<string, any>) {
    const sessionId: string = msg.sessionId ?? '';
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // P2 阶段只确认收到，全量转写留 P3+
    this.send(ws, {
      type: 'audio_ack',
      sessionId,
      sequence: msg.sequence,
    });
  }

  private handleHeartbeat(msg: Record<string, any>) {
    const sessionId: string = msg.sessionId ?? '';
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastHeartbeat = new Date();
    deviceBindingService.touchDevice(session.deviceId).catch(() => {});
  }

  private onClose(deviceId: string) {
    const sessionId = this.deviceSessions.get(deviceId);
    if (sessionId) {
      this.sessions.delete(sessionId);
      this.deviceSessions.delete(deviceId);
      logger.info({ deviceId, sessionId }, 'Device session closed');
    }
  }

  // ── 主动推送命令 ──────────────────────────────────────

  sendToDevice(deviceId: string, command: Record<string, any>): boolean {
    const sessionId = this.deviceSessions.get(deviceId);
    if (!sessionId) return false;

    const session = this.sessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return false;

    this.send(session.ws, command);
    return true;
  }

  // ── 状态查询 ──────────────────────────────────────────

  getOnlineDevices(): string[] {
    return Array.from(this.deviceSessions.keys());
  }

  isOnline(deviceId: string): boolean {
    return this.deviceSessions.has(deviceId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  // ── 工具 ─────────────────────────────────────────────

  private send(ws: WebSocket, data: Record<string, any>) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private resolveMode(mode: string): 'casual_chat' | 'record_note' | 'conversation_record' | 'task_request' {
    const valid = ['casual_chat', 'record_note', 'conversation_record', 'task_request'];
    return valid.includes(mode) ? (mode as any) : 'casual_chat';
  }

  private buildReply(mode: string): string {
    const map: Record<string, string> = {
      record_note: '我记下了，稍后会整理给你确认。',
      task_request: '好的，已创建任务候选，请在手机上确认。',
      conversation_record: '已记录这段对话，稍后整理。',
      casual_chat: '收到。',
    };
    return map[mode] ?? '收到。';
  }
}

export const navigatorDeviceRuntime = new NavigatorDeviceRuntime();

export function initDeviceWebSocket(httpServer: Server): WebSocketServer {
  return navigatorDeviceRuntime.init(httpServer);
}
