/**
 * Phase 1.2 - Z1 路由管理 API
 * 提供路由日志查询和用户偏好配置
 */

import { Router } from 'express';
import { 
  getZ1Status, 
  getRoutingLogs, 
  updateUserRoutingPreferences,
  routeZ1,
  getZ1RouterConfig,
  configureZ1Router,
} from '../services/z1-llm-router';
import { taskClassifier } from '../services/task-classifier';
import type { RoutingMode } from '@shared/schema';

const router = Router();

router.get('/status', async (req, res) => {
  try {
    const status = await getZ1Status();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/config', async (req, res) => {
  try {
    const config = getZ1RouterConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/config', async (req, res) => {
  try {
    const { primaryBrain, visionBrain, fastBrain, offlineBrain, models } = req.body;
    configureZ1Router({ primaryBrain, visionBrain, fastBrain, offlineBrain, models });
    res.json({
      success: true,
      data: getZ1RouterConfig(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await getRoutingLogs(userId, limit);
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/classify', async (req, res) => {
  try {
    const { message, routingMode } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }
    
    const result = taskClassifier.classify(message, routingMode as RoutingMode || 'BALANCED');
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const logs = await getRoutingLogs(userId, 1);
    res.json({
      success: true,
      data: {
        userId,
        recentRouting: logs[0] || null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { routingMode, customSensitiveKeywords, preferredProvider, blockedProviders, forceLocalForSensitive } = req.body;
    
    const success = await updateUserRoutingPreferences(userId, {
      routingMode,
      customSensitiveKeywords,
      preferredProvider,
      blockedProviders,
      forceLocalForSensitive,
    });
    
    res.json({
      success,
      message: success ? 'Preferences updated' : 'Failed to update preferences',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { message, userId, routingMode } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }
    
    const result = await routeZ1(
      [{ role: 'system', content: '你是小智，一个友好的AI助手。' }],
      message,
      {
        userId,
        routingMode: routingMode as RoutingMode,
        enableLogging: true,
      }
    );
    
    res.json({
      success: true,
      data: {
        response: result.response?.content,
        provider: result.provider,
        hpCost: result.hpCost,
        taskType: result.taskType,
        fallbackUsed: result.fallbackUsed,
        latencyMs: result.latencyMs,
        classification: result.classification,
        routingLogId: result.routingLogId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/sensitive-categories', (req, res) => {
  res.json({
    success: true,
    data: taskClassifier.getSensitiveCategories(),
  });
});

export default router;

console.log('[Z1Routing] 路由管理 API 已注册 /api/z1-routing/*');
