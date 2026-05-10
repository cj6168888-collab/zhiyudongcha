import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('Auth');

export type UserRole = 'MASTER' | 'GUEST'

declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole;
      sessionId?: string;
    }
  }
}

export function getMasterSecret(): string {
  const secret = process.env.AVATAR_MASTER_SECRET;

  if (!secret) {
    throw new Error('AVATAR_MASTER_SECRET environment variable is required');
  }

  if (process.env.NODE_ENV === 'production' && secret.length < 64) {
    throw new Error('AVATAR_MASTER_SECRET must be at least 64 characters in production environment');
  }

  if (secret === 'dev-master-key-change-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AVATAR_MASTER_SECRET cannot be the default insecure value in production');
    }
    console.warn('⚠️  WARNING: Using default insecure Master Secret in development mode!');
  }

  return secret;
}

export function extractRole(req: Request): UserRole {
  // 首先检查 session
  if (req.session?.userRole === 'MASTER') {
    return 'MASTER';
  }

  const roleHeader = req.headers['x-avatar-role'] as string | undefined;
  const authRoleHeader = req.headers['x-auth-role'] as string | undefined;
  const secretHeader = req.headers['x-avatar-secret'] as string | undefined;

  // 支持两种头格式: x-avatar-role 和 x-auth-role
  const requestedRole = roleHeader || authRoleHeader;

  if (requestedRole === 'MASTER') {
    // 必须提供有效的 secret 才能获取 MASTER 权限
    if (secretHeader === getMasterSecret()) {
      return 'MASTER';
    }
    // 记录未授权的 MASTER 访问尝试
    logger.warn({ ip: req.ip, path: req.path }, 'Unauthorized MASTER role attempt');
  }

  return 'GUEST';
}

export function attachRole(req: Request, res: Response, next: NextFunction) {
  req.userRole = extractRole(req);
  req.sessionId = req.headers['x-session-id'] as string || `session_${Date.now()}`;
  next();
}

export function requireMaster(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== 'MASTER') {
    storage.createAuditLog({
      action: 'ACCESS_DENIED',
      actor: req.userRole || 'UNKNOWN',
      targetType: 'route',
      targetId: req.path,
      details: { method: req.method },
      ipAddress: req.ip || req.socket.remoteAddress,
      result: 'DENIED',
    }).catch(() => {});

    return res.status(403).json({
      error: 'MASTER 权限不足',
      code: 'FORBIDDEN',
      requiredRole: 'MASTER',
    });
  }
  return next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userRole) {
    return res.status(401).json({
      error: '未认证',
      code: 'UNAUTHORIZED',
    });
  }
  return next();
}

export async function auditAction(
  action: string,
  actor: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>,
  result: 'SUCCESS' | 'DENIED' | 'FAILED' = 'SUCCESS',
  req?: Request
) {
  try {
    await storage.createAuditLog({
      action,
      actor,
      targetType,
      targetId,
      details,
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      deviceInfo: req?.headers['user-agent'],
      result,
    });
  } catch (error) {
    logger.error({ err: error, action, actor, targetType, targetId }, '审计日志记录失败');
  }
}
