/**
 * 智能对话 API 路由
 *
 * 统一的语音/文字对话入口，自动理解意图并执行功能
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ConversationAPI');

import type { Express, Request, Response } from 'express';
import type { IStorage } from '../storage';
import type { RegisterRouteFn } from './types';
import {
  processUserInput,
  processVoiceCommand,
  clearConversationHistory,
  getConversationHistory,
  getConversationStats
} from '../services/smart-conversation';
import { registerAvatarTools } from '../services/avatar-tools';

let toolsRegistered = false;

export const registerConversationRoutes: RegisterRouteFn = (app, storage, context) => {

  if (!toolsRegistered) {
    registerAvatarTools();
    toolsRegistered = true;
  }

  app.post('/api/conversation/chat', async (req: Request, res: Response) => {
    try {
      const { message, userId = 'default', useHistory = true } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '请提供消息内容' }
        });
      }

      logger.info({ userId, message: message.substring(0, 50) }, '收到对话请求');

      const result = await processUserInput(userId, message, storage, {
        useHistory,
        executeCommand: true,
      });

      res.json({
        success: true,
        data: {
          response: result.response,
          action: result.action,
          entity: result.entity,
          toolsCalled: result.toolsCalled,
          thinking: result.chainOfThought,
        }
      });

    } catch (error) {
      logger.error({ err: error }, '对话处理失败');
      res.status(500).json({
        success: false,
        error: { code: 'PROCESS_ERROR', message: '对话处理失败' }
      });
    }
  });

  app.post('/api/conversation/voice', async (req: Request, res: Response) => {
    try {
      const { text, userId = 'default' } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '请提供语音转写文本' }
        });
      }

      logger.info({ userId, text: text.substring(0, 50) }, '收到语音命令');

      const result = await processVoiceCommand(userId, text, storage);

      res.json({
        success: true,
        data: {
          response: result.response,
          action: result.action,
          entity: result.entity,
          executed: !!result.toolsCalled,
          details: result.toolsCalled,
        }
      });

    } catch (error) {
      logger.error({ err: error }, '语音命令处理失败');
      res.status(500).json({
        success: false,
        error: { code: 'PROCESS_ERROR', message: '语音命令处理失败' }
      });
    }
  });

  app.get('/api/conversation/history/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const history = getConversationHistory(userId);

      res.json({
        success: true,
        data: {
          userId,
          messages: history,
          count: history.length,
        }
      });

    } catch (error) {
      logger.error({ err: error }, '获取对话历史失败');
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: '获取对话历史失败' }
      });
    }
  });

  app.delete('/api/conversation/history/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      clearConversationHistory(userId);

      res.json({
        success: true,
        data: { message: '对话历史已清除' }
      });

    } catch (error) {
      logger.error({ err: error }, '清除对话历史失败');
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_ERROR', message: '清除对话历史失败' }
      });
    }
  });

  app.get('/api/conversation/stats', async (req: Request, res: Response) => {
    try {
      const stats = getConversationStats();

      res.json({
        success: true,
        data: {
          ...stats,
          status: 'active',
        }
      });

    } catch (error) {
      logger.error({ err: error }, '获取对话统计失败');
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: '获取对话统计失败' }
      });
    }
  });

  logger.info('智能对话API已注册: /api/conversation/*');
};
