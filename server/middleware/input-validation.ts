import { createServiceLogger } from '../lib/logger';
import { z, ZodError, ZodIssue } from 'zod';
import { Request, Response, NextFunction } from 'express';

const logger = createServiceLogger('InputValidationMiddleware');

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

/**
 * 输入验证选项
 */
export interface ValidationOptions {
  sanitize?: boolean;
  trim?: boolean;
  maxLength?: number;
}

/**
 * XSS防护函数
 */
export function sanitizeInput(input: unknown, options: ValidationOptions = {}): unknown {
  if (typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // 基础清理
  if (options.trim) {
    sanitized = sanitized.trim();
  }

  // 长度限制
  if (options.maxLength && sanitized.length > options.maxLength) {
    throw new Error(`Input exceeds maximum length of ${options.maxLength}`);
  }

  // XSS防护 - 移除潜在的脚本标签
  if (options.sanitize) {
    const str = sanitized as string;
    sanitized = str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)<\/iframe>/gi, '')
      .replace(/&lt;script\b[^&lt;]*(?:(?!&lt;\/script&gt;)&lt;[^&lt;]*)&lt;\/script&gt;/gi, '')
      .replace(/&lt;iframe\b[^&lt;]*(?:(?!&lt;\/iframe&gt;)&lt;[^&lt;]*)&lt;\/iframe&gt;/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;[^&gt;]*&gt;/g, '')
      .trim();
  }

  return sanitized;
}

/**
 * SQL注入防护函数
 */
export function sanitizeSQLInput(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    // 移除危险的SQL字符
    .replace(/[';]/g, '')
    .replace(/\b(drop|delete|insert|update|create|alter|exec|execute)\b/gi, '')
    // 转义特殊字符
    .replace(/'/g, "''")
    .replace(/"/g, '""')
    .trim();
}

/**
 * 邮箱验证
 */
export const emailSchema = z.string()
  .email('无效的邮箱格式')
  .max(255, '邮箱地址不能超过255个字符')
  .transform(val => val?.toLowerCase());

/**
 * 用户名验证
 */
export const usernameSchema = z.string()
  .min(2, '用户名至少2个字符')
  .max(50, '用户名不能超过50个字符')
  .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线')
  .transform(val => val?.trim());

/**
 * 密码验证
 */
export const passwordSchema = z.string()
  .min(8, '密码至少8个字符')
  .max(128, '密码不能超过128个字符')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含大小写字母和数字');

/**
 * 分页参数验证
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().min(1).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

/**
 * ID验证
 */
export const idSchema = z.string()
  .uuid('无效的ID格式')
  .transform(val => val?.trim());

/**
 * 查询参数验证
 */
export const searchQuerySchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空').max(100, '搜索关键词不能超过100个字符').transform(sanitizeSQLInput),
  type: z.enum(['all', 'users', 'projects', 'files']).default('all'),
  sort: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc')
});

/**
 * 文件上传验证
 */
export const fileUploadSchema = z.object({
  filename: z.string()
    .min(1, '文件名不能为空')
    .max(255, '文件名不能超过255个字符')
    .regex(/^[a-zA-Z0-9._-]+$/, '文件名只能包含字母、数字、点、下划线和连字符')
    .transform(sanitizeInput),
  size: z.number()
    .max(50 * 1024 * 1024, '文件大小不能超过50MB'), // 50MB
  mimetype: z.enum([
    'image/jpeg',
    'image/png', 
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/json',
    'application/xml'
  ])
});

/**
 * 创建用户DTO验证
 */
export const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string()
    .min(1, '姓名不能为空')
    .max(100, '姓名不能超过100个字符')
    .transform(sanitizeInput),
  phone: z.string()
    .regex(/^\+?[\d\s-()]+$/, '无效的电话号码格式')
    .optional()
});

/**
 * 更新用户DTO验证
 */
export const updateUserSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  full_name: z.string()
    .min(1, '姓名不能为空')
    .max(100, '姓名不能超过100个字符')
    .transform(sanitizeInput)
    .optional(),
  phone: z.string()
    .regex(/^\+?[\d\s-()]+$/, '无效的电话号码格式')
    .optional()
});

/**
 * 项目创建验证
 */
export const createProjectSchema = z.object({
  name: z.string()
    .min(1, '项目名称不能为空')
    .max(200, '项目名称不能超过200个字符')
    .transform(sanitizeInput),
  description: z.string()
    .max(2000, '项目描述不能超过2000个字符')
    .transform(sanitizeInput)
    .optional(),
  status: z.enum(['planning', 'active', 'completed', 'archived']).default('planning'),
  priority: z.enum(['low', 'medium', 'high']).default('medium')
});

/**
 * 通用验证中间件创建器
 */
export function createValidationMiddleware(schema: z.ZodSchema, options: ValidationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 对请求体进行验证
      if (req.body) {
        req.body = schema.parse(req.body);
      }

      // 对查询参数进行验证  
      if (req.query) {
        const querySchema = z.object({
          ...searchQuerySchema.shape,
          ...paginationSchema.shape
        });
        req.query = querySchema.parse(req.query);
      }

      // 对路径参数进行验证
      if (req.params) {
        Object.keys(req.params).forEach(key => {
          if (key.includes('id')) {
            req.params[key] = idSchema.parse(req.params[key]);
          }
        });
      }

      // 记录验证成功的日志
      logger.debug('输入验证通过', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      next();
    } catch (error) {
      // 记录验证失败的日志
      logger.warn('输入验证失败', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        error: error instanceof Error ? error.message : String(error),
        body: req.body,
        query: req.query,
        params: req.params
      });

      // 返回标准化错误响应
      res.status(400).json({
        success: false,
        error: '输入验证失败',
        message: error instanceof Error ? error.message : String(error),
        details: [],
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * XSS防护中间件
 */
export function xssProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // 设置安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 对输入进行XSS过滤
  if (req.body) {
    req.body = sanitizeInput(req.body, { sanitize: true, trim: true });
  }

  if (req.query) {
    req.query = sanitizeInput(req.query, { sanitize: true, trim: true });
  }

  next();
}

/**
 * SQL注入防护中间件
 */
export function sqlInjectionProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // 对可能包含SQL的参数进行清理
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeSQLInput(req.query[key]);
      }
    });
  }

  if (req.body) {
    const sqlFields = ['query', 'search', 'filter', 'sort', 'order'];
    sqlFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = sanitizeSQLInput(req.body[field]);
      }
    });
  }

  next();
}

/**
 * 综合安全中间件
 */
export function createSecurityMiddleware() {
  return [
    xssProtectionMiddleware,
    sqlInjectionProtectionMiddleware,
    createValidationMiddleware(z.object({}), { sanitize: true, trim: true })
  ];
}

/**
 * API错误响应格式化
 */
export function formatValidationError(error: ZodError | Error): {
  success: false;
  error: string;
  message: string;
  details: ZodIssue[] | string[];
  timestamp: string;
} {
  return {
    success: false,
    error: 'VALIDATION_ERROR',
    message: error.message || '输入验证失败',
    details: error instanceof ZodError ? error.errors : [error.message],
    timestamp: new Date().toISOString()
  };
}
