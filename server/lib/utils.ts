/**
 * 通用工具函数
 * 减少代码重复，提供常用功能
 */

export class DateUtils {
  static now(): string {
    return new Date().toISOString();
  }

  static timestamp(): number {
    return Date.now();
  }

  static format(date: Date | number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    return format
      .replace('YYYY', d.getFullYear().toString())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds()));
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static diffInMs(date1: Date, date2: Date): number {
    return Math.abs(date1.getTime() - date2.getTime());
  }

  static isExpired(timestamp: number, ttlMs: number): boolean {
    return Date.now() > timestamp + ttlMs;
  }
}

export class StringUtils {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static camelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
  }

  static kebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  static truncate(str: string, length: number): string {
    return str.length > length ? str.substring(0, length) + '...' : str;
  }

  static slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static mask(str: string, start = 3, end = 3): string {
    if (str.length <= start + end) return str;
    return str.slice(0, start) + '*'.repeat(str.length - start - end) + str.slice(-end);
  }
}

export class ValidationUtils {
  static isEmail(str: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  static isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  static isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  static isIP(str: string): boolean {
    return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(str);
  }

  static isPort(str: string): boolean {
    const port = parseInt(str, 10);
    return !isNaN(port) && port > 0 && port < 65536;
  }

  static isStrongPassword(str: string): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(str);
  }
}

export class ArrayUtils {
  static unique<T>(arr: T[]): T[] {
    return [...new Set(arr)];
  }

  static groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
    return arr.reduce((groups, item) => {
      const value = String(item[key]);
      (groups[value] = groups[value] || []).push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  static chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  static shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  static flatMap<T, U>(arr: T[], fn: (item: T) => U[]): U[] {
    return arr.reduce((acc, item) => [...acc, ...fn(item)], [] as U[]);
  }
}

export class ObjectUtils {
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  static deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T {
    for (const source of sources) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = ObjectUtils.deepMerge(target[key] || {} as unknown as T, source[key] as unknown as Partial<T>);
        } else {
          target[key] = source[key] as T[Extract<keyof T, string>];
        }
      }
    }
    return target;
  }

  static pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  static omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
  }

  static isEmpty(obj: unknown): boolean {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === 'string') return obj.length === 0;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }
}

export class NumberUtils {
  static random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  static formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  static formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  static percentage(value: number, total: number): number {
    return total === 0 ? 0 : (value / total) * 100;
  }
}

export class AsyncUtils {
  static async retry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; delayMs?: number } = {}
  ): Promise<T> {
    const { maxAttempts = 3, delayMs = 1000 } = options;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw new Error('Retry failed');
  }

  static async timeout<T>(ms: number, promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), ms)
      )
    ]);
  }

  static debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delayMs: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delayMs);
    };
  }

  static throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    limitMs: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= limitMs) {
        lastCall = now;
        fn(...args);
      }
    };
  }
}

export const utils = {
  date: DateUtils,
  string: StringUtils,
  validation: ValidationUtils,
  array: ArrayUtils,
  object: ObjectUtils,
  number: NumberUtils,
  async: AsyncUtils,
};

export default utils;
