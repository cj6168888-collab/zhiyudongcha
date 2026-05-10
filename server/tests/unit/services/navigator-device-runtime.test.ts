import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock 依赖
vi.mock('../../../services/devices/DeviceBindingService', () => ({
  deviceBindingService: {
    validateDevice: vi.fn(),
    generateBindCode: vi.fn(),
    touchDevice: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../services/perception/PerceptionGateway', () => ({
  perceptionGateway: {
    ingestText: vi.fn().mockResolvedValue({ conversation: { id: 'conv-001' }, segmentId: 'seg-001', processed: false }),
  },
}));

import { deviceBindingService } from '../../../services/devices/DeviceBindingService';
import { perceptionGateway } from '../../../services/perception/PerceptionGateway';
import { navigatorDeviceRuntime } from '../../../services/devices/NavigatorDeviceRuntime';

// ── 模拟 WebSocket ─────────────────────────────────────

function makeMockWs() {
  const emitter = new EventEmitter() as any;
  emitter.readyState = 1; // WebSocket.OPEN
  emitter.sent = [] as string[];
  emitter.send = vi.fn((data: string) => emitter.sent.push(data));
  emitter.emit = emitter.emit.bind(emitter);
  return emitter;
}

function parseLast(ws: any): Record<string, any> {
  const msgs = ws.sent;
  return JSON.parse(msgs[msgs.length - 1]);
}

const BINDING = {
  id: 'binding-001',
  ownerId: 'user-001',
  identityId: 'identity-001',
  deviceId: 'dev-001',
  deviceType: 'esp32_voice',
  provider: 'esp32_voice',
  displayName: null,
  status: 'active',
  capabilities: {},
  allowedModes: ['casual_chat', 'record_note', 'task_request'],
  riskPolicy: {},
  lastSeenAt: null,
  boundAt: new Date(),
  revokedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // 清空 runtime 内部会话（通过模拟 close 事件）
});

// 辅助：模拟 hello 握手并返回 sessionId
async function doHello(ws: any): Promise<string> {
  vi.mocked(deviceBindingService.validateDevice).mockResolvedValue(BINDING);

  await (navigatorDeviceRuntime as any).handleHello(ws, {
    type: 'hello',
    deviceId: 'dev-001',
    protocolVersion: '1.0',
    capabilities: { audioInput: true },
  });

  const ack = parseLast(ws);
  return ack.sessionId;
}

describe('NavigatorDeviceRuntime — hello 握手', () => {
  it('未绑定设备返回 binding_required', async () => {
    vi.mocked(deviceBindingService.validateDevice).mockResolvedValue(null);
    vi.mocked(deviceBindingService.generateBindCode).mockResolvedValue({
      code: '482913',
      ownerId: 'default',
      identityId: 'default',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600_000,
    });

    const ws = makeMockWs();
    await (navigatorDeviceRuntime as any).handleHello(ws, { type: 'hello', deviceId: 'unknown-dev' });

    const msg = parseLast(ws);
    expect(msg.type).toBe('binding_required');
    expect(msg.displayCode).toBe('482913');
    expect(msg.expiresInSec).toBeGreaterThan(0);
  });

  it('已绑定设备返回 hello_ack + sessionId', async () => {
    vi.mocked(deviceBindingService.validateDevice).mockResolvedValue(BINDING);
    const ws = makeMockWs();

    await (navigatorDeviceRuntime as any).handleHello(ws, { type: 'hello', deviceId: 'dev-001' });

    const msg = parseLast(ws);
    expect(msg.type).toBe('hello_ack');
    expect(msg.sessionId).toBeTruthy();
    expect(msg.allowedModes).toContain('casual_chat');
    expect(msg.identity.name).toBe('小语');
  });

  it('hello 缺少 deviceId 返回 error', async () => {
    const ws = makeMockWs();
    await (navigatorDeviceRuntime as any).handleHello(ws, { type: 'hello' });
    const msg = parseLast(ws);
    expect(msg.type).toBe('error');
    expect(msg.code).toBe('MISSING_DEVICE_ID');
  });
});

describe('NavigatorDeviceRuntime — text_intent', () => {
  it('会话不存在返回 SESSION_NOT_FOUND', async () => {
    const ws = makeMockWs();
    await (navigatorDeviceRuntime as any).handleTextIntent(ws, {
      type: 'text_intent',
      sessionId: 'nonexistent',
      text: '帮我记一下',
      mode: 'record_note',
    });
    const msg = parseLast(ws);
    expect(msg.type).toBe('error');
    expect(msg.code).toBe('SESSION_NOT_FOUND');
  });

  it('正常文本意图调用 PerceptionGateway', async () => {
    const ws = makeMockWs();
    const sessionId = await doHello(ws);

    ws.sent = []; // 清空 hello_ack
    await (navigatorDeviceRuntime as any).handleTextIntent(ws, {
      type: 'text_intent',
      sessionId,
      text: '帮我记一下会议内容',
      mode: 'record_note',
      confidence: 0.92,
    });

    expect(vi.mocked(perceptionGateway.ingestText)).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'xiaozhi_device',
        mode: 'record_note',
        text: '帮我记一下会议内容',
      })
    );

    const reply = ws.sent.find((s: string) => JSON.parse(s).type === 'navigator_reply');
    expect(reply).toBeTruthy();
    expect(JSON.parse(reply!).text).toBe('我记下了，稍后会整理给你确认。');
  });

  it('高风险关键词触发 needs_confirmation', async () => {
    const ws = makeMockWs();
    const sessionId = await doHello(ws);

    ws.sent = [];
    await (navigatorDeviceRuntime as any).handleTextIntent(ws, {
      type: 'text_intent',
      sessionId,
      text: '帮我删除所有联系人',
      mode: 'task_request',
    });

    // PerceptionGateway 不应被调用
    expect(vi.mocked(perceptionGateway.ingestText)).not.toHaveBeenCalled();

    const stateMsg = ws.sent.find((s: string) => JSON.parse(s).state === 'needs_confirmation');
    expect(stateMsg).toBeTruthy();
    expect(JSON.parse(stateMsg!).displayText).toBe('请在手机确认');
  });

  it('不在 allowedModes 中的模式被拒绝', async () => {
    const ws = makeMockWs();
    // 重新 hello，限制只允许 casual_chat
    vi.mocked(deviceBindingService.validateDevice).mockResolvedValue({
      ...BINDING,
      allowedModes: ['casual_chat'],
    });
    await (navigatorDeviceRuntime as any).handleHello(ws, { type: 'hello', deviceId: 'dev-001' });
    const ack = parseLast(ws);
    const sessionId = ack.sessionId;

    ws.sent = [];
    await (navigatorDeviceRuntime as any).handleTextIntent(ws, {
      type: 'text_intent',
      sessionId,
      text: '帮我记一下',
      mode: 'record_note', // 不在 allowedModes 里
    });

    const denied = ws.sent.find((s: string) => JSON.parse(s).state === 'mode_denied');
    expect(denied).toBeTruthy();
    expect(vi.mocked(perceptionGateway.ingestText)).not.toHaveBeenCalled();
  });
});

describe('NavigatorDeviceRuntime — 状态查询', () => {
  it('getOnlineDevices 包含已握手设备', async () => {
    vi.mocked(deviceBindingService.validateDevice).mockResolvedValue(BINDING);
    const ws = makeMockWs();
    await (navigatorDeviceRuntime as any).handleHello(ws, { type: 'hello', deviceId: 'dev-online' });

    const online = navigatorDeviceRuntime.getOnlineDevices();
    expect(online).toContain('dev-online');
  });

  it('isOnline 对已连接设备返回 true', async () => {
    expect(navigatorDeviceRuntime.isOnline('dev-online')).toBe(true);
  });

  it('isOnline 对未连接设备返回 false', () => {
    expect(navigatorDeviceRuntime.isOnline('dev-ghost')).toBe(false);
  });
});
