/**
 * RBAC 角色定义
 * 定义系统中的所有角色及其层级关系
 */

export type Role = 'MASTER' | 'ADMIN' | 'USER' | 'GUEST';

export const ROLE_HIERARCHY: Record<Role, number> = {
  MASTER: 100,
  ADMIN: 50,
  USER: 10,
  GUEST: 1,
};

export const ROLE_LABELS: Record<Role, string> = {
  MASTER: '主人',
  ADMIN: '管理员',
  USER: '普通用户',
  GUEST: '访客',
};

export function hasHigherOrEqualRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function getRoleFromString(role: string): Role {
  const upperRole = role.toUpperCase() as Role;
  if (upperRole in ROLE_HIERARCHY) {
    return upperRole;
  }
  return 'GUEST';
}
