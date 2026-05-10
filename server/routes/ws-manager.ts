/**
 * WebSocket管理 API 路由 - 技术债务清理
 *
 * HTTP端点:
 * - GET /api/ws/stats - 连接统计
 * - GET /api/ws/connections - 连接列表
 * - GET /api/ws/config - 获取配置
 * - PUT /api/ws/config - 更新配置
 * - DELETE /api/ws/connection/:id - 断开连接
 * - POST /api/ws/broadcast - 广播消息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('WsManager');

import type { Express, Request, Response } from 'express';
import { wsManager, type PoolConfig, type ConnectionInfo } from '../services/websocket-manager';
import type { RegisterRouteFn } from './types';

export const registerWSManagerRoutes: RegisterRouteFn = (app, storage, context) => {

  // 连接统计
  app.get('/api/ws/stats', async (req: Request, res: Response) => {
    try {
      const stats = wsManager.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 连接列表
  app.get('/api/ws/connections', async (req: Request, res: Response) => {
    try {
      const { type, userId, limit = 100 } = req.query;

      let connections: ReturnType<typeof wsManager.getConnectionsByType> = [];
      if (type) {
        connections = wsManager.getConnectionsByType(type as ConnectionInfo['type']);
      } else if (userId) {
        connections = wsManager.getConnectionsByUser(userId as string);
      } else {
        // 获取所有连接的基本信息（不暴露敏感数据）
        connections = [];
        // 需要从wsManager获取所有连接
      }

      const result = connections.slice(0, Number(limit)).map(info => ({
        id: info.id,
        userId: info.userId,
        deviceId: info.deviceId,
        type: info.type,
        connectedAt: info.connectedAt,
        lastPongAt: info.lastPongAt,
        isAlive: info.isAlive,
        pingCount: info.pingCount,
        missedPongs: info.missedPongs,
        connectionDuration: Date.now() - info.connectedAt,
      }));

      res.json({
        connections: result,
        count: result.length,
        total: wsManager.getStats().total,
      });
    } catch (error) {
      res.status(500).json({ error: '获取连接列表失败' });
    }
  });

  // 获取配置
  app.get('/api/ws/config', async (req: Request, res: Response) => {
    try {
      const config = wsManager.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: '获取配置失败' });
    }
  });

  // 更新配置
  app.put('/api/ws/config', async (req: Request, res: Response) => {
    try {
      const updates: Partial<PoolConfig> = {};
      const allowedKeys: (keyof PoolConfig)[] = [
        'maxConnections',
        'maxConnectionsPerUser',
        'heartbeatInterval',
        'heartbeatTimeout',
        'maxMissedPongs',
        'cleanupInterval',
        'connectionTimeout',
      ];

      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
          (updates as Partial<Record<keyof PoolConfig, unknown>>)[key] = req.body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: '没有有效的配置更新' });
      }

      wsManager.updateConfig(updates);

      res.json({
        success: true,
        updated: updates,
        config: wsManager.getConfig(),
      });
    } catch (error) {
      res.status(500).json({ error: '更新配置失败' });
    }
  });

  // 断开连接
  app.delete('/api/ws/connection/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const connection = wsManager.getConnection(id);

      if (!connection) {
        return res.status(404).json({ error: '连接不存在' });
      }

      const success = wsManager.unregister(id);

      res.json({
        success,
        connectionId: id,
        message: success ? '连接已断开' : '断开失败',
      });
    } catch (error) {
      res.status(500).json({ error: '断开连接失败' });
    }
  });

  // 广播消息
  app.post('/api/ws/broadcast', async (req: Request, res: Response) => {
    try {
      const { message, type, userId } = req.body;

      if (!message) {
        return res.status(400).json({ error: '缺少消息内容' });
      }

      let sent = 0;

      if (userId) {
        sent = wsManager.broadcastToUser(userId, message);
      } else if (type) {
        sent = wsManager.broadcastToType(type, message);
      } else {
        sent = wsManager.broadcast(message);
      }

      res.json({
        success: true,
        sentTo: sent,
        filter: { type, userId },
      });
    } catch (error) {
      res.status(500).json({ error: '广播失败' });
    }
  });

  // 按用户断开连接
  app.delete('/api/ws/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const connections = wsManager.getConnectionsByUser(userId);

      let closed = 0;
      for (const conn of connections) {
        if (wsManager.unregister(conn.id)) {
          closed++;
        }
      }

      res.json({
        success: true,
        userId,
        closedConnections: closed,
      });
    } catch (error) {
      res.status(500).json({ error: '断开用户连接失败' });
    }
  });

  // 按类型断开连接
  app.delete('/api/ws/type/:type', async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const connections = wsManager.getConnectionsByType(type as ConnectionInfo['type']);

      let closed = 0;
      for (const conn of connections) {
        if (wsManager.unregister(conn.id)) {
          closed++;
        }
      }

      res.json({
        success: true,
        type,
        closedConnections: closed,
      });
    } catch (error) {
      res.status(500).json({ error: '断开类型连接失败' });
    }
  });

  logger.info('[WSManager] HTTP路由已注册 /api/ws/*');
};
