/**
 * Natural Language Command API - 自然语言指令接口
 *
 * POST /api/agent/nl - 处理自然语言指令
 */

import { Router, Request, Response } from 'express';
import { naturalLanguageAgent } from '../services/agent/NaturalLanguageAgent';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('NLCommandRoutes');

router.use(attachRole);

/**
 * POST /api/agent/nl
 * 处理自然语言指令
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { command, context } = req.body;

    if (!command || typeof command !== 'string') {
      res.status(400).json({
        success: false,
        error: '缺少 command 参数'
      });
      return;
    }

    logger.info({ command, userId: req.userRole }, 'Processing natural language command');

    // 获取用户信息
    const userContext = {
      userId: req.user?.id || req.session?.userId,
      companyInfo: context?.companyInfo,
      credentials: context?.credentials,
    };

    // 执行命令
    const result = await naturalLanguageAgent.processCommand(command, userContext);

    res.json({
      success: result.success,
      taskId: result.taskId,
      requiresInput: result.steps.some(s => s.output?.requiresInput),
      steps: result.steps.map(s => ({
        id: s.step.id,
        description: s.step.description,
        success: s.success,
        output: s.output,
        error: s.error,
      })),
      reflections: result.reflections,
      finalResult: result.finalResult,
      suggestions: result.suggestions,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process natural language command');
    res.status(500).json({
      success: false,
      error: '处理失败: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

/**
 * POST /api/agent/nl/continue
 * 继续执行需要用户输入的任务
 */
router.post('/continue', async (req: Request, res: Response) => {
  try {
    const { taskId, userInput } = req.body;

    if (!taskId || !userInput) {
      res.status(400).json({
        success: false,
        error: '缺少 taskId 或 userInput'
      });
      return;
    }

    // 继续执行，传入用户输入
    const result = await naturalLanguageAgent.processCommand(userInput, {
      continuingTaskId: taskId,
    });

    res.json({
      success: result.success,
      taskId: result.taskId,
      steps: result.steps,
      reflections: result.reflections,
      finalResult: result.finalResult,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to continue task');
    res.status(500).json({
      success: false,
      error: '继续执行失败'
    });
  }
});

/**
 * GET /api/agent/nl/capabilities
 * 获取支持的能力
 */
router.get('/capabilities', async (req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: {
      intentTypes: ['inquiry', 'application', 'monitor', 'report', 'search', 'automation'],
      supportedActions: [
        'search_and_navigate',
        'analyze_page_structure',
        'fill_forms',
        'submit_applications',
        'extract_information',
        'monitor_changes',
        'generate_reports',
      ],
      supportedWebsites: 'any',  // 支持任何网站
      requiresCredentials: true,
      supportsScheduling: true,
    },
    examples: [
      {
        command: '帮我查一下科技局的最新政策',
        description: '搜索并分析科技局网站的政策信息',
      },
      {
        command: '帮我申报高新技术企业认定',
        description: '分析申报流程并协助填写表单',
      },
      {
        command: '监控税务局的回复，有新消息就通知我',
        description: '定期检查税务局网站并发送通知',
      },
      {
        command: '整理一下我桌面的文件，把项目相关的归档',
        description: '分析桌面文件并进行整理',
      },
    ],
  });
});

export default router;
