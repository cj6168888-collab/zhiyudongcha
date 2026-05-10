/**
 * RBAC 路由守卫
 * 提供基于角色的访问控制中间件
 */

import { Request, Response, NextFunction } from 'express';
import type { Role } from './roles';
import type { Permission } from './permissions';
import { hasHigherOrEqualRole, getRoleFromString } from './roles';
import { hasAnyPermission, hasAllPermissions } from './permissions';

type AuthRequest = Request & { userRole?: Role };

export function requireRole(requiredRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.userRole || req.session?.userRole;
    
    if (!userRole) {
      res.status(401).json({ error: 'Unauthorized', code: 'NO_ROLE' });
      return;
    }

    const role = getRoleFromString(userRole);
    
    if (!hasHigherOrEqualRole(role, requiredRole)) {
      res.status(403).json({ 
        error: 'Forbidden', 
        code: 'INSUFFICIENT_ROLE',
        required: requiredRole,
        current: role
      });
      return;
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.userRole || req.session?.userRole;
    
    if (!userRole) {
      res.status(401).json({ error: 'Unauthorized', code: 'NO_ROLE' });
      return;
    }

    const role = getRoleFromString(userRole);
    
    if (!hasAnyPermission(role, requiredPermissions)) {
      res.status(403).json({ 
        error: 'Forbidden', 
        code: 'INSUFFICIENT_PERMISSION',
        required: requiredPermissions,
        current: role
      });
      return;
    }

    next();
  };
}

export function requireAllPermissions(...requiredPermissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.userRole || req.session?.userRole;
    
    if (!userRole) {
      res.status(401).json({ error: 'Unauthorized', code: 'NO_ROLE' });
      return;
    }

    const role = getRoleFromString(userRole);
    
    if (!hasAllPermissions(role, requiredPermissions)) {
      res.status(403).json({ 
        error: 'Forbidden', 
        code: 'INSUFFICIENT_PERMISSION',
        required: requiredPermissions,
        current: role
      });
      return;
    }

    next();
  };
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const userRole = req.userRole || req.session?.userRole;
  
  if (userRole) {
    req.userRole = getRoleFromString(userRole);
  } else {
    req.userRole = 'GUEST';
  }
  
  next();
}
