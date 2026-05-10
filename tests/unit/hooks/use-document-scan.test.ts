/**
 * useDocumentScan hook 单元测试
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const {
  isNativePlatformMock,
  startScanSessionMock,
  addPageMock,
  finishAndAnalyzeMock,
  cancelSessionMock,
} = vi.hoisted(() => ({
  isNativePlatformMock:   vi.fn(() => false),
  startScanSessionMock:   vi.fn(),
  addPageMock:            vi.fn().mockResolvedValue(undefined),
  finishAndAnalyzeMock:   vi.fn().mockResolvedValue(undefined),
  cancelSessionMock:      vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));

vi.mock('@/plugins', () => ({
  DocumentPlugin: {
    startScanSession: startScanSessionMock,
    addPage:          addPageMock,
    finishAndAnalyze: finishAndAnalyzeMock,
    cancelSession:    cancelSessionMock,
  },
}));

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { useDocumentScan } from '@/hooks/use-document-scan';

// ── helpers ──────────────────────────────────────────────────────────────────

let objectUrls: string[] = [];
const createObjectURLMock = vi.fn((file: File | Blob) => {
  const url = `blob:mock/${Math.random().toString(36).slice(2)}`;
  objectUrls.push(url);
  return url;
});
const revokeObjectURLMock = vi.fn((url: string) => {
  objectUrls = objectUrls.filter((u) => u !== url);
});

function makeFile(name = 'page.jpg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
}

function mockFetchOk() {
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({ success: true }),
  } as Response);
}

function mockFetchFail(status = 500) {
  global.fetch = vi.fn().mockResolvedValue({
    ok:         false,
    status,
    statusText: 'Internal Server Error',
  } as Response);
}

// ── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  objectUrls = [];
  isNativePlatformMock.mockReturnValue(false);
  startScanSessionMock.mockResolvedValue({ sessionId: 'native-session-1' });

  global.URL.createObjectURL = createObjectURLMock;
  global.URL.revokeObjectURL = revokeObjectURLMock;
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('useDocumentScan — 初始状态', () => {
  it('state=idle, pages=[], sessionId=null, projectId=null', () => {
    const { result } = renderHook(() => useDocumentScan());
    expect(result.current.state).toBe('idle');
    expect(result.current.pages).toHaveLength(0);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.projectId).toBeNull();
  });
});

describe('useDocumentScan — startSession（Web）', () => {
  it('startSession → state=active，生成 web-session-* ID', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    expect(result.current.state).toBe('active');
    expect(result.current.sessionId).toMatch(/^web-session-/);
    expect(startScanSessionMock).not.toHaveBeenCalled();
  });

  it('startSession 传入 projectId → projectId 被存储', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession('proj-123'); });
    expect(result.current.projectId).toBe('proj-123');
  });

  it('二次 startSession 清空上一次的 pages', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile()); });
    expect(result.current.pages).toHaveLength(1);

    await act(async () => { await result.current.startSession(); });
    expect(result.current.pages).toHaveLength(0);
  });
});

describe('useDocumentScan — startSession（Native）', () => {
  beforeEach(() => { isNativePlatformMock.mockReturnValue(true); });

  it('调用 DocumentPlugin.startScanSession，并存储返回的 sessionId', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession('proj-42'); });
    expect(startScanSessionMock).toHaveBeenCalledWith({ projectId: 'proj-42' });
    expect(result.current.sessionId).toBe('native-session-1');
  });

  it('DocumentPlugin.startScanSession 抛错 → sessionId=null，state 仍为 active', async () => {
    startScanSessionMock.mockRejectedValueOnce(new Error('plugin error'));
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    expect(result.current.state).toBe('active');
    expect(result.current.sessionId).toBeNull();
  });
});

describe('useDocumentScan — addPage', () => {
  it('addPage → pages 增加一项，createObjectURL 被调用', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    const file = makeFile('doc1.jpg');
    await act(async () => { await result.current.addPage(file); });
    expect(result.current.pages).toHaveLength(1);
    expect(createObjectURLMock).toHaveBeenCalledWith(file);
    expect(result.current.pages[0].file).toBe(file);
  });

  it('state !== active 时 addPage 无效', async () => {
    const { result } = renderHook(() => useDocumentScan());
    // state is 'idle' — not started
    await act(async () => { await result.current.addPage(makeFile()); });
    expect(result.current.pages).toHaveLength(0);
  });

  it('多次 addPage 累加 pages', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile('p1.jpg')); });
    await act(async () => { await result.current.addPage(makeFile('p2.jpg')); });
    await act(async () => { await result.current.addPage(makeFile('p3.jpg')); });
    expect(result.current.pages).toHaveLength(3);
  });
});

describe('useDocumentScan — removePage', () => {
  it('removePage(0) 移除第一页并 revoke 其 previewUrl', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile()); });

    const previewUrl = result.current.pages[0].previewUrl;
    act(() => { result.current.removePage(0); });

    expect(result.current.pages).toHaveLength(0);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(previewUrl);
  });

  it('多页中 removePage(1) 只移除第二页', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile('p1.jpg')); });
    await act(async () => { await result.current.addPage(makeFile('p2.jpg')); });

    act(() => { result.current.removePage(1); });
    expect(result.current.pages).toHaveLength(1);
    expect(result.current.pages[0].file.name).toBe('p1.jpg');
  });
});

describe('useDocumentScan — submit（Web）', () => {
  it('pages 为空时 submit 返回 success=false', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    let res: { success: boolean; message: string };
    await act(async () => {
      res = await result.current.submit();
    });
    expect(res!.success).toBe(false);
    expect(res!.message).toContain('添加');
  });

  it('上传成功 → state=done, success=true', async () => {
    mockFetchOk();
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile()); });

    let res: { success: boolean; message: string };
    await act(async () => {
      res = await result.current.submit();
    });

    expect(result.current.state).toBe('done');
    expect(res!.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/scans/upload',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shareToSwarm=true → message 提到蜂群', async () => {
    mockFetchOk();
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile()); });

    let res: { success: boolean; message: string };
    await act(async () => { res = await result.current.submit(true); });
    expect(res!.message).toContain('蜂群');
  });

  it('fetch 返回非 ok → state=error, success=false', async () => {
    mockFetchFail(500);
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile()); });

    let res: { success: boolean; message: string };
    await act(async () => { res = await result.current.submit(); });
    expect(result.current.state).toBe('error');
    expect(res!.success).toBe(false);
    expect(res!.message).toContain('失败');
  });
});

describe('useDocumentScan — reset', () => {
  it('reset 清空 pages，state→idle，revoke 所有 previewUrl', async () => {
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });
    await act(async () => { await result.current.addPage(makeFile('a.jpg')); });
    await act(async () => { await result.current.addPage(makeFile('b.jpg')); });

    const urls = result.current.pages.map((p) => p.previewUrl);

    act(() => { result.current.reset(); });

    expect(result.current.state).toBe('idle');
    expect(result.current.pages).toHaveLength(0);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.projectId).toBeNull();
    // forEach passes (url, index, array) — check first arg only
    const revokedUrls = revokeObjectURLMock.mock.calls.map((c) => c[0]);
    urls.forEach((url) => {
      expect(revokedUrls).toContain(url);
    });
  });

  it('Native 环境 reset 调用 DocumentPlugin.cancelSession', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const { result } = renderHook(() => useDocumentScan());
    await act(async () => { await result.current.startSession(); });

    act(() => { result.current.reset(); });

    expect(cancelSessionMock).toHaveBeenCalledWith({ sessionId: 'native-session-1' });
  });
});
