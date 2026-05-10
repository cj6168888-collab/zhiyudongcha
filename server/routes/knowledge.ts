/**
 * 知识库API路由
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { Router, Request, Response } from 'express';
import { programKnowledgeBase, programLearner, programDiscoveryService } from '../services/knowledge';

const router = Router();

/**
 * 获取所有程序
 */
router.get('/programs', async (req: Request, res: Response) => {
  try {
    const { category, platform, search } = req.query;

    let programs = programKnowledgeBase.getAllPrograms();

    // 按分类筛选
    if (category && typeof category === 'string') {
      programs = programs.filter(p => p.category === category);
    }

    // 按平台筛选
    if (platform && typeof platform === 'string') {
      programs = programs.filter(p => p.platforms.includes(platform as string));
    }

    // 搜索
    if (search && typeof search === 'string') {
      const results = programKnowledgeBase.searchPrograms(search);
      const resultIds = new Set(results.map(r => r.id));
      programs = programs.filter(p => resultIds.has(p.id));
    }

    res.json({
      success: true,
      data: programs,
      total: programs.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 获取单个程序详情
 */
router.get('/programs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const program = programKnowledgeBase.getProgram(id);

    if (!program) {
      return res.status(404).json({ success: false, error: '程序不存在' });
    }

    res.json({ success: true, data: program });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 获取程序操作
 */
router.get('/programs/:id/operations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const program = programKnowledgeBase.getProgram(id);

    if (!program) {
      return res.status(404).json({ success: false, error: '程序不存在' });
    }

    res.json({ success: true, data: program.operations });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 匹配用户意图
 */
router.post('/programs/match', async (req: Request, res: Response) => {
  try {
    const { intent } = req.body;

    if (!intent || typeof intent !== 'string') {
      return res.status(400).json({ success: false, error: 'intent参数必填' });
    }

    const matches = programKnowledgeBase.matchIntent(intent);

    res.json({
      success: true,
      data: matches.slice(0, 10),
      total: matches.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 手动学习新程序
 */
router.post('/programs', async (req: Request, res: Response) => {
  try {
    const program = req.body;

    if (!program.id || !program.name) {
      return res.status(400).json({ success: false, error: '程序ID和名称必填' });
    }

    programKnowledgeBase.learnProgram(program);

    res.json({ success: true, message: '程序已学习' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 更新程序
 */
router.put('/programs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const success = programKnowledgeBase.updateProgram(id, updates);

    if (!success) {
      return res.status(404).json({ success: false, error: '程序不存在' });
    }

    res.json({ success: true, message: '程序已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 添加程序操作
 */
router.post('/programs/:id/operations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operation = req.body;

    if (!operation.id || !operation.name) {
      return res.status(400).json({ success: false, error: '操作ID和名称必填' });
    }

    const success = programKnowledgeBase.addOperation(id, operation);

    if (!success) {
      return res.status(404).json({ success: false, error: '程序不存在' });
    }

    res.json({ success: true, message: '操作已添加' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 发现新程序
 */
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { packageName, platform } = req.body;

    if (!packageName || !platform) {
      return res.status(400).json({ success: false, error: 'packageName和platform必填' });
    }

    const result = await programDiscoveryService.discoverProgram(packageName, platform);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 批量发现
 */
router.post('/discover/batch', async (req: Request, res: Response) => {
  try {
    const { programs } = req.body;

    if (!Array.isArray(programs)) {
      return res.status(400).json({ success: false, error: 'programs必须是数组' });
    }

    const results = await programDiscoveryService.batchDiscover(programs);

    res.json({
      success: true,
      data: Object.fromEntries(results),
      total: results.size,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 获取已发现的程序
 */
router.get('/discovered', async (req: Request, res: Response) => {
  try {
    const programs = programDiscoveryService.getDiscoveredPrograms();
    res.json({ success: true, data: programs, total: programs.length });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 记录执行日志
 */
router.post('/learn/log', async (req: Request, res: Response) => {
  try {
    const { programId, operation, parameters, result, userId } = req.body;

    if (!programId || !operation || !result) {
      return res.status(400).json({ success: false, error: '缺少必填参数' });
    }

    programLearner.logExecution(programId, operation, parameters || {}, result, userId);

    res.json({ success: true, message: '日志已记录' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 记录用户反馈
 */
router.post('/learn/feedback', async (req: Request, res: Response) => {
  try {
    const { programId, operation, feedback, userId } = req.body;

    if (!programId || !operation || !feedback) {
      return res.status(400).json({ success: false, error: '缺少必填参数' });
    }

    programLearner.recordFeedback(programId, operation, feedback, userId);

    res.json({ success: true, message: '反馈已记录' });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 获取学习报告
 */
router.get('/learn/report', async (req: Request, res: Response) => {
  try {
    const report = programLearner.generateLearningReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 导出学习日志
 */
router.get('/learn/logs', async (req: Request, res: Response) => {
  try {
    const logs = programLearner.exportLogs();
    res.json({ success: true, data: JSON.parse(logs) });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 清除旧日志
 */
router.delete('/learn/logs', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const olderThanDays = days ? parseInt(days as string) : 30;

    const removed = programLearner.clearOldLogs(olderThanDays);

    res.json({ success: true, removed });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 获取数据库统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const programs = programKnowledgeBase.getAllPrograms();
    const discoveryReport = programDiscoveryService.generateDiscoveryReport();
    const learningReport = programLearner.generateLearningReport();

    res.json({
      success: true,
      data: {
        programs: {
          total: programs.length,
          byCategory: programKnowledgeBase.getCategoryStats(),
          byPlatform: programKnowledgeBase.getPlatformStats(),
        },
        discovery: discoveryReport,
        learning: learningReport,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 导出数据库
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const database = programKnowledgeBase.exportDatabase();
    res.json({ success: true, data: JSON.parse(database) });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * 导入数据库
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'data参数必填' });
    }

    const count = programKnowledgeBase.importDatabase(JSON.stringify(data));

    res.json({ success: true, imported: count });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
