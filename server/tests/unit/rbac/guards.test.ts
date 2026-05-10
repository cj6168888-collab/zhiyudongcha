import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  optionalAuth,
  requireAllPermissions,
  requirePermission,
  requireRole,
} from '../../../lib/rbac/guards';

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

function createRequest(userRole?: string, sessionRole?: string) {
  return {
    userRole,
    session: sessionRole ? { userRole: sessionRole } : undefined,
  } as unknown as Request & { userRole?: string };
}

describe('RBAC guards', () => {
  it('rejects role-protected routes when no role is present', () => {
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    requireRole('USER')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized', code: 'NO_ROLE' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects users below the required role hierarchy', () => {
    const req = createRequest('GUEST');
    const res = createResponse();
    const next = vi.fn();

    requireRole('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      code: 'INSUFFICIENT_ROLE',
      required: 'ADMIN',
      current: 'GUEST',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows users at or above the required role hierarchy', () => {
    const req = createRequest('ADMIN');
    const res = createResponse();
    const next = vi.fn();

    requireRole('USER')(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses the session role when request role is absent', () => {
    const req = createRequest(undefined, 'MASTER');
    const res = createResponse();
    const next = vi.fn();

    requirePermission('delete:users')(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('requires any one requested permission for requirePermission', () => {
    const req = createRequest('USER');
    const res = createResponse();
    const next = vi.fn();

    requirePermission('manage:roles', 'read:projects')(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects when none of the requested permissions are granted', () => {
    const req = createRequest('GUEST');
    const res = createResponse();
    const next = vi.fn();

    requirePermission('manage:roles', 'delete:users')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      code: 'INSUFFICIENT_PERMISSION',
      required: ['manage:roles', 'delete:users'],
      current: 'GUEST',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requires every requested permission for requireAllPermissions', () => {
    const req = createRequest('USER');
    const res = createResponse();
    const next = vi.fn();

    requireAllPermissions('read:projects', 'write:projects')(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects requireAllPermissions when one permission is missing', () => {
    const req = createRequest('USER');
    const res = createResponse();
    const next = vi.fn();

    requireAllPermissions('read:projects', 'delete:projects')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      code: 'INSUFFICIENT_PERMISSION',
      required: ['read:projects', 'delete:projects'],
      current: 'USER',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('normalizes optional auth to guest when no role exists', () => {
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(req.userRole).toBe('GUEST');
    expect(next).toHaveBeenCalledOnce();
  });
});
