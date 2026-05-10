/**
 * 用户服务单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '../../server/services/UserService';
import type { User } from '../../shared/schema';

// Mock 依赖
vi.mock('../../server/storage/domains', () => ({
  userStorage: {
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

describe('UserService', () => {
  let userService: UserService;

  // 模拟用户数据
  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    userService = new UserService();
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const { userStorage } = await import('../../server/storage/domains');
      vi.mocked(userStorage.getUser).mockResolvedValue(mockUser);

      const result = await userService.getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(userStorage.getUser).toHaveBeenCalledWith('user-123');
    });

    it('should return null when user not found', async () => {
      const { userStorage } = await import('../../server/storage/domains');
      vi.mocked(userStorage.getUser).mockResolvedValue(undefined);

      const result = await userService.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const { userStorage } = await import('../../server/storage/domains');
      vi.mocked(userStorage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(userStorage.createUser).mockResolvedValue(mockUser);

      const result = await userService.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual(mockUser);
    });
  });
});
