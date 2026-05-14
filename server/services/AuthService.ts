/**
 * 认证服务
 * 封装认证逻辑，包括登录、登出、会话管理和WebSocket令牌验证
 * 使用UserService进行用户验证，使用原始storage进行审计日志
 */

import { createServiceLogger } from '../lib/logger';
import { auditAction, getMasterSecret } from '../middleware/auth';
import { userService } from './UserService';
import crypto from 'crypto';
import type { Request } from 'express';

const logger = createServiceLogger('AuthService');

const wsTokens = new Map<string, { role: 'MASTER' | 'GUEST'; expiresAt: number }>();

export class AuthService {
  /**
   * 验证登录凭证
   * 目前仅支持主密钥验证，未来可扩展为多用户验证
   */
  async validateCredentials(secret: string): Promise<{
    success: boolean;
    role?: 'MASTER' | 'GUEST';
    error?: string;
    code?: string;
  }> {
    try {
      if (!secret || typeof secret !== 'string') {
        return { success: false, error: '密钥不能为空', code: 'INVALID_INPUT' };
      }

      // 主密钥验证
      if (secret === getMasterSecret()) {
        return { success: true, role: 'MASTER' };
      }

      // 未来可扩展：用户数据库验证
      // const user = await userService.validateCredentials(username, secret);

      await auditAction(
        'LOGIN_FAILED',
        'GUEST',
        'session',
        'temp-session-id',
        { reason: 'invalid_secret' },
        'DENIED'
      );

      return { success: false, error: '密钥不正确', code: 'INVALID_SECRET' };
    } catch (error) {
      logger.error({ err: error }, '凭证验证失败');
      return { success: false, error: '验证过程出错', code: 'SERVER_ERROR' };
    }
  }

  /**
   * 创建用户会话
   */
  async createUserSession(req: Request): Promise<{
    success: boolean;
    sessionId?: string;
    role?: 'MASTER' | 'GUEST';
    error?: string;
  }>;
  async createUserSession(
    req: Request,
    role: 'MASTER' | 'GUEST',
    metadata?: { userId?: string; username?: string; method?: string }
  ): Promise<{
    success: boolean;
    sessionId?: string;
    role?: 'MASTER' | 'GUEST';
    error?: string;
  }>;
  async createUserSession(
    req: Request,
    role: 'MASTER' | 'GUEST' = 'MASTER',
    metadata: { userId?: string; username?: string; method?: string } = {}
  ): Promise<{
    success: boolean;
    sessionId?: string;
    role?: 'MASTER' | 'GUEST';
    error?: string;
  }> {
    return new Promise((resolve) => {
      req.session.regenerate((err: Error | undefined) => {
        if (err) {
          logger.error({ err }, '会话创建失败');
          resolve({ success: false, error: '会话创建失败' });
          return;
        }

        req.session.userRole = role;
        req.session.userId = metadata.userId;
        req.session.username = metadata.username;
        req.session.authenticatedAt = Date.now();
        req.userRole = role;
        const sessionId = (req as Request & { sessionID?: string }).sessionID || req.sessionId || 'session';

        auditAction(
          'LOGIN',
          role,
          'session',
          sessionId,
          { method: metadata.method || 'secret', userId: metadata.userId, username: metadata.username },
          'SUCCESS',
          req
        );

        resolve({
          success: true,
          sessionId,
          role,
        });
      });
    });
  }

  /**
   * 销毁用户会话
   */
  async destroyUserSession(req: Request): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const previousRole = req.session.userRole;
      const wasAuthenticated = !!req.session.authenticatedAt;

      req.session.destroy((err: Error | undefined) => {
        if (err) {
          logger.error({ err }, '会话销毁失败');
          resolve({ success: false, error: '会话销毁失败' });
          return;
        }

        if (wasAuthenticated) {
          auditAction(
            'LOGOUT',
            previousRole || 'GUEST',
            'session',
            'destroyed',
            {},
            'SUCCESS',
            req
          );
        }

        resolve({ success: true });
      });
    });
  }

  /**
   * 获取当前会话信息
   */
  getSessionInfo(req: Request): {
    authenticated: boolean;
    role: 'MASTER' | 'GUEST';
    authenticatedAt: number | null;
    user?: { id?: string; username?: string };
  } {
    const role = req.userRole === 'MASTER' ? 'MASTER' : 'GUEST';
    return {
      authenticated: Boolean(req.session?.authenticatedAt) || req.userRole === 'MASTER',
      role,
      authenticatedAt: req.session?.authenticatedAt || null,
      user: req.session?.userId || req.session?.username
        ? { id: req.session.userId, username: req.session.username }
        : undefined,
    };
  }

  /**
   * 生成WebSocket令牌
   */
  generateWsToken(role: 'MASTER' | 'GUEST' = 'GUEST'): {
    token: string;
    expiresAt: number;
    expiresIn: number;
    role: 'MASTER' | 'GUEST';
  } {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 30000; // 30秒
    const expiresIn = 30;

    wsTokens.set(token, { role, expiresAt });

    // 只记录角色和过期时间，不记录敏感token
    logger.debug({ role, expiresAt }, 'WebSocket令牌生成');

    return { token, expiresAt, expiresIn, role };
  }

  /**
   * 验证WebSocket令牌
   */
  validateWsToken(token: string): 'MASTER' | 'GUEST' | null {
    const data = wsTokens.get(token);
    if (!data) return null;

    wsTokens.delete(token);

    if (Date.now() > data.expiresAt) {
      return null;
    }

    return data.role;
  }

  /**
   * 清理过期令牌
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    Array.from(wsTokens.entries()).forEach(([token, data]) => {
      if (now > data.expiresAt) {
        wsTokens.delete(token);
      }
    });
  }

  /**
   * 获取认证统计信息
   */
  async getAuthStats(): Promise<{
    activeTokens: number;
    masterTokens: number;
    guestTokens: number;
  }> {
    let masterTokens = 0;
    let guestTokens = 0;

    wsTokens.forEach((data) => {
      if (data.role === 'MASTER') masterTokens++;
      else guestTokens++;
    });

    return {
      activeTokens: wsTokens.size,
      masterTokens,
      guestTokens,
    };
  }
}

// 创建并导出全局实例
export const authService = new AuthService();

// 启动定时清理任务
setInterval(() => {
  authService.cleanupExpiredTokens();
}, 60000);
