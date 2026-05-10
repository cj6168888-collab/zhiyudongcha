import { Router, Request, Response } from 'express';
import { syncService } from '../../services/sync/sync-service';
import { logger } from '../../lib/logger';

const router = Router();

router.post('/messages', async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, messages: incomingMessages, force = false, since } = req.body;

    if (!userId || !sessionId || !incomingMessages) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: userId, sessionId, messages',
      });
    }

    const result = await syncService.syncMessages(userId, incomingMessages, force, since);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        conflict: result.conflict,
        synced: result.data?.length || 0,
        timestamp: Date.now(),
      });
    }

    return res.status(500).json({
      success: false,
      error: result.error,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '同步消息失败');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '同步失败',
    });
  }
});

router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, since, limit } = req.query;

    if (!userId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: userId, sessionId',
      });
    }

    const messages = await syncService.getMessages(
      userId as string,
      sessionId as string,
      since ? parseInt(since as string) : undefined,
      limit ? parseInt(limit as string) : 100
    );

    return res.json({
      success: true,
      data: messages,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('获取消息失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.post('/config', async (req: Request, res: Response) => {
  try {
    const { userId, config, timestamp, force = false } = req.body;

    if (!userId || !config) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: userId, config',
      });
    }

    const syncConfig = {
      userId,
      config,
      timestamp: timestamp || Date.now(),
    };

    const result = await syncService.syncConfig(userId, syncConfig, force);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        conflict: result.conflict,
        timestamp: Date.now(),
      });
    }

    return res.status(500).json({
      success: false,
      error: result.error,
    });
  } catch (error) {
    console.error('同步配置失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '同步失败',
    });
  }
});

router.get('/config/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'];

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: userId',
      });
    }

    const config = await syncService.getConfig(userId);

    return res.json({
      success: true,
      data: config,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.post('/state', async (req: Request, res: Response) => {
  try {
    const { userId, state, timestamp, force = false } = req.body;

    if (!userId || !state) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: userId, state',
      });
    }

    const syncState = {
      userId,
      state,
      timestamp: timestamp || Date.now(),
    };

    const result = await syncService.syncState(userId, syncState, force);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        conflict: result.conflict,
        timestamp: Date.now(),
      });
    }

    return res.status(500).json({
      success: false,
      error: result.error,
    });
  } catch (error) {
    console.error('同步状态失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '同步失败',
    });
  }
});

router.get('/state/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'];

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: userId',
      });
    }

    const state = await syncService.getState(userId);

    return res.json({
      success: true,
      data: state,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('获取状态失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'];

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: userId',
      });
    }

    const [recentMessages, config, state] = await Promise.all([
      syncService.getMessages(userId, 'default', undefined, 1),
      syncService.getConfig(userId),
      syncService.getState(userId),
    ]);

    const stats = syncService.getStats();

    return res.json({
      success: true,
      data: {
        lastSyncTime: recentMessages[0]?.timestamp || null,
        hasConfig: !!config,
        hasState: !!state,
        serverTime: Date.now(),
        stats,
      },
    });
  } catch (error) {
    console.error('获取同步状态失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
    });
  }
});

router.post('/clear', async (_req: Request, res: Response) => {
  try {
    syncService.clear();

    return res.json({
      success: true,
      message: '同步存储已清空',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('清空存储失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '清空失败',
    });
  }
});

export default router;
