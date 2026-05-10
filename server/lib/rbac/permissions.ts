/**
 * RBAC 权限定义
 * 定义系统中的所有细粒度权限
 */

import type { Role } from './roles';

export type Permission =
  | 'read:self'
  | 'write:self'
  | 'read:users'
  | 'write:users'
  | 'delete:users'
  | 'read:devices'
  | 'write:devices'
  | 'delete:devices'
  | 'read:projects'
  | 'write:projects'
  | 'delete:projects'
  | 'read:persons'
  | 'write:persons'
  | 'delete:persons'
  | 'read:emails'
  | 'write:emails'
  | 'read:finances'
  | 'write:finances'
  | 'read:settings'
  | 'write:settings'
  | 'read:admin'
  | 'write:admin'
  | 'manage:roles'
  | 'manage:permissions'
  | 'api:access'
  | 'voice:access'
  | 'webhook:configure';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  MASTER: [
    'read:self', 'write:self',
    'read:users', 'write:users', 'delete:users',
    'read:devices', 'write:devices', 'delete:devices',
    'read:projects', 'write:projects', 'delete:projects',
    'read:persons', 'write:persons', 'delete:persons',
    'read:emails', 'write:emails',
    'read:finances', 'write:finances',
    'read:settings', 'write:settings',
    'read:admin', 'write:admin',
    'manage:roles', 'manage:permissions',
    'api:access', 'voice:access', 'webhook:configure',
  ],
  ADMIN: [
    'read:self', 'write:self',
    'read:users', 'write:users',
    'read:devices', 'write:devices',
    'read:projects', 'write:projects',
    'read:persons', 'write:persons',
    'read:emails', 'write:emails',
    'read:finances', 'write:finances',
    'read:settings', 'write:settings',
    'read:admin',
    'api:access', 'voice:access',
  ],
  USER: [
    'read:self', 'write:self',
    'read:devices', 'write:devices',
    'read:projects', 'write:projects',
    'read:persons', 'write:persons',
    'read:emails',
    'read:settings', 'write:settings',
    'api:access', 'voice:access',
  ],
  GUEST: [
    'read:self',
    'read:settings',
    'api:access',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}
