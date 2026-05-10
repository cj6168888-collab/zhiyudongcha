/**
 * 屏幕穿透服务 API 路由 - Phase 11.4
 * 
 * HTTP端点:
 * - POST /api/screen/analyze - 分析屏幕截图
 * - POST /api/screen/anchors - 创建语义锚点
 * - GET /api/screen/anchors - 获取锚点列表
 * - POST /api/screen/find-element - 查找元素
 * - POST /api/screen/execute - 执行UI动作
 * - POST /api/screen/sequences - 创建操作序列
 * - GET /api/screen/sequences - 获取序列列表
 * - POST /api/screen/run-sequence - 运行操作序列
 * - GET /api/screen/captures - 获取截图历史
 * - GET /api/screen/stats - 统计信息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ScreenPiercer');

import type { Express, Request, Response } from 'express';
import { screenPiercer } from '../services/screen-piercer';
import type { RegisterRouteFn } from './types';

export const registerScreenPiercerRoutes: RegisterRouteFn = (app, storage, context) => {

  // 分析屏幕截图
  app.post('/api/screen/analyze', async (req: Request, res: Response) => {
    try {
      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ error: '缺少图像数据' });
      }

      const capture = await screenPiercer.analyzeScreen(imageData);

      res.json({
        success: true,
        capture: {
          id: capture.id,
          timestamp: capture.timestamp,
          resolution: capture.resolution,
          elementsCount: capture.elements.length,
          elements: capture.elements.map(e => ({
            id: e.id,
            type: e.type,
            text: e.text,
            region: e.region,
            confidence: e.confidence,
          })),
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '屏幕分析失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 创建语义锚点
  app.post('/api/screen/anchors', async (req: Request, res: Response) => {
    try {
      const { name, description, selector } = req.body;

      if (!name || !selector) {
        return res.status(400).json({ error: '缺少必要参数: name, selector' });
      }

      const anchor = screenPiercer.createAnchor({
        name,
        description: description || '',
        selector,
      });

      res.json({
        success: true,
        anchor: {
          id: anchor.id,
          name: anchor.name,
          reliability: anchor.reliability,
        },
      });

    } catch (error) {
      res.status(500).json({ error: '创建锚点失败' });
    }
  });

  // 获取锚点列表
  app.get('/api/screen/anchors', async (req: Request, res: Response) => {
    try {
      const anchors = screenPiercer.listAnchors();

      res.json({
        anchors: anchors.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          reliability: a.reliability,
          usageCount: a.usageCount,
          lastMatch: a.lastMatch ? { text: a.lastMatch.text } : null,
        })),
        count: anchors.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取锚点列表失败' });
    }
  });

  // 查找元素
  app.post('/api/screen/find-element', async (req: Request, res: Response) => {
    try {
      const { anchorId } = req.body;

      if (!anchorId) {
        return res.status(400).json({ error: '缺少锚点ID' });
      }

      const element = screenPiercer.findElement(anchorId);

      if (!element) {
        return res.status(404).json({ error: '未找到匹配元素' });
      }

      res.json({
        found: true,
        element: {
          id: element.id,
          type: element.type,
          text: element.text,
          region: element.region,
          confidence: element.confidence,
        },
      });

    } catch (error) {
      res.status(500).json({ error: '查找元素失败' });
    }
  });

  // 执行UI动作
  app.post('/api/screen/execute', async (req: Request, res: Response) => {
    try {
      const { type, target, parameters } = req.body;

      if (!type || !target) {
        return res.status(400).json({ error: '缺少必要参数: type, target' });
      }

      const action = await screenPiercer.executeAction({
        type,
        target,
        parameters: parameters || {},
      });

      res.json({
        success: action.result.success,
        action: {
          id: action.id,
          type: action.type,
          duration: action.result.duration,
          error: action.result.error,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '执行动作失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 创建操作序列
  app.post('/api/screen/sequences', async (req: Request, res: Response) => {
    try {
      const { name, description, actions, variables } = req.body;

      if (!name || !actions || !Array.isArray(actions)) {
        return res.status(400).json({ error: '缺少必要参数: name, actions' });
      }

      const sequence = screenPiercer.createSequence({
        name,
        description: description || '',
        actions,
        variables,
      });

      res.json({
        success: true,
        sequence: {
          id: sequence.id,
          name: sequence.name,
          actionsCount: sequence.actions.length,
        },
      });

    } catch (error) {
      res.status(500).json({ error: '创建序列失败' });
    }
  });

  // 获取序列列表
  app.get('/api/screen/sequences', async (req: Request, res: Response) => {
    try {
      const sequences = screenPiercer.listSequences();

      res.json({
        sequences: sequences.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          actionsCount: s.actions.length,
          successRate: s.successRate,
          lastRun: s.lastRun,
        })),
        count: sequences.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取序列列表失败' });
    }
  });

  // 运行操作序列
  app.post('/api/screen/run-sequence', async (req: Request, res: Response) => {
    try {
      const { sequenceId, variables } = req.body;

      if (!sequenceId) {
        return res.status(400).json({ error: '缺少序列ID' });
      }

      const result = await screenPiercer.runSequence(sequenceId, variables);

      res.json({
        success: result.success,
        duration: result.duration,
        actionsExecuted: result.results.length,
        failedAt: result.success ? null : result.results.length,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '运行序列失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取截图历史
  app.get('/api/screen/captures', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const captures = screenPiercer.getRecentCaptures(limit);

      res.json({
        captures: captures.map(c => ({
          id: c.id,
          timestamp: c.timestamp,
          elementsCount: c.elements.length,
          resolution: c.resolution,
        })),
        count: captures.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取截图历史失败' });
    }
  });

  // 统计信息
  app.get('/api/screen/stats', async (req: Request, res: Response) => {
    try {
      const stats = screenPiercer.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '11.4',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  logger.info('[ScreenPiercer] HTTP路由已注册 /api/screen/*');
};
