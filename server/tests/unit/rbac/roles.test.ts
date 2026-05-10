import { describe, it, expect } from 'vitest';
import {
  ROLE_HIERARCHY,
  ROLE_LABELS,
  hasHigherOrEqualRole,
  getRoleFromString,
  type Role
} from '../../../lib/rbac/roles';

describe('RBAC Roles', () => {
  describe('ROLE_HIERARCHY', () => {
    it('should have correct hierarchy values', () => {
      expect(ROLE_HIERARCHY.MASTER).toBe(100);
      expect(ROLE_HIERARCHY.ADMIN).toBe(50);
      expect(ROLE_HIERARCHY.USER).toBe(10);
      expect(ROLE_HIERARCHY.GUEST).toBe(1);
    });

    it('should have MASTER at highest level', () => {
      expect(ROLE_HIERARCHY.MASTER).toBeGreaterThan(ROLE_HIERARCHY.ADMIN);
      expect(ROLE_HIERARCHY.MASTER).toBeGreaterThan(ROLE_HIERARCHY.USER);
      expect(ROLE_HIERARCHY.MASTER).toBeGreaterThan(ROLE_HIERARCHY.GUEST);
    });
  });

  describe('ROLE_LABELS', () => {
    it('should have correct labels', () => {
      expect(ROLE_LABELS.MASTER).toBe('主人');
      expect(ROLE_LABELS.ADMIN).toBe('管理员');
      expect(ROLE_LABELS.USER).toBe('普通用户');
      expect(ROLE_LABELS.GUEST).toBe('访客');
    });
  });

  describe('hasHigherOrEqualRole', () => {
    it('should return true for same role', () => {
      expect(hasHigherOrEqualRole('MASTER', 'MASTER')).toBe(true);
      expect(hasHigherOrEqualRole('ADMIN', 'ADMIN')).toBe(true);
      expect(hasHigherOrEqualRole('USER', 'USER')).toBe(true);
      expect(hasHigherOrEqualRole('GUEST', 'GUEST')).toBe(true);
    });

    it('should return true for higher role', () => {
      expect(hasHigherOrEqualRole('MASTER', 'ADMIN')).toBe(true);
      expect(hasHigherOrEqualRole('MASTER', 'USER')).toBe(true);
      expect(hasHigherOrEqualRole('MASTER', 'GUEST')).toBe(true);
      expect(hasHigherOrEqualRole('ADMIN', 'USER')).toBe(true);
      expect(hasHigherOrEqualRole('ADMIN', 'GUEST')).toBe(true);
      expect(hasHigherOrEqualRole('USER', 'GUEST')).toBe(true);
    });

    it('should return false for lower role', () => {
      expect(hasHigherOrEqualRole('GUEST', 'MASTER')).toBe(false);
      expect(hasHigherOrEqualRole('GUEST', 'ADMIN')).toBe(false);
      expect(hasHigherOrEqualRole('GUEST', 'USER')).toBe(false);
      expect(hasHigherOrEqualRole('USER', 'ADMIN')).toBe(false);
      expect(hasHigherOrEqualRole('USER', 'MASTER')).toBe(false);
      expect(hasHigherOrEqualRole('ADMIN', 'MASTER')).toBe(false);
    });
  });

  describe('getRoleFromString', () => {
    it('should convert uppercase role strings', () => {
      expect(getRoleFromString('MASTER')).toBe('MASTER');
      expect(getRoleFromString('ADMIN')).toBe('ADMIN');
      expect(getRoleFromString('USER')).toBe('USER');
      expect(getRoleFromString('GUEST')).toBe('GUEST');
    });

    it('should convert lowercase role strings', () => {
      expect(getRoleFromString('master')).toBe('MASTER');
      expect(getRoleFromString('admin')).toBe('ADMIN');
      expect(getRoleFromString('user')).toBe('USER');
      expect(getRoleFromString('guest')).toBe('GUEST');
    });

    it('should return GUEST for invalid role strings', () => {
      expect(getRoleFromString('invalid')).toBe('GUEST');
      expect(getRoleFromString('')).toBe('GUEST');
      expect(getRoleFromString('SUPERADMIN')).toBe('GUEST');
    });
  });
});
