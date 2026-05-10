/**
 * 主动事件监控 API 路由
 * Proactive Event Monitor API Routes
 */

import { Router, Request } from 'express';

const router = Router();

/**
 * 从请求中获取用户ID
 */
function getUserId(req: Request): string | null {
  return (req.body as Record<string, unknown>).userId || req.session?.userId || null;
}

/**
 * GET /api/v1/event-monitor/status
 * 获取监控服务状态
 */
router.get('/status', (req, res) => {
  try {
    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    const status = proactiveEventMonitor.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/event-monitor/preferences
 * 设置用户偏好
 */
router.post('/preferences', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    const {
      interestedCategories,
      interestedEventTypes,
      followedIndustries,
      followedCompanies,
      notifyEnabled,
      notifyTypes,
      minImpactLevel,
      activeHoursStart,
      activeHoursEnd,
    } = req.body;

    proactiveEventMonitor.setUserPreferences({
      userId,
      interestedCategories: interestedCategories || [],
      interestedEventTypes: interestedEventTypes || [],
      followedIndustries: followedIndustries || [],
      followedCompanies: followedCompanies || [],
      notifyEnabled: notifyEnabled !== false,
      notifyTypes: notifyTypes || ['BUBBLE'],
      minImpactLevel: minImpactLevel || 'MEDIUM',
      activeHoursStart: activeHoursStart || '09:00',
      activeHoursEnd: activeHoursEnd || '22:00',
    });

    res.json({
      success: true,
      message: '偏好设置已保存',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/event-monitor/preferences
 * 获取用户偏好
 */
router.get('/preferences', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    const prefs = proactiveEventMonitor.getUserPreferences(userId);

    res.json({
      success: true,
      data: prefs || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/event-monitor/alerts
 * 获取用户提醒列表
 */
router.get('/alerts', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    const limit = parseInt(req.query.limit as string) || 20;
    const alerts = proactiveEventMonitor.getUserAlerts(userId).slice(0, limit);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/event-monitor/alerts/unread-count
 * 获取未读提醒数量
 */
router.get('/alerts/unread-count', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    const count = proactiveEventMonitor.getUnreadAlertCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/event-monitor/alerts/:alertId/read
 * 标记提醒为已读
 */
router.post('/alerts/:alertId/read', (req, res) => {
  try {
    const userId = getUserId(req);
    const { alertId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    proactiveEventMonitor.markAsRead(alertId, userId);

    res.json({
      success: true,
      message: '已标记为已读',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/v1/event-monitor/alerts/:alertId
 * 删除/忽略提醒
 */
router.delete('/alerts/:alertId', (req, res) => {
  try {
    const userId = getUserId(req);
    const { alertId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    proactiveEventMonitor.dismissAlert(alertId, userId);

    res.json({
      success: true,
      message: '提醒已删除',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/v1/event-monitor/alerts
 * 清除所有提醒
 */
router.delete('/alerts', (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    proactiveEventMonitor.clearAlerts(userId);

    res.json({
      success: true,
      message: '所有提醒已清除',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/event-monitor/trigger
 * 手动触发事件检查
 */
router.post('/trigger', async (req, res) => {
  try {
    const { proactiveEventMonitor } = require('../services/proactive-event-monitor');
    await proactiveEventMonitor.triggerManualCheck();

    res.json({
      success: true,
      message: '事件检查已完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
