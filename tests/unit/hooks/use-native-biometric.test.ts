/**
 * useNativeBiometric hook 单元测试
 * @vitest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const {
  isNativePlatformMock,
  checkBiometricAvailabilityMock,
  authenticateMock,
} = vi.hoisted(() => ({
  isNativePlatformMock:              vi.fn(() => false),
  checkBiometricAvailabilityMock:    vi.fn(),
  authenticateMock:                  vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));

vi.mock('@/plugins', () => ({
  SecurityPlugin: {
    checkBiometricAvailability: checkBiometricAvailabilityMock,
    authenticate:               authenticateMock,
  },
}));

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { useNativeBiometric } from '@/hooks/use-native-biometric';

// ── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  isNativePlatformMock.mockReturnValue(false);
  checkBiometricAvailabilityMock.mockResolvedValue({ available: true, error: null });
  authenticateMock.mockResolvedValue(undefined);
});

describe('useNativeBiometric — Web 环境（isNative=false）', () => {
  it('isAvailable=false，status=idle，isGranted=false 初始状态', () => {
    const { result } = renderHook(() => useNativeBiometric());
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.isGranted).toBe(false);
    expect(checkBiometricAvailabilityMock).not.toHaveBeenCalled();
  });

  it('Web 环境 authenticate() 直接返回 true（无门控）', async () => {
    const { result } = renderHook(() => useNativeBiometric());
    let authResult: boolean;
    await act(async () => {
      authResult = await result.current.authenticate();
    });
    expect(authResult!).toBe(true);
    expect(authenticateMock).not.toHaveBeenCalled();
  });
});

describe('useNativeBiometric — Native 环境（isNative=true）', () => {
  beforeEach(() => {
    isNativePlatformMock.mockReturnValue(true);
  });

  it('挂载时调用 checkBiometricAvailability，available=true → isAvailable=true', async () => {
    checkBiometricAvailabilityMock.mockResolvedValue({ available: true });
    const { result } = renderHook(() => useNativeBiometric());
    await waitFor(() => {
      expect(result.current.isAvailable).toBe(true);
    });
    expect(checkBiometricAvailabilityMock).toHaveBeenCalledTimes(1);
  });

  it('checkBiometricAvailability 返回 unavailable → isAvailable=false + unavailableReason', async () => {
    checkBiometricAvailabilityMock.mockResolvedValue({
      available: false,
      error:     'NO_HARDWARE',
    });
    const { result } = renderHook(() => useNativeBiometric());
    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.unavailableReason).toBe('NO_HARDWARE');
  });

  it('checkBiometricAvailability 抛错 → status 恢复 idle，不崩溃', async () => {
    checkBiometricAvailabilityMock.mockRejectedValueOnce(new Error('plugin error'));
    const { result } = renderHook(() => useNativeBiometric());
    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });
  });

  it('authenticate 成功 → isGranted=true, status=granted', async () => {
    checkBiometricAvailabilityMock.mockResolvedValue({ available: true });
    authenticateMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useNativeBiometric());
    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    let authResult: boolean;
    await act(async () => {
      authResult = await result.current.authenticate();
    });

    expect(authResult!).toBe(true);
    expect(result.current.isGranted).toBe(true);
    expect(result.current.status).toBe('granted');
    expect(authenticateMock).toHaveBeenCalledTimes(1);
  });

  it('authenticate 失败（插件抛错）→ isGranted=false, status=denied 后恢复 idle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      checkBiometricAvailabilityMock.mockResolvedValue({ available: true });
      authenticateMock.mockRejectedValueOnce(new Error('user cancelled'));

      const { result } = renderHook(() => useNativeBiometric());
      await waitFor(() => expect(result.current.isAvailable).toBe(true));

      let authResult: boolean;
      await act(async () => {
        authResult = await result.current.authenticate();
      });

      expect(authResult!).toBe(false);
      expect(result.current.isGranted).toBe(false);
      expect(result.current.status).toBe('denied');

      // advance 1.5s timer → idle
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      expect(result.current.status).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('isGranted=true 时再次 authenticate 直接返回 true，不调插件', async () => {
    checkBiometricAvailabilityMock.mockResolvedValue({ available: true });
    const { result } = renderHook(() => useNativeBiometric());
    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    // First auth
    await act(async () => { await result.current.authenticate(); });
    expect(result.current.isGranted).toBe(true);

    // Second auth — should short-circuit
    const callCountBefore = authenticateMock.mock.calls.length;
    let secondResult: boolean;
    await act(async () => {
      secondResult = await result.current.authenticate();
    });
    expect(secondResult!).toBe(true);
    expect(authenticateMock.mock.calls.length).toBe(callCountBefore);
  });

  it('revokeGrant() 重置 isGranted=false + status=idle', async () => {
    checkBiometricAvailabilityMock.mockResolvedValue({ available: true });
    const { result } = renderHook(() => useNativeBiometric());
    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    await act(async () => { await result.current.authenticate(); });
    expect(result.current.isGranted).toBe(true);

    act(() => { result.current.revokeGrant(); });
    expect(result.current.isGranted).toBe(false);
    expect(result.current.status).toBe('idle');
  });
});
