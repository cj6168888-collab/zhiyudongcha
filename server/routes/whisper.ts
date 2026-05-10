/**
 * 耳语助手 API 路由
 * 实时检测问题并生成耳语反馈
 */

import { Request, Response } from 'express';
import { whisperAssistant } from '../services/whisper-assistant';
import { createServiceLogger } from '../lib/logger';
import type { RegisterRouteFn } from './types';

const logger = createServiceLogger('WhisperAPI');

export const registerWhisperRoutes: RegisterRouteFn = (app, storage, context) => {
  
  app.post('/api/whisper/process', async (req: Request, res: Response) => {
    try {
      const { text, speakerId, sessionId } = req.body;

      if (!text) {
        return res.status(400).json({ error: '缺少文本内容' });
      }

      logger.info({ text: text.substring(0, 50), sessionId }, '处理耳语请求');

      const result = await whisperAssistant.processTranscript(text, speakerId);

      if (!result) {
        return res.json({
          hasWhisper: false,
          message: '未检测到需要回答的问题',
        });
      }

      logger.info({ 
        type: result.questionType, 
        confidence: result.confidence,
        processingTime: result.processingTime 
      }, '耳语生成成功');

      res.json({
        hasWhisper: true,
        whisper: {
          type: result.questionType,
          answer: result.answer,
          shortAnswer: result.shortAnswer,
          sources: result.sources,
          confidence: result.confidence,
          processingTime: result.processingTime,
        },
      });

    } catch (error) {
      logger.error({ err: error }, '处理耳语请求失败');
      res.status(500).json({ 
        error: '处理失败',
        hasWhisper: false,
      });
    }
  });

  app.post('/api/whisper/detect', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ error: '缺少文本内容' });
      }

      const question = await whisperAssistant.detectQuestion(text);

      if (!question) {
        return res.json({
          isQuestion: false,
        });
      }

      res.json({
        isQuestion: true,
        question: {
          type: question.type,
          extractedQuery: question.extractedQuery,
          confidence: question.confidence,
          urgency: question.urgency,
        },
      });

    } catch (error) {
      logger.error({ err: error }, '检测问题失败');
      res.status(500).json({ error: '检测失败' });
    }
  });

  app.post('/api/whisper/calculate', async (req: Request, res: Response) => {
    try {
      const { expression } = req.body;

      if (!expression) {
        return res.status(400).json({ error: '缺少计算表达式' });
      }

      const question = {
        type: 'CALCULATION' as const,
        originalText: expression,
        extractedQuery: expression,
        confidence: 1,
        urgency: 'HIGH' as const,
      };

      const result = await whisperAssistant.generateWhisper(question);

      res.json({
        success: result.success,
        result: result.shortAnswer,
        fullAnswer: result.answer,
        processingTime: result.processingTime,
      });

    } catch (error) {
      logger.error({ err: error }, '计算失败');
      res.status(500).json({ error: '计算失败' });
    }
  });

  app.post('/api/whisper/legal', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ error: '缺少法律查询内容' });
      }

      const question = {
        type: 'LEGAL' as const,
        originalText: query,
        extractedQuery: query,
        confidence: 1,
        urgency: 'HIGH' as const,
      };

      const result = await whisperAssistant.generateWhisper(question);

      res.json({
        success: result.success,
        answer: result.answer,
        shortAnswer: result.shortAnswer,
        sources: result.sources,
        confidence: result.confidence,
        processingTime: result.processingTime,
      });

    } catch (error) {
      logger.error({ err: error }, '法律查询失败');
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.post('/api/whisper/context/update', async (req: Request, res: Response) => {
    try {
      const { sessionId, text } = req.body;

      if (!sessionId || !text) {
        return res.status(400).json({ error: '缺少sessionId或text' });
      }

      const newPersons = await whisperAssistant.updateContext(sessionId, text);
      const context = whisperAssistant.getOrCreateContext(sessionId);

      logger.info({ 
        sessionId, 
        personsCount: context.mentionedPersons.length,
        topicsCount: context.mentionedTopics.length
      }, '上下文已更新');

      res.json({
        success: true,
        newPersonsDetected: newPersons.length,
        totalPersons: context.mentionedPersons.length,
        totalTopics: context.mentionedTopics.length,
        persons: context.mentionedPersons.map(p => ({
          name: p.name,
          organization: p.organization,
          role: p.role,
        })),
      });

    } catch (error) {
      logger.error({ err: error }, '更新上下文失败');
      res.status(500).json({ error: '更新失败' });
    }
  });

  app.post('/api/whisper/hesitation', async (req: Request, res: Response) => {
    try {
      const { sessionId, text } = req.body;

      if (!sessionId || !text) {
        return res.status(400).json({ error: '缺少sessionId或text' });
      }

      const hint = await whisperAssistant.detectHesitation(sessionId, text);

      if (!hint) {
        return res.json({
          hasHint: false,
          message: '未检测到停顿或忘词',
        });
      }

      logger.info({ 
        sessionId, 
        hintType: hint.type,
        confidence: hint.confidence 
      }, '检测到停顿，提供提示');

      res.json({
        hasHint: true,
        hint: {
          type: hint.type,
          content: hint.hint,
          confidence: hint.confidence,
          relatedPerson: hint.relatedPerson ? {
            name: hint.relatedPerson.name,
            organization: hint.relatedPerson.organization,
            role: hint.relatedPerson.role,
          } : undefined,
        },
      });

    } catch (error) {
      logger.error({ err: error }, '停顿检测失败');
      res.status(500).json({ error: '检测失败' });
    }
  });

  app.get('/api/whisper/context/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const context = whisperAssistant.getOrCreateContext(sessionId);

      res.json({
        sessionId,
        mentionedPersons: context.mentionedPersons.map(p => ({
          name: p.name,
          organization: p.organization,
          role: p.role,
          mentionedAt: p.mentionedAt,
        })),
        mentionedTopics: context.mentionedTopics,
        recentTranscriptsCount: context.recentTranscripts.length,
        lastUpdateTime: context.lastUpdateTime,
      });

    } catch (error) {
      logger.error({ err: error }, '获取上下文失败');
      res.status(500).json({ error: '获取失败' });
    }
  });

  app.post('/api/whisper/smart', async (req: Request, res: Response) => {
    try {
      const { sessionId, text, speakerId } = req.body;

      if (!text) {
        return res.status(400).json({ error: '缺少文本内容' });
      }

      const effectiveSessionId = sessionId || 'default';
      
      await whisperAssistant.updateContext(effectiveSessionId, text);

      const hesitationHint = await whisperAssistant.detectHesitation(effectiveSessionId, text);
      if (hesitationHint) {
        logger.info({ sessionId: effectiveSessionId, hintType: hesitationHint.type }, '智能耳语: 检测到停顿');
        return res.json({
          type: 'HESITATION_HINT',
          hasResponse: true,
          response: {
            hint: hesitationHint.hint,
            hintType: hesitationHint.type,
            confidence: hesitationHint.confidence,
            relatedPerson: hesitationHint.relatedPerson,
          },
        });
      }

      const whisperResult = await whisperAssistant.processTranscript(text, speakerId);
      if (whisperResult) {
        logger.info({ sessionId: effectiveSessionId, type: whisperResult.questionType }, '智能耳语: 生成回答');
        return res.json({
          type: 'WHISPER',
          hasResponse: true,
          response: {
            questionType: whisperResult.questionType,
            answer: whisperResult.answer,
            shortAnswer: whisperResult.shortAnswer,
            sources: whisperResult.sources,
            confidence: whisperResult.confidence,
            processingTime: whisperResult.processingTime,
          },
        });
      }

      const context = whisperAssistant.getOrCreateContext(effectiveSessionId);
      res.json({
        type: 'CONTEXT_ONLY',
        hasResponse: false,
        context: {
          personsCount: context.mentionedPersons.length,
          topicsCount: context.mentionedTopics.length,
        },
      });

    } catch (error) {
      logger.error({ err: error }, '智能耳语处理失败');
      res.status(500).json({ error: '处理失败' });
    }
  });

  logger.info('耳语助手路由已注册 (含停顿检测与上下文追踪)');
};
