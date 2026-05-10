import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/devices/DeviceBindingService', () => ({
  deviceBindingService: {
    listDevices: vi.fn(),
  },
}));

import { deviceBindingsRouter } from '../../../routes/device-bindings';
import { deviceBindingService } from '../../../services/devices/DeviceBindingService';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/device-bindings', deviceBindingsRouter);
  return app;
}

describe('Device bindings routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns bound devices for the current user', async () => {
    vi.mocked(deviceBindingService.listDevices).mockResolvedValue([
      {
        deviceId: 'phone-1',
        deviceType: 'mobile',
        displayName: '手机',
        status: 'ONLINE',
        lastSeenAt: new Date('2026-05-10T10:00:00Z'),
      },
    ] as any);

    const response = await request(createApp())
      .get('/api/device-bindings')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      devices: [
        {
          deviceId: 'phone-1',
          deviceType: 'mobile',
          displayName: '手机',
          status: 'ONLINE',
        },
      ],
    });
  });

  it('keeps the device list safe when storage is unavailable', async () => {
    vi.mocked(deviceBindingService.listDevices).mockRejectedValue(
      new Error('relation "device_bindings" does not exist'),
    );

    const response = await request(createApp())
      .get('/api/device-bindings')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      devices: [],
    });
  });
});
