/**
 * Function Calling API 路由 - Phase 10.1
 *
 * HTTP端点:
 * - GET /api/functions/list - 获取可用工具列表
 * - GET /api/functions/openai - 获取OpenAI格式工具定义
 * - POST /api/functions/call - 执行单个工具调用
 * - POST /api/functions/batch - 批量执行工具调用
 * - GET /api/functions/logs - 获取调用日志
 * - GET /api/functions/stats - 统计信息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('FunctionCalling');

import type { Express, Request, Response } from 'express';
import { functionCallingService, type ToolCall } from '../services/function-calling';
import type { RegisterRouteFn } from './types';

export const registerFunctionCallingRoutes: RegisterRouteFn = (app, storage, context) => {

  // 获取可用工具列表
  app.get('/api/functions/list', async (req: Request, res: Response) => {
    try {
      const tools = functionCallingService.getToolsForOpenAI();
      res.json({
        tools: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
        count: tools.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取工具列表失败' });
    }
  });

  // 获取OpenAI格式工具定义
  app.get('/api/functions/openai', async (req: Request, res: Response) => {
    try {
      const tools = functionCallingService.getToolsForOpenAI();
      res.json({
        tools,
        format: 'openai_tools',
        version: '1.0',
      });
    } catch (error) {
      res.status(500).json({ error: '获取OpenAI格式失败' });
    }
  });

  // 执行单个工具调用
  app.post('/api/functions/call', async (req: Request, res: Response) => {
    try {
      const { name, arguments: args } = req.body;

      if (!name) {
        return res.status(400).json({ error: '缺少必要参数: name' });
      }

      const call: ToolCall = {
        id: 'call_' + Date.now().toString(36),
        name,
        arguments: args || {},
      };

      const result = await functionCallingService.executeCall(call, {
        userId: req.userId,
      });

      res.json(result);

    } catch (error) {
      res.status(500).json({
        error: '执行失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 批量执行工具调用
  app.post('/api/functions/batch', async (req: Request, res: Response) => {
    try {
      const { calls, parallel } = req.body as {
        calls: Array<{ name: string; arguments?: Record<string, any> }>;
        parallel?: boolean;
      };

      if (!calls || !Array.isArray(calls)) {
        return res.status(400).json({ error: '缺少必要参数: calls' });
      }

      const toolCalls: ToolCall[] = calls.map((c, i) => ({
        id: `call_${Date.now().toString(36)}_${i}`,
        name: c.name,
        arguments: c.arguments || {},
      }));

      const results = await functionCallingService.executeCalls(toolCalls, {
        userId: req.userId,
        parallel: parallel ?? true,
      });

      res.json({
        results,
        count: results.length,
        successCount: results.filter(r => r.success).length,
      });

    } catch (error) {
      res.status(500).json({
        error: '批量执行失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取调用日志
  app.get('/api/functions/logs', async (req: Request, res: Response) => {
    try {
      const { toolName, userId, limit } = req.query;

      const logs = functionCallingService.getCallLogs({
        toolName: toolName as string,
        userId: userId as string,
        limit: limit ? parseInt(limit as string) : 50,
      });

      res.json({
        logs,
        count: logs.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取日志失败' });
    }
  });

  // 统计信息
  app.get('/api/functions/stats', async (req: Request, res: Response) => {
    try {
      const stats = functionCallingService.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '10.1',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 清除日志
  app.delete('/api/functions/logs', async (req: Request, res: Response) => {
    try {
      functionCallingService.clearLogs();
      res.json({
        success: true,
        message: '调用日志已清除',
      });
    } catch (error) {
      res.status(500).json({ error: '清除日志失败' });
    }
  });

  // 获取工具详情
  app.get('/api/functions/tool/:name', async (req: Request, res: Response) => {
    try {
      const tool = functionCallingService.getTool(req.params.name);

      if (!tool) {
        return res.status(404).json({ error: '工具不存在' });
      }

      res.json({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        category: tool.category,
        riskLevel: tool.riskLevel,
        requiresAuth: tool.requiresAuth,
      });

    } catch (error) {
      res.status(500).json({ error: '获取工具详情失败' });
    }
  });

  // 测试工具调用
  app.post('/api/functions/test', async (req: Request, res: Response) => {
    try {
      // 测试多个内置工具
      const testCalls: ToolCall[] = [
        { id: 'test_1', name: 'get_current_time', arguments: {} },
        { id: 'test_2', name: 'calculator', arguments: { expression: '2 + 2 * 3' } },
        { id: 'test_3', name: 'get_weather', arguments: { location: '北京', days: 1 } },
      ];

      const results = await functionCallingService.executeCalls(testCalls, { parallel: true });

      res.json({
        success: true,
        tests: results.map(r => ({
          name: r.name,
          success: r.success,
          result: r.result,
          duration: r.duration,
        })),
      });

    } catch (error) {
      res.status(500).json({
        error: '测试失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  logger.info('[FunctionCall] HTTP路由已注册 /api/functions/*');
};
