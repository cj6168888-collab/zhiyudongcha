/**
 * 授权中间件（ADR 0001）。过渡期：MASTER 对 requireResourceGrant 快速放行。
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthzContext } from '../services/authz/effective-grants';
import { loadAuthzContext, hasGrant } from '../services/authz/effective-grants';

declare global {
  namespace Express {
    interface Request {
      authz?: AuthzContext;
    }
  }
}

export function attachAuthzContext(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      req.authz = await loadAuthzContext(req);
      next();
    } catch (err) {
      next(err);
    }
  })();
}

export function requireResourceGrant(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.userRole === 'MASTER') {
      next();
      return;
    }
    if (!req.authz) {
      res.status(500).json({ error: '授权上下文未初始化', code: 'AUTHZ_NOT_LOADED' });
      return;
    }
    if (hasGrant(req.authz.grants, resource, action)) {
      next();
      return;
    }
    res.status(403).json({
      error: '权限不足',
      code: 'INSUFFICIENT_GRANT',
      resource,
      action,
    });
  };
}
