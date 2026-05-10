/**
 * 小智 Plugin System Routes - 热更新插件系统API
 * 
 * 提供插件管理、验证、激活/停用、回滚等API接口
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, Request, Response } from 'express';
import { pluginSystem, PluginType, PluginStatus } from '../services/plugin-system';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await pluginSystem.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计失败',
    });
  }
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query;
    const filter: { type?: PluginType; status?: PluginStatus } = {};
    
    if (type) filter.type = type as PluginType;
    if (status) filter.status = status as PluginStatus;
    
    const plugins = await pluginSystem.listPlugins(filter);
    res.json({
      success: true,
      plugins,
      total: plugins.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取插件列表失败',
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const plugin = pluginSystem.getPlugin(req.params.id);
    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: '插件不存在',
      });
    }
    res.json({
      success: true,
      plugin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取插件详情失败',
    });
  }
});

router.post('/logic-package', async (req: Request, res: Response) => {
  try {
    const { name, description, decisionWeights, responseTemplates, processingRules, triggerConditions } = req.body;
    
    if (!name || !description || !decisionWeights) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: name, description, decisionWeights',
      });
    }
    
    const plugin = await pluginSystem.createLogicPackage({
      name,
      description,
      decisionWeights,
      responseTemplates,
      processingRules,
      triggerConditions,
    });
    
    res.json({
      success: true,
      plugin,
      message: '逻辑指令包创建成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    });
  }
});

router.post('/knowledge-patch', async (req: Request, res: Response) => {
  try {
    const { name, description, domain, entries, synonyms, relations } = req.body;
    
    if (!name || !description || !domain || !entries) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: name, description, domain, entries',
      });
    }
    
    const plugin = await pluginSystem.createKnowledgePatch({
      name,
      description,
      domain,
      entries,
      synonyms,
      relations,
    });
    
    res.json({
      success: true,
      plugin,
      message: '知识库补丁创建成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    });
  }
});

router.post('/behavior-profile', async (req: Request, res: Response) => {
  try {
    const { name, description, toneStyle, responsePatterns, emotionalTuning } = req.body;
    
    if (!name || !description || !toneStyle) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: name, description, toneStyle',
      });
    }
    
    const plugin = await pluginSystem.createBehaviorProfile({
      name,
      description,
      toneStyle,
      responsePatterns,
      emotionalTuning,
    });
    
    res.json({
      success: true,
      plugin,
      message: '行为配置创建成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    });
  }
});

router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const result = await pluginSystem.validatePlugin(req.params.id);
    res.json({
      success: true,
      validation: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '验证失败',
    });
  }
});

router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const success = await pluginSystem.activatePlugin(req.params.id);
    res.json({
      success,
      message: success ? '插件已激活' : '激活失败',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '激活失败',
    });
  }
});

router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const success = await pluginSystem.deactivatePlugin(req.params.id);
    res.json({
      success,
      message: success ? '插件已停用' : '停用失败',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '停用失败',
    });
  }
});

router.post('/:id/rollback', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const success = await pluginSystem.rollbackPlugin(req.params.id, reason || '手动回滚');
    res.json({
      success,
      message: success ? '插件已回滚' : '回滚失败',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '回滚失败',
    });
  }
});

router.get('/active/decision-weights', async (req: Request, res: Response) => {
  try {
    const weights = pluginSystem.getActiveDecisionWeights();
    res.json({
      success: true,
      weights,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.get('/active/response-templates', async (req: Request, res: Response) => {
  try {
    const templates = pluginSystem.getActiveResponseTemplates();
    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.get('/active/knowledge', async (req: Request, res: Response) => {
  try {
    const { domain } = req.query;
    const knowledge = pluginSystem.getActiveKnowledge(domain as string | undefined);
    res.json({
      success: true,
      knowledge,
      count: knowledge.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.get('/active/behavior', async (req: Request, res: Response) => {
  try {
    const behavior = pluginSystem.getCurrentBehaviorProfile();
    res.json({
      success: true,
      behavior,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

export default router;
