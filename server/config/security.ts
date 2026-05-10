/**
 * 安全配置
 * 包含安全相关的常量和配置
 */

export const SecurityConfig = {
  // 密码策略
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // 天
  },

  // 会话配置
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    maxPerUser: 5,
    idleTimeout: 30 * 60 * 1000, // 30分钟
  },

  // API 限流
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100,
    maxPremium: 1000,
  },

  // CORS 配置
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5000',
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  },

  // 安全头
  headers: {
    contentSecurityPolicy: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
    },
    xssProtection: '1; mode=block',
    noSniff: 'nosniff',
    noCache: false,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  },

  // 输入验证
  input: {
    maxLength: 10000,
    sanitizeHtml: true,
    blockSqlInjection: true,
    blockXss: true,
  },

  // 文件上传
  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
    ],
    scanVirus: false,
  },

  // 加密配置
  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationDays: 30,
  },

  // JWT 配置
  jwt: {
    expiresIn: '24h',
    refreshExpiresIn: '7d',
    issuer: 'sheng-yu-assistant',
    audience: 'sheng-yu-users',
  },

  // IP 白名单
  ipWhitelist: [] as string[],

  // IP 黑名单
  ipBlacklist: [] as string[],
} as const;

export type SecurityConfigType = typeof SecurityConfig;
