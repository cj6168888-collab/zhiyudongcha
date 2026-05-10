/**
 * Meeting API - 智能会议助手接口
 */

import { Router, Request, Response } from 'express';
import { meetingAgent } from '../services/agent/MeetingAgent';
import { naturalLanguageAgent } from '../services/agent/NaturalLanguageAgent';
import { createServiceLogger } from '../lib/logger';
import { attachRole } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('MeetingRoutes');

router.use(attachRole);

/**
 * POST /api/meeting/create
 * 创建会议
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const request = req.body;

    const result = await meetingAgent.processRequest({
      description: request.description,
      title: request.title,
      type: request.type,
      startTime: request.startTime ? new Date(request.startTime) : undefined,
      duration: request.duration,
      participants: request.participants,
      recurrence: request.recurrence,
      collectMaterials: request.collectMaterials,
      generateAgenda: request.generateAgenda,
    });

    res.json({
      success: result.success,
      meeting: result.meeting,
      actions: result.actions,
      messages: result.messages,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to create meeting');
    res.status(500).json({ success: false, error: '创建会议失败' });
  }
});

/**
 * POST /api/meeting/nl
 * 自然语言创建会议
 */
router.post('/nl', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;

    if (!command) {
      res.status(400).json({ success: false, error: '缺少 command 参数' });
      return;
    }

    logger.info({ command }, 'Processing meeting command');

    // 使用 MeetingAgent 处理
    const result = await meetingAgent.processRequest({
      description: command,
    });

    res.json({
      success: result.success,
      meeting: result.meeting,
      actions: result.actions,
      messages: result.messages,
    });

  } catch (error) {
    logger.error({ err: error }, 'Failed to process meeting command');
    res.status(500).json({ success: false, error: '处理失败' });
  }
});

/**
 * GET /api/meeting/templates
 * 获取会议模板
 */
router.get('/templates', (req: Request, res: Response) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'weekly',
        name: '周会',
        type: '周会',
        defaultDuration: 60,
        agenda: [
          { title: '上周工作总结', duration: 20 },
          { title: '本周工作计划', duration: 15 },
          { title: '问题与支持', duration: 10 },
          { title: '任务分配', duration: 10 },
          { title: '自由讨论', duration: 5 },
        ],
      },
      {
        id: 'monthly',
        name: '月会',
        type: '月会',
        defaultDuration: 90,
        agenda: [
          { title: '本月工作汇报', duration: 25 },
          { title: 'KPI完成情况', duration: 15 },
          { title: '问题分析', duration: 15 },
          { title: '下月计划', duration: 20 },
          { title: '总结', duration: 15 },
        ],
      },
      {
        id: 'standup',
        name: '站会',
        type: '日常',
        defaultDuration: 15,
        agenda: [
          { title: '昨天做了什么', duration: 5 },
          { title: '今天要做什么', duration: 5 },
          { title: '遇到什么阻碍', duration: 5 },
        ],
      },
      {
        id: 'one-on-one',
        name: '一对一',
        type: '一对一',
        defaultDuration: 30,
        agenda: [
          { title: '工作反馈', duration: 10 },
          { title: '职业发展', duration: 10 },
          { title: '问题与建议', duration: 10 },
        ],
      },
    ],
  });
});

/**
 * POST /api/meeting/materials
 * 请求会议资料
 */
router.post('/materials', async (req: Request, res: Response) => {
  try {
    const { meetingId, participantIds, requestMessage } = req.body;

    res.json({
      success: true,
      message: '资料收集请求已发送',
      requestId: `req_${Date.now()}`,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '请求失败' });
  }
});

/**
 * POST /api/meeting/minutes
 * 生成会议纪要
 */
router.post('/minutes', async (req: Request, res: Response) => {
  try {
    const { meetingId, discussions } = req.body;

    const minutes = await meetingAgent.generateMinutes(meetingId, discussions || []);

    res.json({
      success: true,
      minutes,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '生成失败' });
  }
});

/**
 * GET /api/meeting/summary
 * 获取工作总结
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { userId, weekNumber } = req.query;

    const summary = await meetingAgent.extractWorkSummary(
      userId as string || 'default',
      weekNumber ? parseInt(weekNumber as string) : undefined
    );

    res.json({
      success: true,
      summary,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

/**
 * POST /api/meeting/team
 * 设置团队成员
 */
router.post('/team', (req: Request, res: Response) => {
  try {
    const { members } = req.body;

    if (members && Array.isArray(members)) {
      meetingAgent.setTeamMembers(members);
    }

    res.json({
      success: true,
      message: `已设置 ${members?.length || 0} 位团队成员`,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '设置失败' });
  }
});

/**
 * 模拟测试接口
 */
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const command = `小星，明天上午要开周会，给团队总结下上周的工作，听听团队的汇报，布置下任务，你帮我安排资料；另外以后每周一上午都要开周会`;

    const result = await meetingAgent.processRequest({
      description: command,
    });

    res.json({
      success: true,
      command,
      result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: '模拟失败' });
  }
});

export default router;
