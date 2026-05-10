/**
 * 输入验证单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  createUserSchema,
  createProjectSchema,
  emailSchema,
  paginationSchema,
  idSchema,
  searchQuerySchema,
  sanitizeInput,
  createValidationMiddleware,
} from '../../middleware/input-validation';

describe('输入验证中间件', () => {
  describe('createUserSchema - 用户创建验证', () => {
    it('应该验证有效的用户数据', () => {
      const validUser = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'SecurePass123!',
        full_name: 'Test User',
      };

      const result = createUserSchema.parse(validUser);
      expect(result.username).toBe('testuser123');
      expect(result.email).toBe('test@example.com');
    });

    it('应该拒绝无效的用户名', () => {
      const invalidUsernames = [
        'ab', // 太短
        'test user', // 包含空格
        'test@user', // 包含特殊字符
        'a'.repeat(31), // 太长
      ];

      for (const username of invalidUsernames) {
        expect(() =>
          createUserSchema.parse({
            username,
            email: 'test@example.com',
            password: 'SecurePass123!',
          })
        ).toThrow();
      }
    });

    it('应该拒绝无效的邮箱格式', () => {
      const invalidEmails = [
        'invalid-email',
        '',
        'test@.com',
        '@example.com',
        'test@example',
        'test@@example.com',
      ];

      for (const email of invalidEmails) {
        expect(() =>
          createUserSchema.parse({
            username: 'testuser',
            email,
            password: 'SecurePass123!',
          })
        ).toThrow();
      }
    });

    it('应该拒绝弱密码', () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc',
        'a'.repeat(7),
      ];

      for (const password of weakPasswords) {
        expect(() =>
          createUserSchema.parse({
            username: 'testuser',
            email: 'test@example.com',
            password,
          })
        ).toThrow();
      }
    });
  });

  describe('createProjectSchema - 项目创建验证', () => {
    it('应该验证有效的项目数据', () => {
      const validProject = {
        name: 'Test Project',
        description: 'A test project',
        status: 'active',
        priority: 'high',
      };

      const result = createProjectSchema.parse(validProject);
      expect(result.name).toBe('Test Project');
    });

    it('应该拒绝无效的项目名称', () => {
      const invalidNames = [
        '',
        'a'.repeat(201), // 超过 max(200)
      ];

      for (const name of invalidNames) {
        expect(() =>
          createProjectSchema.parse({
            name,
            description: 'test',
          })
        ).toThrow();
      }
    });

    it('应该拒绝无效的状态值', () => {
      expect(() =>
        createProjectSchema.parse({
          name: 'Test Project',
          status: 'invalid_status',
        })
      ).toThrow();
    });
  });

  describe('emailSchema - 邮箱验证', () => {
    it('应该接受有效的邮箱', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
      ];

      for (const email of validEmails) {
        expect(() => emailSchema.parse(email)).not.toThrow();
      }
    });

    it('应该拒绝无效的邮箱', () => {
      const invalidEmails = [
        'invalid',
        '@example.com',
        'test@',
        'test@.com',
      ];

      for (const email of invalidEmails) {
        expect(() => emailSchema.parse(email)).toThrow();
      }
    });
  });

  describe('paginationSchema - 分页参数验证', () => {
    it('应该接受有效的分页参数', () => {
      const validParams = [
        { page: 1, limit: 10 },
        { page: 1, limit: 100 },
        { page: 10, limit: 50 },
      ];

      for (const params of validParams) {
        const result = paginationSchema.parse(params);
        expect(result.page).toBeGreaterThan(0);
        expect(result.limit).toBeGreaterThan(0);
      }
    });

    it('应该拒绝无效的分页参数', () => {
      const invalidParams = [
        { page: 0, limit: 10 }, // page必须大于0
        { page: 1, limit: 0 }, // limit必须大于0
        { page: -1, limit: 10 }, // page不能为负数
        { page: 1, limit: 101 }, // limit不能超过100
        { page: 'a' as any, limit: 10 }, // page必须是数字
      ];

      for (const params of invalidParams) {
        expect(() => paginationSchema.parse(params)).toThrow();
      }
    });

    it('应该有默认值', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('idSchema - ID验证', () => {
    it('应该接受有效的UUID', () => {
      const validIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0b1c2d3-e4f5-6789-0abc-def012345678',
      ];

      for (const id of validIds) {
        expect(() => idSchema.parse(id)).not.toThrow();
      }
    });

    it('应该拒绝无效的ID格式', () => {
      const invalidIds = [
        '123',
        'invalid-id',
        '',
        'a'.repeat(37), // 太长
      ];

      for (const id of invalidIds) {
        expect(() => idSchema.parse(id)).toThrow();
      }
    });
  });

  describe('searchQuerySchema - 搜索查询验证', () => {
    it('应该接受有效的搜索查询', () => {
      const validQueries = [
        'test',
        'hello world',
        'a',
        'a'.repeat(100),
      ];

      for (const query of validQueries) {
        const result = searchQuerySchema.parse({ q: query });
        expect(result.q).toBe(query);
      }
    });

    it('应该拒绝空查询', () => {
      expect(() => searchQuerySchema.parse({ q: '' })).toThrow();
    });

    it('应该拒绝超长查询', () => {
      expect(() =>
        searchQuerySchema.parse({ q: 'a'.repeat(201) })
      ).toThrow();
    });

    it('应该过滤危险字符', () => {
      const result = searchQuerySchema.parse({
        q: "';",
      });
      expect(result.q).not.toContain("'");
    });
  });

  describe('validateRequest - 请求验证中间件', () => {
    it('应该创建有效的验证中间件', () => {
      const middleware = createValidationMiddleware(createUserSchema);
      expect(typeof middleware).toBe('function');
    });
  });

  describe('sanitizeInput - 输入清理', () => {
    it('应该移除HTML标签', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeInput(input, { sanitize: true });
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('</strong>');
    });

    it('应该移除JavaScript代码', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeInput(input, { sanitize: true });
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('应该保留普通文本', () => {
      const input = 'Hello World! 你好世界！';
      const result = sanitizeInput(input);
      expect(result).toBe(input);
    });
  });
});
