import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hpServiceMock = vi.hoisted(() => ({
  getHPStatus: vi.fn(),
  consumeHP: vi.fn(),
  restoreHP: vi.fn(),
  getHPBalance: vi.fn(),
  consumeHPForService: vi.fn(),
  rechargeHP: vi.fn(),
}));

vi.mock('../../server/services/HPService', () => ({
  hpService: hpServiceMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireMaster: (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).userRole !== 'MASTER') {
      res.status(403).json({ error: 'MASTER required' });
      return;
    }
    next();
  },
  attachRole: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import { registerHPRoutes } from '../../server/routes/hp';

function createTestApp(role: 'MASTER' | 'GUEST' = 'MASTER'): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).userRole = role;
    next();
  });
  registerHPRoutes(app, { storage: {} } as any);
  return app;
}

describe('HP API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hpServiceMock.getHPStatus.mockResolvedValue({ hp: 850, maxHp: 1000, academicLevel: 'BACHELOR' });
    hpServiceMock.consumeHP.mockResolvedValue({ success: true, previousHp: 850, currentHp: 800, consumed: 50 });
    hpServiceMock.restoreHP.mockResolvedValue({ success: true, previousHp: 800, currentHp: 850, restored: 50 });
    hpServiceMock.getHPBalance.mockResolvedValue({
      current: 850,
      maximum: 1000,
      rechargeRate: 10,
      academicLevel: 'BACHELOR',
      bonusMultiplier: 1,
      pendingBonus: 0,
    });
    hpServiceMock.consumeHPForService.mockResolvedValue({
      success: true,
      transaction: { id: 'tx-consume' },
      currentBalance: 700,
    });
    hpServiceMock.rechargeHP.mockResolvedValue({
      success: true,
      transaction: { id: 'tx-recharge' },
      currentBalance: 900,
    });
  });

  it('returns Z1 HP status and balance details', async () => {
    const z1Status = await request(app).get('/api/z1/hp');
    const balance = await request(app).get('/api/hp/balance');

    expect(z1Status.status).toBe(200);
    expect(z1Status.body).toEqual({ hp: 850, maxHp: 1000, academicLevel: 'BACHELOR' });
    expect(balance.body).toEqual({
      success: true,
      data: {
        current: 850,
        maximum: 1000,
        rechargeRate: 10,
        academicLevel: 'BACHELOR',
        bonusMultiplier: 1,
        pendingBonus: 0,
      },
    });
  });

  it('consumes and restores Z1 HP with role forwarding and insufficient-HP mapping', async () => {
    const consume = await request(app).post('/api/z1/hp/consume').send({ amount: 50, reason: 'model call' });
    const restore = await request(app).post('/api/z1/hp/restore').send({ amount: 50 });

    hpServiceMock.consumeHP.mockRejectedValueOnce(new Error('HP涓嶈冻: need 999'));
    const insufficient = await request(app).post('/api/z1/hp/consume').send({ amount: 999, reason: 'large job' });

    expect(consume.body).toEqual({ success: true, previousHp: 850, currentHp: 800, consumed: 50 });
    expect(hpServiceMock.consumeHP).toHaveBeenCalledWith(50, 'model call', 'MASTER');
    expect(restore.body).toEqual({ success: true, previousHp: 800, currentHp: 850, restored: 50 });
    expect(hpServiceMock.restoreHP).toHaveBeenCalledWith(50, 'MASTER');
    expect(insufficient.status).toBe(402);
    expect(insufficient.body.error).toContain('HP');
  });

  it('handles service HP consumption validation and recharge flows', async () => {
    const consume = await request(app).post('/api/hp/consume').send({
      amount: 150,
      serviceType: 'assistant',
      description: 'assistant run',
      metadata: { responseId: 'response-1' },
    });
    const recharge = await request(app).post('/api/hp/recharge').send({
      amount: 200,
      source: 'manual',
      description: 'top up',
    });

    hpServiceMock.consumeHPForService.mockRejectedValueOnce(new Error('蹇呴』鎸囧畾鏈嶅姟绫诲瀷'));
    const invalidService = await request(app).post('/api/hp/consume').send({ amount: 10 });

    expect(consume.body).toEqual({ success: true, transaction: { id: 'tx-consume' }, currentBalance: 700 });
    expect(hpServiceMock.consumeHPForService).toHaveBeenCalledWith(
      150,
      'assistant',
      'assistant run',
      { responseId: 'response-1' },
      'MASTER',
    );
    expect(recharge.body).toEqual({ success: true, transaction: { id: 'tx-recharge' }, currentBalance: 900 });
    expect(hpServiceMock.rechargeHP).toHaveBeenCalledWith(200, 'manual', 'top up', 'MASTER');
    expect(invalidService.status).toBe(400);
  });

  it('requires master role for restore and recharge routes', async () => {
    const guestApp = createTestApp('GUEST');

    const restore = await request(guestApp).post('/api/z1/hp/restore').send({ amount: 10 });
    const recharge = await request(guestApp).post('/api/hp/recharge').send({ amount: 10 });

    expect(restore.status).toBe(403);
    expect(recharge.status).toBe(403);
  });

  it('returns 500 for unexpected service errors', async () => {
    hpServiceMock.getHPStatus.mockRejectedValueOnce(new Error('boom'));
    hpServiceMock.rechargeHP.mockRejectedValueOnce(new Error('boom'));

    const status = await request(app).get('/api/z1/hp');
    const recharge = await request(app).post('/api/hp/recharge').send({ amount: 10 });

    expect(status.status).toBe(500);
    expect(recharge.status).toBe(500);
  });
});
