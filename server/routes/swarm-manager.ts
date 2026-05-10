/**
 * 蜂群管理协议 API 路由 - Phase 11.3
 * 
 * HTTP端点:
 * - POST /api/swarm/entities - 创建子体
 * - GET /api/swarm/entities - 获取子体列表
 * - GET /api/swarm/entities/:id - 获取子体详情
 * - POST /api/swarm/entities/:id/suspend - 暂停子体
 * - POST /api/swarm/entities/:id/revoke - 召回子体
 * - POST /api/swarm/entities/:id/reactivate - 重新激活
 * - POST /api/swarm/tokens - 签发令牌
 * - POST /api/swarm/tokens/validate - 验证令牌
 * - GET /api/swarm/tokens - 获取令牌列表
 * - POST /api/swarm/teams - 创建团队
 * - GET /api/swarm/teams - 获取团队列表
 * - POST /api/swarm/emergency-recall - 紧急召回
 * - GET /api/swarm/audit - 获取审计日志
 * - GET /api/swarm/stats - 统计信息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SwarmManager');

import type { Express, Request, Response } from 'express';
import { swarmManager } from '../services/swarm-manager';
import type { RegisterRouteFn } from './types';

export const registerSwarmRoutes: RegisterRouteFn = (app, storage, context) => {

  // 创建子体
  app.post('/api/swarm/entities', async (req: Request, res: Response) => {
    try {
      const { name, type, capabilities, permissions, expiresIn, ipRestrictions, maxSessions } = req.body;

      if (!name || !capabilities || !Array.isArray(capabilities)) {
        return res.status(400).json({ error: '缺少必要参数: name, capabilities' });
      }

      const entity = await swarmManager.createClone({
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
        entity: {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          status: entity.status,
          capabilities: entity.capabilities,
          permissionsCount: entity.permissions.length,
          expiresAt: entity.expiresAt,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '创建子体失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取子体列表
  app.get('/api/swarm/entities', async (req: Request, res: Response) => {
    try {
      const { type, status } = req.query;

      const entities = swarmManager.listEntities({
        type: type as any,
        status: status as any,
      });

      res.json({
        entities: entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          status: e.status,
          capabilities: e.capabilities,
          createdAt: e.createdAt,
          lastActiveAt: e.lastActiveAt,
        })),
        count: entities.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取子体列表失败' });
    }
  });

  // 获取子体详情
  app.get('/api/swarm/entities/:id', async (req: Request, res: Response) => {
    try {
      const entity = swarmManager.getEntity(req.params.id);
      if (!entity) {
        return res.status(404).json({ error: '子体不存在' });
      }

      res.json({
        ...entity,
        metadata: entity.metadata,
      });

    } catch (error) {
      res.status(500).json({ error: '获取子体详情失败' });
    }
  });

  // 暂停子体
  app.post('/api/swarm/entities/:id/suspend', async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      await swarmManager.suspendEntity(req.params.id, reason);
      res.json({ success: true, message: '子体已暂停' });
    } catch (error) {
      res.status(500).json({ 
        error: '暂停失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 召回子体
  app.post('/api/swarm/entities/:id/revoke', async (req: Request, res: Response) => {
    try {
      await swarmManager.revokeEntity(req.params.id);
      res.json({ success: true, message: '子体已召回' });
    } catch (error) {
      res.status(500).json({ 
        error: '召回失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 重新激活子体
  app.post('/api/swarm/entities/:id/reactivate', async (req: Request, res: Response) => {
    try {
      await swarmManager.reactivateEntity(req.params.id);
      res.json({ success: true, message: '子体已重新激活' });
    } catch (error) {
      res.status(500).json({ 
        error: '激活失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 签发令牌
  app.post('/api/swarm/tokens', async (req: Request, res: Response) => {
    try {
      const { entityId, type, expiresIn, maxUsage } = req.body;

      if (!entityId || !type || !expiresIn) {
        return res.status(400).json({ error: '缺少必要参数: entityId, type, expiresIn' });
      }

      const token = await swarmManager.issueToken({
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
  app.post('/api/swarm/tokens/validate', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: '缺少令牌' });
      }

      const result = await swarmManager.validateToken(token);

      res.json({
        valid: result.valid,
        reason: result.reason,
        entity: result.entity ? {
          id: result.entity.id,
          name: result.entity.name,
          type: result.entity.type,
          capabilities: result.entity.capabilities,
        } : null,
      });

    } catch (error) {
      res.status(500).json({ error: '验证失败' });
    }
  });

  // 获取令牌列表
  app.get('/api/swarm/tokens', async (req: Request, res: Response) => {
    try {
      const { entityId } = req.query;
      const tokens = swarmManager.listTokens(entityId as string);

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

  // 创建团队
  app.post('/api/swarm/teams', async (req: Request, res: Response) => {
    try {
      const { name, leaderEntityId } = req.body;

      if (!name || !leaderEntityId) {
        return res.status(400).json({ error: '缺少必要参数: name, leaderEntityId' });
      }

      const team = await swarmManager.createTeam(name, leaderEntityId);

      res.json({
        success: true,
        team: {
          id: team.id,
          name: team.name,
          membersCount: team.members.length,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '创建团队失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取团队列表
  app.get('/api/swarm/teams', async (req: Request, res: Response) => {
    try {
      const teams = swarmManager.listTeams();

      res.json({
        teams: teams.map(t => ({
          id: t.id,
          name: t.name,
          membersCount: t.members.length,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        count: teams.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取团队列表失败' });
    }
  });

  // 获取团队详情
  app.get('/api/swarm/teams/:id', async (req: Request, res: Response) => {
    try {
      const team = swarmManager.getTeam(req.params.id);
      if (!team) {
        return res.status(404).json({ error: '团队不存在' });
      }
      res.json(team);
    } catch (error) {
      res.status(500).json({ error: '获取团队详情失败' });
    }
  });

  // 生成团队洞察
  app.post('/api/swarm/teams/:id/insights', async (req: Request, res: Response) => {
    try {
      const insights = await swarmManager.generateTeamInsights(req.params.id);
      res.json({ insights });
    } catch (error) {
      res.status(500).json({ 
        error: '生成洞察失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 紧急召回
  app.post('/api/swarm/emergency-recall', async (req: Request, res: Response) => {
    try {
      const result = await swarmManager.emergencyRecall();
      res.json({
        success: true,
        recalled: result.recalled,
        errors: result.errors,
        message: `已召回 ${result.recalled} 个子体`,
      });
    } catch (error) {
      res.status(500).json({ error: '紧急召回失败' });
    }
  });

  // 获取审计日志
  app.get('/api/swarm/audit', async (req: Request, res: Response) => {
    try {
      const { entityId, action, limit } = req.query;

      const logs = swarmManager.getAuditLog({
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
  app.get('/api/swarm/stats', async (req: Request, res: Response) => {
    try {
      const stats = swarmManager.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '11.3',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 权限检查
  app.post('/api/swarm/check-permission', async (req: Request, res: Response) => {
    try {
      const { entityId, resource, action, context } = req.body;

      if (!entityId || !resource || !action) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const hasPermission = swarmManager.checkPermission(entityId, resource, action, context);

      res.json({ hasPermission });

    } catch (error) {
      res.status(500).json({ error: '权限检查失败' });
    }
  });

  logger.info('[Swarm] HTTP路由已注册 /api/swarm/*');
};
