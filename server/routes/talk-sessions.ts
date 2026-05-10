import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireMaster } from '../middleware/auth';
import { talkService } from '../services/TalkService';
import { personService } from '../services/PersonService';

const logger = createServiceLogger('TalkSessionsRoutes');

export function registerTalkSessionsRoutes(app: Express, context: RouteContext): void {
  const { storage } = context;

  app.post('/api/talk-sessions', async (req, res) => {
    try {
      const { language = 'zh-CN' } = req.body;
      const session = await talkService.createTalkSession(language);
      return res.json(session);
    } catch (error) {
      logger.error({ err: error }, 'Create talk session error');
      return res.status(500).json({ error: '创建会话失败' });
    }
  });

  app.get('/api/talk-sessions/:id', async (req, res) => {
    try {
      const session = await talkService.getTalkSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }
      return res.json(session);
    } catch (error) {
      logger.error({ err: error }, 'Get talk session error');
      return res.status(500).json({ error: '获取会话失败' });
    }
  });

  app.post('/api/talk-sessions/:id/stop', async (req, res) => {
    try {
      const { rawTranscript } = req.body;
      const sessionId = req.params.id;

      const updatedSession = await talkService.stopAndAnalyzeTalkSession(sessionId, rawTranscript);
      return res.json(updatedSession);
    } catch (error) {
      logger.error({ err: error }, 'Stop talk session error');
      return res.status(500).json({ error: '停止会话失败' });
    }
  });

  app.post('/api/talk-sessions/:id/analyze', async (req, res) => {
    try {
      const { text } = req.body;
      const sessionId = req.params.id;

      if (!text) {
        return res.status(500).json({ error: '缺少文本内容' });
      }

      const result = await talkService.analyzeTalkType(sessionId, text);
      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Analyze talk error');
      return res.status(500).json({ error: '分析失败' });
    }
  });

  app.get('/api/talk-sessions/:id/entities', async (req, res) => {
    try {
      const entities = await talkService.getSessionEntities(req.params.id);
      return res.json(entities);
    } catch (error) {
      logger.error({ err: error }, 'Get entities error');
      return res.status(500).json({ error: '获取实体失败' });
    }
  });

  app.get('/api/talk-sessions/:id/opportunities', async (req, res) => {
    try {
      const opportunities = await talkService.getSessionOpportunities(req.params.id);
      return res.json(opportunities);
    } catch (error) {
      logger.error({ err: error }, 'Get opportunities error');
      return res.status(500).json({ error: '获取商机失败' });
    }
  });

  app.post('/api/talk-sessions/:id/entities/:entityId/link', requireMaster, async (req, res) => {
    try {
      const { personId, projectId } = req.body;
      const updated = await talkService.linkEntity(req.params.entityId, personId, projectId);
      return res.json(updated);
    } catch (error) {
      logger.error({ err: error }, 'Link entity error');
      return res.status(500).json({ error: '关联实体失败' });
    }
  });

  app.post('/api/talk-sessions/:id/opportunities/:oppId/action', requireMaster, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await talkService.updateOpportunityStatus(req.params.oppId, status);
      return res.json(updated);
    } catch (error) {
      logger.error({ err: error }, 'Update opportunity error');
      return res.status(500).json({ error: '更新商机状态失败' });
    }
  });

  app.post('/api/talk-sessions/:id/create-contacts', requireMaster, async (req, res) => {
    try {
      const sessionId = req.params.id;
      const result = await talkService.createContactsFromSession(sessionId);
      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Create contacts error');
      return res.status(500).json({ error: '自动创建联系人失败' });
    }
  });

  logger.info('Talk sessions routes registered');
}
