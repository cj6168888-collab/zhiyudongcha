import { describe, it, expect, vi, beforeEach } from 'vitest';

// manager 依赖 ../index 里的 sessionMiddleware，需要 mock 掉整条链
vi.mock('../../index', () => ({ sessionMiddleware: vi.fn() }));
vi.mock('../routes/auth', () => ({ validateWsToken: vi.fn().mockReturnValue('MASTER') }));
vi.mock('../services/dashscope', () => ({}));
vi.mock('../services/alibaba-asr', () => ({ handleASRConnection: vi.fn() }));

// 用相对路径 mock
vi.mock('../../../index', () => ({ sessionMiddleware: vi.fn() }));
vi.mock('../../../routes/auth', () => ({ validateWsToken: vi.fn().mockReturnValue('MASTER') }));
vi.mock('../../../services/dashscope', () => ({}));
vi.mock('../../../services/alibaba-asr', () => ({ handleASRConnection: vi.fn() }));
vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { WebSocketManagerImpl } from '../../../websocket/manager';

function makeWs(readyState: number) {
  return { readyState, send: vi.fn() };
}

describe('WebSocketManagerImpl.broadcast', () => {
  let mgr: WebSocketManagerImpl;

  beforeEach(() => {
    mgr = new WebSocketManagerImpl();
  });

  it('向所有 OPEN 的 z3 客户端广播', () => {
    const open1 = makeWs(1);
    const open2 = makeWs(1);
    const closed = makeWs(3);

    // @ts-expect-error 直接访问私有字段做测试
    mgr['z3Clients'].add(open1);
    // @ts-expect-error
    mgr['z3Clients'].add(open2);
    // @ts-expect-error
    mgr['z3Clients'].add(closed);

    mgr.broadcast('HP_UPDATED', { balance: 900, consumed: 100 });

    expect(open1.send).toHaveBeenCalledTimes(1);
    expect(open2.send).toHaveBeenCalledTimes(1);
    expect(closed.send).not.toHaveBeenCalled();

    const payload = JSON.parse(open1.send.mock.calls[0][0] as string);
    expect(payload.type).toBe('HP_UPDATED');
    expect(payload.balance).toBe(900);
    expect(payload.consumed).toBe(100);
    expect(typeof payload.timestamp).toBe('number');
  });

  it('没有客户端时广播不报错', () => {
    expect(() => mgr.broadcast('EVOLUTION_UPDATE', { xpGained: 10 })).not.toThrow();
  });

  it('广播的 JSON 包含 type + data + timestamp', () => {
    const ws = makeWs(1);
    // @ts-expect-error
    mgr['z3Clients'].add(ws);

    mgr.broadcast('EVOLUTION_UPDATE', { state: { academicLevel: 'MASTER' }, levelUp: null });

    const payload = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      type: 'EVOLUTION_UPDATE',
      state: { academicLevel: 'MASTER' },
      levelUp: null,
    });
    expect(payload.timestamp).toBeGreaterThan(0);
  });
});
