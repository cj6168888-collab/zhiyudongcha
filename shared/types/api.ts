// @ts-nocheck
/**
 * API 请求类型定义
 * 统一项目中的请求类型
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * 分页请求参数
 */
export interface PaginatedRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 带分页的响应
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 标准 API 响应
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: string;
}

/**
 * API 错误
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

/**
 * 认证请求
 */
export interface AuthRequest extends Request {
  user?: AuthUser;
  token?: string;
}

/**
 * 认证用户
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 用户角色
 */
export type UserRole = 'admin' | 'user' | 'guest' | 'developer';

/**
 * 权限
 */
export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

/**
 * 请求 ID 中间件类型
 */
export interface RequestWithId extends Request {
  id: string;
  startTime: number;
}

/**
 * Express 错误处理中间件类型
 */
export type ErrorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

/**
 * Express 异步路由处理器类型
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<Response | void>;

/**
 * 带用户认证的异步路由处理器
 */
export type AuthAsyncRequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => Promise<Response | void>;
