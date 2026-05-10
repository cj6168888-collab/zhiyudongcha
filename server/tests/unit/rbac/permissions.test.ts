import { describe, it, expect } from 'vitest';
import {
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type Permission
} from '../../../lib/rbac/permissions';

describe('RBAC Permissions', () => {
  describe('ROLE_PERMISSIONS', () => {
    it('should have permissions for all roles', () => {
      expect(ROLE_PERMISSIONS.MASTER).toBeDefined();
      expect(ROLE_PERMISSIONS.ADMIN).toBeDefined();
      expect(ROLE_PERMISSIONS.USER).toBeDefined();
      expect(ROLE_PERMISSIONS.GUEST).toBeDefined();
    });

    it('MASTER should have all permissions', () => {
      const masterPerms = ROLE_PERMISSIONS.MASTER;
      expect(masterPerms).toContain('read:self');
      expect(masterPerms).toContain('write:self');
      expect(masterPerms).toContain('manage:roles');
      expect(masterPerms).toContain('manage:permissions');
    });

    it('GUEST should have minimal permissions', () => {
      const guestPerms = ROLE_PERMISSIONS.GUEST;
      expect(guestPerms).toContain('read:self');
      expect(guestPerms).toContain('read:settings');
      expect(guestPerms).toContain('api:access');
      expect(guestPerms).not.toContain('manage:roles');
      expect(guestPerms).not.toContain('delete:users');
    });
  });

  describe('hasPermission', () => {
    it('should return true when role has permission', () => {
      expect(hasPermission('MASTER', 'read:self')).toBe(true);
      expect(hasPermission('ADMIN', 'read:users')).toBe(true);
      expect(hasPermission('USER', 'read:projects')).toBe(true);
      expect(hasPermission('GUEST', 'read:self')).toBe(true);
    });

    it('should return false when role lacks permission', () => {
      expect(hasPermission('GUEST', 'manage:roles')).toBe(false);
      expect(hasPermission('GUEST', 'delete:users')).toBe(false);
      expect(hasPermission('USER', 'manage:permissions')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when role has any of the permissions', () => {
      expect(hasAnyPermission('GUEST', ['read:self', 'manage:roles'])).toBe(true);
      expect(hasAnyPermission('USER', ['delete:users', 'read:projects'])).toBe(true);
    });

    it('should return false when role lacks all permissions', () => {
      expect(hasAnyPermission('GUEST', ['manage:roles', 'manage:permissions'])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when role has all permissions', () => {
      expect(hasAllPermissions('MASTER', ['read:self', 'write:self'])).toBe(true);
      expect(hasAllPermissions('USER', ['read:self', 'read:projects'])).toBe(true);
    });

    it('should return false when role lacks any permission', () => {
      expect(hasAllPermissions('GUEST', ['read:self', 'manage:roles'])).toBe(false);
      expect(hasAllPermissions('USER', ['manage:roles', 'manage:permissions'])).toBe(false);
    });
  });
});
