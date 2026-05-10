/**
 * Smart Assistant API - 极简智能助手接口
 *
 * 设计：只有一个入口，所有对话都通过这里
 */

import { Router, Request, Response } from 'express';
import { smartAssistant, XIAO_XING_PRINCIPLES } from '../services/assistant/SmartAssistant';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('SmartAssistantRoutes');

router.use(attachRole);

/**
 * POST /api/assistant/chat
 *
 * 核心入口：用户发送消息 → 小星响应
 *
 * 极简设计：
 * - 一个入口
 * - 自然语言
 * - 智能响应
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, type = 'text', source = 'app' } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
      return;
    }

    logger.info({
      messageLength: message.length,
      source,
      userId: req.user?.id
    }, 'User message received');

    // 构建用户消息
    const userMessage = {
      id: `msg_${Date.now()}`,
      content: message,
      type: type as 'text' | 'voice' | 'image',
      source: source as 'app' | 'wechat' | 'phone' | 'watch' | 'other',
      timestamp: new Date(),
      context: {
        time: new Date(),
        userState: {
          isDriving: false,
          isInMeeting: false,
        }
      }
    };

    // 小星处理
    const response = await smartAssistant.processMessage(userMessage);

    logger.info({
      responseId: response.id,
      responseType: response.type
    }, 'Response generated');

    // 返回
    res.json({
      success: true,
      response,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process message');
    res.status(500).json({
      success: false,
      error: '处理失败，请稍后重试',
      response: {
        type: 'report',
        message: '抱歉，我遇到了一点问题，请稍后重试。',
      }
    });
  }
});

/**
 * POST /api/assistant/voice
 *
 * 语音输入 → 小星响应
 */
router.post('/voice', async (req: Request, res: Response) => {
  try {
    const { audioUrl, source = 'phone' } = req.body;

    if (!audioUrl) {
      res.status(400).json({ success: false, error: '缺少音频地址' });
      return;
    }

    // 实际应该：语音转文字 → 处理文字
    // const text = await speechToText(audioUrl);
    const text = '模拟的语音转文字结果';

    const response = await smartAssistant.processMessage({
      id: `msg_${Date.now()}`,
      content: text,
      type: 'voice',
      source: source as any,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      text,
      response,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '处理失败' });
  }
});

/**
 * POST /api/assistant/authorize
 *
 * 用户授权确认
 */
router.post('/authorize', async (req: Request, res: Response) => {
  try {
    const { responseId, action, modifications } = req.body;

    // 根据用户的授权动作继续执行
    // ...

    res.json({
      success: true,
      message: '好的，我这就去做',
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '授权处理失败' });
  }
});

/**
 * GET /api/assistant/principles
 *
 * 查看小星的原则
 */
router.get('/principles', (req: Request, res: Response) => {
  res.json({
    success: true,
    principles: XIAO_XING_PRINCIPLES,
  });
});

/**
 * GET /api/assistant/capabilities
 *
 * 查看小星的能力
 */
router.get('/capabilities', (req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: [
      {
        name: 'calendar',
        description: '日历管理',
        examples: ['帮我安排明天下午3点开会', '明天有什么安排'],
      },
      {
        name: 'navigation',
        description: '导航服务',
        examples: ['导航到北京西站', '去机场最快的路线'],
      },
      {
        name: 'booking',
        description: '预订服务',
        examples: ['帮我订个酒店', '预订餐厅'],
      },
      {
        name: 'search',
        description: '搜索查询',
        examples: ['查一下科技局最新政策', '搜索高企认定条件'],
      },
      {
        name: 'meeting',
        description: '会议管理',
        examples: ['安排周会', '生成会议纪要'],
      },
      {
        name: 'recommendation',
        description: '智能推荐',
        examples: ['推荐附近餐厅', '有什么好玩的'],
      },
      {
        name: 'browser',
        description: '网页操作',
        examples: ['帮我查下这个网站', '填写这个表单'],
      },
    ],
  });
});

/**
 * POST /api/assistant/demo
 *
 * 演示各种场景
 */
router.post('/demo', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;

    const scenarios: Record<string, string> = {
      // 场景1：安排出差
      'trip': '小星，我明天要去北京出差，帮我安排下行程',

      // 场景2：接人
      'pickup': '陈哥晚上10点到郑州，帮我安排下去接他',

      // 场景3：安排会议
      'meeting': '明天上午要开周会，给团队总结下上周工作，以后每周一都开',

      // 场景4：查询政策
      'policy': '帮我查一下最新科技型中小企业扶持政策',

      // 场景5：情绪关心
      'care': '最近工作压力好大，睡眠也不好',

      // 场景6：复杂任务
      'complex': '我下周要去深圳出差见客户，顺便见个老朋友，帮我安排下',
    };

    const message = scenarios[scenario] || '你好，小星';

    const response = await smartAssistant.processMessage({
      id: `demo_${Date.now()}`,
      content: message,
      type: 'text',
      source: 'app',
      timestamp: new Date(),
    });

    res.json({
      success: true,
      scenario,
      message,
      response,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '演示失败' });
  }
});

export default router;
