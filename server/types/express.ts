import { Request, Response, NextFunction, RequestHandler } from 'express';

export type ExpressRequest = Request;
export type ExpressResponse = Response;
export type ExpressNext = NextFunction;
export type ExpressHandler = RequestHandler;

export type JsonObject = Record<string, unknown>;
export type JsonArray = unknown[];
export type JsonValue = JsonObject | JsonArray | string | number | boolean | null;

export interface RequestWithUser {
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
  session?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, unknown>;
}

export interface ApiErrorOptions {
  code: string;
  message: string;
  statusCode?: number;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.statusCode = options.statusCode || 500;
    this.details = options.details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): JsonObject {
    const errorObj: JsonObject = { code: this.code, message: this.message };
    if (this.details !== undefined) {
      errorObj.details = this.details;
    }
    return {
      success: false,
      error: errorObj,
      timestamp: new Date().toISOString()
    };
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super({ code: 'VALIDATION_ERROR', message, statusCode: 400, details });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super({ code: 'NOT_FOUND', message: `${resource} not found`, statusCode: 404 });
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super({ code: 'UNAUTHORIZED', message, statusCode: 401 });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super({ code: 'FORBIDDEN', message, statusCode: 403 });
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super({ code: 'CONFLICT', message, statusCode: 409 });
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Too many requests') {
    super({ code: 'RATE_LIMIT_EXCEEDED', message, statusCode: 429 });
    this.name = 'RateLimitError';
  }
}
