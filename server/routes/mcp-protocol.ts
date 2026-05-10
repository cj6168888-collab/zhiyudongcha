/**
 * MCP协议 API 路由 - Phase 10.2
 * 
 * HTTP端点 (MCP over HTTP适配):
 * - GET /api/mcp/info - 服务器信息
 * - GET /api/mcp/resources - 资源列表
 * - GET /api/mcp/resources/:uri - 读取资源
 * - GET /api/mcp/tools - 工具列表
 * - POST /api/mcp/tools/call - 调用工具
 * - GET /api/mcp/prompts - 提示词列表
 * - POST /api/mcp/prompts/:name - 获取提示词消息
 * - POST /api/mcp/sampling - 采样请求
 * - GET /api/mcp/stats - 统计信息
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('McpProtocol');

import type { Express, Request, Response } from 'express';
import { mcpProtocolService, type MCPSamplingRequest } from '../services/mcp-protocol';
import type { RegisterRouteFn } from './types';

export const registerMCPRoutes: RegisterRouteFn = (app, storage, context) => {

  // 服务器信息
  app.get('/api/mcp/info', async (req: Request, res: Response) => {
    try {
      const info = mcpProtocolService.getServerInfo();
      res.json({
        ...info,
        protocol: 'mcp',
        protocolVersion: '2024-11-05',
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: '获取服务器信息失败' });
    }
  });

  // 资源列表
  app.get('/api/mcp/resources', async (req: Request, res: Response) => {
    try {
      const resources = mcpProtocolService.listResources();
      res.json({
        resources,
        count: resources.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取资源列表失败' });
    }
  });

  // 读取资源
  app.get('/api/mcp/resources/*', async (req: Request, res: Response) => {
    try {
      const uri = decodeURIComponent(req.params[0]);
      const content = await mcpProtocolService.readResource(uri);
      
      if (!content) {
        return res.status(404).json({ error: '资源不存在' });
      }

      res.json({
        contents: [content],
      });
    } catch (error) {
      res.status(500).json({ error: '读取资源失败' });
    }
  });

  // 工具列表
  app.get('/api/mcp/tools', async (req: Request, res: Response) => {
    try {
      const tools = mcpProtocolService.listTools();
      res.json({
        tools,
        count: tools.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取工具列表失败' });
    }
  });

  // 调用工具
  app.post('/api/mcp/tools/call', async (req: Request, res: Response) => {
    try {
      const { name, arguments: args } = req.body;

      if (!name) {
        return res.status(400).json({ error: '缺少必要参数: name' });
      }

      const result = await mcpProtocolService.callTool(name, args || {});
      res.json(result);

    } catch (error) {
      res.status(500).json({ 
        error: '工具调用失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 提示词列表
  app.get('/api/mcp/prompts', async (req: Request, res: Response) => {
    try {
      const prompts = mcpProtocolService.listPrompts();
      res.json({
        prompts,
        count: prompts.length,
      });
    } catch (error) {
      res.status(500).json({ error: '获取提示词列表失败' });
    }
  });

  // 获取提示词消息
  app.post('/api/mcp/prompts/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const args = req.body.arguments || {};

      const result = await mcpProtocolService.getPrompt(name, args);
      
      if (!result) {
        return res.status(404).json({ error: '提示词不存在' });
      }

      res.json(result);

    } catch (error) {
      res.status(500).json({ error: '获取提示词失败' });
    }
  });

  // 采样请求
  app.post('/api/mcp/sampling', async (req: Request, res: Response) => {
    try {
      const request = req.body as MCPSamplingRequest;

      if (!request.messages || !Array.isArray(request.messages)) {
        return res.status(400).json({ error: '缺少必要参数: messages' });
      }

      const result = await mcpProtocolService.createSamplingRequest(request);
      res.json(result);

    } catch (error) {
      res.status(500).json({ 
        error: '采样请求失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 同步工具
  app.post('/api/mcp/sync-tools', async (req: Request, res: Response) => {
    try {
      const synced = await mcpProtocolService.syncToolsFromFunctionCalling();
      res.json({
        success: true,
        syncedTools: synced,
      });
    } catch (error) {
      res.status(500).json({ error: '同步工具失败' });
    }
  });

  // 统计信息
  app.get('/api/mcp/stats', async (req: Request, res: Response) => {
    try {
      const stats = mcpProtocolService.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '10.2',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 注册自定义资源
  app.post('/api/mcp/resources', async (req: Request, res: Response) => {
    try {
      const { uri, name, description, mimeType } = req.body;

      if (!uri || !name) {
        return res.status(400).json({ error: '缺少必要参数: uri, name' });
      }

      mcpProtocolService.registerResource({
        uri,
        name,
        description,
        mimeType,
      });

      res.json({
        success: true,
        uri,
        name,
      });

    } catch (error) {
      res.status(500).json({ error: '注册资源失败' });
    }
  });

  // 删除资源
  app.delete('/api/mcp/resources/*', async (req: Request, res: Response) => {
    try {
      const uri = decodeURIComponent(req.params[0]);
      const deleted = mcpProtocolService.unregisterResource(uri);

      res.json({
        success: deleted,
        uri,
        message: deleted ? '资源已删除' : '资源不存在',
      });

    } catch (error) {
      res.status(500).json({ error: '删除资源失败' });
    }
  });

  logger.info('[MCP] HTTP路由已注册 /api/mcp/*');
};
