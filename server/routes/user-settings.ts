import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireAuth, requireMaster } from '../middleware/auth';
import { userService } from '../services/UserService';
import { cozeAPI } from '../lib/coze-api';
import { z } from 'zod';

const logger = createServiceLogger('UserSettingsRoutes');

const userSettingsUpdateSchema = z.object({
  voiceEnabled: z.string().optional(),
  autoAnalyze: z.string().optional(),
  wakeWordSensitivity: z.number().min(0).max(1).optional(),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  avatarName: z.string().min(1).max(50).optional(),
  avatarEmoji: z.string().max(10).optional(),
  preferredLanguage: z.string().optional(),
  // Coze AI配置
  cozeEnabled: z.string().optional(),
  cozeApiKey: z.string().optional(),
  cozeBotId: z.string().optional(),
  cozeWorkflowId: z.string().optional(),
  cozeWorkflowDocFormat: z.string().optional(),
  cozeWorkflowDocPolish: z.string().optional(),
  cozeWorkflowDocTranslate: z.string().optional(),
  cozeWorkflowDocSummarize: z.string().optional(),
  cozeWorkflowPpt: z.string().optional(),
  cozeWorkflowReport: z.string().optional(),
  cozeWorkflowCodeReview: z.string().optional(),
});

export function registerUserSettingsRoutes(app: Express, context: RouteContext): void {

  app.get('/api/user-settings/:userId', requireAuth, async (req, res) => {
    try {
      const userId = req.params.userId;
      if (userId !== 'master' && userId !== 'guest') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid userId' }
        });
      }

      if (req.userRole === 'GUEST' && userId === 'master') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此设置' }
        });
      }

      let settings: Record<string, unknown>;
      try {
        settings = await userService.getUserSettings(userId);
      } catch (error) {
        settings = await userService.updateUserSettings(userId, {});
      }
      return res.json({ success: true, data: settings });
    } catch (error) {
      logger.error({ err: error }, 'Get settings error');
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: '获取用户设置失败' }
      });
    }
  });

  app.patch('/api/user-settings/:userId', requireMaster, async (req, res) => {
    try {
      const userId = req.params.userId;
      if (userId !== 'master') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: '只能修改master设置' }
        });
      }

      const parseResult = userSettingsUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: parseResult.error.flatten()
          }
        });
      }

      const updates = parseResult.data;

      // 如果更新包含Coze配置，同步到Coze API服务
      if (updates.cozeEnabled || updates.cozeApiKey) {
        cozeAPI.updateFromSettings(updates);
      }

      const settings = await userService.updateUserSettings(userId, updates);

      return res.json({ success: true, data: settings });
    } catch (error) {
      logger.error({ err: error }, 'Update settings error');
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: '更新用户设置失败' }
      });
    }
  });

  app.get('/api/user-settings', requireMaster, async (_req, res) => {
    try {
      const allSettings = await userService.getAllUserSettings();
      return res.json({ success: true, data: allSettings });
    } catch (error) {
      logger.error({ err: error }, 'Get all settings error');
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: '获取所有用户设置失败' }
      });
    }
  });

  logger.info('UserSettings routes registered');
}
