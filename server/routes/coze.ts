/**
 * 扣子AI API 路由
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { Router, Request, Response } from 'express';
import { cozeAPI, WorkflowDefinition } from '../lib/coze-api';

const router = Router();

/**
 * 检查配置状态
 */
router.get('/status', async (req: Request, res: Response) => {
  const config = cozeAPI.getConfig();
  res.json({
    success: true,
    configured: config.configured,
    workflowsConfigured: config.hasWorkflows,
  });
});

/**
 * 获取配置详情
 */
router.get('/config', async (req: Request, res: Response) => {
  const config = cozeAPI.getConfig();
  res.json({
    success: true,
    configured: config.configured,
    workflowsConfigured: config.hasWorkflows,
    message: config.configured
      ? '扣子API已配置'
      : '扣子API未配置，请设置API密钥',
  });
});

/**
 * 更新配置 (从用户设置)
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    cozeAPI.updateFromSettings(settings);
    const config = cozeAPI.getConfig();
    res.json({
      success: true,
      configured: config.configured,
      workflowsConfigured: config.hasWorkflows,
      message: '配置已更新',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 获取配置字段说明
 */
router.get('/config/fields', async (req: Request, res: Response) => {
  res.json({
    success: true,
    fields: {
      cozeApiKey: {
        name: 'COZE_API_KEY',
        description: '扣子API密钥',
        type: 'string',
        required: true,
        placeholder: 'pat_xxxxxx',
      },
      cozeBotId: {
        name: 'COZE_BOT_ID',
        description: '扣子Bot ID',
        type: 'string',
        required: false,
      },
      cozeWorkflowId: {
        name: 'COZE_WORKFLOW_ID',
        description: '默认工作流ID',
        type: 'string',
        required: false,
      },
      cozeWorkflowFormat: {
        name: '文档排版工作流',
        description: '用于文档格式优化',
        type: 'string',
        required: false,
      },
      cozeWorkflowPolish: {
        name: '文章润色工作流',
        description: '用于文章润色改写',
        type: 'string',
        required: false,
      },
      cozeWorkflowTranslate: {
        name: '文档翻译工作流',
        description: '用于文档翻译',
        type: 'string',
        required: false,
      },
      cozeWorkflowSummarize: {
        name: '文档摘要工作流',
        description: '用于文档摘要提取',
        type: 'string',
        required: false,
      },
      cozeWorkflowPpt: {
        name: 'PPT生成工作流',
        description: '用于PPT内容生成',
        type: 'string',
        required: false,
      },
      cozeWorkflowReport: {
        name: '报告生成工作流',
        description: '用于商业报告生成',
        type: 'string',
        required: false,
      },
    },
  });
});

/**
 * 获取工作流列表
 */
router.get('/workflows', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    let workflows: WorkflowDefinition[];

    if (category && typeof category === 'string') {
      workflows = cozeAPI.getWorkflowsByCategory(category as WorkflowDefinition['category']);
    } else {
      workflows = cozeAPI.getWorkflows();
    }

    res.json({
      success: true,
      data: workflows,
      total: workflows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 获取单个工作流详情
 */
router.get('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = cozeAPI.getWorkflow(id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: '工作流不存在' });
    }

    res.json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 调用工作流
 */
router.post('/workflows/run', async (req: Request, res: Response) => {
  try {
    const { workflowId, input } = req.body;

    if (!workflowId || !input) {
      return res.status(400).json({ success: false, error: 'workflowId和input必填' });
    }

    const result = await cozeAPI.callWorkflow(workflowId, input);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 智能调用
 */
router.post('/smart', async (req: Request, res: Response) => {
  try {
    const { content, context } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content必填' });
    }

    const result = await cozeAPI.smartCall(content, context);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 文档排版
 */
router.post('/document/format', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content必填' });
    }

    const result = await cozeAPI.formatDocument(content);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 文档润色
 */
router.post('/document/polish', async (req: Request, res: Response) => {
  try {
    const { content, style } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content必填' });
    }

    const result = await cozeAPI.polishContent(content, style);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 文档翻译
 */
router.post('/document/translate', async (req: Request, res: Response) => {
  try {
    const { content, targetLang } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content必填' });
    }

    const result = await cozeAPI.translate(content, targetLang || '中文');

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 文档摘要
 */
router.post('/document/summarize', async (req: Request, res: Response) => {
  try {
    const { content, maxLength } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content必填' });
    }

    const result = await cozeAPI.summarize(content, maxLength);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * PPT内容生成
 */
router.post('/ppt/generate', async (req: Request, res: Response) => {
  try {
    const { topic, slides, audience } = req.body;

    if (!topic) {
      return res.status(400).json({ success: false, error: 'topic必填' });
    }

    const result = await cozeAPI.generatePPTContent(
      topic,
      slides || 10,
      audience
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 商业报告生成
 */
router.post('/report/generate', async (req: Request, res: Response) => {
  try {
    const { type, data, period } = req.body;

    if (!type || !data) {
      return res.status(400).json({ success: false, error: 'type和data必填' });
    }

    const validTypes = ['monthly', 'quarterly', 'annual', 'project', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'type必须是: ' + validTypes.join(', ') });
    }

    const result = await cozeAPI.generateBusinessReport(type, data, period);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 智能问答
 */
router.post('/qa', async (req: Request, res: Response) => {
  try {
    const { question, category, context, history } = req.body;

    if (!question) {
      return res.status(400).json({ success: false, error: 'question必填' });
    }

    const result = await cozeAPI.intelligentQA(question, { category, context, history });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 通用聊天
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'message必填' });
    }

    const result = await cozeAPI.chat(message);

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 批量处理
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items必须是数组' });
    }

    const results = await cozeAPI.batchProcess(items);

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
