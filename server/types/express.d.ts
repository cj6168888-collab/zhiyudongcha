import { Request, Response, NextFunction } from 'express';

export type TypedRequest<T = unknown, P = unknown, Q = unknown> = Request<P, unknown, T, Q>;
export type TypedResponse<T = unknown> = Response<T>;

export interface AuthUser {
  id: string;
  uuid: string;
  username: string;
  email: string;
  role: 'MASTER' | 'ADMIN' | 'USER' | 'GUEST';
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RequestContext {
  requestId: string;
  correlationId?: string;
  source: 'web' | 'mobile' | 'voice' | 'device' | 'api';
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ListQuery extends PaginationQuery {
  search?: string;
  filter?: Record<string, unknown>;
}

export interface ResponseMeta {
  message?: string;
  timestamp?: string;
  requestId?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationInfo;
  meta?: ResponseMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type RequestHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string | string[]>
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void> | void;

export type AsyncRequestHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string | string[]>
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void>;

export type ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    context?: RequestContext;
    userRole?: 'MASTER' | 'ADMIN' | 'USER' | 'GUEST';
    sessionId?: string;
    session: Express.Session & {
      userRole?: 'MASTER' | 'ADMIN' | 'USER' | 'GUEST';
      userId?: string;
      username?: string;
      authenticatedAt?: number;
      regenerate(callback: (err?: Error) => void): void;
      destroy(callback: (err?: Error) => void): void;
    };
  }
  
  interface Response {
    apiSuccess<T>(data: T, meta?: ResponseMeta): Response;
    apiError(error: ApiErrorResponse): Response;
    apiPaginated<T>(items: T[], pagination: PaginationInfo): Response;
  }
}

export function createSuccessResponse<T>(
  data: T,
  meta?: ResponseMeta
): ApiSuccessResponse<T>;

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): ApiErrorResponse;

export function createPaginatedResponse<T>(
  items: T[],
  pagination: PaginationInfo,
  meta?: ResponseMeta
): ApiPaginatedResponse<T>;

export function setupResponseHelpers(app: Express.Application): void;
