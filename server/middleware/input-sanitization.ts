/**
 * 输入验证和清理中间件
 * 防止 XSS、SQL 注入等攻击
 */

import { Request, Response, NextFunction } from 'express';
import { SecurityConfig } from '../config/security';

interface SanitizedRequest extends Request {
  sanitizedBody?: Record<string, unknown>;
  sanitizedQuery?: Record<string, unknown>;
}

function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  return str.replace(/[&<>"'/]/g, char => htmlEscapes[char] || char);
}

function escapeSql(str: string): string {
  return str.replace(/['";\-\-]/g, '');
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let sanitized = value;
    
    if (SecurityConfig.input.sanitizeHtml) {
      sanitized = escapeHtml(sanitized);
    }
    
    if (SecurityConfig.input.blockSqlInjection) {
      sanitized = escapeSql(sanitized);
    }
    
    return sanitized;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }
  
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  
  return value;
}

export function inputSanitization(
  req: SanitizedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (req.body && typeof req.body === 'object') {
      req.sanitizedBody = sanitizeValue(req.body) as Record<string, unknown>;
    }
    
    if (req.query && typeof req.query === 'object') {
      req.sanitizedQuery = sanitizeValue(req.query) as Record<string, unknown>;
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

export function validateInput(
  req: SanitizedRequest,
  res: Response,
  next: NextFunction
): void {
  const maxLength = SecurityConfig.input.maxLength;
  
  if (req.body) {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.length > maxLength) {
      res.status(400).json({
        success: false,
        error: 'INPUT_TOO_LARGE',
        message: `输入数据超过最大长度限制 (${maxLength} 字符)`
      });
      return;
    }
  }
  
  next();
}

export function addSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const headers = SecurityConfig.headers;
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', headers.xssProtection);
  res.setHeader('Referrer-Policy', headers.referrerPolicy);
  res.setHeader('Permissions-Policy', Object.entries(headers.permissionsPolicy)
    .map(([key, value]) => `${key}=(${value.join(',')})`)
    .join(', '));
  
  if (!headers.noCache) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  
  next();
}
