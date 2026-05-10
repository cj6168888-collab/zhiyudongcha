import type { Express } from 'express';
import type { RouteContext } from './registry';
import { createServiceLogger } from '../lib/logger';
import { requireMaster } from '../middleware/auth';
import { evolutionService } from '../services/EvolutionService';

const logger = createServiceLogger('EvolutionRoutes');

export function registerEvolutionRoutes(app: Express, context: RouteContext): void {
  const { storage } = context;

  app.get('/api/evolution-state', async (_req, res) => {
    try {
      const state = await evolutionService.getEvolutionState();
      if (!state) {
        return res.json({
          academicLadder: 'BACHELOR',
          academicProgress: 0,
          externalLlmRatio: 100,
          localModelRatio: 0,
          knowledgeDistilled: 0,
          totalDecisions: 0,
          dreamSimulations: 0,
          evolutionScore: 0,
        });
      }

      const totalCalls = (state.externalCallCount || 0) + (state.localCallCount || 0);
      const localRatio = totalCalls > 0 ? Math.round((state.localCallCount || 0) / totalCalls * 100) : 0;

      return res.json({
        id: state.id,
        academicLadder: state.academicLevel || 'BACHELOR',
        academicProgress: state.nextLevelXp ? Math.round((state.academicXp || 0) / state.nextLevelXp * 100) : 0,
        academicXp: state.academicXp || 0,
        nextLevelXp: state.nextLevelXp || 1000,
        externalLlmRatio: 100 - localRatio,
        localModelRatio: localRatio,
        knowledgeDistilled: state.distilledKnowledgeSize || 0,
        totalDecisions: state.distillationCount || 0,
        dreamSimulations: state.totalDreamSessions || 0,
        totalInsights: state.totalInsightsDiscovered || 0,
        totalSkillCapsules: state.totalSkillCapsules || 0,
        activeSkillCapsules: state.activeSkillCapsules || 0,
        evolutionScore: Math.min(100, (state.academicXp || 0) / 10),
        updatedAt: state.updatedAt,
      });
    } catch (error) {
      logger.error({ err: error }, 'Get evolution state error');
      return res.status(500).json({ error: '获取进化状态失败' });
    }
  });

  app.get('/api/evolution', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await evolutionService.getEvolutionEvents(limit);
      return res.json(events);
    } catch (error) {
      logger.error({ err: error }, 'Get evolution events error');
      return res.status(500).json({ error: '获取进化事件失败' });
    }
  });

  app.get('/api/skill-capsules', async (_req, res) => {
    try {
      const capsules = await evolutionService.getSkillCapsules();
      return res.json(capsules);
    } catch (error) {
      logger.error({ err: error }, 'Get skill capsules error');
      return res.status(500).json({ error: '获取技能胶囊失败' });
    }
  });

  app.get('/api/shadow-memories', requireMaster, async (_req, res) => {
    try {
      const memories = await evolutionService.getAllMemories();
      const groupedByField: Record<string, { count: number; totalExp: number }> = {};

      memories.forEach(m => {
        const field = m.field || 'general';
        if (!groupedByField[field]) groupedByField[field] = { count: 0, totalExp: 0 };
        groupedByField[field].count++;
        groupedByField[field].totalExp += m.expPoints || 0;
      });

      const stats = {
        totalMemories: memories.length,
        totalExp: memories.reduce((sum, m) => sum + (m.expPoints || 0), 0),
        byField: Object.entries(groupedByField).map(([field, data]) => ({
          field,
          count: data.count,
          totalExp: data.totalExp,
        })),
      };

      return res.json(stats);
    } catch (error) {
      logger.error({ err: error }, 'Get shadow memories error');
      return res.status(500).json({ error: '获取影子记忆失败' });
    }
  });

  app.get('/api/evolution/growth-report', async (_req, res) => {
    try {
      const report = await evolutionService.getGrowthReport();
      return res.json(report);
    } catch (error) {
      logger.error({ err: error }, 'Growth report error');
      return res.status(500).json({ error: '生成成长报告失败' });
    }
  });

  logger.info('Evolution routes registered');
}
