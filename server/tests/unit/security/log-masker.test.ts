import { describe, it, expect } from 'vitest';
import { createLogMasker } from '../../../middleware/log-masker';

describe('Log Masker', () => {
  const masker = createLogMasker();

  describe('maskValue', () => {
    it('should return null as is', () => {
      expect(masker.maskValue(null)).toBeNull();
    });

    it('should return undefined as is', () => {
      expect(masker.maskValue(undefined)).toBeUndefined();
    });

    it('should return primitives as is', () => {
      expect(masker.maskValue('string')).toBe('string');
      expect(masker.maskValue(123)).toBe(123);
      expect(masker.maskValue(true)).toBe(true);
    });

    it('should mask sensitive strings', () => {
      const result = masker.maskValue('password=secret123');
      expect(result).not.toContain('secret123');
    });

    it('should mask API keys', () => {
      const result = masker.maskValue('apiKey=sk-1234567890');
      expect(result).not.toContain('sk-1234567890');
    });

    it('should mask credit card numbers', () => {
      const result = masker.maskValue('4111111111111111');
      expect(result).not.toContain('4111111111111111');
    });

    it('should mask SSN', () => {
      const result = masker.maskValue('123-45-6789');
      expect(result).not.toContain('123-45-6789');
    });

    it('should mask Bearer tokens', () => {
      const result = masker.maskValue('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result).not.toContain('eyJ');
    });
  });

  describe('maskObject', () => {
    it('should mask password field', () => {
      const input = { username: 'john', password: 'secret123' };
      const result = masker.maskValue(input) as Record<string, unknown>;
      
      expect(result.username).toBe('john');
      expect(result.password).toBe('***');
    });

    it('should mask nested password field', () => {
      const input = { user: { password: 'secret' } };
      const result = masker.maskValue(input) as Record<string, unknown>;
      
      expect((result.user as Record<string, unknown>).password).toBe('***');
    });

    it('should mask token fields', () => {
      const input = { 
        accessToken: 'token123', 
        refreshToken: 'refresh456',
        data: 'normal'
      };
      const result = masker.maskValue(input) as Record<string, unknown>;
      
      expect(result.accessToken).toBe('***');
      expect(result.refreshToken).toBe('***');
      expect(result.data).toBe('normal');
    });

    it('should mask apiKey field', () => {
      const input = { apiKey: 'key123' };
      const result = masker.maskValue(input) as Record<string, unknown>;
      
      expect(result.apiKey).toBe('***');
    });

    it('should preserve non-sensitive fields', () => {
      const input = { 
        name: 'John',
        email: 'john@example.com',
        age: 30,
        active: true
      };
      const result = masker.maskValue(input) as Record<string, unknown>;
      
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
      expect(result.age).toBe(30);
      expect(result.active).toBe(true);
    });
  });

  describe('maskArray', () => {
    it('should mask objects in array', () => {
      const input = [
        { name: 'user1', password: 'pass1' },
        { name: 'user2', password: 'pass2' }
      ];
      const result = masker.maskValue(input) as Array<Record<string, unknown>>;
      
      expect(result[0].name).toBe('user1');
      expect(result[0].password).toBe('***');
      expect(result[1].name).toBe('user2');
      expect(result[1].password).toBe('***');
    });
  });
});
