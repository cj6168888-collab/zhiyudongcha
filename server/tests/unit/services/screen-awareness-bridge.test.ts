import { describe, it, expect, vi, beforeEach } from 'vitest';

const conversationServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
  appendSegment: vi.fn(),
  finish: vi.fn(),
}));

vi.mock('../../../services/conversation/ConversationService', () => ({
  conversationService: conversationServiceMock,
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { screenAwarenessBridge } from '../../../services/screen/ScreenAwarenessBridge';

const OWNER = 'user-p4-001';

beforeEach(() => {
  vi.clearAllMocks();
  // 每个测试前重置开关状态
  screenAwarenessBridge.disable(OWNER);
  conversationServiceMock.create.mockResolvedValue({ id: 'conv-screen-001' });
  conversationServiceMock.appendSegment.mockResolvedValue(undefined);
  conversationServiceMock.finish.mockResolvedValue(undefined);
});

// ── 开关默认状态 ───────────────────────────────────────────

describe('ScreenAwarenessBridge — 默认关闭', () => {
  it('新 ownerId 默认为 disabled', () => {
    expect(screenAwarenessBridge.isEnabled('brand-new-owner')).toBe(false);
  });

  it('未开启时 processCapture 返回 stored=false，不写 DB', async () => {
    const result = await screenAwarenessBridge.processCapture(OWNER, { text: '任意内容' });

    expect(result.stored).toBe(false);
    expect(result.blocked).toBe(false);
    expect(conversationServiceMock.create).not.toHaveBeenCalled();
  });
});

// ── 开关控制 ─────────────────────────────────────────────

describe('ScreenAwarenessBridge — 开关控制', () => {
  it('enable 后 isEnabled 返回 true', () => {
    screenAwarenessBridge.enable(OWNER);
    expect(screenAwarenessBridge.isEnabled(OWNER)).toBe(true);
  });

  it('disable 后 isEnabled 返回 false', () => {
    screenAwarenessBridge.enable(OWNER);
    screenAwarenessBridge.disable(OWNER);
    expect(screenAwarenessBridge.isEnabled(OWNER)).toBe(false);
  });
});

// ── 正常存储路径 ─────────────────────────────────────────

describe('ScreenAwarenessBridge — 正常存储', () => {
  beforeEach(() => {
    screenAwarenessBridge.enable(OWNER);
  });

  it('正常内容写入 Conversation + Segment + finish', async () => {
    const result = await screenAwarenessBridge.processCapture(OWNER, {
      text: '这是会议记录的内容',
      appContext: 'Notion',
      source: 'ocr',
    });

    expect(result.stored).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.conversationId).toBe('conv-screen-001');

    expect(conversationServiceMock.create).toHaveBeenCalledWith({
      ownerId: OWNER,
      source: 'desktop',
      mode: 'record_note',
      title: '屏幕捕获 — Notion',
    });

    expect(conversationServiceMock.appendSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-screen-001',
        segmentType: 'screen',
        source: 'ocr',
        speaker: 'screen',
      }),
    );

    expect(conversationServiceMock.finish).toHaveBeenCalledWith('conv-screen-001', OWNER);
  });

  it('无 appContext 时标题为"屏幕捕获"', async () => {
    await screenAwarenessBridge.processCapture(OWNER, { text: '普通内容' });

    expect(conversationServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '屏幕捕获' }),
    );
  });

  it('无 source 时默认使用 ocr', async () => {
    await screenAwarenessBridge.processCapture(OWNER, { text: '内容' });

    expect(conversationServiceMock.appendSegment).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ocr' }),
    );
  });

  it('超长文本截断至 4000 字符', async () => {
    const longText = 'x'.repeat(5000);
    await screenAwarenessBridge.processCapture(OWNER, { text: longText });

    const call = conversationServiceMock.appendSegment.mock.calls[0][0];
    expect(call.text.length).toBe(4000);
  });

  it('DB 写入失败时返回 stored=false，不抛出', async () => {
    conversationServiceMock.create.mockRejectedValue(new Error('db error'));

    const result = await screenAwarenessBridge.processCapture(OWNER, { text: '内容' });

    expect(result.stored).toBe(false);
    expect(result.blocked).toBe(false);
  });
});

// ── 敏感内容阻断 ─────────────────────────────────────────

describe('ScreenAwarenessBridge — 敏感内容阻断', () => {
  beforeEach(() => {
    screenAwarenessBridge.enable(OWNER);
  });

  it('密码字段被阻断', async () => {
    const result = await screenAwarenessBridge.processCapture(OWNER, {
      text: '密码：mySecret123',
    });

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('password_field');
    expect(result.stored).toBe(false);
    expect(conversationServiceMock.create).not.toHaveBeenCalled();
  });

  it('英文 password 字段被阻断', async () => {
    const result = await screenAwarenessBridge.processCapture(OWNER, {
      text: 'password: hunter2',
    });

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('password_field');
  });

  it('私钥内容被阻断', async () => {
    const result = await screenAwarenessBridge.processCapture(OWNER, {
      text: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
    });

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('private_key');
  });

  it('验证码被阻断', async () => {
    const result = await screenAwarenessBridge.processCapture(OWNER, {
      text: '验证码：123456',
    });

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('verification_code');
  });

  it('正常内容不被阻断', async () => {
    const result = await screenAwarenessBridge.processCapture(OWNER, {
      text: '今天下午三点开会讨论 Q2 目标',
    });

    expect(result.blocked).toBe(false);
    expect(result.stored).toBe(true);
  });
});
