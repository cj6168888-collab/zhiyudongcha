/**
 * 日志脱敏中间件
 * 自动过滤敏感数据，防止信息泄露
 */

import { Request, Response, NextFunction } from 'express';

const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'apiKey',
  'secretKey',
  'privateKey',
  'creditCard',
  'credit_card',
  'ssn',
  'socialSecurity',
  'social_security_number',
  'phone',
  'mobile',
  'address',
  'birthday',
  'birthDate',
  'passport',
  'driverLicense',
];

const SENSITIVE_PATTERNS = [
  /password[=:]\s*[^\s&]*/gi,
  /token[=:]\s*[^\s&]*/gi,
  /api[_-]?key[=:]\s*[^\s&]*/gi,
  /secret[=:]\s*[^\s&]*/gi,
  /bearer\s+[a-zA-Z0-9\-_.~+/]+=*/gi,
  /[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/g,
  /\d{3}-\d{2}-\d{4}/g,
];

export interface LogMaskerOptions {
  maskChar?: string;
  preserveLength?: boolean;
  fields?: string[];
}

const defaultOptions: Required<LogMaskerOptions> = {
  maskChar: '***',
  preserveLength: false,
  fields: SENSITIVE_FIELDS,
};

export function createLogMasker(options: LogMaskerOptions = {}) {
  const config = { ...defaultOptions, ...options };

  function maskValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return maskString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => maskValue(item));
    }

    if (typeof value === 'object') {
      return maskObject(value as Record<string, unknown>);
    }

    return value;
  }

  function maskString(str: string): string {
    for (const pattern of SENSITIVE_PATTERNS) {
      str = str.replace(pattern, (match) => {
        if (match.includes('=')) {
          const [key, value] = match.split('=');
          return `${key}=${config.maskChar}`;
        }
        return config.maskChar;
      });
    }
    return str;
  }

  function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      const isSensitive = config.fields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        if (typeof value === 'string') {
          masked[key] = config.preserveLength 
            ? value.substring(0, 2) + config.maskChar + value.substring(value.length - 2)
            : config.maskChar;
        } else {
          masked[key] = config.maskChar;
        }
      } else {
        masked[key] = maskValue(value);
      }
    }

    return masked;
  }

  function maskRequest(req: Request): Record<string, unknown> {
    const masked: Record<string, unknown> = {
      method: req.method,
      url: req.url,
      headers: maskObject({ 
        ...req.headers, 
        authorization: req.headers.authorization ? '[FILTERED]' : undefined 
      } as Record<string, unknown>),
    };

    if (req.query) {
      masked.query = maskObject({ ...req.query } as Record<string, unknown>);
    }

    if (req.body && typeof req.body === 'object') {
      masked.body = maskObject({ ...req.body } as Record<string, unknown>);
    }

    return masked;
  }

  function maskResponse(data: unknown): unknown {
    return maskValue(data);
  }

  return {
    maskValue,
    maskRequest,
    maskResponse,
  };
}

export const logMasker = createLogMasker();

export function maskedLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  
  res.json = function(data: unknown): Response {
    const maskedData = logMasker.maskResponse(data);
    (req as Request & { maskedResponse?: unknown }).maskedResponse = maskedData;
    return originalJson(maskedData);
  };

  next();
}
