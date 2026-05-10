import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachRole } from '../../../middleware/auth';

vi.mock('../../../services/HPService', () => ({
  hpService: {
    getHPBalance: vi.fn(),
  },
}));

import { registerHPRoutes } from '../../../routes/hp';
import { hpService } from '../../../services/HPService';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(attachRole);
  registerHPRoutes(app, {} as any);
  return app;
}

describe('HP routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HP balance in the shape expected by the mobile home', async () => {
    vi.mocked(hpService.getHPBalance).mockResolvedValue({
      current: 900,
      maximum: 1000,
      rechargeRate: 10,
      lastRecharge: new Date('2026-05-10T10:00:00Z'),
      academicLevel: 'BACHELOR',
      bonusMultiplier: 1,
      pendingBonus: 0,
    });

    const response = await request(createApp())
      .get('/api/hp/balance')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        current: 900,
        maximum: 1000,
        academicLevel: 'BACHELOR',
      },
    });
  });

  it('keeps mobile home safe when HP storage is unavailable', async () => {
    vi.mocked(hpService.getHPBalance).mockRejectedValue(new Error('database unavailable'));

    const response = await request(createApp())
      .get('/api/hp/balance')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        current: 1000,
        maximum: 1000,
        academicLevel: 'BACHELOR',
      },
    });
  });
});
