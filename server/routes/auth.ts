import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Auth');

import type { Express } from "express";
import type { IStorage } from "../storage";
import { authService } from "../services/AuthService";
import { userService } from "../services/UserService";
import { smsVerificationService } from "../services/sms-verification";
import { BusinessError, ErrorCode, isBusinessError } from "../lib/errors";

export function validateWsToken(token: string): 'MASTER' | 'GUEST' | null {
  return authService.validateWsToken(token);
}

export function registerAuthRoutes(app: Express, storage: IStorage): void {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { secret, username, password } = req.body;

      if (username || password) {
        if (typeof username !== 'string' || typeof password !== 'string') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: '用户名和密码不能为空'
            }
          });
        }

        const user = await userService.validatePassword(username, password);
        if (!user) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: '用户名或密码错误'
            }
          });
        }

        const sessionResult = await authService.createUserSession(req, 'GUEST', {
          userId: user.id,
          username: user.username,
          method: 'password',
        });
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
            role: 'GUEST',
            user: {
              id: user.id,
              username: user.username,
            },
            message: '登录成功'
          }
        });
      }

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

  app.post("/api/auth/sms/send", async (req, res) => {
    try {
      const { phone, scene } = req.body;
      if (typeof phone !== 'string' || typeof scene !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '手机号和验证码场景不能为空'
          }
        });
      }

      const result = await smsVerificationService.sendCode(phone, scene);
      return res.json({
        success: true,
        data: result,
        message: '验证码已发送'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '验证码发送失败';
      logger.warn({ err: error }, 'SMS send error');
      return res.status(message.includes('频繁') || message.includes('后再获取') ? 429 : 400).json({
        success: false,
        error: {
          code: 'SMS_SEND_FAILED',
          message
        }
      });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { phone, password, code } = req.body;
      if (typeof phone !== 'string' || typeof password !== 'string' || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '手机号、密码和验证码不能为空'
          }
        });
      }

      const normalizedPhone = smsVerificationService.normalizePhone(phone);
      const existing = await userService.getUserByUsername(normalizedPhone);
      if (existing) {
        throw new BusinessError('手机号已注册', ErrorCode.CONFLICT, 409);
      }

      smsVerificationService.verifyCode(phone, 'register', code);
      const user = await userService.createUserWithPassword(normalizedPhone, password);
      const sessionResult = await authService.createUserSession(req, 'GUEST', {
        userId: user.id,
        username: user.username,
        method: 'sms_register',
      });
      if (!sessionResult.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_ERROR',
            message: sessionResult.error || "注册成功，但登录失败"
          }
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          role: 'GUEST',
          user: {
            id: user.id,
            username: user.username,
          },
          message: '注册成功'
        }
      });
    } catch (error) {
      logger.warn({ err: error }, 'Register error');
      const status = isBusinessError(error) ? error.statusCode : 400;
      const code = isBusinessError(error) ? error.code : 'REGISTER_FAILED';
      const message = error instanceof Error ? error.message : '注册失败';
      return res.status(status).json({
        success: false,
        error: { code, message }
      });
    }
  });

  app.post("/api/auth/password/reset", async (req, res) => {
    try {
      const { phone, code, newPassword } = req.body;
      if (typeof phone !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '手机号、验证码和新密码不能为空'
          }
        });
      }

      const normalizedPhone = smsVerificationService.normalizePhone(phone);
      const existing = await userService.getUserByUsername(normalizedPhone);
      if (!existing) {
        throw new BusinessError('账号不存在', ErrorCode.NOT_FOUND, 404);
      }

      smsVerificationService.verifyCode(phone, 'reset_password', code);
      await userService.resetPassword(normalizedPhone, newPassword);
      return res.json({
        success: true,
        data: { message: '密码已重置，请重新登录' }
      });
    } catch (error) {
      logger.warn({ err: error }, 'Password reset error');
      const status = isBusinessError(error) ? error.statusCode : 400;
      const code = isBusinessError(error) ? error.code : 'RESET_PASSWORD_FAILED';
      const message = error instanceof Error ? error.message : '密码重置失败';
      return res.status(status).json({
        success: false,
        error: { code, message }
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
