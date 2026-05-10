/**
 * 增强的安全中间件配置
 * 提供更细粒度的安全控制
 */

import { Request, Response, NextFunction } from 'express';

export interface SecurityConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXSSFilter: boolean;
  enableFrameGuard: boolean;
  enableContentTypeNosniff;
  enableReferrerPolicy: boolean;
  allowedOrigins: string[];
  maxRequestBodySize: string;
}

/**
 * 默认安全配置
 */
export const defaultSecurityConfig: SecurityConfig = {
  enableCSP: true,
  enableHSTS: true,
  enableXSSFilter: true,
  enableFrameGuard: true,
  enableContentTypeNosniff: true,
  enableReferrerPolicy: true,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  maxRequestBodySize: '10mb',
};

/**
 * 创建增强的安全中间件
 */
export function createEnhancedSecurityMiddleware(config: SecurityConfig = defaultSecurityConfig) {
  return {
    /**
     * 内容安全策略 (CSP)
     */
    csp: (req: Request, res: Response, next: NextFunction) => {
      if (config.enableCSP) {
        res.setHeader(
          'Content-Security-Policy',
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https: wss:",
            "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
            "media-src 'self' blob:",
          ].join('; ')
        );
      }
      next();
    },

    /**
     * HTTP严格传输安全 (HSTS)
     */
    hsts: (req: Request, res: Response, next: NextFunction) => {
      if (config.enableHSTS && req.secure) {
        res.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        );
      }
      next();
    },

    /**
     * X-XSS-Protection
     */
    xssFilter: (req: Request, res: Response, next: NextFunction) => {
      if (config.enableXSSFilter) {
        res.setHeader('X-XSS-Protection', '1; mode=block');
      }
      next();
    },

    /**
     * X-Frame-Options (防止点击劫持)
     */
    frameGuard: (req: Request, res: Response, next: NextFunction) => {
      if (config.enableFrameGuard) {
        res.setHeader('X-Frame-Options', 'DENY');
      }
      next();
    },

    /**
     * X-Content-Type-Options (防止MIME类型嗅探)
     */
    contentTypeNosniff: (req: Request, res: Response, next: NextFunction) => {
      if (config.enableContentTypeNosniff) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      next();
    },

    /**
     * Referrer-Policy
     */
    referrerPolicy: (req: Request, res: Response, next: NextFunction) => {
      if (config.enableReferrerPolicy) {
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      }
      next();
    },

    /**
     * 移除敏感头信息
     */
    removeSensitiveHeaders: (req: Request, res: Response, next: NextFunction) => {
      res.removeHeader('X-Powered-By');
      res.removeHeader('X-AspNet-Version');
      res.removeHeader('Server');
      next();
    },

    /**
     * 请求体大小限制
     */
    limitRequestBody: (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const maxSize = parseSize(config.maxRequestBodySize);
        if (parseInt(contentLength) > maxSize) {
          return res.status(413).json({
            success: false,
            error: 'PAYLOAD_TOO_LARGE',
            message: '请求体过大',
          });
        }
      }
      next();
    },

    /**
     * CORS预检请求缓存
     */
    corsPreflightCache: (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Access-Control-Max-Age', '86400');
      next();
    },
  };
}

/**
 * 解析大小字符串
 */
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)([a-z]+)$/);
  if (match) {
    const [, value, unit] = match;
    return parseInt(value) * (units[unit] || 1);
  }

  return parseInt(size);
}

/**
 * IP白名单中间件
 */
export function createIPWhitelistMiddleware(whitelist: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.socket.remoteAddress;
    
    if (whitelist.length > 0 && !whitelist.includes(clientIP || '')) {
      return res.status(403).json({
        success: false,
        error: 'IP_NOT_ALLOWED',
        message: '您的IP地址不在允许范围内',
      });
    }
    
    next();
  };
}

/**
 * 安全日志中间件
 */
export function createSecurityLogMiddleware(logger: ReturnType<typeof import('pino')>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    if (res.once) {
      res.once('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date().toISOString(),
        };
        
        if (res.statusCode < 400) {
          logger.debug(logData);
        } else {
          logger.warn(logData);
        }
      });
    } else {
      // Fallback for environments where res.on is not available
      setTimeout(() => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date().toISOString(),
        };
        
        if (res.statusCode < 400) {
          logger.debug(logData);
        } else {
          logger.warn(logData);
        }
      }, 0);
    }

    next();
  };
}

export default {
  createEnhancedSecurityMiddleware,
  createIPWhitelistMiddleware,
  createSecurityLogMiddleware,
  defaultSecurityConfig,
};
