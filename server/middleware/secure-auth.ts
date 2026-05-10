import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../lib/logger';
import { secureConfigManager } from '../lib/secure-config-manager';
import crypto from 'crypto';

const logger = createServiceLogger('AuthMiddleware');

export interface AuthRequestContext {
  userId?: string;
  role?: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

const DEV_AUTH_BYPASS = process.env['DEV_AUTH_BYPASS'] === 'true';

enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: string[];
  recommendations: string[];
}

function assessRequestRisk(req: Request): RiskAssessment {
  const factors: string[] = [];
  let score = 0;

  const clientIP = req.ip || (req.connection as { remoteAddress?: string })?.remoteAddress;
  if (clientIP) {
    if (isPrivateIP(clientIP)) {
      score -= 10;
      factors.push('内网访问');
    } else {
      score += 20;
      factors.push('公网访问');
    }
  }

  const userAgent = req.get('User-Agent');
  if (!userAgent || userAgent.length < 50) {
    score += 15;
    factors.push('可疑User-Agent');
  }

  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    score += 10;
    factors.push('非常规时间访问');
  }

  const reqCount = (req as Request & { requestCount?: number }).requestCount || 0;
  if (reqCount > 10) {
    score += 30;
    factors.push('高频访问');
  }

  const authHeader = req.get('Authorization');
  if (!authHeader) {
    score += 50;
    factors.push('未提供认证信息');
  }

  let level: RiskLevel;
  if (score >= 70) {
    level = RiskLevel.CRITICAL;
  } else if (score >= 50) {
    level = RiskLevel.HIGH;
  } else if (score >= 30) {
    level = RiskLevel.MEDIUM;
  } else {
    level = RiskLevel.LOW;
  }

  const recommendations: string[] = [];
  if (score >= 50) {
    recommendations.push('建议启用双因素认证');
    recommendations.push('考虑实施IP白名单');
  }
  if (reqCount > 10) {
    recommendations.push('启用更严格的限流');
  }

  return {
    level,
    score,
    factors,
    recommendations
  };
}

function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/
  ];

  return privateRanges.some(range => range.test(ip));
}

interface JWTDecoded {
  userId: string;
  role: string;
  exp?: number;
}

function validateJWTToken(token: string): JWTDecoded | null {
  try {
    const secret = secureConfigManager.getConfig('SESSION_SECRET');
    if (!secret) {
      throw new Error('JWT secret not configured');
    }

    // 真正的 JWT 解析和验签
    const parts = token.split('.');
    if (parts.length !== 3) {
      logger.warn('Invalid JWT format: not 3 parts');
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // 解析 header
    let header: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    } catch {
      logger.warn('Invalid JWT header JSON');
      return null;
    }

    // 解析 payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    } catch {
      logger.warn('Invalid JWT payload JSON');
      return null;
    }

    // 检查过期时间
    if (payload.exp) {
      const exp = Number(payload.exp);
      if (Date.now() / 1000 > exp) {
        logger.warn('JWT token expired');
        return null;
      }
    }

    // 检查签发时间（可选）
    if (payload.iat) {
      const iat = Number(payload.iat);
      if (iat > Date.now() / 1000 + 60) { // 允许最多 60 秒时钟偏差
        logger.warn('JWT token issued in the future');
        return null;
      }
    }

    // 验签：使用 HMAC-SHA256
    const signatureInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');

    if (signatureB64 !== expectedSignature) {
      logger.warn('JWT signature mismatch');
      return null;
    }

    // 提取用户信息
    const userId = payload.sub as string | undefined;
    const role = payload.role as string | undefined;

    if (!userId) {
      logger.warn('JWT payload missing sub (subject) claim');
      return null;
    }

    return {
      userId,
      role: role || 'user',
      exp: payload.exp as number | undefined,
    };
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'JWT验证失败');
    return null;
  }
}

function validateAPIKey(apiKey: string): { valid: boolean; provider: string | null } {
  try {
    const validKeys = secureConfigManager.getConfigsByCategory('ai');

    for (const [provider, key] of Object.entries(validKeys)) {
      if (key && apiKey === key) {
        return { provider, valid: true };
      }
    }

    return { valid: false, provider: null };
  } catch {
    return { valid: false, provider: null };
  }
}

async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const userRole = await getUserRole(userId);

    switch (userRole) {
      case 'admin':
        return ['read', 'write', 'delete', 'admin'];
      case 'user':
        return ['read', 'write'];
      case 'guest':
        return ['read'];
      default:
        return [];
    }
  } catch (error) {
    logger.error({ error: (error as Error).message }, '获取用户权限失败');
    return [];
  }
}

async function getUserRole(userId: string): Promise<string> {
  return userId === 'admin' ? 'admin' : 'user';
}

function logSecurityEvent(event: string, req: Request, metadata: Record<string, unknown> = {}): void {
  const securityLog = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.ip || (req.connection as { remoteAddress?: string })?.remoteAddress,
    userAgent: req.get('User-Agent'),
    path: req.path,
    method: req.method,
    userId: (req as Request & { context?: AuthRequestContext }).context?.userId,
    risk: (req as Request & { riskAssessment?: RiskAssessment }).riskAssessment?.level || RiskLevel.LOW,
    ...metadata
  };

  logger.warn(securityLog, event);
}

export interface AuthRequest extends Request {
  riskAssessment?: RiskAssessment;
  context?: AuthRequestContext;
}

export function secureAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void | Response {
  try {
    req.riskAssessment = assessRequestRisk(req);

    if (req.riskAssessment.level === RiskLevel.CRITICAL) {
      logSecurityEvent('高风险访问尝试', req, {
        score: req.riskAssessment.score,
        factors: req.riskAssessment.factors
      });

      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: '访问被拒绝，请稍后重试或联系管理员',
        timestamp: new Date().toISOString()
      });
    }

    // 开发环境认证绕过（仅用于本地开发，生产环境必须禁用）
    if (process.env['NODE_ENV'] === 'development' && DEV_AUTH_BYPASS) {
      // 记录安全警告
      logger.warn({
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        risk: req.riskAssessment.level,
        warning: '开发环境认证绕过已启用 - 生产环境必须设置 DEV_AUTH_BYPASS=false'
      }, '⚠️ 安全警告: 开发环境认证绕过已启用');

      // 检查是否来自可信的本地网络
      const isLocalNetwork = isPrivateIP(req.ip || '');
      if (!isLocalNetwork) {
        logger.error({ ip: req.ip }, '非本地网络尝试使用开发环境认证绕过，已拒绝');
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: '开发环境认证绕过仅允许本地网络访问',
          timestamp: new Date().toISOString()
        });
      }

      req.context = {
        userId: 'dev_user',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'admin'],
        metadata: {
          bypassUsed: true,
          riskLevel: req.riskAssessment.level,
          securityWarning: '开发环境认证绕过 - 不要在生产环境使用'
        }
      };

      return next();
    }

    const authHeader = req.get('Authorization');
    if (!authHeader) {
      logSecurityEvent('缺少认证信息', req);

      return res.status(401).json({
        success: false,
        error: 'MISSING_AUTH',
        message: '请提供认证信息',
        timestamp: new Date().toISOString()
      });
    }

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = validateJWTToken(token);

      if (!decoded) {
        logSecurityEvent('JWT验证失败', req, { token: token.substring(0, 20) + '...' });

        return res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: '无效的访问令牌',
          timestamp: new Date().toISOString()
        });
      }

      getUserPermissions(decoded.userId).then(permissions => {
        req.context = {
          userId: decoded.userId,
          role: decoded.role,
          permissions,
          metadata: {
            authType: 'jwt',
            tokenExpiry: decoded.exp
          }
        };

        logSecurityEvent('JWT认证成功', req, { userId: decoded.userId });
        next();
      }).catch(error => {
        logger.error({ error: error.message }, '获取用户权限失败');
        next();
      });

    } else if (authHeader.startsWith('API-Key ')) {
      const apiKey = authHeader.substring(8);
      const validation = validateAPIKey(apiKey);

      if (!validation.valid) {
        logSecurityEvent('API密钥验证失败', req);

        return res.status(401).json({
          success: false,
          error: 'INVALID_API_KEY',
          message: '无效的API密钥',
          timestamp: new Date().toISOString()
        });
      }

      req.context = {
        userId: `api_${validation.provider}`,
        role: 'api',
        permissions: ['read', 'write'],
        metadata: {
          authType: 'api_key',
          provider: validation.provider
        }
      };

      logSecurityEvent('API密钥认证成功', req, { provider: validation.provider });
      next();

    } else {
      logSecurityEvent('不支持的认证方式', req, { authHeader });

      return res.status(401).json({
        success: false,
        error: 'UNSUPPORTED_AUTH',
        message: '不支持的认证方式',
        timestamp: new Date().toISOString()
      });
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  } catch (error) {
    logger.error({
      error: (error as Error).message,
      path: req.path,
      method: req.method,
      ip: req.ip
    }, '认证中间件执行失败');

    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '认证服务暂时不可用',
      timestamp: new Date().toISOString()
    });
  }
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.context) {
      logSecurityEvent('未认证用户尝试访问受保护资源', req, { requiredPermission: permission });

      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: '请先进行认证',
        timestamp: new Date().toISOString()
      });
    }

    if (!req.context.permissions.includes(permission)) {
      logSecurityEvent('权限不足', req, {
        userRole: req.context.role,
        requiredPermission: permission,
        userPermissions: req.context.permissions
      });

      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `需要 ${permission} 权限`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void | Response {
  if (!req.context || req.context.role !== 'admin') {
    logSecurityEvent('非管理员尝试访问管理员资源', req);

    return res.status(403).json({
      success: false,
      error: 'ADMIN_REQUIRED',
      message: '需要管理员权限',
      timestamp: new Date().toISOString()
    });
  }

  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void | Response {
  logger.warn('使用了过时的认证中间件，建议升级到secureAuthMiddleware');
  return secureAuthMiddleware(req as AuthRequest, res, next);
}

export function getRequestContext(req: Request): AuthRequestContext | undefined {
  return (req as AuthRequest).context;
}

export function hasPermission(req: Request, permission: string): boolean {
  const context = getRequestContext(req);
  return context?.permissions?.includes(permission) || false;
}

export function isAdmin(req: Request): boolean {
  const context = getRequestContext(req);
  return context?.role === 'admin';
}
