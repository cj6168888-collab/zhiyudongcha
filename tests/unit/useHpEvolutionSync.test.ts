/**
 * useHpEvolutionSync hook 单元测试
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---- hoisted mocks ---------------------------------------------------------

const { setStateMock, invalidateQueriesMock } = vi.hoisted(() => ({
  setStateMock:          vi.fn(),
  invalidateQueriesMock: vi.fn(),
}));

vi.mock('../../client/src/lib/queryClient', () => ({
  getAuthenticatedWsUrlAsync: vi.fn().mockResolvedValue('ws://localhost/ws/z3?token=test'),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock('../../client/src/lib/z1/god-protocol', () => ({
  useZ1Store: { setState: setStateMock },
}));

// ---- import SUT after mocks ------------------------------------------------

import { useHpEvolutionSync } from '../../client/src/hooks/use-hp-evolution-sync';

const flushPromises = () => Promise.resolve().then(() => Promise.resolve());

// ---- MockWebSocket ---------------------------------------------------------

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN       = 1;
  static CLOSING    = 2;
  static CLOSED     = 3;

  readyState = MockWebSocket.OPEN;
  onopen:    ((e: Event) => void)        | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose:   ((e: CloseEvent) => void)   | null = null;
  onerror:   ((e: Event) => void)        | null = null;

  sentMessages: string[] = [];

  send(data: string) { this.sentMessages.push(data); }
  close() { this.readyState = MockWebSocket.CLOSED; }

  simulateOpen()  { this.onopen?.(new Event('open')); }
  simulateMessage(data: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
  simulateError() { this.onerror?.(new Event('error')); }
}

let lastWs: MockWebSocket;
let wsCreateCount = 0;
const OriginalWebSocket = (global as any).WebSocket;

// ---- tests -----------------------------------------------------------------

describe('useHpEvolutionSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setStateMock.mockClear();
    invalidateQueriesMock.mockClear();
    wsCreateCount = 0;

    // 用构造函数替换 global.WebSocket，MockWebSocket 本身就是 class（构造函数）
    const WsFactory = function (this: MockWebSocket) {
      wsCreateCount++;
      const instance = new MockWebSocket();
      lastWs = instance;
      Object.assign(this, instance);
      // 重写方法让 this 指向正确
      this.send  = (d: string) => instance.sentMessages.push(d);
      this.close = () => { instance.readyState = MockWebSocket.CLOSED; instance.close(); };
      Object.defineProperty(this, 'onopen',    { get: () => instance.onopen,    set: (v) => { instance.onopen    = v; } });
      Object.defineProperty(this, 'onmessage', { get: () => instance.onmessage, set: (v) => { instance.onmessage = v; } });
      Object.defineProperty(this, 'onclose',   { get: () => instance.onclose,   set: (v) => { instance.onclose   = v; } });
      Object.defineProperty(this, 'onerror',   { get: () => instance.onerror,   set: (v) => { instance.onerror   = v; } });
      Object.defineProperty(this, 'readyState',{ get: () => instance.readyState });
    } as unknown as typeof WebSocket;

    // 必须带上静态属性，hook 内 WebSocket.CLOSED 才能正确判断
    (WsFactory as any).CONNECTING = 0;
    (WsFactory as any).OPEN       = 1;
    (WsFactory as any).CLOSING    = 2;
    (WsFactory as any).CLOSED     = 3;

    (global as any).WebSocket = WsFactory;
  });

  afterEach(() => {
    vi.useRealTimers();
    (global as any).WebSocket = OriginalWebSocket;
  });

  it('连接后发送注册消息', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    expect(lastWs.sentMessages).toHaveLength(1);
    expect(JSON.parse(lastWs.sentMessages[0])).toEqual({ type: 'HP_EVOLUTION_LISTENER' });
    unmount();
  });

  it('HP_UPDATED 消息更新 hpBalance', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    lastWs.simulateMessage({ type: 'HP_UPDATED', balance: 750, consumed: 50, actionType: 'TEST', timestamp: 1 });

    expect(setStateMock).toHaveBeenCalledWith({ hpBalance: 750 });
    unmount();
  });

  it('EVOLUTION_UPDATE 消息更新 academicXp', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    lastWs.simulateMessage({
      type: 'EVOLUTION_UPDATE', totalXp: 1200, xpGained: 50, levelUp: null, state: {}, timestamp: 2,
    });

    expect(setStateMock).toHaveBeenCalledWith({ academicXp: 1200 });
    unmount();
  });

  it('EVOLUTION_UPDATE 升级 PHD → academicLevel DOCTOR', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    lastWs.simulateMessage({
      type: 'EVOLUTION_UPDATE', totalXp: 5000, xpGained: 200,
      levelUp: { from: 'MASTER', to: 'PHD' }, state: {}, timestamp: 3,
    });

    expect(setStateMock).toHaveBeenCalledWith({ academicXp: 5000, academicLevel: 'DOCTOR' });
    unmount();
  });

  it('POSTDOC 映射为 PROFESSOR', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    lastWs.simulateMessage({
      type: 'EVOLUTION_UPDATE', totalXp: 15000, xpGained: 500,
      levelUp: { from: 'PHD', to: 'POSTDOC' }, state: {}, timestamp: 4,
    });

    expect(setStateMock).toHaveBeenCalledWith({ academicXp: 15000, academicLevel: 'PROFESSOR' });
    unmount();
  });

  it('未知 level 名称不写入 academicLevel', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    lastWs.simulateMessage({
      type: 'EVOLUTION_UPDATE', totalXp: 9999, xpGained: 100,
      levelUp: { from: 'PHD', to: 'UNKNOWN' }, state: {}, timestamp: 5,
    });

    expect(setStateMock).toHaveBeenCalledWith({ academicXp: 9999 });
    unmount();
  });

  it('EVOLUTION_UPDATE 后使 evolution 缓存失效', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    lastWs.simulateMessage({
      type: 'EVOLUTION_UPDATE', totalXp: 800, xpGained: 20, levelUp: null, state: {}, timestamp: 6,
    });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['/api/evolution'] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['/api/evolution-state'] });
    unmount();
  });

  it('WebSocket 断开后 5 秒自动重连', async () => {
    renderHook(() => useHpEvolutionSync());
    await flushPromises();

    const countBefore = wsCreateCount;
    lastWs.simulateClose();
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();
    await flushPromises();

    expect(wsCreateCount).toBe(countBefore + 1);
  });

  it('unmount 时关闭 WebSocket', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();

    const ws = lastWs;
    const closeSpy = vi.spyOn(ws, 'close');
    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('畸形 JSON 消息不会抛出异常', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();
    lastWs.simulateOpen();

    expect(() => {
      lastWs.onmessage?.(new MessageEvent('message', { data: 'bad-json{{' }));
    }).not.toThrow();
    unmount();
  });

  it('onerror 时关闭连接', async () => {
    const { unmount } = renderHook(() => useHpEvolutionSync());
    await flushPromises();

    const ws = lastWs;
    const closeSpy = vi.spyOn(ws, 'close');
    ws.simulateError();

    expect(closeSpy).toHaveBeenCalled();
    unmount();
  });
});
