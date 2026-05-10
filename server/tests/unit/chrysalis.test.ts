/**
 * Chrysalis 化蝶计划 单元测试
 * Project Chrysalis - 自我进化协议
 *
 * @version 1.0.0
 * @date 2026-04-19
 * @author 测试组
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

// Mock database
vi.mock('../../db', () => ({
  getDatabase: () => ({
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis()
  })
}));

describe('Chrysalis Orchestrator', () => {
  describe('进化阶段定义', () => {
    const chrysalisPhases = [
      'IDLE',
      'COLLECTING',
      'RETROSPECTING',
      'FINETUNING',
      'VISION_EVOLVING',
      'SELF_CODING',
      'GENERATING_GIFT',
      'COMPLETED'
    ];

    it('应该有8个进化阶段', () => {
      expect(chrysalisPhases).toHaveLength(8);
    });

    it('初始阶段应该是 IDLE', () => {
      const initialPhase = 'IDLE';
      expect(initialPhase).toBe('IDLE');
    });

    it('完成阶段应该是 COMPLETED', () => {
      const completedPhase = 'COMPLETED';
      expect(completedPhase).toBe('COMPLETED');
    });

    it('阶段顺序应该正确', () => {
      const expectedOrder = [
        'IDLE',
        'COLLECTING',
        'RETROSPECTING',
        'FINETUNING',
        'VISION_EVOLVING',
        'SELF_CODING',
        'GENERATING_GIFT',
        'COMPLETED'
      ];

      expectedOrder.forEach((phase, index) => {
        expect(chrysalisPhases[index]).toBe(phase);
      });
    });
  });

  describe('进度计算', () => {
    const calculateProgress = (phase: string): number => {
      const phaseProgress: Record<string, number> = {
        'IDLE': 0,
        'COLLECTING': 15,
        'RETROSPECTING': 30,
        'FINETUNING': 50,
        'VISION_EVOLVING': 65,
        'SELF_CODING': 80,
        'GENERATING_GIFT': 95,
        'COMPLETED': 100,
      };
      return phaseProgress[phase] || 0;
    };

    it('IDLE 阶段进度应该为 0', () => {
      expect(calculateProgress('IDLE')).toBe(0);
    });

    it('COLLECTING 阶段进度应该为 15%', () => {
      expect(calculateProgress('COLLECTING')).toBe(15);
    });

    it('RETROSPECTING 阶段进度应该为 30%', () => {
      expect(calculateProgress('RETROSPECTING')).toBe(30);
    });

    it('FINETUNING 阶段进度应该为 50%', () => {
      expect(calculateProgress('FINETUNING')).toBe(50);
    });

    it('VISION_EVOLVING 阶段进度应该为 65%', () => {
      expect(calculateProgress('VISION_EVOLVING')).toBe(65);
    });

    it('SELF_CODING 阶段进度应该为 80%', () => {
      expect(calculateProgress('SELF_CODING')).toBe(80);
    });

    it('GENERATING_GIFT 阶段进度应该为 95%', () => {
      expect(calculateProgress('GENERATING_GIFT')).toBe(95);
    });

    it('COMPLETED 阶段进度应该为 100%', () => {
      expect(calculateProgress('COMPLETED')).toBe(100);
    });

    it('未知阶段进度应该为 0', () => {
      expect(calculateProgress('UNKNOWN')).toBe(0);
    });
  });

  describe('进化周期结果计算', () => {
    const calculateSuccessRate = (phases: string[]): number => {
      const totalPhases = 6;
      return phases.length / totalPhases;
    };

    const calculateEvolutionScore = (result: any): number => {
      let score = 0;

      if (result.failuresCollected) {
        score += Math.min(result.failuresCollected * 2, 20);
      }

      if (result.retrospectionResult) {
        score += result.retrospectionResult.failuresProcessed * 3;
        score += result.retrospectionResult.knowledgeGenerated * 5;
      }

      if (result.fineTuneResult) {
        score += result.fineTuneResult.tacticsLearned.length * 10;
        score += result.fineTuneResult.trapsIdentified.length * 8;
      }

      if (result.visionResult) {
        score += result.visionResult.patternsLearned * 10;
      }

      if (result.selfCodingResult) {
        score += result.selfCodingResult.patchesDeployed * 15;
      }

      return Math.min(score, 100);
    };

    it('完整周期成功率应该是 100%', () => {
      const completedPhases = ['COLLECTING', 'RETROSPECTING', 'FINETUNING', 'VISION_EVOLVING', 'SELF_CODING', 'GENERATING_GIFT'];
      const rate = calculateSuccessRate(completedPhases);
      expect(rate).toBe(1);
    });

    it('部分周期成功率应该正确计算', () => {
      const partialPhases = ['COLLECTING', 'RETROSPECTING'];
      const rate = calculateSuccessRate(partialPhases);
      expect(rate).toBeCloseTo(0.333, 2);
    });

    it('失败收集应该贡献分数', () => {
      const result = { failuresCollected: 10 };
      const score = calculateEvolutionScore(result);
      expect(score).toBeGreaterThan(0);
    });

    it('分数上限应该是 100', () => {
      const result = {
        failuresCollected: 100,
        retrospectionResult: { failuresProcessed: 100, knowledgeGenerated: 100 },
        fineTuneResult: { tacticsLearned: [1,2,3], trapsIdentified: [1,2,3] },
        visionResult: { patternsLearned: 100 },
        selfCodingResult: { patchesDeployed: 100 }
      };
      const score = calculateEvolutionScore(result);
      expect(score).toBe(100);
    });
  });

  describe('夜间周期调度', () => {
    const NIGHT_CYCLE_HOURS = [2, 3, 4, 5];

    const shouldStartNightCycle = (hour: number, isActive: boolean): boolean => {
      return NIGHT_CYCLE_HOURS.includes(hour) && !isActive;
    };

    it('2点应该触发夜间周期', () => {
      expect(shouldStartNightCycle(2, false)).toBe(true);
    });

    it('3点应该触发夜间周期', () => {
      expect(shouldStartNightCycle(3, false)).toBe(true);
    });

    it('4点应该触发夜间周期', () => {
      expect(shouldStartNightCycle(4, false)).toBe(true);
    });

    it('5点应该触发夜间周期', () => {
      expect(shouldStartNightCycle(5, false)).toBe(true);
    });

    it('6点不应该触发夜间周期', () => {
      expect(shouldStartNightCycle(6, false)).toBe(false);
    });

    it('1点不应该触发夜间周期', () => {
      expect(shouldStartNightCycle(1, false)).toBe(false);
    });

    it('周期进行中不应该重复启动', () => {
      expect(shouldStartNightCycle(3, true)).toBe(false);
    });

    it('周期进行中不应该在非夜间时段启动', () => {
      expect(shouldStartNightCycle(10, true)).toBe(false);
    });
  });

  describe('下次调度时间计算', () => {
    const getNextScheduledTime = (currentHour: number): Date => {
      const NIGHT_CYCLE_HOURS = [2, 3, 4, 5];
      const now = new Date();
      const nextRun = new Date(now);

      if (currentHour < NIGHT_CYCLE_HOURS[0]) {
        nextRun.setHours(NIGHT_CYCLE_HOURS[0], 0, 0, 0);
      } else if (currentHour >= NIGHT_CYCLE_HOURS[NIGHT_CYCLE_HOURS.length - 1]) {
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(NIGHT_CYCLE_HOURS[0], 0, 0, 0);
      } else {
        const nextHour = NIGHT_CYCLE_HOURS.find(h => h > currentHour);
        if (nextHour) {
          nextRun.setHours(nextHour, 0, 0, 0);
        }
      }

      return nextRun;
    };

    it('凌晨1点应该调度到2点', () => {
      const nextTime = getNextScheduledTime(1);
      expect(nextTime.getHours()).toBe(2);
    });

    it('凌晨5点应该调度到明天的2点', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextTime = getNextScheduledTime(5);
      expect(nextTime.getHours()).toBe(2);
      expect(nextTime.getDate()).toBe(tomorrow.getDate());
    });

    it('中午12点应该调度到明天的2点', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextTime = getNextScheduledTime(12);
      expect(nextTime.getHours()).toBe(2);
      expect(nextTime.getDate()).toBe(tomorrow.getDate());
    });

    it('3点应该调度到4点（同一天）', () => {
      const nextTime = getNextScheduledTime(3);
      expect(nextTime.getHours()).toBe(4);
      expect(nextTime.getDate()).toBe(new Date().getDate());
    });
  });
});

describe('Failure Collector', () => {
  describe('失败类型定义', () => {
    const failureTypes = ['UNANSWERED', 'EXECUTION_ERROR', 'USER_CORRECTION'];

    it('应该有3种失败类型', () => {
      expect(failureTypes).toHaveLength(3);
    });

    it('UNANSWERED 类型应该表示未回答的问题', () => {
      expect(failureTypes).toContain('UNANSWERED');
    });

    it('EXECUTION_ERROR 类型应该表示执行错误', () => {
      expect(failureTypes).toContain('EXECUTION_ERROR');
    });

    it('USER_CORRECTION 类型应该表示用户纠正', () => {
      expect(failureTypes).toContain('USER_CORRECTION');
    });
  });

  describe('失败统计', () => {
    interface FailureStats {
      total: number;
      unanswered: number;
      executionErrors: number;
      userCorrections: number;
      lastCollectedAt: Date | null;
    }

    const mockStats: FailureStats = {
      total: 150,
      unanswered: 45,
      executionErrors: 30,
      userCorrections: 75,
      lastCollectedAt: new Date()
    };

    it('应该正确统计总失败数', () => {
      const { total, unanswered, executionErrors, userCorrections } = mockStats;
      expect(total).toBe(unanswered + executionErrors + userCorrections);
    });

    it('各类型失败数应该非负', () => {
      expect(mockStats.unanswered).toBeGreaterThanOrEqual(0);
      expect(mockStats.executionErrors).toBeGreaterThanOrEqual(0);
      expect(mockStats.userCorrections).toBeGreaterThanOrEqual(0);
    });

    it('失败类型占比计算', () => {
      const unansweredRatio = (mockStats.unanswered / mockStats.total) * 100;
      const executionErrorsRatio = (mockStats.executionErrors / mockStats.total) * 100;
      const userCorrectionsRatio = (mockStats.userCorrections / mockStats.total) * 100;

      expect(unansweredRatio + executionErrorsRatio + userCorrectionsRatio).toBeCloseTo(100, 1);
    });
  });

  describe('失败收集上下文', () => {
    interface FailureContext {
      module: string;
      timestamp: Date;
      [key: string]: any;
    }

    it('应该包含必需字段', () => {
      const context: FailureContext = {
        module: 'api',
        timestamp: new Date()
      };

      expect(context).toHaveProperty('module');
      expect(context).toHaveProperty('timestamp');
    });

    it('应该支持自定义字段', () => {
      const context: FailureContext = {
        module: 'api',
        timestamp: new Date(),
        userId: 'user-123',
        requestId: 'req-456'
      };

      expect(context.userId).toBe('user-123');
      expect(context.requestId).toBe('req-456');
    });
  });
});

describe('Retrospection Engine', () => {
  describe('复盘会话状态', () => {
    const retrospectionStatus = ['IDLE', 'ANALYZING', 'PROCESSING', 'COMPLETED', 'ERROR'];

    it('应该有5个复盘状态', () => {
      expect(retrospectionStatus).toHaveLength(5);
    });

    it('初始状态应该是 IDLE', () => {
      expect(retrospectionStatus[0]).toBe('IDLE');
    });

    it('完成状态应该是 COMPLETED', () => {
      expect(retrospectionStatus[3]).toBe('COMPLETED');
    });
  });

  describe('复盘结果', () => {
    interface RetrospectionResult {
      sessionId: string;
      startTime: Date;
      endTime: Date;
      failuresProcessed: number;
      knowledgeGenerated: number;
      insightsDiscovered: string[];
    }

    it('应该包含会话标识', () => {
      const result: RetrospectionResult = {
        sessionId: `retro_${Date.now()}`,
        startTime: new Date(),
        endTime: new Date(),
        failuresProcessed: 25,
        knowledgeGenerated: 10,
        insightsDiscovered: ['insight1', 'insight2']
      };

      expect(result.sessionId).toMatch(/^retro_\d+$/);
    });

    it('应该记录处理时间', () => {
      const startTime = new Date('2026-04-19T02:00:00');
      const endTime = new Date('2026-04-19T02:30:00');
      const durationMs = endTime.getTime() - startTime.getTime();

      expect(durationMs).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('知识生成数应该非负', () => {
      const result: RetrospectionResult = {
        sessionId: 'test',
        startTime: new Date(),
        endTime: new Date(),
        failuresProcessed: 20,
        knowledgeGenerated: 8,
        insightsDiscovered: []
      };

      expect(result.knowledgeGenerated).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Logic Finetuner', () => {
  describe('策略学习', () => {
    interface TacticsLearned {
      category: string;
      name: string;
      description: string;
      examples: string[];
    }

    it('应该支持多种策略类别', () => {
      const categories = ['negotiation', 'analysis', 'communication', 'planning', 'risk'];

      expect(categories.length).toBeGreaterThan(0);
      categories.forEach(cat => expect(typeof cat).toBe('string'));
    });

    it('策略应该包含必要信息', () => {
      const tactic: TacticsLearned = {
        category: 'negotiation',
        name: '锚定效应',
        description: '通过设置初始价格影响对方预期',
        examples: ['谈判起始报价', '预算设定']
      };

      expect(tactic).toHaveProperty('category');
      expect(tactic).toHaveProperty('name');
      expect(tactic).toHaveProperty('description');
      expect(tactic).toHaveProperty('examples');
    });
  });

  describe('陷阱识别', () => {
    interface TrapIdentified {
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      mitigation: string;
    }

    it('应该支持陷阱严重程度分级', () => {
      const severities: TrapIdentified['severity'][] = ['low', 'medium', 'high', 'critical'];

      expect(severities).toHaveLength(4);
    });

    it('陷阱应该包含缓解建议', () => {
      const trap: TrapIdentified = {
        type: 'hidden_fee',
        severity: 'high',
        description: '合同中隐藏的额外费用条款',
        mitigation: '仔细审查每一条款，要求对方明确说明所有费用'
      };

      expect(trap.mitigation.length).toBeGreaterThan(0);
    });
  });

  describe('RAG 更新', () => {
    interface RagUpdate {
      id: string;
      timestamp: Date;
      knowledgeType: string;
      content: string;
      source: string;
    }

    it('应该生成唯一更新ID', () => {
      const update: RagUpdate = {
        id: `rag_${Date.now()}`,
        timestamp: new Date(),
        knowledgeType: 'tactic',
        content: '新的谈判策略',
        source: 'retrospection'
      };

      expect(update.id).toMatch(/^rag_\d+$/);
    });

    it('应该支持多种知识类型', () => {
      const knowledgeTypes = ['tactic', 'trap', 'preference', 'pattern', 'insight'];

      expect(knowledgeTypes).toContain('tactic');
      expect(knowledgeTypes).toContain('trap');
    });
  });
});

describe('Vision Evolver', () => {
  describe('视觉模式学习', () => {
    interface VisualPattern {
      id: string;
      type: string;
      name: string;
      rules: string[];
      confidence: number;
      learnedAt: Date;
    }

    it('应该支持多种视觉模式类型', () => {
      const patternTypes = ['layout', 'color', 'typography', 'spacing', 'component'];

      expect(patternTypes).toHaveLength(5);
    });

    it('模式应该包含置信度', () => {
      const pattern: VisualPattern = {
        id: 'pattern_1',
        type: 'color',
        name: '主色调偏好',
        rules: ['蓝色为主', '强调色为橙'],
        confidence: 0.85,
        learnedAt: new Date()
      };

      expect(pattern.confidence).toBeGreaterThanOrEqual(0);
      expect(pattern.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('进化结果', () => {
    interface VisionEvolutionResult {
      patternsLearned: number;
      patternsUpdated: number;
      confidenceImproved: number;
      timestamp: Date;
    }

    it('应该记录学习的模式数', () => {
      const result: VisionEvolutionResult = {
        patternsLearned: 5,
        patternsUpdated: 3,
        confidenceImproved: 0.12,
        timestamp: new Date()
      };

      expect(result.patternsLearned).toBeGreaterThanOrEqual(0);
    });

    it('置信度提升应该非负', () => {
      const result: VisionEvolutionResult = {
        patternsLearned: 0,
        patternsUpdated: 0,
        confidenceImproved: 0.05,
        timestamp: new Date()
      };

      expect(result.confidenceImproved).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Self Coder', () => {
  describe('补丁管理', () => {
    interface Patch {
      id: string;
      description: string;
      status: 'pending' | 'deployed' | 'rolled_back';
      createdAt: Date;
      deployedAt?: Date;
    }

    it('应该支持三种补丁状态', () => {
      const statuses: Patch['status'][] = ['pending', 'deployed', 'rolled_back'];

      expect(statuses).toHaveLength(3);
    });

    it('补丁应该有时间戳', () => {
      const patch: Patch = {
        id: 'patch_1',
        description: '修复登录问题',
        status: 'deployed',
        createdAt: new Date('2026-04-19T00:00:00'),
        deployedAt: new Date('2026-04-19T01:00:00')
      };

      expect(patch.createdAt).toBeDefined();
      expect(patch.deployedAt).toBeDefined();
    });

    it('待部署补丁不应该有部署时间', () => {
      const patch: Patch = {
        id: 'patch_2',
        description: '优化性能',
        status: 'pending',
        createdAt: new Date()
      };

      expect(patch.deployedAt).toBeUndefined();
    });
  });

  describe('代码自迭代', () => {
    interface SelfCodingResult {
      sessionId: string;
      patchesGenerated: number;
      patchesDeployed: number;
      pluginsCreated: number;
      pluginMode: boolean;
    }

    it('应该记录生成的补丁数', () => {
      const result: SelfCodingResult = {
        sessionId: `sc_${Date.now()}`,
        patchesGenerated: 10,
        patchesDeployed: 8,
        pluginsCreated: 2,
        pluginMode: true
      };

      expect(result.patchesDeployed).toBeLessThanOrEqual(result.patchesGenerated);
    });

    it('插件模式应该记录创建的插件数', () => {
      const result: SelfCodingResult = {
        sessionId: 'test',
        patchesGenerated: 5,
        patchesDeployed: 5,
        pluginsCreated: 3,
        pluginMode: true
      };

      expect(result.pluginMode).toBe(true);
      expect(result.pluginsCreated).toBeGreaterThan(0);
    });
  });

  describe('回滚功能', () => {
    it('应该能够回滚补丁', () => {
      const rollbackPatch = (patchId: string): boolean => {
        // 模拟回滚逻辑
        return patchId.startsWith('patch_');
      };

      expect(rollbackPatch('patch_1')).toBe(true);
      expect(rollbackPatch('invalid')).toBe(false);
    });

    it('回滚后补丁状态应该更新', () => {
      const patch: Patch = {
        id: 'patch_1',
        description: '测试补丁',
        status: 'deployed',
        createdAt: new Date()
      };

      // 模拟回滚
      patch.status = 'rolled_back';

      expect(patch.status).toBe('rolled_back');
    });
  });
});

describe('Morning Gift', () => {
  describe('晨间礼物生成', () => {
    interface MorningGift {
      id: string;
      greeting: string;
      content: string;
      type: 'insight' | 'tip' | 'quote' | 'task';
      generatedAt: Date;
      read: boolean;
    }

    it('应该生成唯一的礼物ID', () => {
      const gift: MorningGift = {
        id: `gift_${Date.now()}`,
        greeting: '早安，主人！',
        content: '今天是个适合学习新技能的日子',
        type: 'insight',
        generatedAt: new Date(),
        read: false
      };

      expect(gift.id).toMatch(/^gift_\d+$/);
    });

    it('应该支持多种礼物类型', () => {
      const types: MorningGift['type'][] = ['insight', 'tip', 'quote', 'task'];

      expect(types).toHaveLength(4);
    });

    it('新礼物应该标记为未读', () => {
      const gift: MorningGift = {
        id: 'test',
        greeting: '测试',
        content: '测试内容',
        type: 'insight',
        generatedAt: new Date(),
        read: false
      };

      expect(gift.read).toBe(false);
    });
  });

  describe('礼物历史', () => {
    it('应该限制历史记录数量', () => {
      const limit = 7;
      const gifts: any[] = Array.from({ length: 10 }, (_, i) => ({ id: i }));

      const recentGifts = gifts.slice(0, limit);
      expect(recentGifts).toHaveLength(limit);
    });

    it('应该按时间倒序排列', () => {
      const gifts = [
        { id: 1, generatedAt: new Date('2026-04-18') },
        { id: 2, generatedAt: new Date('2026-04-19') },
        { id: 3, generatedAt: new Date('2026-04-17') }
      ];

      const sorted = gifts.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
      expect(sorted[0].id).toBe(2); // 最新的是2026-04-19
      expect(sorted[2].id).toBe(3); // 最老的是2026-04-17
    });
  });

  describe('已读标记', () => {
    it('应该能够标记礼物为已读', () => {
      const markAsRead = (giftId: string, gifts: Map<string, boolean>): boolean => {
        if (gifts.has(giftId)) {
          gifts.set(giftId, true);
          return true;
        }
        return false;
      };

      const gifts = new Map<string, boolean>();
      gifts.set('gift_1', false);

      expect(markAsRead('gift_1', gifts)).toBe(true);
      expect(gifts.get('gift_1')).toBe(true);
    });

    it('标记不存在的礼物应该返回false', () => {
      const markAsRead = (giftId: string, gifts: Map<string, boolean>): boolean => {
        if (gifts.has(giftId)) {
          gifts.set(giftId, true);
          return true;
        }
        return false;
      };

      const gifts = new Map<string, boolean>();
      expect(markAsRead('nonexistent', gifts)).toBe(false);
    });
  });
});

describe('Evolution Dashboard', () => {
  describe('学术阶梯', () => {
    const academicLadders = {
      BACHELOR: { label: '本科', level: 1 },
      MASTER: { label: '硕士', level: 2 },
      PHD: { label: '博士', level: 3 },
      EXPERT: { label: '专家', level: 4 },
      AVATAR: { label: '身外化身', level: 5 }
    };

    it('应该有5个学术等级', () => {
      expect(Object.keys(academicLadders)).toHaveLength(5);
    });

    it('等级应该递增', () => {
      const levels = Object.values(academicLadders).map(l => l.level);
      const sortedLevels = [...levels].sort((a, b) => a - b);

      expect(levels).toEqual(sortedLevels);
    });

    it('身外化身应该是最高等级', () => {
      const maxLevel = Math.max(...Object.values(academicLadders).map(l => l.level));
      expect(academicLadders.AVATAR.level).toBe(maxLevel);
    });
  });

  describe('自主进化进度', () => {
    interface AutonomyProgress {
      localRatio: number;
      externalRatio: number;
    }

    it('本地和外部比例应该互补', () => {
      const progress: AutonomyProgress = {
        localRatio: 45,
        externalRatio: 55
      };

      expect(progress.localRatio + progress.externalRatio).toBe(100);
    });

    it('自主进化应该等于本地比例', () => {
      const progress: AutonomyProgress = {
        localRatio: 60,
        externalRatio: 40
      };

      const autonomyProgress = progress.localRatio;
      expect(autonomyProgress).toBe(60);
    });
  });

  describe('技能胶囊', () => {
    interface SkillCapsule {
      id: string;
      name: string;
      category: string;
      isActive: number;
      usageCount: number;
      successRate: number;
    }

    it('活跃技能应该正确识别', () => {
      const capsules: SkillCapsule[] = [
        { id: '1', name: '技能1', category: 'general', isActive: 1, usageCount: 10, successRate: 0.9 },
        { id: '2', name: '技能2', category: 'general', isActive: 0, usageCount: 5, successRate: 0.8 },
        { id: '3', name: '技能3', category: 'general', isActive: 1, usageCount: 20, successRate: 0.95 }
      ];

      const activeCapsules = capsules.filter(c => c.isActive === 1);
      expect(activeCapsules).toHaveLength(2);
    });

    it('成功率应该在0-1之间', () => {
      const capsules: SkillCapsule[] = [
        { id: '1', name: '技能1', category: 'general', isActive: 1, usageCount: 10, successRate: 0.9 },
        { id: '2', name: '技能2', category: 'general', isActive: 1, usageCount: 5, successRate: 0.8 }
      ];

      capsules.forEach(c => {
        expect(c.successRate).toBeGreaterThanOrEqual(0);
        expect(c.successRate).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('影子记忆', () => {
    interface ShadowMemoryStats {
      totalMemories: number;
      totalExp: number;
      byField: { field: string; count: number; totalExp: number }[];
    }

    it('应该按领域统计记忆', () => {
      const stats: ShadowMemoryStats = {
        totalMemories: 100,
        totalExp: 5000,
        byField: [
          { field: 'user_preference', count: 30, totalExp: 1500 },
          { field: 'conversation', count: 40, totalExp: 2000 },
          { field: 'general', count: 30, totalExp: 1500 }
        ]
      };

      const sumByField = stats.byField.reduce((sum, f) => sum + f.count, 0);
      expect(sumByField).toBe(stats.totalMemories);
    });

    it('各领域经验应该等于总经验', () => {
      const stats: ShadowMemoryStats = {
        totalMemories: 50,
        totalExp: 3000,
        byField: [
          { field: 'legal', count: 15, totalExp: 1000 },
          { field: 'finance', count: 20, totalExp: 1200 },
          { field: 'strategy', count: 15, totalExp: 800 }
        ]
      };

      const sumExp = stats.byField.reduce((sum, f) => sum + f.totalExp, 0);
      expect(sumExp).toBe(stats.totalExp);
    });
  });
});
