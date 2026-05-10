/**
 * useActionPlugin hook 单元测试
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const {
  isNativePlatformMock,
  makeCallMock,
  addToCalendarMock,
  sendEmailMock,
} = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(() => false),
  makeCallMock:         vi.fn().mockResolvedValue(undefined),
  addToCalendarMock:    vi.fn().mockResolvedValue(undefined),
  sendEmailMock:        vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));

vi.mock('@/plugins', () => ({
  ActionPlugin: {
    makeCall:                makeCallMock,
    addToCalendar:           addToCalendarMock,
    sendEmailWithAttachment: sendEmailMock,
  },
}));

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { useActionPlugin } from '@/hooks/use-action-plugin';

// ── helpers ──────────────────────────────────────────────────────────────────

function hook() {
  return renderHook(() => useActionPlugin()).result.current;
}

beforeEach(() => {
  vi.clearAllMocks();
  isNativePlatformMock.mockReturnValue(false);
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('useActionPlugin — Web 环境（isNative=false）', () => {
  it('未匹配任何意图时返回 handled=false', async () => {
    const { detectAndExecute } = hook();
    const result = await detectAndExecute('今天天气怎么样');
    expect(result.handled).toBe(false);
    expect(result.response).toBe('');
  });

  it('拨号意图 → handled=true，提示仅手机端可用', async () => {
    const { detectAndExecute } = hook();
    const result = await detectAndExecute('拨号：13812345678');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('make_call');
    expect(result.response).toContain('仅在手机端可用');
    expect(result.response).toContain('13812345678');
    expect(makeCallMock).not.toHaveBeenCalled();
  });

  it('日历意图 → handled=true，提示仅手机端可用', async () => {
    const { detectAndExecute } = hook();
    const result = await detectAndExecute('添加一个日程：下午三点开会');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('add_calendar');
    expect(result.response).toContain('仅在手机端可用');
    expect(addToCalendarMock).not.toHaveBeenCalled();
  });

  it('邮件意图 → handled=true，提示仅手机端可用', async () => {
    const { detectAndExecute } = hook();
    const result = await detectAndExecute('发邮件给张三 主题：合同审核');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('send_email');
    expect(result.response).toContain('仅在手机端可用');
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('纯文字问答不触发任何意图', async () => {
    const { detectAndExecute } = hook();
    const msgs = [
      '帮我分析一下市场趋势',
      '写一首关于春天的诗',
      '翻译这段文字',
      '创建一个项目叫做领航者',
    ];
    for (const msg of msgs) {
      const result = await detectAndExecute(msg);
      expect(result.handled).toBe(false);
    }
  });
});

describe('useActionPlugin — Native 环境（isNative=true）', () => {
  beforeEach(() => {
    isNativePlatformMock.mockReturnValue(true);
  });

  it('拨号成功 → 调用 ActionPlugin.makeCall，返回正在拨打提示', async () => {
    const { detectAndExecute } = renderHook(() => useActionPlugin()).result.current;
    const result = await detectAndExecute('拨号：13912345678');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('make_call');
    expect(makeCallMock).toHaveBeenCalledWith({ number: '13912345678' });
    expect(result.response).toContain('正在为您拨打');
  });

  it('ActionPlugin.makeCall 抛错 → handled=true + 提示手动拨打', async () => {
    makeCallMock.mockRejectedValueOnce(new Error('permission denied'));
    const { detectAndExecute } = renderHook(() => useActionPlugin()).result.current;
    const result = await detectAndExecute('拨号：13912345678');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('make_call');
    expect(result.response).toContain('拨号失败');
  });

  it('日历添加成功 → 调用 ActionPlugin.addToCalendar', async () => {
    const { detectAndExecute } = renderHook(() => useActionPlugin()).result.current;
    const result = await detectAndExecute('添加一个日程：下午三点开会');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('add_calendar');
    expect(addToCalendarMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: '下午三点开会' }),
    );
    expect(result.response).toContain('已打开日历');
  });

  it('ActionPlugin.addToCalendar 抛错 → handled=true + 提示手动新建', async () => {
    addToCalendarMock.mockRejectedValueOnce(new Error('calendar unavailable'));
    const { detectAndExecute } = renderHook(() => useActionPlugin()).result.current;
    const result = await detectAndExecute('添加一个日程：年度总结');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('add_calendar');
    expect(result.response).toContain('日历添加失败');
  });

  it('邮件发送成功 → 调用 ActionPlugin.sendEmailWithAttachment', async () => {
    const { detectAndExecute } = renderHook(() => useActionPlugin()).result.current;
    const result = await detectAndExecute('发邮件给张三 主题：合同审核');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('send_email');
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: '张三' }),
    );
    expect(result.response).toContain('已打开邮件客户端');
  });

  it('ActionPlugin.sendEmailWithAttachment 抛错 → handled=true + 提示手动发送', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('email app not found'));
    const { detectAndExecute } = renderHook(() => useActionPlugin()).result.current;
    const result = await detectAndExecute('发邮件给李四 主题：报告');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('send_email');
    expect(result.response).toContain('邮件客户端启动失败');
  });
});

describe('useActionPlugin — 提醒触发日历', () => {
  it('「提醒我」语法匹配日历意图（Web）', async () => {
    const { detectAndExecute } = hook();
    const result = await detectAndExecute('提醒我明天下午跟客户开会');
    expect(result.handled).toBe(true);
    expect(result.action).toBe('add_calendar');
  });
});
