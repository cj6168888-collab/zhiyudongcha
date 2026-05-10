import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiResponse, AppError } from '../types/common';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ValidationMiddleware');

export class ValidationError extends Error {
  public statusCode: number;
  public details: unknown;

  constructor(message: string, details: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

// 请求体验证中间件
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          '请求体验证失败',
          error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
        
        logger.warn('请求体验证失败', {
          path: req.path,
          method: req.method,
          errors: validationError.details,
        });
        
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

// 查询参数验证中间件
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          '查询参数验证失败',
          error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
        
        logger.warn('查询参数验证失败', {
          path: req.path,
          method: req.method,
          errors: validationError.details,
        });
        
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

// 路径参数验证中间件
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          '路径参数验证失败',
          error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
        
        logger.warn('路径参数验证失败', {
          path: req.path,
          method: req.method,
          errors: validationError.details,
        });
        
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

// 组合验证中间件
export function validateRequest<TBody = unknown, TQuery = unknown, TParams = unknown>(options: {
  body?: z.ZodSchema<TBody>;
  query?: z.ZodSchema<TQuery>;
  params?: z.ZodSchema<TParams>;
}) {
  const middleware: Array<(req: Request, res: Response, next: NextFunction) => void> = [];
  
  if (options.params) {
    middleware.push(validateParams(options.params));
  }
  
  if (options.query) {
    middleware.push(validateQuery(options.query));
  }
  
  if (options.body) {
    middleware.push(validateBody(options.body));
  }
  
  return middleware;
}

// 文件上传验证中间件
export function validateFileUpload(options: {
  maxSize?: number; // bytes
  allowedTypes?: string[];
  required?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { maxSize = 10 * 1024 * 1024, allowedTypes = [], required = false } = options;
    
    if (!req.file && !req.files) {
      if (required) {
        const error = new ValidationError('文件是必需的', null);
        return next(error);
      }
      return next();
    }
    
    const files = req.files ? (Array.isArray(req.files) ? req.files : [req.files]) : [req.file];
    
    for (const file of files) {
      if (!file) continue;
      
      // 检查文件大小
      if (maxSize && file.size > maxSize) {
        const error = new ValidationError(
          `文件大小超过限制 (${maxSize / 1024 / 1024}MB)`,
          { filename: file.filename, size: file.size }
        );
        return next(error);
      }
      
      // 检查文件类型
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        const error = new ValidationError(
          `不支持的文件类型: ${file.mimetype}`,
          { filename: file.filename, mimetype: file.mimetype }
        );
        return next(error);
      }
    }
    
    next();
  };
}

// 数组分页验证中间件
export function validatePagination() {
  return validateQuery(z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }));
}

// ID参数验证
export const validateId = validateParams(z.object({
  id: z.string().uuid(),
}));

// 邮箱验证
export const validateEmail = z.string().email('请输入有效的邮箱地址');

// 密码验证
export const validatePassword = z.string()
  .min(8, '密码至少8位')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    '密码必须包含大小写字母、数字和特殊字符');

// 手机号验证
export const validatePhone = z.string()
  .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号');

// 日期范围验证
export function validateDateRange(startField: string = 'startDate', endField: string = 'endDate') {
  return validateBody(z.object({
    [startField]: z.string().datetime().optional(),
    [endField]: z.string().datetime().optional(),
  }).refine((data) => {
    if (data[startField] && data[endField]) {
      return new Date(data[startField]) <= new Date(data[endField]);
    }
    return true;
  }, {
    message: '开始日期不能晚于结束日期',
    path: [endField],
  }));
}

// 自定义验证规则
export const customValidators = {
  // 验证中文姓名
  chineseName: z.string().regex(/^[\u4e00-\u9fa5]{2,8}$/, '请输入有效的中文姓名'),
  
  // 验证身份证号
  idCard: z.string().regex(/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/, '请输入有效的身份证号'),
  
  // 验证URL
  url: z.string().url('请输入有效的URL'),
  
  // 验证IP地址
  ip: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, '请输入有效的IP地址'),
  
  // 验证颜色代码
  hexColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, '请输入有效的颜色代码'),
  
  // 验证JSON字符串
  jsonString: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, '请输入有效的JSON字符串'),
};

// 条件验证
export function conditionalValidation<T>(
  condition: (data: unknown) => boolean,
  schema: z.ZodSchema<T>
) {
  return z.any().refine((data) => {
    if (condition(data)) {
      return schema.safeParse(data).success;
    }
    return true;
  }, '条件验证失败');
}

// 异步验证
export function asyncValidation<T>(
  validator: (data: T) => Promise<boolean>,
  message: string = '异步验证失败'
) {
  return z.any().superRefine(async (data, ctx) => {
    try {
      const isValid = await validator(data);
      if (!isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
        });
      }
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '验证过程中发生错误',
      });
    }
  });
}

// 转换函数
export const transformers = {
  // 转换为数字
  toNumber: (value: string) => {
    const num = Number(value);
    if (isNaN(num)) throw new Error('必须是有效数字');
    return num;
  },
  
  // 转换为布尔值
  toBoolean: (value: string) => {
    return value === 'true' || value === '1';
  },
  
  // 转换为数组
  toArray: (value: string | string[]) => {
    if (Array.isArray(value)) return value;
    return value.split(',').map(item => item.trim()).filter(Boolean);
  },
  
  // 转换为日期
  toDate: (value: string) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) throw new Error('必须是有效日期');
    return date;
  },
};

// 错误处理中间件
export function validationErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof ValidationError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.status(error.statusCode).json(response);
  } else {
    next(error);
  }
}
