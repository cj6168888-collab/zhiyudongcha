import { beforeEach, describe, expect, it, vi } from 'vitest';

const systemOperationServiceMock = vi.hoisted(() => ({
  testConnection: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../../services/pc-agent/SystemOperationService', () => ({
  systemOperationService: {
    testConnection: systemOperationServiceMock.testConnection,
    getSystemInfo: vi.fn(() => ({
      memory: { usagePercent: 35 },
    })),
    getOptimizationSuggestions: vi.fn(() => []),
    cleanTempFiles: vi.fn(),
    cleanBrowserCache: vi.fn(),
    installSoftware: vi.fn(),
    uninstallSoftware: vi.fn(),
  },
}));

import { pcAgent } from '../../../services/pc-agent/PCAgent';

describe('PCAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    systemOperationServiceMock.testConnection.mockResolvedValue({
      reachable: true,
      latency: 24,
    });
  });

  it('handles connectivity diagnostics from a custom phone-to-PC request', async () => {
    const result = await pcAgent.executeTask({
      type: 'custom',
      description: '执行一次连通性测试，并把结果回传到手机端',
      params: {},
    });

    expect(systemOperationServiceMock.testConnection).toHaveBeenCalledWith('127.0.0.1', 80);
    expect(result).toMatchObject({
      success: true,
      type: 'system_optimize',
      message: 'PC 端连通性测试完成：127.0.0.1 可达，耗时约 24ms',
      data: {
        host: '127.0.0.1',
        port: 80,
        reachable: true,
        latency: 24,
      },
    });
  });
});
