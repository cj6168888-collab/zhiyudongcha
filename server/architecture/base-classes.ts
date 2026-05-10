/**
 * ============================================================================
 *     🏗️ Phase 1.1: 分层架构 - 基础框架
 * ============================================================================
 *
 * 创建标准的分层架构:
 * - Controller: 处理 HTTP 请求/响应
 * - Service: 业务逻辑
 * - Repository: 数据访问
 *
 * ============================================================================
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createServiceLogger } from '../lib/logger';

/**
 * 基础 Controller 类
 * 提供标准的请求处理方法
 */
export abstract class BaseController {
  protected req: Request;
  protected res: Response;
  protected next: NextFunction;

  constructor(req: Request, res: Response, next: NextFunction) {
    this.req = req;
    this.res = res;
    this.next = next;
  }

  protected ok(data?: unknown): void {
    this.res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  }

  protected created(data?: unknown): void {
    this.res.status(201).json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  }

  protected badRequest(message: string, details?: unknown): void {
    this.res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message, details },
      timestamp: new Date().toISOString()
    });
  }

  protected unauthorized(message = 'Unauthorized'): void {
    this.res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message },
      timestamp: new Date().toISOString()
    });
  }

  protected forbidden(message = 'Forbidden'): void {
    this.res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message },
      timestamp: new Date().toISOString()
    });
  }

  protected notFound(resource: string): void {
    this.res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `${resource} not found` },
      timestamp: new Date().toISOString()
    });
  }

  protected serverError(message = 'Internal Server Error'): void {
    this.res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 基础 Service 类
 * 提供标准的业务逻辑处理
 */
export abstract class BaseService {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  private readonly _log = createServiceLogger(this.name);

  protected logInfo(message: string, meta?: object): void {
    this._log.info(meta ? { ...meta, msg: message } : message);
  }

  protected logError(message: string, error?: Error, meta?: object): void {
    this._log.error(meta ? { ...meta, err: error?.message, msg: message } : `ERROR: ${message}`);
  }

  protected logWarn(message: string, meta?: object): void {
    this._log.warn(meta ? { ...meta, msg: message } : message);
  }
}

/**
 * 基础 Repository 类
 * 提供标准的数据访问方法
 */
export abstract class BaseRepository<T> {
  protected tableName: string;
  protected db: unknown;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async findById(id: string): Promise<T | null> {
    throw new Error('Method not implemented');
  }

  async findAll(filters?: object): Promise<T[]> {
    throw new Error('Method not implemented');
  }

  async create(data: Partial<T>): Promise<T> {
    throw new Error('Method not implemented');
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    throw new Error('Method not implemented');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }
}

/**
 * 异步处理包装器
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 验证中间件工厂
 */
export const validate = (schema: object) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 简化版验证 - 实际使用需集成 zod/joi/yup
    const { body, query, params } = req;

    // TODO: 实现实际验证逻辑
    next();
  };
};
