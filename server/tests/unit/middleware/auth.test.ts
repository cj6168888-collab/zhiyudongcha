import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../storage', () => ({
  storage: {
    createAuditLog: storageMock.createAuditLog,
  },
}));

import {
  attachRole,
  extractRole,
  getMasterSecret,
  requireAuth,
  requireMaster,
} from '../../../middleware/auth';

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function createRequest(overrides: Partial<Request> & Record<string, unknown> = {}) {
  return {
    headers: {},
    path: '/protected',
    method: 'POST',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

describe('auth middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AVATAR_MASTER_SECRET = 'unit-test-master-secret';
    storageMock.createAuditLog.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('requires AVATAR_MASTER_SECRET to be configured', () => {
    delete process.env.AVATAR_MASTER_SECRET;

    expect(() => getMasterSecret()).toThrow('AVATAR_MASTER_SECRET environment variable is required');
  });

  it('rejects short master secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.AVATAR_MASTER_SECRET = 'short-secret';

    expect(() => getMasterSecret()).toThrow('AVATAR_MASTER_SECRET must be at least 64 characters');
  });

  it('extracts MASTER from session without requiring headers', () => {
    const req = createRequest({ session: { userRole: 'MASTER' } });

    expect(extractRole(req)).toBe('MASTER');
  });

  it('extracts MASTER from headers only when the secret matches', () => {
    const req = createRequest({
      headers: {
        'x-avatar-role': 'MASTER',
        'x-avatar-secret': 'unit-test-master-secret',
      },
    });

    expect(extractRole(req)).toBe('MASTER');
  });

  it('falls back to GUEST when a MASTER header has the wrong secret', () => {
    const req = createRequest({
      headers: {
        'x-auth-role': 'MASTER',
        'x-avatar-secret': 'wrong-secret',
      },
    });

    expect(extractRole(req)).toBe('GUEST');
  });

  it('attaches role and client session id to the request', () => {
    const req = createRequest({
      headers: {
        'x-session-id': 'client-session-1',
      },
    }) as Request & { userRole?: string; sessionId?: string };
    const res = createResponse();
    const next = vi.fn();

    attachRole(req, res, next);

    expect(req.userRole).toBe('GUEST');
    expect(req.sessionId).toBe('client-session-1');
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects non-master requests and records an audit log', () => {
    const req = createRequest({ userRole: 'GUEST' });
    const res = createResponse();
    const next = vi.fn();

    requireMaster(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MASTER 权限不足',
      code: 'FORBIDDEN',
      requiredRole: 'MASTER',
    });
    expect(storageMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCESS_DENIED',
        actor: 'GUEST',
        targetType: 'route',
        targetId: '/protected',
        result: 'DENIED',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows master requests through', () => {
    const req = createRequest({ userRole: 'MASTER' });
    const res = createResponse();
    const next = vi.fn();

    requireMaster(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('requires an attached role before authenticated handlers run', () => {
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: '未认证',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
