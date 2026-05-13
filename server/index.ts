/**
 * 领航者 (Navigator-X) 服务器入口
 *
 * @version 2.0.0
 * @author Navigator-X 团队
 * @date 2026-04-19
 */

import './lib/load-env';
import express from 'express';
import session from 'express-session';
import { createServer as createHttpServer, Server } from 'http';
import { existsSync } from 'fs';
import path from 'path';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { logger } from './lib/logger';
import { ensureAssistantRuntimeSchema } from './services/assistant-runtime-schema';
import { swarmTaskRegistry } from './services/swarm-task-registry';
import { conversationActionExecutor } from './services/assistant/ConversationActionExecutor';
import { cozeAPI } from './lib/coze-api';
import { userService } from './services/UserService';
import crypto from 'crypto';
import docsRouter from './routes/docs';
import { validateEnvConfig } from './lib/config-validator';
import { createSecurityMiddleware } from './middleware/security-middleware';
import csrfRouter from './routes/csrf';
import { attachCSRFToken, csrfProtection } from './middleware/csrf-protection';

// 在服务器启动前验证环境变量
validateEnvConfig();

/**
 * Session 中间件类型定义
 */
export function sessionMiddleware(req: unknown, res: unknown, next: unknown): void {
  const request = req as { session?: Record<string, unknown> };
  if (!request.session) {
    request.session = {};
  }
  (next as () => void)();
}

/**
 * 数据库配置
 */
const databaseConfig = {
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432'),
  database: process.env['DB_NAME'] || 'sheng_yu_zhu_shou',
  user: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASSWORD'] || '',
  max: parseInt(process.env['DB_MAX_CONNECTIONS'] || '20'),
  min: parseInt(process.env['DB_MIN_CONNECTIONS'] || '5'),
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000'),
  connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '10000'),
  ssl: process.env['DB_SSL'] === 'true'
};

/**
 * Redis 配置
 */
const redisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379'),
  password: process.env['REDIS_PASSWORD'] || '',
  db: parseInt(process.env['REDIS_DB'] || '0'),
  maxRetriesPerRequest: parseInt(process.env['REDIS_MAX_RETRIES'] || '3'),
  retryDelayOnFailover: parseInt(process.env['REDIS_RETRY_DELAY'] || '100'),
  lazyConnect: process.env['REDIS_LAZY_CONNECT'] === 'true',
  keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'sheng_yu:',
  ttl: parseInt(process.env['REDIS_TTL'] || '3600')
};

/**
 * 服务器配置
 */
const serverConfig = {
  port: parseInt(process.env['PORT'] || '3000'),
  host: process.env['HOST'] || '0.0.0.0',
  cors: {
    origin: process.env['CORS_ORIGIN'] ? process.env['CORS_ORIGIN'].split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5001'],
    credentials: process.env['CORS_CREDENTIALS'] === 'true'
  },
  compression: {
    enabled: process.env['COMPRESSION_ENABLED'] !== 'false'
  },
  static: {
    enabled: process.env['STATIC_ENABLED'] !== 'false',
    maxAge: parseInt(process.env['STATIC_MAX_AGE'] || '86400000'),
    etag: process.env['STATIC_ETAG'] === 'true'
  },
  security: {
    helmet: process.env['HELMET_ENABLED'] !== 'false',
    rateLimit: {
      windowMs: parseInt(process.env['RATE_LIMIT_WINDOW'] || '900000'),
      max: parseInt(process.env['RATE_LIMIT_MAX'] || '100')
    }
  },
  session: {
    secret: process.env['SESSION_SECRET'] || 'default-session-secret',
    resave: process.env['SESSION_RESAVE'] !== 'false',
    saveUninitialized: process.env['SESSION_SAVE_UNINITIALIZED'] !== 'false',
    rolling: process.env['SESSION_ROLLING'] === 'true',
    cookie: {
      secure: process.env['COOKIE_SECURE']
        ? process.env['COOKIE_SECURE'] === 'true'
        : process.env['NODE_ENV'] === 'production',
      httpOnly: process.env['COOKIE_HTTP_ONLY'] !== 'false',
      maxAge: parseInt(process.env['COOKIE_MAX_AGE'] || '86400000'),
      sameSite: parseCookieSameSite(process.env['COOKIE_SAME_SITE'])
    }
  },
  api: {
    rateLimit: {
      windowMs: parseInt(process.env['API_RATE_LIMIT_WINDOW'] || '900000'),
      max: parseInt(process.env['API_RATE_LIMIT_MAX'] || '1000')
    }
  },
  monitoring: {
    enabled: process.env['MONITORING_ENABLED'] !== 'false',
    metricsInterval: parseInt(process.env['MONITORING_INTERVAL'] || '5000'),
    alertCheckInterval: parseInt(process.env['MONITORING_ALERT_INTERVAL'] || '10000')
  }
};

function parseCookieSameSite(value: string | undefined): 'strict' | 'lax' | 'none' | boolean {
  if (!value) {
    return process.env['NODE_ENV'] === 'production' ? 'strict' : 'lax';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'false') return false;
  if (normalized === 'true') return true;
  if (normalized === 'strict' || normalized === 'lax' || normalized === 'none') return normalized;
  logger.warn({ value }, 'Invalid COOKIE_SAME_SITE value, falling back to lax');
  return 'lax';
}

function serveStaticAssets(app: express.Express): void {
  if (!serverConfig.static.enabled) {
    return;
  }

  const publicDir = path.resolve(process.cwd(), 'dist/public');
  const indexFile = path.join(publicDir, 'index.html');

  if (!existsSync(indexFile)) {
    logger.warn({ publicDir }, 'Static frontend assets not found; skipping frontend serving');
    return;
  }

  app.use(express.static(publicDir, {
    maxAge: serverConfig.static.maxAge,
    etag: serverConfig.static.etag,
    index: false,
  }));

  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/api-docs') ||
      req.path.startsWith('/swagger') ||
      req.path.startsWith('/ws')
    ) {
      next();
      return;
    }

    res.sendFile(indexFile);
  });
}

/**
 * 创建并配置 Express 应用
 */
async function createServer(port: number, host: string): Promise<Server> {
  const app = express();

  // 统一安全中间件（包括 API Key、CORS、Helmet 等）
  app.use(createSecurityMiddleware());
  app.use(session({
    secret: serverConfig.session.secret,
    resave: serverConfig.session.resave,
    saveUninitialized: serverConfig.session.saveUninitialized,
    rolling: serverConfig.session.rolling,
    cookie: serverConfig.session.cookie,
  }));

  // Swagger 文档路由
  app.use(docsRouter);

  // 解析请求体
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.raw({ type: 'application/vnd.custom-type' }));

  // Request ID 中间件
  app.use((req, res, next) => {
    (req as Record<string, unknown>)['requestId'] = crypto.randomUUID();
    res.setHeader('X-Request-ID', (req as Record<string, unknown>)['requestId'] as string);
    next();
  });

  // CSRF Protection
  app.use(attachCSRFToken);
  app.use('/api/security', csrfRouter);

  // Create HTTP server
  const httpServer = createHttpServer(app);

  // Register application routes (with CSRF protection applied after)
  app.use(csrfProtection);
  await registerRoutes(httpServer, app);
  serveStaticAssets(app);

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => resolve());
  });

  return httpServer;
}

/**
 * 主函数 - 启动服务器
 */
async function main(): Promise<void> {
  logger.info({
    port: serverConfig.port,
    host: serverConfig.host,
    nodeVersion: process.version,
    platform: process.platform,
    database: databaseConfig.host,
    redis: redisConfig.host
  }, '启动领航者 (Navigator-X) 服务器');

  const httpServer = await createServer(serverConfig.port, serverConfig.host);

  // 确保 restart-safe 运行时表存在，避免本地/老库遗漏迁移时降级为纯内存状态。
  try {
    await ensureAssistantRuntimeSchema();
  } catch (error) {
    logger.warn({ err: error }, 'Assistant runtime schema ensure failed');
  }

  // 从 DB 恢复蜂群任务和暂存动作（restart-safe）
  await Promise.allSettled([
    swarmTaskRegistry.hydrate(),
    conversationActionExecutor.hydrate(),
  ]);

  // 从用户设置加载Coze AI配置
  try {
    const settings = await userService.getUserSettings('master');
    if (settings.cozeEnabled || settings.cozeApiKey) {
      cozeAPI.updateFromSettings(settings);
      logger.info('Coze API配置已从用户设置加载');
    }
  } catch (error) {
    logger.debug({ error }, '无法从用户设置加载Coze配置');
  }

  logger.info({
    port: serverConfig.port,
    host: serverConfig.host,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform
  }, '服务器启动成功');

  logger.info({
    port: serverConfig.port,
    url: `http://${serverConfig.host}:${serverConfig.port}`,
    environment: process.env.NODE_ENV || 'development'
  }, '领航者 (Navigator-X) 服务器已就绪');
}

// 全局异常处理
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, '未捕获的异常');
  process.exit(1);
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, '未处理的Promise拒绝');
});

// 启动服务器
main().catch((error) => {
  logger.error({ error: error.message, stack: error.stack }, '服务器启动失败');
  process.exit(1);
});

export { serverConfig, databaseConfig, redisConfig };
