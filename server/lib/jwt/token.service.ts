
/**
 * JWT 令牌服务
 * 提供 Access Token 和 Refresh Token 的生成、验证和刷新功能
 */

import jwt from 'jsonwebtoken';
import { createServiceLogger } from '../lib/logger';
import { CacheManager } from './cache';

const logger = createServiceLogger('JWTService');

// 获取 Redis 客户端实例
const cacheManager = new CacheManager();
const redis = cacheManager.getClient();

export interface TokenPayload {
  userId: string;
  email?: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface JWTConfig {
  accessToken: {
    expiresIn: string;
    secret: string;
  };
  refreshToken: {
    expiresIn: string;
    secret: string;
  };
  blacklist: {
    enabled: boolean;
    redisPrefix: string;
  };
}

const defaultConfig: JWTConfig = {
  accessToken: {
    expiresIn: '15m',
    secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
  },
  refreshToken: {
    expiresIn: '7d',
    secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
  },
  blacklist: {
    enabled: process.env.JWT_BLACKLIST_ENABLED === 'true',
    redisPrefix: 'jwt:blacklist:',
  },
};

let currentConfig = defaultConfig;

export function setJWTConfig(config: Partial<JWTConfig>): void {
  currentConfig = { ...defaultConfig, ...config };
}

export function getJWTConfig(): JWTConfig {
  return currentConfig;
}

/**
 * 生成 Access Token
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  const tokenPayload: TokenPayload = { ...payload, type: 'access' };
  return jwt.sign(tokenPayload, currentConfig.accessToken.secret, {
    expiresIn: currentConfig.accessToken.expiresIn,
  });
}

/**
 * 生成 Refresh Token
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  const tokenPayload: TokenPayload = { ...payload, type: 'refresh' };
  return jwt.sign(tokenPayload, currentConfig.refreshToken.secret, {
    expiresIn: currentConfig.refreshToken.expiresIn,
  });
}

/**
 * 生成令牌对 (Access + Refresh)
 */
export function generateTokenPair(payload: Omit<TokenPayload, 'type'>): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const expiresIn = Date.now() + 15 * 60 * 1000;

  return { accessToken, refreshToken, expiresIn };
}

/**
 * 验证 Access Token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, currentConfig.accessToken.secret) as TokenPayload;
    if (decoded.type !== 'access') {
      logger.warn('Invalid token type for access token');
      return null;
    }
    return decoded;
  } catch (error) {
    logger.warn({ err: error }, 'Access token verification failed');
    return null;
  }
}

/**
 * 验证 Refresh Token
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, currentConfig.refreshToken.secret) as TokenPayload;
    if (decoded.type !== 'refresh') {
      logger.warn('Invalid token type for refresh token');
      return null;
    }
    return decoded;
  } catch (error) {
    logger.warn({ err: error }, 'Refresh token verification failed');
    return null;
  }
}

/**
 * 将令牌加入黑名单
 */
export async function addToBlacklist(token: string, type: 'access' | 'refresh'): Promise<boolean> {
  if (!currentConfig.blacklist.enabled) {
    return true;
  }

  try {
    const decoded = jwt.decode(token) as TokenPayload | null;
    if (!decoded) {
      return false;
    }

    const exp = decoded.exp || 0;
    const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 0);
    const key = `${currentConfig.blacklist.redisPrefix}${type}:${token.substring(0, 20)}`;

    await redis.setex(key, ttl, '1');
    logger.info({ type, userId: decoded.userId }, 'Token added to blacklist');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to add token to blacklist');
    return false;
  }
}

/**
 * 检查令牌是否在黑名单中
 */
export async function isTokenBlacklisted(token: string, type: 'access' | 'refresh'): Promise<boolean> {
  if (!currentConfig.blacklist.enabled) {
    return false;
  }

  try {
    const key = `${currentConfig.blacklist.redisPrefix}${type}:${token.substring(0, 20)}`;
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error({ err: error }, 'Failed to check token blacklist');
    return false;
  }
}

/**
 * 刷新令牌对
 */
export async function refreshTokenPair(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return null;
  }

  const isBlacklisted = await isTokenBlacklisted(refreshToken, 'refresh');
  if (isBlacklisted) {
    logger.warn({ userId: decoded.userId }, 'Refresh token is blacklisted');
    return null;
  }

  await addToBlacklist(refreshToken, 'refresh');

  return generateTokenPair({ userId: decoded.userId, email: decoded.email, role: decoded.role });
}

/**
 * 吊销所有用户令牌
 */
export async function revokeAllUserTokens(userId: string): Promise<boolean> {
  if (!currentConfig.blacklist.enabled) {
    return true;
  }

  try {
    const pattern = `${currentConfig.blacklist.redisPrefix}*`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    logger.info({ userId }, 'All user tokens revoked');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to revoke user tokens');
    return false;
  }
}

/**
 * 从请求头提取 Bearer Token
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * 解析 JWT 并获取过期时间
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
}
