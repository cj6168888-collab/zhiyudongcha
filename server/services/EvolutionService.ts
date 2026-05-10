import { createServiceLogger } from '../lib/logger';
import { storage } from '../storage';
import { webSocketManager } from '../websocket';
import type { EvolutionState, EvolutionEvent, SkillCapsule, ShadowMemory } from '@shared/schema';

const logger = createServiceLogger('EvolutionService');

// XP 阈值：升级到下一级所需的累计总 XP
const LEVEL_THRESHOLDS: Record<string, { nextLevel: string; xpRequired: number }> = {
  BACHELOR: { nextLevel: 'MASTER',  xpRequired: 1000  },
  MASTER:   { nextLevel: 'PHD',     xpRequired: 5000  },
  PHD:      { nextLevel: 'POSTDOC', xpRequired: 15000 },
};

export class EvolutionService {
  async getEvolutionState(): Promise<EvolutionState | undefined> {
    return await storage.getEvolutionState();
  }

  async updateEvolutionState(updates: Partial<EvolutionState>): Promise<EvolutionState | undefined> {
    const state = await storage.updateEvolutionState(updates);
    if (state) {
      logger.debug({ stateId: state.id }, '进化状态更新成功');
    }
    return state;
  }

  async getEvolutionEvents(limit?: number): Promise<EvolutionEvent[]> {
    return await storage.getEvolutionEvents(limit);
  }

  async getSkillCapsules(): Promise<SkillCapsule[]> {
    return await storage.getSkillCapsules();
  }

  async getAllMemories(): Promise<ShadowMemory[]> {
    return await storage.getAllMemories();
  }

  /**
   * 积累 XP，触发自动升级检测，广播进化事件。
   * HP 消耗、任务完成、AI 调用后调用此方法。
   */
  async gainXp(xp: number, source: string): Promise<void> {
    if (xp <= 0) return;
    try {
      const state = await storage.getEvolutionState();
      const currentLevel = state?.academicLevel ?? 'BACHELOR';
      const currentXp = state?.academicXp ?? 0;
      const newXp = currentXp + xp;

      const threshold = LEVEL_THRESHOLDS[currentLevel];
      const levelUp = !!threshold && newXp >= threshold.xpRequired;
      const newLevel = levelUp ? threshold.nextLevel : currentLevel;
      const newNextLevelXp = levelUp
        ? (LEVEL_THRESHOLDS[threshold.nextLevel]?.xpRequired ?? threshold.xpRequired)
        : (state?.nextLevelXp ?? 1000);

      const updatedState = await storage.updateEvolutionState({
        academicXp: newXp,
        academicLevel: newLevel,
        nextLevelXp: newNextLevelXp,
      });

      await storage.createEvolutionEvent({
        eventType: 'XP_GAINED',
        sourceModule: source,
        deltaDescription: `获得 ${xp} XP（来源：${source}）`,
        previousValue: { xp: currentXp, level: currentLevel },
        newValue: { xp: newXp, level: newLevel },
      });

      if (levelUp) {
        await storage.createEvolutionEvent({
          eventType: 'LEVEL_UP',
          sourceModule: source,
          deltaDescription: `从 ${currentLevel} 升级到 ${newLevel}`,
          previousValue: { level: currentLevel },
          newValue: { level: newLevel },
        });
        logger.info({ from: currentLevel, to: newLevel, xp: newXp }, '进化等级提升');
      }

      webSocketManager.broadcast('EVOLUTION_UPDATE', {
        state: updatedState ?? {},
        levelUp: levelUp ? { from: currentLevel, to: newLevel } : null,
        xpGained: xp,
        totalXp: newXp,
      });
    } catch (err) {
      logger.error({ err, xp, source }, 'gainXp 失败');
    }
  }

  async getGrowthReport(): Promise<{
    currentLevel: string;
    totalXp: number;
    nextLevelXp: number;
    totalSkills: number;
    activeSkills: number;
    totalMemories: number;
    todayNewSkills: (string | null)[];
    todayEventsCount: number;
    topAbilities: Array<{ field: string; count: number; exp: number }>;
    milestones: Array<{ name: string; achieved: boolean; icon: string }>;
    recentGrowth: Array<{ type: string; description: string | null; module: string; time: Date | null }>;
  }> {
    try {
      const state = await storage.getEvolutionState();
      const events = await storage.getEvolutionEvents(20);
      const capsules = await storage.getSkillCapsules();
      const memories = await storage.getAllMemories();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayEvents = events.filter(e => new Date(e.createdAt!) >= today);
      const activeCapsules = capsules.filter(c => c.isActive === 1);

      const newSkills = todayEvents
        .filter(e => e.eventType === 'SKILL_LEARNED' || e.eventType === 'KNOWLEDGE_GAINED')
        .map(e => e.deltaDescription);

      const fieldStats = memories.reduce((acc, m) => {
        const field = m.field || 'general';
        if (!acc[field]) acc[field] = { count: 0, exp: 0 };
        acc[field].count++;
        acc[field].exp += m.expPoints || 0;
        return acc;
      }, {} as Record<string, { count: number; exp: number }>);

      const topFields = Object.entries(fieldStats)
        .sort((a, b) => b[1].exp - a[1].exp)
        .slice(0, 5)
        .map(([field, stats]) => ({ field, ...stats }));

      return {
        currentLevel: state?.academicLevel || 'BACHELOR',
        totalXp: state?.academicXp || 0,
        nextLevelXp: state?.nextLevelXp || 1000,
        totalSkills: capsules.length,
        activeSkills: activeCapsules.length,
        totalMemories: memories.length,
        todayNewSkills: newSkills,
        todayEventsCount: todayEvents.length,
        topAbilities: topFields,
        milestones: [
          { name: '首次对话',    achieved: memories.length > 0,                         icon: '💬' },
          { name: '学会10项技能', achieved: capsules.length >= 10,                        icon: '🎯' },
          { name: '积累100经验', achieved: (state?.academicXp || 0) >= 100,              icon: '⭐' },
          { name: '完成首次梦境', achieved: (state?.totalDreamSessions || 0) > 0,         icon: '🌙' },
          { name: '发现10条洞察', achieved: (state?.totalInsightsDiscovered || 0) >= 10,  icon: '💡' },
          { name: '升级到硕士',  achieved: state?.academicLevel !== 'BACHELOR',           icon: '🎓' },
        ],
        recentGrowth: events.slice(0, 5).map(e => ({
          type: e.eventType,
          description: e.deltaDescription,
          module: e.sourceModule,
          time: e.createdAt,
        })),
      };
    } catch (error) {
      logger.error({ err: error }, '生成成长报告失败');
      throw new Error('生成成长报告失败');
    }
  }
}

export const evolutionService = new EvolutionService();
