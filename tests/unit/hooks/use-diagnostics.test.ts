/**
 * useDiagnostics hook 单元测试
 * @vitest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const { isNativePlatformMock, checkHealthMock } = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(() => false),
  checkHealthMock:      vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));

vi.mock('@/plugins', () => ({
  DiagnosticsPlugin: { checkHealth: checkHealthMock },
}));

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { useDiagnostics } from '@/hooks/use-diagnostics';
import type { HealthReport } from '@/plugins/definitions';

// ── fixture ──────────────────────────────────────────────────────────────────

const MOCK_HEALTH: HealthReport = {
  jni_loaded:      true,
  jni_error:       null,
  tts_ready:       true,
  free_storage_mb: 1024,
  permissions: {
    RECORD_AUDIO:    true,
    READ_EXTERNAL_STORAGE:  true,
    WRITE_EXTERNAL_STORAGE: true,
    CAMERA: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  isNativePlatformMock.mockReturnValue(false);
  checkHealthMock.mockResolvedValue(MOCK_HEALTH);
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('useDiagnostics — Web 环境（isNative=false）', () => {
  it('isAvailable=false，health 初始为 null', () => {
    const { result } = renderHook(() => useDiagnostics(false));
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.health).toBeNull();
  });

  it('checkHealth 在非原生环境中是 no-op，不调用插件', async () => {
    const { result } = renderHook(() => useDiagnostics(false));
    await act(async () => {
      await result.current.checkHealth();
    });
    expect(checkHealthMock).not.toHaveBeenCalled();
    expect(result.current.health).toBeNull();
  });

  it('runOnMount=true 在非原生环境中不触发检测', () => {
    renderHook(() => useDiagnostics(true));
    expect(checkHealthMock).not.toHaveBeenCalled();
  });
});

describe('useDiagnostics — Native 环境（isNative=true）', () => {
  beforeEach(() => {
    isNativePlatformMock.mockReturnValue(true);
  });

  it('runOnMount=true → 自动调用 DiagnosticsPlugin.checkHealth', async () => {
    const { result } = renderHook(() => useDiagnostics(true));
    await waitFor(() => {
      expect(result.current.health).not.toBeNull();
    });
    expect(checkHealthMock).toHaveBeenCalledTimes(1);
  });

  it('runOnMount=false → 挂载时不调用 checkHealth', async () => {
    renderHook(() => useDiagnostics(false));
    // Allow microtasks to settle
    await act(async () => {});
    expect(checkHealthMock).not.toHaveBeenCalled();
  });

  it('checkHealth 成功 → health 更新为插件返回值', async () => {
    const { result } = renderHook(() => useDiagnostics(false));
    await act(async () => {
      await result.current.checkHealth();
    });
    expect(result.current.health).toEqual(MOCK_HEALTH);
  });

  it('checkHealth 过程中 isChecking=true，结束后恢复 false', async () => {
    let resolveHealth!: (v: HealthReport) => void;
    checkHealthMock.mockImplementationOnce(
      () => new Promise<HealthReport>((res) => { resolveHealth = res; }),
    );

    const { result } = renderHook(() => useDiagnostics(false));
    let checkPromise: Promise<void>;

    act(() => {
      checkPromise = result.current.checkHealth();
    });

    // isChecking should be true while promise is pending
    expect(result.current.isChecking).toBe(true);

    await act(async () => {
      resolveHealth(MOCK_HEALTH);
      await checkPromise;
    });

    expect(result.current.isChecking).toBe(false);
  });

  it('DiagnosticsPlugin.checkHealth 抛错 → health 保持 null，isChecking 恢复 false', async () => {
    checkHealthMock.mockRejectedValueOnce(new Error('plugin not ready'));
    const { result } = renderHook(() => useDiagnostics(false));
    await act(async () => {
      await result.current.checkHealth();
    });
    expect(result.current.health).toBeNull();
    expect(result.current.isChecking).toBe(false);
  });

  it('多次调用 checkHealth 每次均触发插件', async () => {
    const { result } = renderHook(() => useDiagnostics(false));
    await act(async () => { await result.current.checkHealth(); });
    await act(async () => { await result.current.checkHealth(); });
    expect(checkHealthMock).toHaveBeenCalledTimes(2);
  });
});
