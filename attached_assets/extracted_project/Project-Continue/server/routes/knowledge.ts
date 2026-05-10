/**
 * 专业知识库API路由 (Professional Knowledge API)
 * 
 * 提供法律/财务知识的语义搜索、合同分析、设备同步等功能
 */

import { Router, Request, Response } from 'express';
import { professionalKnowledge } from '../services/professional-knowledge';
import type { KnowledgeType } from '../services/professional-knowledge';

export const knowledgeRouter = Router();

/**
 * GET /api/knowledge/search
 * 语义搜索知识库
 * 
 * Query Params:
 *   q: string - 搜索关键词
 *   type?: 'LEGAL' | 'FINANCE' - 知识类型
 *   category?: string - 分类过滤
 *   limit?: number - 返回数量 (默认5)
 */
knowledgeRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, type, category, limit } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '请提供搜索关键词 (参数: q)' 
      });
    }

    const knowledgeType = type as KnowledgeType | undefined;
    const searchLimit = limit ? parseInt(limit as string, 10) : 5;

    const results = await professionalKnowledge.searchKnowledge(
      q,
      knowledgeType,
      category as string | undefined,
      searchLimit
    );

    res.json({
      success: true,
      query: q,
      type: knowledgeType || 'ALL',
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Search error:', error);
    res.status(500).json({ 
      success: false, 
      error: '知识库搜索失败' 
    });
  }
});

/**
 * POST /api/knowledge/contract/analyze
 * 合同风险分析
 * 
 * Body:
 *   text: string - 合同文本内容
 */
knowledgeRouter.post('/contract/analyze', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '请提供合同文本内容 (参数: text)' 
      });
    }

    if (text.length < 50) {
      return res.status(400).json({ 
        success: false, 
        error: '合同文本过短，请提供完整合同内容' 
      });
    }

    const analysis = await professionalKnowledge.analyzeContractRisks(text);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Contract analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: '合同分析失败' 
    });
  }
});

/**
 * GET /api/knowledge/sync/:deviceId
 * 获取设备同步包
 * 
 * Params:
 *   deviceId: string - 设备ID
 * 
 * Query:
 *   type: 'LEGAL' | 'FINANCE' - 知识类型
 *   fromVersion?: number - 起始版本 (0表示全量同步)
 */
knowledgeRouter.get('/sync/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { type, fromVersion } = req.query;

    if (!type || (type !== 'LEGAL' && type !== 'FINANCE')) {
      return res.status(400).json({ 
        success: false, 
        error: '请指定知识类型 (type: LEGAL 或 FINANCE)' 
      });
    }

    const version = fromVersion ? parseInt(fromVersion as string, 10) : 0;

    const syncPackage = await professionalKnowledge.prepareSyncPackage(
      deviceId,
      type as KnowledgeType,
      version
    );

    res.json({
      success: true,
      syncPackage,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: '同步包准备失败' 
    });
  }
});

/**
 * GET /api/knowledge/stats
 * 获取知识库统计信息
 */
knowledgeRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await professionalKnowledge.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取统计信息失败' 
    });
  }
});

/**
 * POST /api/knowledge/contract/ocr
 * 合同图片OCR识别
 * 
 * Body:
 *   image: string - Base64编码的图片数据
 */
knowledgeRouter.post('/contract/ocr', async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '请提供图片数据 (参数: image，Base64格式)' 
      });
    }

    const ocrResult = await professionalKnowledge.performContractOCR(image);

    res.json({
      success: true,
      ocrResult,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] OCR error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'OCR识别失败' 
    });
  }
});

/**
 * POST /api/knowledge/contract/analyze-image
 * 合同图片OCR + 风险分析一体化
 * 
 * Body:
 *   image: string - Base64编码的图片数据（单页）
 *   images?: string[] - Base64编码的图片数组（多页）
 */
knowledgeRouter.post('/contract/analyze-image', async (req: Request, res: Response) => {
  try {
    const { image, images } = req.body;
    
    if (images && Array.isArray(images)) {
      if (images.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: '请提供至少一张图片' 
        });
      }
      if (images.length > 20) {
        return res.status(400).json({ 
          success: false, 
          error: '一次最多支持20页合同分析' 
        });
      }

      const result = await professionalKnowledge.analyzeMultiPageContract(images);
      return res.json({
        success: true,
        ...result,
      });
    }
    
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '请提供图片数据 (参数: image 或 images)' 
      });
    }

    const result = await professionalKnowledge.analyzeContractFromImage(image);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Image analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: '合同图片分析失败' 
    });
  }
});

/**
 * GET /api/knowledge/categories
 * 获取可用分类列表
 */
knowledgeRouter.get('/categories', async (req: Request, res: Response) => {
  res.json({
    success: true,
    categories: {
      legal: [
        { value: 'CONTRACT', label: '合同法' },
        { value: 'CORPORATE', label: '公司法' },
        { value: 'LABOR', label: '劳动法' },
        { value: 'TAX', label: '税法' },
        { value: 'TRADE', label: '贸易法' },
        { value: 'INTELLECTUAL_PROPERTY', label: '知识产权' },
      ],
      finance: [
        { value: 'TAX', label: '税务' },
        { value: 'ACCOUNTING', label: '会计' },
        { value: 'INVESTMENT', label: '投资' },
        { value: 'COMPLIANCE', label: '合规' },
        { value: 'AUDIT', label: '审计' },
      ],
    },
  });
});

/**
 * GET /api/knowledge/patches
 * 获取待处理的补丁列表
 */
knowledgeRouter.get('/patches', async (req: Request, res: Response) => {
  try {
    const pendingPatches = professionalKnowledge.getPendingPatches();
    const history = professionalKnowledge.getPatchHistory();

    res.json({
      success: true,
      pending: pendingPatches,
      history: history.slice(0, 10),
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Patches error:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取补丁列表失败' 
    });
  }
});

/**
 * POST /api/knowledge/patches/apply/:patchId
 * 手动应用指定补丁
 */
knowledgeRouter.post('/patches/apply/:patchId', async (req: Request, res: Response) => {
  try {
    const { patchId } = req.params;
    const result = await professionalKnowledge.applyPatch(patchId);

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Apply patch error:', error);
    res.status(500).json({ 
      success: false, 
      error: '应用补丁失败' 
    });
  }
});

/**
 * POST /api/knowledge/patches/skip/:patchId
 * 跳过指定补丁
 */
knowledgeRouter.post('/patches/skip/:patchId', async (req: Request, res: Response) => {
  try {
    const { patchId } = req.params;
    const success = professionalKnowledge.skipPatch(patchId);

    res.json({
      success,
      message: success ? '补丁已跳过' : '无法跳过补丁',
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Skip patch error:', error);
    res.status(500).json({ 
      success: false, 
      error: '跳过补丁失败' 
    });
  }
});

/**
 * GET /api/knowledge/patches/config
 * 获取补丁调度配置
 */
knowledgeRouter.get('/patches/config', async (req: Request, res: Response) => {
  try {
    const config = professionalKnowledge.getPatchScheduleConfig();

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Config error:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取配置失败' 
    });
  }
});

/**
 * PUT /api/knowledge/patches/config
 * 更新补丁调度配置
 */
knowledgeRouter.put('/patches/config', async (req: Request, res: Response) => {
  try {
    const { preferredHour, enableAutoApply, notifyBeforeApply } = req.body;
    
    professionalKnowledge.updatePatchScheduleConfig({
      preferredHour,
      enableAutoApply,
      notifyBeforeApply,
    });

    const updatedConfig = professionalKnowledge.getPatchScheduleConfig();

    res.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Update config error:', error);
    res.status(500).json({ 
      success: false, 
      error: '更新配置失败' 
    });
  }
});

/**
 * GET /api/knowledge/patches/notification/:deviceId
 * 获取设备的补丁通知
 */
knowledgeRouter.get('/patches/notification/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const notification = professionalKnowledge.generatePatchNotification(deviceId);

    res.json({
      success: true,
      hasUpdate: notification !== null,
      notification,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Notification error:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取通知失败' 
    });
  }
});

/**
 * POST /api/knowledge/patches/test-create
 * 创建测试补丁（仅供开发测试）
 */
knowledgeRouter.post('/patches/test-create', async (req: Request, res: Response) => {
  try {
    const patch = await professionalKnowledge.createSampleLegalUpdatePatch();

    res.json({
      success: true,
      patch,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Test create error:', error);
    res.status(500).json({ 
      success: false, 
      error: '创建测试补丁失败' 
    });
  }
});

/**
 * POST /api/knowledge/seed-extended
 * 导入扩展法律财税知识库
 */
knowledgeRouter.post('/seed-extended', async (req: Request, res: Response) => {
  try {
    const result = await professionalKnowledge.seedExtendedKnowledge();

    res.json({
      success: true,
      message: `导入完成：${result.legal}条法律条文，${result.finance}条财税知识`,
      inserted: result,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Seed extended error:', error);
    res.status(500).json({ 
      success: false, 
      error: '知识库导入失败' 
    });
  }
});

/**
 * GET /api/knowledge/stats-detailed
 * 获取知识库详细统计（按分类）
 */
knowledgeRouter.get('/stats-detailed', async (req: Request, res: Response) => {
  try {
    const stats = await professionalKnowledge.getKnowledgeStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[KnowledgeAPI] Stats detailed error:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取统计失败' 
    });
  }
});

// ===== 动态法律索引 API =====

import { 
  legalIndexService, 
  caseLearningService, 
  patternSyncService,
  type LawCategory,
  type CaseType
} from '../services/legal-case-learning';
import { legalIndexEntries, caseStudyEntries } from '../data/legal-index-seed';

/**
 * GET /api/knowledge/legal-index/search
 * 搜索法律法规索引
 */
knowledgeRouter.get('/legal-index/search', async (req: Request, res: Response) => {
  try {
    const { q, category, onlyDownloaded, limit } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '请提供搜索关键词 (参数: q)' 
      });
    }

    const results = await legalIndexService.searchIndex(q, {
      category: category as LawCategory | undefined,
      onlyDownloaded: onlyDownloaded === 'true',
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({
      success: true,
      query: q,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[LegalIndex] Search error:', error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
});

/**
 * GET /api/knowledge/legal-index/:id
 * 获取法律索引详情
 */
knowledgeRouter.get('/legal-index/:id', async (req: Request, res: Response) => {
  try {
    const result = await legalIndexService.getIndexById(req.params.id);
    
    if (!result) {
      return res.status(404).json({ success: false, error: '索引项不存在' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[LegalIndex] Get by ID error:', error);
    res.status(500).json({ success: false, error: '获取详情失败' });
  }
});

/**
 * POST /api/knowledge/legal-index/:id/download
 * 下载法律法规内容
 */
knowledgeRouter.post('/legal-index/:id/download', async (req: Request, res: Response) => {
  try {
    const result = await legalIndexService.downloadLawContent(req.params.id);
    res.json({ success: result.success, ...result });
  } catch (error) {
    console.error('[LegalIndex] Download error:', error);
    res.status(500).json({ success: false, error: '下载失败' });
  }
});

/**
 * GET /api/knowledge/legal-index/pending/downloads
 * 获取待下载的高优先级法规
 */
knowledgeRouter.get('/legal-index/pending/downloads', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const results = await legalIndexService.getPendingDownloads(limit);
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    console.error('[LegalIndex] Pending downloads error:', error);
    res.status(500).json({ success: false, error: '获取待下载列表失败' });
  }
});

/**
 * GET /api/knowledge/legal-index/stats
 * 获取法律索引统计
 */
knowledgeRouter.get('/legal-index/stats', async (req: Request, res: Response) => {
  try {
    const stats = await legalIndexService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[LegalIndex] Stats error:', error);
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

// ===== 案例学习 API =====

/**
 * GET /api/knowledge/cases/search
 * 搜索案例库
 */
knowledgeRouter.get('/cases/search', async (req: Request, res: Response) => {
  try {
    const { q, caseType, onlyAnalyzed, limit } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '请提供搜索关键词 (参数: q)' 
      });
    }

    const results = await caseLearningService.searchCases(q, {
      caseType: caseType as CaseType | undefined,
      onlyAnalyzed: onlyAnalyzed === 'true',
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({
      success: true,
      query: q,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[CaseLearning] Search error:', error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
});

/**
 * GET /api/knowledge/cases/:id
 * 获取案例详情
 */
knowledgeRouter.get('/cases/:id', async (req: Request, res: Response) => {
  try {
    const result = await caseLearningService.getCaseById(req.params.id);
    
    if (!result) {
      return res.status(404).json({ success: false, error: '案例不存在' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CaseLearning] Get by ID error:', error);
    res.status(500).json({ success: false, error: '获取案例详情失败' });
  }
});

/**
 * POST /api/knowledge/cases/:id/analyze
 * 分析案例并提取策略模式
 */
knowledgeRouter.post('/cases/:id/analyze', async (req: Request, res: Response) => {
  try {
    const result = await caseLearningService.analyzeCase(req.params.id);
    
    if (!result) {
      return res.status(404).json({ success: false, error: '案例不存在' });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[CaseLearning] Analyze error:', error);
    res.status(500).json({ success: false, error: '分析失败' });
  }
});

/**
 * POST /api/knowledge/cases/analyze-batch
 * 批量分析未处理的案例
 */
knowledgeRouter.post('/cases/analyze-batch', async (req: Request, res: Response) => {
  try {
    const limit = req.body.limit || 10;
    const result = await caseLearningService.analyzeUnprocessedCases(limit);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[CaseLearning] Batch analyze error:', error);
    res.status(500).json({ success: false, error: '批量分析失败' });
  }
});

/**
 * GET /api/knowledge/cases/stats
 * 获取案例统计
 */
knowledgeRouter.get('/cases/stats', async (req: Request, res: Response) => {
  try {
    const stats = await caseLearningService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[CaseLearning] Stats error:', error);
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

// ===== 策略模式同步 API =====

/**
 * GET /api/knowledge/patterns/sync/:deviceId
 * 获取设备待同步的策略模式
 */
knowledgeRouter.get('/patterns/sync/:deviceId', async (req: Request, res: Response) => {
  try {
    const { fromVersion } = req.query;
    const version = fromVersion ? parseInt(fromVersion as string, 10) : 0;
    
    const syncPackage = await patternSyncService.getDeltaSyncPackage(
      req.params.deviceId,
      version
    );

    res.json({ success: true, ...syncPackage });
  } catch (error) {
    console.error('[PatternSync] Get sync package error:', error);
    res.status(500).json({ success: false, error: '获取同步包失败' });
  }
});

/**
 * POST /api/knowledge/patterns/sync/:deviceId/confirm
 * 确认策略模式已同步
 */
knowledgeRouter.post('/patterns/sync/:deviceId/confirm', async (req: Request, res: Response) => {
  try {
    const { patternIds } = req.body;
    
    if (!Array.isArray(patternIds)) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供patternIds数组' 
      });
    }

    await patternSyncService.markSynced(patternIds, req.params.deviceId);
    res.json({ success: true, syncedCount: patternIds.length });
  } catch (error) {
    console.error('[PatternSync] Confirm sync error:', error);
    res.status(500).json({ success: false, error: '确认同步失败' });
  }
});

/**
 * GET /api/knowledge/patterns/category/:category
 * 按类别获取策略模式
 */
knowledgeRouter.get('/patterns/category/:category', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const patterns = await patternSyncService.getPatternsByCategory(
      req.params.category as CaseType,
      limit
    );
    res.json({ success: true, count: patterns.length, patterns });
  } catch (error) {
    console.error('[PatternSync] Get by category error:', error);
    res.status(500).json({ success: false, error: '获取策略模式失败' });
  }
});

/**
 * POST /api/knowledge/patterns/:id/usage
 * 记录策略模式使用
 */
knowledgeRouter.post('/patterns/:id/usage', async (req: Request, res: Response) => {
  try {
    await patternSyncService.incrementUsage(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[PatternSync] Increment usage error:', error);
    res.status(500).json({ success: false, error: '记录使用失败' });
  }
});

/**
 * GET /api/knowledge/patterns/stats
 * 获取策略模式统计
 */
knowledgeRouter.get('/patterns/stats', async (req: Request, res: Response) => {
  try {
    const stats = await patternSyncService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[PatternSync] Stats error:', error);
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

/**
 * POST /api/knowledge/seed-legal-index
 * 导入法律索引和案例种子数据
 */
knowledgeRouter.post('/seed-legal-index', async (req: Request, res: Response) => {
  try {
    const indexCount = await legalIndexService.bulkAddIndex(legalIndexEntries);
    const caseCount = await caseLearningService.bulkAddCases(caseStudyEntries);

    res.json({
      success: true,
      message: `导入完成：${indexCount}条法律索引，${caseCount}条案例数据`,
      inserted: { legalIndex: indexCount, cases: caseCount },
    });
  } catch (error) {
    console.error('[Knowledge] Seed legal index error:', error);
    res.status(500).json({ success: false, error: '导入失败' });
  }
});

/**
 * GET /api/knowledge/learning-stats
 * 获取学习系统综合统计
 */
knowledgeRouter.get('/learning-stats', async (req: Request, res: Response) => {
  try {
    const [indexStats, caseStats, patternStats] = await Promise.all([
      legalIndexService.getStats(),
      caseLearningService.getStats(),
      patternSyncService.getStats(),
    ]);

    res.json({
      success: true,
      legalIndex: indexStats,
      cases: caseStats,
      patterns: patternStats,
    });
  } catch (error) {
    console.error('[Knowledge] Learning stats error:', error);
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

export function registerKnowledgeRoutes(app: any) {
  app.use('/api/knowledge', knowledgeRouter);
  console.log('[Knowledge] Routes registered at /api/knowledge/*');
  console.log('[Knowledge] Legal Index routes at /api/knowledge/legal-index/*');
  console.log('[Knowledge] Case Learning routes at /api/knowledge/cases/*');
  console.log('[Knowledge] Pattern Sync routes at /api/knowledge/patterns/*');
  
  professionalKnowledge.initialize().catch(err => {
    console.error('[Knowledge] Initialization failed:', err);
  });
  
  professionalKnowledge.startPatchScheduler();
}
