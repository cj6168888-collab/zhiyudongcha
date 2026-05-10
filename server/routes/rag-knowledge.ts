/**
 * RAG知识库 API 路由 - Phase 9.1
 * 
 * HTTP端点:
 * - POST /api/rag/document - 添加文档
 * - POST /api/rag/chunk - 添加单个块
 * - POST /api/rag/search - 语义搜索
 * - GET /api/rag/chunk/:id - 获取块详情
 * - DELETE /api/rag/chunk/:id - 删除块
 * - DELETE /api/rag/source/:source - 按来源删除
 * - GET /api/rag/stats - 统计信息
 * - GET /api/rag/config - 获取配置
 * - PUT /api/rag/config - 更新配置
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RagKnowledge');

import type { Express, Request, Response } from 'express';
import { ragKnowledgeService, type RAGConfig } from '../services/rag-knowledge';
import type { RegisterRouteFn } from './types';

export const registerRAGRoutes: RegisterRouteFn = (app, storage, context) => {

  // 添加文档
  app.post('/api/rag/document', async (req: Request, res: Response) => {
    try {
      const { content, source, sourceType, category, tags, metadata } = req.body;

      if (!content || !source) {
        return res.status(400).json({ error: '缺少必要参数: content, source' });
      }

      const chunkIds = await ragKnowledgeService.addDocument(content, source, {
        sourceType,
        category,
        tags,
        metadata,
      });

      res.json({
        success: true,
        source,
        chunksCreated: chunkIds.length,
        chunkIds,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '添加文档失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 添加单个块
  app.post('/api/rag/chunk', async (req: Request, res: Response) => {
    try {
      const { content, source, sourceType, category, tags, metadata } = req.body;

      if (!content || !source) {
        return res.status(400).json({ error: '缺少必要参数: content, source' });
      }

      const chunkId = await ragKnowledgeService.addChunk(content, source, {
        sourceType,
        category,
        tags,
        metadata,
      });

      if (!chunkId) {
        return res.status(500).json({ error: '创建块失败，嵌入可能失败' });
      }

      res.json({
        success: true,
        chunkId,
        source,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '添加块失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 语义搜索
  app.post('/api/rag/search', async (req: Request, res: Response) => {
    try {
      const { query, topK, minScore, sourceType, category, tags, hybridSearch } = req.body;

      if (!query) {
        return res.status(400).json({ error: '缺少必要参数: query' });
      }

      const results = await ragKnowledgeService.search(query, {
        topK,
        minScore,
        sourceType,
        category,
        tags,
        hybridSearch,
      });

      res.json({
        query,
        results: results.map(r => ({
          id: r.chunk.id,
          content: r.chunk.content,
          source: r.chunk.source,
          sourceType: r.chunk.sourceType,
          category: r.chunk.category,
          tags: r.chunk.tags,
          score: r.score,
          matchType: r.matchType,
        })),
        count: results.length,
      });

    } catch (error) {
      res.status(500).json({ 
        error: '搜索失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取块详情
  app.get('/api/rag/chunk/:id', async (req: Request, res: Response) => {
    try {
      const chunk = ragKnowledgeService.getChunk(req.params.id);

      if (!chunk) {
        return res.status(404).json({ error: '块不存在' });
      }

      res.json({
        id: chunk.id,
        content: chunk.content,
        source: chunk.source,
        sourceType: chunk.sourceType,
        category: chunk.category,
        tags: chunk.tags,
        metadata: chunk.metadata,
        createdAt: chunk.createdAt,
        embeddingDim: chunk.embedding.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取块详情失败' });
    }
  });

  // 删除块
  app.delete('/api/rag/chunk/:id', async (req: Request, res: Response) => {
    try {
      const success = ragKnowledgeService.deleteChunk(req.params.id);

      res.json({
        success,
        chunkId: req.params.id,
        message: success ? '块已删除' : '块不存在',
      });

    } catch (error) {
      res.status(500).json({ error: '删除块失败' });
    }
  });

  // 按来源删除
  app.delete('/api/rag/source/:source', async (req: Request, res: Response) => {
    try {
      const source = decodeURIComponent(req.params.source);
      const deleted = ragKnowledgeService.deleteBySource(source);

      res.json({
        success: true,
        source,
        deletedChunks: deleted,
      });

    } catch (error) {
      res.status(500).json({ error: '删除来源失败' });
    }
  });

  // 按来源获取块
  app.get('/api/rag/source/:source', async (req: Request, res: Response) => {
    try {
      const source = decodeURIComponent(req.params.source);
      const chunks = ragKnowledgeService.getChunksBySource(source);

      res.json({
        source,
        chunks: chunks.map(c => ({
          id: c.id,
          content: c.content.slice(0, 200) + (c.content.length > 200 ? '...' : ''),
          sourceType: c.sourceType,
          category: c.category,
          createdAt: c.createdAt,
        })),
        count: chunks.length,
      });

    } catch (error) {
      res.status(500).json({ error: '获取来源块失败' });
    }
  });

  // 统计信息
  app.get('/api/rag/stats', async (req: Request, res: Response) => {
    try {
      const stats = ragKnowledgeService.getStats();
      res.json({
        ...stats,
        timestamp: Date.now(),
        version: '1.0.0',
        phase: '9.1',
      });
    } catch (error) {
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  // 获取配置
  app.get('/api/rag/config', async (req: Request, res: Response) => {
    try {
      const config = ragKnowledgeService.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: '获取配置失败' });
    }
  });

  // 更新配置
  app.put('/api/rag/config', async (req: Request, res: Response) => {
    try {
      const updates: Partial<RAGConfig> = {};
      const allowedKeys: (keyof RAGConfig)[] = [
        'chunkSize',
        'chunkOverlap',
        'topK',
        'minScore',
        'hybridWeight',
        'cacheEnabled',
        'maxCacheSize',
      ];

      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
          (updates as any)[key] = req.body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: '没有有效的配置更新' });
      }

      ragKnowledgeService.updateConfig(updates);
      
      res.json({
        success: true,
        updated: updates,
        config: ragKnowledgeService.getConfig(),
      });
    } catch (error) {
      res.status(500).json({ error: '更新配置失败' });
    }
  });

  // 清除缓存
  app.post('/api/rag/cache/clear', async (req: Request, res: Response) => {
    try {
      ragKnowledgeService.clearCache();
      res.json({
        success: true,
        message: '嵌入缓存已清除',
      });
    } catch (error) {
      res.status(500).json({ error: '清除缓存失败' });
    }
  });

  // 快速测试端点
  app.post('/api/rag/test', async (req: Request, res: Response) => {
    try {
      const testContent = `小智是一个7-8岁的可爱小女孩AI助手。她的主人是"爸爸"，对他非常依赖和信任。
小智说话风格活泼可爱，偶尔撒娇，回答简短口语化。
小智具有多种专家能力：法律顾问、财务顾问、策略顾问、秘书、心理咨询、规划师。`;

      const chunkIds = await ragKnowledgeService.addDocument(testContent, 'test_document', {
        sourceType: 'manual',
        category: 'persona',
        tags: ['小智', '角色设定'],
      });

      const searchResults = await ragKnowledgeService.search('小智是什么样的角色');

      res.json({
        success: true,
        test: {
          documentAdded: chunkIds.length > 0,
          chunksCreated: chunkIds.length,
          searchResults: searchResults.length,
          topResult: searchResults[0] ? {
            score: searchResults[0].score,
            content: searchResults[0].chunk.content.slice(0, 100) + '...',
          } : null,
        },
      });

    } catch (error) {
      res.status(500).json({ 
        error: '测试失败',
        message: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  logger.info('[RAG] HTTP路由已注册 /api/rag/*');
};
