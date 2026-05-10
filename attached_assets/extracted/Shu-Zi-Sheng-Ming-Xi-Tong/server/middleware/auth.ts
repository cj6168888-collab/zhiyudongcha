import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * MVP SECURITY NOTE:
 * Current auth relies on client-supplied X-Avatar-Role header.
 * This is acceptable for MVP prototype demonstration only.
 * 
 * Production requirements:
 * 1. Implement proper user authentication (session/JWT with server-side identity)
 * 2. Store role in server session, not client header
 * 3. Add MASTER activation ceremony with hardware token or biometric
 * 4. Implement rate limiting on role-protected endpoints
 * 
 * The header-based approach allows rapid prototyping of role-based UI
 * without requiring full auth infrastructure in the MVP phase.
 */

export type UserRole = 'MASTER' | 'GUEST';

declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole;
      sessionId?: string;
    }
  }
}

const MASTER_SECRET = process.env.AVATAR_MASTER_SECRET || 'dev-master-key-change-in-production';

export function extractRole(req: Request): UserRole {
  const roleHeader = req.headers['x-avatar-role'] as string | undefined;
  const secretHeader = req.headers['x-avatar-secret'] as string | undefined;
  
  if (roleHeader === 'MASTER' && secretHeader === MASTER_SECRET) {
    return 'MASTER';
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
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userRole) {
    return res.status(401).json({ 
      error: '未认证',
      code: 'UNAUTHORIZED',
    });
  }
  next();
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
    console.error('[AUDIT] Failed to log action:', error);
  }
}
