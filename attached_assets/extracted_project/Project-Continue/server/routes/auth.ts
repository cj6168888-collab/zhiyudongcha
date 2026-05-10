import type { Express } from "express";
import type { IStorage } from "../storage";
import { auditAction, getMasterSecret } from "../middleware/auth";
import crypto from "crypto";

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

setInterval(() => {
  const now = Date.now();
  Array.from(wsTokens.entries()).forEach(([token, data]) => {
    if (now > data.expiresAt) {
      wsTokens.delete(token);
    }
  });
}, 60000);

export function registerAuthRoutes(app: Express, storage: IStorage): void {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { secret } = req.body;
      
      if (!secret || typeof secret !== 'string') {
        return res.status(400).json({ error: "密钥不能为空", code: "INVALID_INPUT" });
      }
      
      if (secret === getMasterSecret()) {
        req.session.regenerate((err) => {
          if (err) {
            console.error('[Auth] Session regenerate error:', err);
            return res.status(500).json({ error: "登录失败", code: "SESSION_ERROR" });
          }
          
          req.session.userRole = 'MASTER';
          req.session.authenticatedAt = Date.now();
          req.userRole = 'MASTER';
          
          auditAction(
            'LOGIN',
            'MASTER',
            'session',
            req.sessionID,
            { method: 'secret' },
            'SUCCESS',
            req
          );
          
          return res.json({ 
            success: true, 
            role: 'MASTER',
            message: '主人，欢迎回来～'
          });
        });
        return;
      } else {
        await auditAction(
          'LOGIN_FAILED',
          'GUEST',
          'session',
          req.sessionID,
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
      console.error('[Auth] Login error:', error);
      return res.status(500).json({ error: "登录失败", code: "SERVER_ERROR" });
    }
  });
  
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const previousRole = req.session.userRole;
      
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth] Session destroy error:', err);
          return res.status(500).json({ error: "登出失败" });
        }
        
        res.clearCookie('connect.sid');
        return res.json({ success: true, message: '已安全登出' });
      });
      
      if (previousRole === 'MASTER') {
        await auditAction(
          'LOGOUT',
          'MASTER',
          'session',
          'destroyed',
          {},
          'SUCCESS',
          req
        );
      }
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      return res.status(500).json({ error: "登出失败" });
    }
  });
  
  app.get("/api/auth/session", (req, res) => {
    return res.json({
      authenticated: req.userRole === 'MASTER',
      role: req.userRole || 'GUEST',
      authenticatedAt: req.session?.authenticatedAt || null,
    });
  });
  
  app.post("/api/auth/ws-token", (req, res) => {
    const role = req.userRole || 'GUEST';
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 30000;
    
    wsTokens.set(token, { role, expiresAt });
    
    return res.json({
      token,
      expiresIn: 30,
      role,
    });
  });
}
