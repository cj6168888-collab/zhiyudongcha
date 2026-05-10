/**
 * 技术狩猎系统 API 路由 - Phase 11.2
 * 
 * HTTP端点:
 * - GET /api/tech/sources - 获取技术源列表
 * - POST /api/tech/scan - 扫描技术源
 * - GET /api/tech/discoveries - 获取技术发现
 * - POST /api/tech/evaluate - 评估技术
 * - GET /api/tech/plugins - 获取插件列表
 * - POST /api/tech/propose - 提交升级提案
 * - GET /api/tech/proposals - 获取提案列表
 * - POST /api/tech/approve - 批准提案
 * - GET /api/tech/report - 获取每日报告
 * - GET /api/tech/stats - 统计信息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('TechHunter');

import type { Express, Request, Response } from 'express';
import { techHunter } from '../services/tech-hunter';
import type { RegisterRouteFn } from './types';

export const registerTechHunterRoutes: RegisterRouteFn = (app, storage, context) => {

  // 获取技术源列表
  app.get('/api/tech/sources', async (req: Request, res: Response) => {
    try {
      const sources = techHunter.listSources();
      res.json({
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          enabled: s.enabled,
          lastChecked: s.lastChecked,
          filtersCount: s.filters.length,
        })),
        count: sources.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取技术源失败' });
    }
  });

  // 扫描技术源
  app.post('/api/tech/scan', async (req: Request, res: Response) => {
    try {
      const { sourceId, scanAll } = req.body;

      let discoveries;
      if (scanAll) {
        discoveries = await techHunter.scanAllSources();
      } else if (sourceId) {
        discoveries = await techHunter.scanSource(sourceId);
      } else {
        return res.status(400).json({ error: '需要指定sourceId或设置scanAll=true' });
      }

      res.json({
        success: true,
        discoveries: discoveries.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          score: d.score,
          status: d.status,
        })),
        count: discoveries.length,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '扫描失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取技术发现
  app.get('/api/tech/discoveries', async (req: Request, res: Response) => {
    try {
      const { status, type, limit, sortBy } = req.query;

      const discoveries = techHunter.listDiscoveries({
        status: status as string,
        type: type as any,
        limit: limit ? parseInt(limit as string) : 20,
        sortBy: (sortBy as any) || 'score',
      });

      res.json({
        discoveries: discoveries.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          description: d.description,
          url: d.url,
          score: d.score,
          relevance: d.relevance,
          status: d.status,
          discoveredAt: d.discoveredAt,
          metadata: d.metadata,
        })),
        count: discoveries.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取发现失败' });
    }
  });

  // 评估技术
  app.post('/api/tech/evaluate', async (req: Request, res: Response) => {
    try {
      const { discoveryId } = req.body;

      if (!discoveryId) {
        return res.status(400).json({ error: '缺少必要参数: discoveryId' });
      }

      const evaluation = await techHunter.evaluateDiscovery(discoveryId);

      res.json({
        success: true,
        evaluation: {
          discoveryId: evaluation.discoveryId,
          scores: evaluation.scores,
          overallScore: evaluation.overallScore,
          recommendation: evaluation.recommendation,
          risks: evaluation.risks,
          benefits: evaluation.benefits,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '评估失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取插件列表
  app.get('/api/tech/plugins', async (req: Request, res: Response) => {
    try {
      const plugins = techHunter.listPlugins();
      res.json({
        plugins: plugins.map(p => ({
          id: p.id,
          name: p.name,
          version: p.version,
          type: p.type,
          enabled: p.enabled,
          loadedAt: p.loadedAt,
        })),
        count: plugins.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取插件失败' });
    }
  });

  // 提交升级提案
  app.post('/api/tech/propose', async (req: Request, res: Response) => {
    try {
      const { discoveryId, targetPluginId } = req.body;

      if (!discoveryId || !targetPluginId) {
        return res.status(400).json({ error: '缺少必要参数: discoveryId, targetPluginId' });
      }

      const proposal = await techHunter.proposeUpgrade(discoveryId, targetPluginId);

      res.json({
        success: true,
        proposal: {
          id: proposal.id,
          currentPlugin: proposal.currentPlugin,
          proposedVersion: proposal.proposedVersion,
          status: proposal.status,
          recommendation: proposal.evaluation.recommendation,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '提案创建失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取提案列表
  app.get('/api/tech/proposals', async (req: Request, res: Response) => {
    try {
      const proposals = techHunter.listProposals();
      res.json({
        proposals: proposals.map(p => ({
          id: p.id,
          currentPlugin: p.currentPlugin,
          proposedVersion: p.proposedVersion,
          discoveryName: p.discovery.name,
          recommendation: p.evaluation.recommendation,
          overallScore: p.evaluation.overallScore,
          status: p.status,
          createdAt: p.createdAt,
        })),
        count: proposals.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取提案失败' });
    }
  });

  // 批准提案
  app.post('/api/tech/approve', async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.body;

      if (!proposalId) {
        return res.status(400).json({ error: '缺少必要参数: proposalId' });
      }

      await techHunter.approveProposal(proposalId);

      res.json({
        success: true,
        message: '提案已批准',
      });

    } catch (error) {
      res.status(500).json({ 
        error: '批准失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取每日报告
  app.get('/api/tech/report', async (req: Request, res: Response) => {
    try {
      const report = await techHunter.generateDailyReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: '生成报告失败' });
    }
  });

  // 统计信息
  app.get('/api/tech/stats', async (req: Request, res: Response) => {
    try {
      const stats = techHunter.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '11.2',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 启动/停止自动扫描
  app.post('/api/tech/auto-scan', async (req: Request, res: Response) => {
    try {
      const { action, intervalMinutes } = req.body;

      if (action === 'start') {
        techHunter.startAutoScan(intervalMinutes || 360);
        res.json({ success: true, message: '自动扫描已启动' });
      } else if (action === 'stop') {
        techHunter.stopAutoScan();
        res.json({ success: true, message: '自动扫描已停止' });
      } else {
        res.status(400).json({ error: 'action必须是start或stop' });
      }

    } catch (error) {
      res.status(500).json({ error: '操作失败' });
    }
  });

  logger.info('[TechHunter] HTTP路由已注册 /api/tech/*');
};
