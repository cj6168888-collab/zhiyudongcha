/**
 * 语音指挥官 API 路由
 * 
 * 处理语音/文字指令，执行系统操作
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('VoiceCommander');

import type { Express, Request, Response } from 'express';
import { 
  parseVoiceCommand,
  parseVoiceCommandWithAI,
  executeVoiceCommand, 
  executeVoiceCommandWithAI,
  SYSTEM_MODULES,
  generateSystemKnowledgePrompt,
  findModuleByKeyword,
} from '../services/voice-commander';
import type { RegisterRouteFn } from './types';

export const registerVoiceCommanderRoutes: RegisterRouteFn = (app, storage, context) => {

  // 处理语音/文字指令（带AI智能推理）
  app.post('/api/voice/command', async (req: Request, res: Response) => {
    try {
      const { text, userId, useAI = true } = req.body;

      if (!text) {
        return res.status(400).json({ error: '缺少指令文本' });
      }

      logger.info({ text, userId, useAI }, '收到语音指令');

      let parsed;
      let result;
      
      if (useAI) {
        // 使用AI增强解析和执行
        parsed = await parseVoiceCommandWithAI(text);
        result = await executeVoiceCommand(parsed, storage, { userId });
      } else {
        // 仅使用规则解析
        parsed = parseVoiceCommand(text);
        result = await executeVoiceCommand(parsed, storage, { userId });
      }
      
      logger.info({ parsed, result, aiUsed: useAI }, '指令处理完成');

      res.json({
        success: result.success,
        message: result.message,
        action: result.action,
        navigateTo: result.navigateTo,
        data: result.data,
        requiresConfirm: result.requiresConfirm,
        confirmMessage: result.confirmMessage,
        continueListen: result.continueListen ?? true,
        aiUsed: useAI && parsed.confidence < 0.7, // 标记是否使用了AI推理
        parsed: {
          understood: parsed.understood,
          confidence: parsed.confidence,
          action: parsed.action,
          module: parsed.module?.name,
          target: parsed.target,
        },
      });

    } catch (error) {
      logger.error({ err: error }, '处理语音指令失败');
      res.status(500).json({ 
        success: false,
        message: '处理指令时出了点问题，再说一遍试试？',
        continueListen: true,
      });
    }
  });

  // 获取系统模块列表（供前端展示）
  app.get('/api/voice/modules', async (req: Request, res: Response) => {
    try {
      const modules = SYSTEM_MODULES.map(m => ({
        id: m.id,
        name: m.name,
        aliases: m.aliases,
        route: m.route,
        description: m.description,
        capabilities: m.capabilities.map(c => ({
          action: c.action,
          description: c.description,
        })),
        examples: m.examples,
      }));

      res.json({ modules });

    } catch (error) {
      res.status(500).json({ error: '获取模块列表失败' });
    }
  });

  // 获取系统知识提示词（供AI使用）
  app.get('/api/voice/system-knowledge', async (req: Request, res: Response) => {
    try {
      const prompt = generateSystemKnowledgePrompt();
      res.json({ prompt });

    } catch (error) {
      res.status(500).json({ error: '生成知识提示词失败' });
    }
  });

  // 查找模块
  app.get('/api/voice/find-module', async (req: Request, res: Response) => {
    try {
      const { keyword } = req.query;
      
      if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ error: '缺少关键词' });
      }

      const module = findModuleByKeyword(keyword);
      
      if (module) {
        res.json({
          found: true,
          module: {
            id: module.id,
            name: module.name,
            route: module.route,
            description: module.description,
          },
        });
      } else {
        res.json({ found: false });
      }

    } catch (error) {
      res.status(500).json({ error: '查找模块失败' });
    }
  });

  // 快速导航（仅返回路由）
  app.post('/api/voice/navigate', async (req: Request, res: Response) => {
    try {
      const { target } = req.body;
      
      if (!target) {
        return res.status(400).json({ error: '缺少目标' });
      }

      const module = findModuleByKeyword(target);
      
      if (module) {
        res.json({
          success: true,
          route: module.route,
          name: module.name,
        });
      } else {
        res.json({
          success: false,
          message: `没有找到"${target}"这个功能`,
          suggestions: SYSTEM_MODULES.slice(0, 5).map(m => m.name),
        });
      }

    } catch (error) {
      res.status(500).json({ error: '导航失败' });
    }
  });

  logger.info('语音指挥官路由已注册');
};
