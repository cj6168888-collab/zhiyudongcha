import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const authServiceMock = vi.hoisted(() => ({
  validateCredentials: vi.fn(),
  createUserSession: vi.fn(),
  destroyUserSession: vi.fn(),
  getSessionInfo: vi.fn(),
  generateWsToken: vi.fn(),
  validateWsToken: vi.fn(),
}));

const userServiceMock = vi.hoisted(() => ({
  validatePassword: vi.fn(),
  getUserByUsername: vi.fn(),
  createUserWithPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

const smsVerificationServiceMock = vi.hoisted(() => ({
  sendCode: vi.fn(),
  normalizePhone: vi.fn(),
  verifyCode: vi.fn(),
}));

vi.mock('../../server/services/AuthService', () => ({
  authService: authServiceMock,
}));

vi.mock('../../server/services/UserService', () => ({
  userService: userServiceMock,
}));

vi.mock('../../server/services/sms-verification', () => ({
  smsVerificationService: smsVerificationServiceMock,
}));

import { registerAuthRoutes, validateWsToken } from '../../server/routes/auth';

function createTestApp(role: 'MASTER' | 'GUEST' = 'MASTER'): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {};
    (req as any).userRole = role;
    next();
  });
  registerAuthRoutes(app, {} as any);
  return app;
}

describe('Auth API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authServiceMock.validateCredentials.mockResolvedValue({ success: true });
    authServiceMock.createUserSession.mockResolvedValue({ success: true, role: 'MASTER' });
    authServiceMock.destroyUserSession.mockResolvedValue({ success: true });
    authServiceMock.getSessionInfo.mockReturnValue({ authenticated: true, role: 'MASTER' });
    authServiceMock.generateWsToken.mockReturnValue({
      token: 'ws-token',
      expiresIn: 3600,
      expiresAt: '2026-04-30T12:00:00Z',
    });
    authServiceMock.validateWsToken.mockReturnValue('MASTER');
    userServiceMock.validatePassword.mockResolvedValue({
      id: 'user-1',
      username: '13800000000',
      password: 'hash',
    });
    userServiceMock.getUserByUsername.mockResolvedValue(undefined);
    userServiceMock.createUserWithPassword.mockResolvedValue({
      id: 'user-2',
      username: '13800000001',
      password: 'hash',
    });
    userServiceMock.resetPassword.mockResolvedValue({
      id: 'user-1',
      username: '13800000000',
      password: 'hash2',
    });
    smsVerificationServiceMock.sendCode.mockResolvedValue({
      phone: '13800000000',
      expiresIn: 300,
      cooldownSeconds: 60,
      debugCode: '123456',
    });
    smsVerificationServiceMock.normalizePhone.mockImplementation((phone: string) => phone);
    smsVerificationServiceMock.verifyCode.mockReturnValue({ phone: '13800000000' });
  });

  it('validates login input, rejects invalid secrets, and creates sessions for valid secrets', async () => {
    const missingSecret = await request(app).post('/api/auth/login').send({});

    authServiceMock.validateCredentials.mockResolvedValueOnce({
      success: false,
      code: 'INVALID_SECRET',
      error: 'wrong secret',
    });
    const invalidSecret = await request(app).post('/api/auth/login').send({ secret: 'wrong' });

    const success = await request(app).post('/api/auth/login').send({ secret: 'correct' });

    expect(missingSecret.status).toBe(400);
    expect(missingSecret.body.error.code).toBe('INVALID_INPUT');
    expect(invalidSecret.status).toBe(401);
    expect(invalidSecret.body.error).toMatchObject({ code: 'INVALID_SECRET', message: 'wrong secret' });
    expect(success.status).toBe(200);
    expect(success.body).toMatchObject({
      success: true,
      data: { role: 'MASTER' },
    });
    expect(authServiceMock.validateCredentials).toHaveBeenCalledWith('correct');
    expect(authServiceMock.createUserSession).toHaveBeenCalledWith(expect.any(Object));
  });

  it('logs in normal users with username and password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: '13800000000', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        role: 'GUEST',
        user: { id: 'user-1', username: '13800000000' },
      },
    });
    expect(userServiceMock.validatePassword).toHaveBeenCalledWith('13800000000', 'password123');
    expect(authServiceMock.createUserSession).toHaveBeenCalledWith(
      expect.any(Object),
      'GUEST',
      expect.objectContaining({ userId: 'user-1', username: '13800000000', method: 'password' }),
    );
  });

  it('sends sms codes, registers phone users, and resets passwords', async () => {
    const sms = await request(app)
      .post('/api/auth/sms/send')
      .send({ phone: '13800000000', scene: 'register' });

    const register = await request(app)
      .post('/api/auth/register')
      .send({ phone: '13800000001', password: 'password123', code: '123456' });

    userServiceMock.getUserByUsername.mockResolvedValueOnce({
      id: 'user-1',
      username: '13800000000',
      password: 'hash',
    });
    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ phone: '13800000000', code: '123456', newPassword: 'newpass123' });

    expect(sms.status).toBe(200);
    expect(sms.body.data.debugCode).toBe('123456');
    expect(smsVerificationServiceMock.sendCode).toHaveBeenCalledWith('13800000000', 'register');

    expect(register.status).toBe(201);
    expect(register.body.data.user).toMatchObject({ id: 'user-2', username: '13800000001' });
    expect(smsVerificationServiceMock.verifyCode).toHaveBeenCalledWith('13800000001', 'register', '123456');
    expect(userServiceMock.createUserWithPassword).toHaveBeenCalledWith('13800000001', 'password123');

    expect(reset.status).toBe(200);
    expect(userServiceMock.resetPassword).toHaveBeenCalledWith('13800000000', 'newpass123');
  });

  it('returns session creation failures from login', async () => {
    authServiceMock.createUserSession.mockResolvedValueOnce({ success: false, error: 'session store unavailable' });

    const response = await request(app).post('/api/auth/login').send({ secret: 'correct' });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: 'SESSION_ERROR',
      message: 'session store unavailable',
    });
  });

  it('destroys sessions during logout and clears the session cookie', async () => {
    const success = await request(app).post('/api/auth/logout').send({});

    authServiceMock.destroyUserSession.mockResolvedValueOnce({ success: false, error: 'destroy failed' });
    const failure = await request(app).post('/api/auth/logout').send({});

    expect(success.status).toBe(200);
    expect(success.body.success).toBe(true);
    expect(success.headers['set-cookie']?.some((cookie: string) => cookie.startsWith('connect.sid='))).toBe(true);
    expect(authServiceMock.destroyUserSession).toHaveBeenCalledWith(expect.any(Object));
    expect(failure.status).toBe(500);
    expect(failure.body.error).toMatchObject({ code: 'LOGOUT_ERROR', message: 'destroy failed' });
  });

  it('returns session info and generates websocket tokens for the current role', async () => {
    const session = await request(app).get('/api/auth/session');
    const token = await request(app).post('/api/auth/ws-token').send({});

    expect(session.body).toEqual({
      success: true,
      data: { authenticated: true, role: 'MASTER' },
    });
    expect(authServiceMock.getSessionInfo).toHaveBeenCalledWith(expect.any(Object));
    expect(token.body).toEqual({
      success: true,
      data: {
        token: 'ws-token',
        expiresIn: 3600,
        expiresAt: '2026-04-30T12:00:00Z',
        role: 'MASTER',
      },
    });
    expect(authServiceMock.generateWsToken).toHaveBeenCalledWith('MASTER');
  });

  it('uses guest role fallback for websocket tokens and delegates token validation helper', async () => {
    const guestApp = createTestApp('GUEST');

    const response = await request(guestApp).post('/api/auth/ws-token').send({});
    const role = validateWsToken('ws-token');

    expect(response.body.data.role).toBe('GUEST');
    expect(authServiceMock.generateWsToken).toHaveBeenCalledWith('GUEST');
    expect(role).toBe('MASTER');
    expect(authServiceMock.validateWsToken).toHaveBeenCalledWith('ws-token');
  });
});
