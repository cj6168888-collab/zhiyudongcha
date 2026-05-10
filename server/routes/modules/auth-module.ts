/**
 * 认证路由模块示例
 * 展示新的模块化路由架构
 */

import { Router } from 'express';
import { createServiceLogger } from '../../lib/logger';
import { userService } from '../../services/UserService';
import { getMasterSecret, auditAction } from '../../middleware/auth';

const logger = createServiceLogger('AuthModule');
const router = Router();

// WebSocket令牌管理（从原auth.ts迁移）
const wsTokens = new Map<string, { role: 'MASTER' | 'GUEST'; expiresAt: number }>();

export function validateWsToken(token: string): 'MASTER' | 'GUEST' | null {
  const data = wsTokens.get(token);
  if (!data) return null;

  wsTokens.delete(token);

  if (Date.now() > data.expiresAt) {
    return null;
  }
  return data.role;
}

// 清理过期令牌
setInterval(() => {
  const now = Date.now();
  Array.from(wsTokens.entries()).forEach(([token, data]) => {
    if (now > data.expiresAt) {
      wsTokens.delete(token);
    }
  });
}, 60000);

/**
 * 登录接口
 */
router.post('/login', async (req, res) => {
  try {
    const { secret } = req.body;

    if (!secret || typeof secret !== 'string') {
      return res.status(400).json({ error: "密钥不能为空", code: "INVALID_INPUT" });
    }

    if (secret === getMasterSecret()) {
      // 这里应该有真正的session处理
      // 简化示例
      auditAction(
        'LOGIN',
        'MASTER',
        'session',
        'temp-session-id',
        { method: 'secret' },
        'SUCCESS',
        req
      );

      return res.json({
        success: true,
        role: 'MASTER',
        message: '主人，欢迎回来～'
      });
    } else {
      await auditAction(
        'LOGIN_FAILED',
        'GUEST',
        'session',
        'temp-session-id',
        { reason: 'invalid_secret' },
        'DENIED',
        req
      );

      return res.status(401).json({
        error: "密钥不正确",
        code: "INVALID_SECRET"
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    return res.status(500).json({ error: "登录失败", code: "SERVER_ERROR" });
  }
});

/**
 * 登出接口
 */
router.post('/logout', async (req, res) => {
  try {
    // 简化示例 - 实际应该有session销毁逻辑
    auditAction(
      'LOGOUT',
      'MASTER',
      'session',
      'temp-session-id',
      {},
      'SUCCESS',
      req
    );

    return res.json({
      success: true,
      message: '已登出'
    });
  } catch (error) {
    logger.error({ err: error }, 'Logout error');
    return res.status(500).json({ error: "登出失败" });
  }
});

/**
 * 生成WebSocket令牌
 */
router.post('/ws-token', async (req, res) => {
  try {
    const { role = 'GUEST' } = req.body;

    if (role === 'MASTER') {
      const { secret } = req.body;
      if (secret !== getMasterSecret()) {
        return res.status(401).json({ error: "无效的MASTER密钥" });
      }
    }

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效

    wsTokens.set(token, { role: role as 'MASTER' | 'GUEST', expiresAt });

    return res.json({
      token,
      expiresAt,
      role,
      expiresIn: '5m'
    });
  } catch (error) {
    logger.error({ err: error }, 'WS token generation error');
    return res.status(500).json({ error: "令牌生成失败" });
  }
});

/**
 * 用户信息接口（示例使用UserService）
 */
router.get('/profile', async (req, res) => {
  try {
    // 示例：从header获取用户ID
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(400).json({ error: "缺少用户ID" });
    }

    // 使用UserService获取用户信息
    const user = await userService.getUser(userId);

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        // 其他字段...
      }
    });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && (error as Error).statusCode === 404) {
      return res.status(404).json({ error: "用户不存在" });
    }
    logger.error({ err: error }, '获取用户信息失败');
    return res.status(500).json({ error: "获取用户信息失败" });
  }
});

export default router;
