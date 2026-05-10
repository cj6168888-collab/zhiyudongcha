import type { Request, Response, NextFunction } from 'express'
import { createServiceLogger } from '../lib/logger'
import { getSecurityHeaders, getSessionConfig } from '../lib/production-security'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import cors from 'cors'
import { createApiKeyMiddleware } from './api-key-middleware'

const logger = createServiceLogger('SecurityMiddleware')

export interface SecurityMiddlewareOptions {
  trustProxy?: boolean
  maxRequests?: number
  windowMs?: number
  enableCSP?: boolean
  enableHSTS?: boolean
  customHeaders?: Record<string, string>
}

/**
 * 安全中间件配置
 */
export class SecurityMiddleware {
  private static readonly DEFAULT_OPTIONS: SecurityMiddlewareOptions = {
    trustProxy: true,
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15分钟
    enableCSP: true,
    enableHSTS: true
  }

  /**
   * 创建安全响应头中间件
   */
  static createSecurityHeaders(options: SecurityMiddlewareOptions = {}) {
    const config = { ...this.DEFAULT_OPTIONS, ...options }
    const securityHeaders = getSecurityHeaders()

    // 自定义安全头配置
    const helmetConfig: Record<string, unknown> = {
      contentSecurityPolicy: config.enableCSP ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          childSrc: ["'none'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          upgradeInsecureRequests: []
        }
      } : false,
      hsts: config.enableHSTS ? {
        maxAge: 31536000, // 1年
        includeSubDomains: true,
        preload: true
      } : false,
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false, // 允许跨域嵌入
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false
    }

    return helmet(helmetConfig);
  }

  /**
   * 创建CORS中间件
   */
  static createCORS(options: SecurityMiddlewareOptions = {}) {
    const config = { ...this.DEFAULT_OPTIONS, ...options }

    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        // 在开发环境允许所有源
        if (process.env.NODE_ENV === 'development') {
          return callback(null, true)
        }

        // 生产环境严格检查
        const allowedOrigins = [
          ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
          ...(process.env.CORS_ORIGIN?.split(',') || []),
          `http://localhost:${process.env.PORT || '3000'}`,
          `http://127.0.0.1:${process.env.PORT || '3000'}`,
        ].map(value => value.trim()).filter(Boolean)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error('不允许的CORS源'), false)
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
        'X-API-Version'
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Request-ID',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
      ],
      maxAge: 86400 // 24小时
    }

    return cors(corsOptions)
  }

  /**
   * 创建速率限制中间件
   */
  static createRateLimit(options: SecurityMiddlewareOptions = {}) {
    const config = { ...this.DEFAULT_OPTIONS, ...options }

    return rateLimit({
      windowMs: config.windowMs,
      max: config.maxRequests,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil(config.windowMs! / 1000)
        }
      },
      standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` 头中
      legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
      keyGenerator: (req) => {
        // 根据IP和用户ID生成限制键
        const userId = req.user?.id
        const ip = req.ip || req.socket.remoteAddress || 'unknown'
        return userId ? `user:${userId}` : ipKeyGenerator(ip)
      },
      skip: (req) => {
        // 跳过健康检查等特殊路由
        const skipPaths = ['/health', '/metrics', '/api/meta/rate-limit-stats']
        return skipPaths.some(path => req.path?.includes(path))
      }
    })
  }

  /**
   * 创建请求ID中间件
   */
  static createRequestID() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || this.generateRequestID()
      req.headers['x-request-id'] = requestId
      res.setHeader('X-Request-ID', requestId)
      next()
    }
  }

  /**
   * 创建请求大小限制中间件
   */
  static createRequestSizeLimit(maxSize: string = '10mb') {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length']

      if (contentLength) {
        const size = parseInt(contentLength)
        const maxSizeBytes = this.parseSize(maxSize)

        if (size > maxSizeBytes) {
          return res.status(413).json({
            success: false,
            error: {
              code: 'REQUEST_TOO_LARGE',
              message: `请求体过大，最大允许 ${maxSize}`,
              actualSize: size,
              maxSize: maxSizeBytes
            }
          })
        }
      }

      next()
    }
  }

  /**
   * 创建安全会话中间件
   */
  static createSecureSession() {
    const session = require('express-session')
    const MemoryStore = require('memorystore')(session)

    const sessionConfig = getSessionConfig()

    return session({
      ...sessionConfig,
      store: new MemoryStore({
        checkPeriod: 86400000, // 24小时清理一次
      }),
      rolling: false, // 不在每次请求时重置cookie
      resave: false, // 不保存未修改的会话
      name: 'spirit-session', // 自定义cookie名称
      cookie: {
        ...sessionConfig.cookie,
        // 额外的安全设置
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        sameSite: sessionConfig.cookie.sameSite as 'strict' | 'lax' | 'none' | boolean
      }
    })
  }

  /**
   * 创建输入验证中间件
   */
  static createInputValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      // 检查Content-Type
      const contentType = req.headers['content-type']
      if (req.method !== 'GET' && !contentType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CONTENT_TYPE',
            message: '缺少Content-Type头'
          }
        })
      }

      // 验证JSON格式
      if (contentType?.includes('application/json')) {
        try {
          // 确保req.body是有效的JSON
          if (req.body && typeof req.body === 'object') {
            JSON.stringify(req.body)
          }
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: '无效的JSON格式'
            }
          })
        }
      }

      // 防止原型污染
      if (req.body) {
        req.body = this.sanitizeInput(req.body)
      }

      next()
    }
  }

  /**
   * 创建安全日志中间件
   */
  static createSecurityLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now()
      const requestId = req.headers['x-request-id'] as string

      // 记录请求开始
      logger.info('安全请求开始', {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length']
      })

      // 监听响应完成
      res.on('finish', () => {
        const duration = Date.now() - startTime
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info'

        logger[logLevel]('安全请求完成', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          ip: req.ip
        })
      })

      next()
    }
  }

  /**
   * 创建API版本控制中间件
   */
  static createAPIVersionControl() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestedVersion = req.headers['x-api-version'] as string || req.query.version as string
      const supportedVersions = ['v1', 'v2']
      const defaultVersion = 'v1'

      const version = requestedVersion && supportedVersions.includes(requestedVersion)
        ? requestedVersion
        : defaultVersion

      req.headers['x-api-version'] = version
      res.setHeader('API-Version', version)

      // 记录版本不匹配的请求
      if (requestedVersion && !supportedVersions.includes(requestedVersion)) {
        logger.warn('不支持的API版本', {
          requestedVersion,
          supportedVersions,
          url: req.url,
          ip: req.ip
        })
      }

      next()
    }
  }

  /**
   * 创建错误响应中间件
   */
  static createErrorResponse() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string

      // 记录错误
      logger.error('请求错误', {
        requestId,
        method: req.method,
        url: req.url,
        error: error.message,
        stack: error.stack,
        ip: req.ip
      })

      // 防止敏感信息泄露
      const isDevelopment = process.env.NODE_ENV === 'development'

      const errorResponse = {
        success: false,
        error: {
          code: (error as { code?: string }).code || 'INTERNAL_SERVER_ERROR',
          message: error.message || '内部服务器错误',
          requestId,
          ...(isDevelopment && { stack: error.stack })
        }
      }

      // 根据错误类型设置状态码
      let statusCode = 500
      if (error.name === 'ValidationError') {
        statusCode = 400
      } else if (error.name === 'UnauthorizedError') {
        statusCode = 401
      } else if (error.name === 'ForbiddenError') {
        statusCode = 403
      } else if (error.name === 'NotFoundError') {
        statusCode = 404
      } else if (error.name === 'RateLimitError') {
        statusCode = 429
      }

      res.status(statusCode).json(errorResponse)
    }
  }

  /**
   * 生成请求ID
   */
  private static generateRequestID(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `req_${timestamp}_${random}`
  }

  /**
   * 解析大小字符串
   */
  private static parseSize(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    }

    const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/)
    if (!match) {
      return 10 * 1024 * 1024 // 默认10MB
    }

    const [, sizeStr, unit] = match
    return parseInt(sizeStr) * units[unit]
  }

  /**
   * 清理输入数据，防止原型污染
   */
  private static sanitizeInput(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeInput(item))
    }

    const sanitized: Record<string, unknown> = {}
    const inputObj = obj as Record<string, unknown>
    for (const key in inputObj) {
      if (Object.prototype.hasOwnProperty.call(inputObj, key) && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
        sanitized[key] = this.sanitizeInput(inputObj[key])
      }
    }

    return sanitized
  }
}

/**
 * 综合安全中间件工厂
 */
export function createSecurityMiddleware(options: SecurityMiddlewareOptions = {}) {
  return [
    // 1. 请求ID
    SecurityMiddleware.createRequestID(),

    // 2. 代理信任
    (req: Request, _res: Response, next: NextFunction) => {
      req.app.set('trust proxy', options.trustProxy ?? true)
      next()
    },

    // 3. API Key 验证（可选）
    createApiKeyMiddleware(),

    // 4. 安全响应头
    SecurityMiddleware.createSecurityHeaders(options),

    // 5. CORS
    SecurityMiddleware.createCORS(options),

    // 6. 请求大小限制
    SecurityMiddleware.createRequestSizeLimit(),

    // 7. 输入验证
    SecurityMiddleware.createInputValidation(),

    // 8. 速率限制
    SecurityMiddleware.createRateLimit(options),

    // 9. API版本控制
    SecurityMiddleware.createAPIVersionControl(),

    // 10. 安全日志
    SecurityMiddleware.createSecurityLogger()
  ];
}

/**
 * 创建安全会话中间件
 */
export function createSecureSessionMiddleware() {
  return SecurityMiddleware.createSecureSession()
}

/**
 * 创建错误处理中间件
 */
export function createErrorHandlingMiddleware() {
  return SecurityMiddleware.createErrorResponse()
}

// 导出便捷函数
export const {
  createSecurityHeaders,
  createCORS,
  createRateLimit,
  createRequestID,
  createRequestSizeLimit,
  createSecureSession,
  createInputValidation,
  createSecurityLogger,
  createAPIVersionControl,
  createErrorResponse
} = SecurityMiddleware

export default SecurityMiddleware
