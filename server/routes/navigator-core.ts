/**
 * 领航者核心协议 API 路由 - Navigator-X v1.0
 *
 * HTTP端点:
 * - POST /api/navigator/nodes - 创建节点
 * - GET /api/navigator/nodes - 获取节点列表
 * - GET /api/navigator/nodes/:id - 获取节点详情
 * - POST /api/navigator/nodes/:id/suspend - 暂停节点
 * - POST /api/navigator/nodes/:id/revoke - 召回节点
 * - POST /api/navigator/nodes/:id/reactivate - 重新激活
 * - POST /api/navigator/tokens - 签发令牌
 * - POST /api/navigator/tokens/validate - 验证令牌
 * - GET /api/navigator/tokens - 获取令牌列表
 * - POST /api/navigator/fleets - 创建舰队
 * - GET /api/navigator/fleets - 获取舰队列表
 * - POST /api/navigator/emergency-recall - 紧急召回
 * - GET /api/navigator/audit - 获取审计日志
 * - GET /api/navigator/stats - 统计信息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('NavigatorRoutes');

import type { Express, Request, Response } from 'express';
import { navigatorCore } from '../services/navigator-core';
import type { RegisterRouteFn } from './types';

export const registerNavigatorRoutes: RegisterRouteFn = (app, storage, context) => {

  // 创建节点
  app.post('/api/navigator/nodes', async (req: Request, res: Response) => {
    try {
      const { name, type, capabilities, permissions, expiresIn, ipRestrictions, maxSessions } = req.body;

      if (!name || !capabilities || !Array.isArray(capabilities)) {
        return res.status(400).json({ error: '缺少必要参数: name, capabilities' });
      }

      const node = await navigatorCore.createNode({
        name,
        type,
        capabilities,
        permissions,
        expiresIn,
        ipRestrictions,
        maxSessions,
      });

      res.json({
        success: true,
        node: {
          id: node.id,
          name: node.name,
          type: node.type,
          status: node.status,
          capabilities: node.capabilities,
          permissionsCount: node.permissions.length,
          expiresAt: node.expiresAt,
        },
      });

    } catch (error) {
      res.status(500).json({
        error: '创建节点失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取节点列表
  app.get('/api/navigator/nodes', async (req: Request, res: Response) => {
    try {
      const { type, status } = req.query;

      const nodes = navigatorCore.listNodes({
        type: type as any,
        status: status as any,
      });

      res.json({
        nodes: nodes.map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
          status: n.status,
          capabilities: n.capabilities,
          createdAt: n.createdAt,
          lastActiveAt: n.lastActiveAt,
        })),
        count: nodes.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取节点列表失败' });
    }
  });

  // 获取节点详情
  app.get('/api/navigator/nodes/:id', async (req: Request, res: Response) => {
    try {
      const node = navigatorCore.getNode(req.params.id);
      if (!node) {
        return res.status(404).json({ error: '节点不存在' });
      }

      res.json({
        ...node,
        metadata: node.metadata,
      });

    } catch (error) {
      res.status(500).json({ error: '获取节点详情失败' });
    }
  });

  // 暂停节点
  app.post('/api/navigator/nodes/:id/suspend', async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      await navigatorCore.suspendNode(req.params.id, reason);
      res.json({ success: true, message: '节点已暂停' });
    } catch (error) {
      res.status(500).json({
        error: '暂停失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 召回节点
  app.post('/api/navigator/nodes/:id/revoke', async (req: Request, res: Response) => {
    try {
      await navigatorCore.revokeNode(req.params.id);
      res.json({ success: true, message: '节点已召回' });
    } catch (error) {
      res.status(500).json({
        error: '召回失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 重新激活节点
  app.post('/api/navigator/nodes/:id/reactivate', async (req: Request, res: Response) => {
    try {
      await navigatorCore.reactivateNode(req.params.id);
      res.json({ success: true, message: '节点已重新激活' });
    } catch (error) {
      res.status(500).json({
        error: '激活失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 签发令牌
  app.post('/api/navigator/tokens', async (req: Request, res: Response) => {
    try {
      const { entityId, type, expiresIn, maxUsage } = req.body;

      if (!entityId || !type || !expiresIn) {
        return res.status(400).json({ error: '缺少必要参数: entityId, type, expiresIn' });
      }

      const token = await navigatorCore.issueToken({
        entityId,
        type,
        expiresIn,
        maxUsage,
      });

      res.json({
        success: true,
        token: {
          id: token.id,
          token: token.token,
          type: token.type,
          expiresAt: token.expiresAt,
          maxUsage: token.maxUsage,
        },
      });

    } catch (error) {
      res.status(500).json({
        error: '签发令牌失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 验证令牌
  app.post('/api/navigator/tokens/validate', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: '缺少令牌' });
      }

      const result = await navigatorCore.validateToken(token);

      res.json({
        valid: result.valid,
        reason: result.reason,
        node: result.node ? {
          id: result.node.id,
          name: result.node.name,
          type: result.node.type,
          capabilities: result.node.capabilities,
        } : null,
      });

    } catch (error) {
      res.status(500).json({ error: '验证失败' });
    }
  });

  // 获取令牌列表
  app.get('/api/navigator/tokens', async (req: Request, res: Response) => {
    try {
      const { entityId } = req.query;
      const tokens = navigatorCore.listTokens(entityId as string);

      res.json({
        tokens: tokens.map(t => ({
          id: t.id,
          entityId: t.entityId,
          type: t.type,
          status: t.status,
          usageCount: t.usageCount,
          maxUsage: t.maxUsage,
          expiresAt: t.expiresAt,
          lastUsedAt: t.lastUsedAt,
        })),
        count: tokens.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取令牌列表失败' });
    }
  });

  // 创建舰队
  app.post('/api/navigator/fleets', async (req: Request, res: Response) => {
    try {
      const { name, leaderNodeId } = req.body;

      if (!name || !leaderNodeId) {
        return res.status(400).json({ error: '缺少必要参数: name, leaderNodeId' });
      }

      const fleet = await navigatorCore.createFleet(name, leaderNodeId);

      res.json({
        success: true,
        fleet: {
          id: fleet.id,
          name: fleet.name,
          membersCount: fleet.members.length,
        },
      });

    } catch (error) {
      res.status(500).json({
        error: '创建舰队失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取舰队列表
  app.get('/api/navigator/fleets', async (req: Request, res: Response) => {
    try {
      const fleets = navigatorCore.listFleets();

      res.json({
        fleets: fleets.map(f => ({
          id: f.id,
          name: f.name,
          membersCount: f.members.length,
          avgMoraleScore: f.aggregatedStats.avgMoraleScore,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
        count: fleets.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取舰队列表失败' });
    }
  });

  // 获取舰队详情
  app.get('/api/navigator/fleets/:id', async (req: Request, res: Response) => {
    try {
      const fleet = navigatorCore.getFleet(req.params.id);
      if (!fleet) {
        return res.status(404).json({ error: '舰队不存在' });
      }
      res.json(fleet);
    } catch (error) {
      res.status(500).json({ error: '获取舰队详情失败' });
    }
  });

  // 生成舰队洞察
  app.post('/api/navigator/fleets/:id/insights', async (req: Request, res: Response) => {
    try {
      const insights = await navigatorCore.generateFleetInsights(req.params.id);
      res.json({ insights });
    } catch (error) {
      res.status(500).json({
        error: '生成洞察失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 紧急召回
  app.post('/api/navigator/emergency-recall', async (req: Request, res: Response) => {
    try {
      const result = await navigatorCore.emergencyRecall();
      res.json({
        success: true,
        recalled: result.recalled,
        errors: result.errors,
        message: `已召回 ${result.recalled} 个节点`,
      });
    } catch (error) {
      res.status(500).json({ error: '紧急召回失败' });
    }
  });

  // 获取审计日志
  app.get('/api/navigator/audit', async (req: Request, res: Response) => {
    try {
      const { entityId, action, limit } = req.query;

      const logs = navigatorCore.getAuditLog({
        entityId: entityId as string,
        action: action as string,
        limit: limit ? parseInt(limit as string) : 100,
      });

      res.json({
        logs,
        count: logs.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取审计日志失败' });
    }
  });

  // 统计信息
  app.get('/api/navigator/stats', async (req: Request, res: Response) => {
    try {
      const stats = navigatorCore.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        system: 'Navigator-X',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  app.get('/api/navigator/pending-reports', async (_req: Request, res: Response) => {
    res.json([]);
  });

  app.get('/api/navigator/alerts', async (_req: Request, res: Response) => {
    res.json([]);
  });

  // 权限检查
  app.post('/api/navigator/check-permission', async (req: Request, res: Response) => {
    try {
      const { entityId, resource, action, context } = req.body;

      if (!entityId || !resource || !action) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const hasPermission = navigatorCore.checkPermission(entityId, resource, action, context);

      res.json({ hasPermission });

    } catch (error) {
      res.status(500).json({ error: '权限检查失败' });
    }
  });

  logger.info('[Navigator] HTTP路由已注册 /api/navigator/*');
};

// 向后兼容别名
export const registerSwarmRoutes = registerNavigatorRoutes;
