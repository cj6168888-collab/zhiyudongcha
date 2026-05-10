import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Auth');

import type { Express } from "express";
import type { IStorage } from "../storage";
import { authService } from "../services/AuthService";

export function validateWsToken(token: string): 'MASTER' | 'GUEST' | null {
  return authService.validateWsToken(token);
}

export function registerAuthRoutes(app: Express, storage: IStorage): void {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { secret } = req.body;

      if (!secret || typeof secret !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: "密钥不能为空"
          }
        });
      }

      const validation = await authService.validateCredentials(secret);
      if (!validation.success) {
        return res.status(401).json({
          success: false,
          error: {
            code: validation.code || 'INVALID_SECRET',
            message: validation.error || "密钥不正确"
          }
        });
      }

      const sessionResult = await authService.createUserSession(req);
      if (!sessionResult.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_ERROR',
            message: sessionResult.error || "登录失败"
          }
        });
      }

      return res.json({
        success: true,
        data: {
          role: sessionResult.role,
          message: sessionResult.role === 'MASTER' ? '主人，欢迎回来～' : '欢迎使用'
        }
      });
    } catch (error) {
      logger.error({ err: error }, 'Login error');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: "登录失败"
        }
      });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const result = await authService.destroyUserSession(req);
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'LOGOUT_ERROR',
            message: result.error || "登出失败"
          }
        });
      }

      res.clearCookie('connect.sid');
      return res.json({
        success: true,
        data: { message: '已安全登出' }
      });
    } catch (error) {
      logger.error({ err: error }, 'Logout error');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: "登出失败"
        }
      });
    }
  });

  app.get("/api/auth/session", (req, res) => {
    const sessionInfo = authService.getSessionInfo(req);
    return res.json({
      success: true,
      data: sessionInfo
    });
  });

  app.post("/api/auth/ws-token", (req, res) => {
    const role = req.userRole || 'GUEST';
    const { token, expiresIn, expiresAt } = authService.generateWsToken(role as 'MASTER' | 'GUEST');

    return res.json({
      success: true,
      data: {
        token,
        expiresIn,
        expiresAt,
        role
      }
    });
  });
}
