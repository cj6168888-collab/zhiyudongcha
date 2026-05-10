import { describe, it, expect, vi } from 'vitest';

describe('Utility Functions', () => {
  describe('Date Utilities', () => {
    it('should format date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      expect(date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should parse date from string', () => {
      const dateStr = '2024-01-01';
      const date = new Date(dateStr);
      expect(date.getUTCFullYear()).toBe(2024);
    });

    it('should calculate date difference in days', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-11');
      const diffTime = Math.abs(date2.getTime() - date1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(10);
    });

    it('should format date to locale string', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const localeStr = date.toLocaleDateString('zh-CN');
      expect(localeStr).toContain('2024');
    });
  });

  describe('String Utilities', () => {
    it('should truncate string with ellipsis', () => {
      const str = 'This is a very long string that needs truncation';
      const maxLength = 20;
      const truncated = str.length > maxLength
        ? str.substring(0, maxLength) + '...'
        : str;
      expect(truncated.length).toBe(23);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should capitalize string', () => {
      const str = 'hello world';
      const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
      expect(capitalized).toBe('Hello world');
    });

    it('should trim whitespace', () => {
      const str = '  hello world  ';
      expect(str.trim()).toBe('hello world');
    });

    it('should slugify string', () => {
      const str = 'Hello World! @2024';
      const slug = str.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      expect(slug).toBe('hello-world-2024');
    });

    it('should mask email', () => {
      const email = 'test@example.com';
      const [name, domain] = email.split('@');
      const masked = name.charAt(0) + '***@' + domain;
      expect(masked).toBe('t***@example.com');
    });
  });

  describe('Number Utilities', () => {
    it('should format number with commas', () => {
      const num = 1234567;
      const formatted = num.toLocaleString();
      expect(formatted).toBe('1,234,567');
    });

    it('should round to decimal places', () => {
      const num = 3.14159;
      const rounded = Math.round(num * 100) / 100;
      expect(rounded).toBe(3.14);
    });

    it('should clamp number between min and max', () => {
      const clamp = (num: number, min: number, max: number) =>
        Math.min(Math.max(num, min), max);

      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should format bytes to human readable', () => {
      const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
    });
  });

  describe('Array Utilities', () => {
    it('should remove duplicates from array', () => {
      const arr = [1, 2, 2, 3, 3, 3, 4];
      const unique = [...new Set(arr)];
      expect(unique).toEqual([1, 2, 3, 4]);
    });

    it('should chunk array into smaller arrays', () => {
      const chunk = (arr: number[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) },
          (_, i) => arr.slice(i * size, i * size + size));

      const result = chunk([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should group array by key', () => {
      const groupBy = <T>(arr: T[], key: keyof T) =>
        arr.reduce((acc, item) => {
          const k = item[key] as string;
          (acc[k] = acc[k] || []).push(item);
          return acc;
        }, {} as Record<string, T[]>);

      const arr = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ];

      const grouped = groupBy(arr, 'type');
      expect(grouped.a).toHaveLength(2);
      expect(grouped.b).toHaveLength(1);
    });

    it('should shuffle array', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      expect(shuffled.length).toBe(arr.length);
    });
  });

  describe('Object Utilities', () => {
    it('should deep clone object', () => {
      const original = { a: { b: { c: 1 } } };
      const cloned = JSON.parse(JSON.stringify(original));
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it('should pick specific keys from object', () => {
      const pick = <T, K extends keyof T>(obj: T, keys: K[]) =>
        keys.reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {} as Pick<T, K>);

      const obj = { a: 1, b: 2, c: 3 };
      const picked = pick(obj, ['a', 'c'] as const);
      expect(picked).toEqual({ a: 1, c: 3 });
    });

    it('should omit specific keys from object', () => {
      const omit = <T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
      };

      const obj = { a: 1, b: 2, c: 3 };
      const omitted = omit(obj, ['b'] as const);
      expect(omitted).toEqual({ a: 1, c: 3 });
    });

    it('should merge objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 3, c: 4 };
      const merged = { ...obj1, ...obj2 };
      expect(merged).toEqual({ a: 1, b: 3, c: 4 });
    });
  });

  describe('Validation Utilities', () => {
    it('should validate email format', () => {
      const isValidEmail = (email: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });

    it('should validate URL format', () => {
      const isValidUrl = (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('should validate phone number', () => {
      const isValidPhone = (phone: string) =>
        /^1[3-9]\d{9}$/.test(phone);

      expect(isValidPhone('13812345678')).toBe(true);
      expect(isValidPhone('12345678901')).toBe(false);
    });

    it('should validate Chinese ID card', () => {
      const isValidIdCard = (id: string) =>
        /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(id);

      expect(isValidIdCard('110101199001011234')).toBe(true);
      expect(isValidIdCard('123456789012345678')).toBe(false);
    });
  });

  describe('Crypto Utilities', () => {
    it('should generate random string', () => {
      const randomStr = (length: number) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const result = randomStr(16);
      expect(result.length).toBe(16);
    });

    it('should hash string', async () => {
      const hash = async (str: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const result = await hash('test');
      expect(result).toHaveLength(64);
    });
  });

  describe('URL Utilities', () => {
    it('should parse query parameters', () => {
      const parseQuery = (url: string) => {
        const queryString = url.split('?')[1] || '';
        return Object.fromEntries(
          queryString.split('&').map(param => {
            const [key, value] = param.split('=');
            return [key, decodeURIComponent(value || '')];
          })
        );
      };

      const result = parseQuery('?name=test&age=25');
      expect(result.name).toBe('test');
      expect(result.age).toBe('25');
    });

    it('should build query string', () => {
      const buildQuery = (params: Record<string, string | number>) =>
        Object.entries(params)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&');

      const result = buildQuery({ name: 'test', age: '25' });
      expect(result).toBe('name=test&age=25');
    });
  });
});
