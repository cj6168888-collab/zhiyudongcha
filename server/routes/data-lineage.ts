/**
 * 数据血缘追踪 API 路由 - Phase 11.5
 * 
 * HTTP端点:
 * - POST /api/lineage/nodes - 注册数据节点
 * - GET /api/lineage/nodes - 获取节点列表
 * - GET /api/lineage/nodes/:id - 获取节点详情
 * - POST /api/lineage/edges - 创建数据边
 * - GET /api/lineage/edges - 获取边列表
 * - GET /api/lineage/trace/upstream/:id - 上游追踪
 * - GET /api/lineage/trace/downstream/:id - 下游追踪
 * - GET /api/lineage/impact/:id - 影响分析
 * - POST /api/lineage/issues - 报告质量问题
 * - GET /api/lineage/issues - 获取问题列表
 * - GET /api/lineage/export - 导出图谱
 * - GET /api/lineage/stats - 统计信息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('DataLineage');

import type { Express, Request, Response } from 'express';
import { dataLineage } from '../services/data-lineage';
import type { RegisterRouteFn } from './types';

export const registerDataLineageRoutes: RegisterRouteFn = (app, storage, context) => {

  // 注册数据节点
  app.post('/api/lineage/nodes', async (req: Request, res: Response) => {
    try {
      const { name, type, source, schema, metadata } = req.body;

      if (!name || !type || !source) {
        return res.status(400).json({ error: '缺少必要参数: name, type, source' });
      }

      const node = dataLineage.registerNode({ name, type, source, schema, metadata });

      res.json({
        success: true,
        node: {
          id: node.id,
          name: node.name,
          type: node.type,
          qualityScore: node.qualityScore,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '注册节点失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取节点列表
  app.get('/api/lineage/nodes', async (req: Request, res: Response) => {
    try {
      const { type, system } = req.query;

      const nodes = dataLineage.listNodes({
        type: type as any,
        system: system as string,
      });

      res.json({
        nodes: nodes.map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
          system: n.source.system,
          qualityScore: n.qualityScore,
          lastAccessedAt: n.lastAccessedAt,
        })),
        count: nodes.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取节点列表失败' });
    }
  });

  // 获取节点详情
  app.get('/api/lineage/nodes/:id', async (req: Request, res: Response) => {
    try {
      const node = dataLineage.getNode(req.params.id);
      if (!node) {
        return res.status(404).json({ error: '节点不存在' });
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: '获取节点详情失败' });
    }
  });

  // 创建数据边
  app.post('/api/lineage/edges', async (req: Request, res: Response) => {
    try {
      const { sourceId, targetId, type, transformation, frequency, metadata } = req.body;

      if (!sourceId || !targetId || !type || !frequency) {
        return res.status(400).json({ error: '缺少必要参数: sourceId, targetId, type, frequency' });
      }

      const edge = dataLineage.createEdge({ sourceId, targetId, type, transformation, frequency, metadata });

      res.json({
        success: true,
        edge: {
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          type: edge.type,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '创建边失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取边列表
  app.get('/api/lineage/edges', async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.query;
      const edges = dataLineage.listEdges(nodeId as string);

      res.json({
        edges: edges.map(e => ({
          id: e.id,
          sourceId: e.sourceId,
          targetId: e.targetId,
          type: e.type,
          frequency: e.frequency,
          lastFlowAt: e.lastFlowAt,
        })),
        count: edges.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取边列表失败' });
    }
  });

  // 上游追踪
  app.get('/api/lineage/trace/upstream/:id', async (req: Request, res: Response) => {
    try {
      const maxDepth = parseInt(req.query.maxDepth as string) || 10;
      const path = dataLineage.traceUpstream(req.params.id, maxDepth);

      res.json({
        nodeId: req.params.id,
        direction: 'upstream',
        path: {
          nodes: path.nodes.map(n => ({ id: n.id, name: n.name, type: n.type })),
          edges: path.edges.map(e => ({ id: e.id, type: e.type })),
          depth: path.depth,
          totalTransformations: path.totalTransformations,
        },
      });

    } catch (error) {
      res.status(500).json({ error: '上游追踪失败' });
    }
  });

  // 下游追踪
  app.get('/api/lineage/trace/downstream/:id', async (req: Request, res: Response) => {
    try {
      const maxDepth = parseInt(req.query.maxDepth as string) || 10;
      const path = dataLineage.traceDownstream(req.params.id, maxDepth);

      res.json({
        nodeId: req.params.id,
        direction: 'downstream',
        path: {
          nodes: path.nodes.map(n => ({ id: n.id, name: n.name, type: n.type })),
          edges: path.edges.map(e => ({ id: e.id, type: e.type })),
          depth: path.depth,
          totalTransformations: path.totalTransformations,
        },
      });

    } catch (error) {
      res.status(500).json({ error: '下游追踪失败' });
    }
  });

  // 影响分析
  app.get('/api/lineage/impact/:id', async (req: Request, res: Response) => {
    try {
      const analysis = dataLineage.analyzeImpact(req.params.id);

      res.json({
        nodeId: analysis.nodeId,
        riskLevel: analysis.riskLevel,
        upstreamCount: analysis.upstreamNodes.length,
        downstreamCount: analysis.downstreamNodes.length,
        criticalPathsCount: analysis.criticalPaths.length,
        recommendations: analysis.recommendations,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '影响分析失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 报告质量问题
  app.post('/api/lineage/issues', async (req: Request, res: Response) => {
    try {
      const { nodeId, type, severity, description } = req.body;

      if (!nodeId || !type || !severity || !description) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const issue = dataLineage.reportQualityIssue({ nodeId, type, severity, description });

      res.json({
        success: true,
        issue: {
          id: issue.id,
          type: issue.type,
          severity: issue.severity,
          detectedAt: issue.detectedAt,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '报告问题失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取问题列表
  app.get('/api/lineage/issues', async (req: Request, res: Response) => {
    try {
      const { nodeId, resolved } = req.query;

      const issues = dataLineage.listIssues({
        nodeId: nodeId as string,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      });

      res.json({
        issues: issues.map(i => ({
          id: i.id,
          nodeId: i.nodeId,
          type: i.type,
          severity: i.severity,
          description: i.description,
          detectedAt: i.detectedAt,
          resolvedAt: i.resolvedAt,
        })),
        count: issues.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取问题列表失败' });
    }
  });

  // 解决问题
  app.post('/api/lineage/issues/:id/resolve', async (req: Request, res: Response) => {
    try {
      const { resolution } = req.body;

      if (!resolution) {
        return res.status(400).json({ error: '缺少解决方案描述' });
      }

      dataLineage.resolveIssue(req.params.id, resolution);

      res.json({ success: true, message: '问题已解决' });

    } catch (error) {
      res.status(500).json({ 
        error: '解决问题失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 导出图谱
  app.get('/api/lineage/export', async (req: Request, res: Response) => {
    try {
      const graph = dataLineage.exportToGraph();
      res.json(graph);
    } catch (error) {
      res.status(500).json({ error: '导出失败' });
    }
  });

  // 统计信息
  app.get('/api/lineage/stats', async (req: Request, res: Response) => {
    try {
      const stats = dataLineage.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '11.5',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  logger.info('[DataLineage] HTTP路由已注册 /api/lineage/*');
};
