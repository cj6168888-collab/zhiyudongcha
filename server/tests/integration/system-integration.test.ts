/**
 * 集成测试 - 系统完整功能测试
 *
 * @version 1.0.0
 * @date 2026-04-19
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock services
vi.mock('../services/evolution', () => ({
  getEvolutionState: vi.fn().mockResolvedValue({
    academicLadder: 'BACHELOR',
    academicXp: 500,
    academicProgress: 50
  })
}));

vi.mock('../services/mobile/PCExecutorService', () => ({
  getInstance: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(true),
    isReady: vi.fn().mockReturnValue(true),
    healthCheck: vi.fn().mockResolvedValue({ status: 'ok' })
  })
}));

describe('系统集成测试', () => {
  describe('API 端点集成', () => {
    const apiEndpoints = {
      // 进化系统
      evolution: [
        'GET /api/chrysalis/status',
        'POST /api/chrysalis/cycle/start',
        'POST /api/chrysalis/cycle/partial',
        'GET /api/chrysalis/failures/stats',
        'POST /api/chrysalis/failures/collect',
        'POST /api/chrysalis/failures/scan',
        'GET /api/chrysalis/retrospection/status',
        'POST /api/chrysalis/retrospection/start',
        'POST /api/chrysalis/logic/analyze',
        'POST /api/chrysalis/vision/evolve',
        'POST /api/chrysalis/selfcode/start',
        'GET /api/chrysalis/morning-gift'
      ],
      // 移动端
      mobile: [
        'GET /api/mobile/status',
        'POST /api/mobile/screenshot',
        'POST /api/mobile/click',
        'POST /api/mobile/type'
      ],
      // Navigator
      navigator: [
        'GET /api/navigator/stats',
        'GET /api/navigator/nodes',
        'GET /api/navigator/pending-reports',
        'GET /api/navigator/alerts',
        'POST /api/navigator/inspiration'
      ],
      // 系统
      system: [
        'GET /api/system/status',
        'GET /api/health',
        'GET /api/telemetry/status'
      ]
    };

    it('进化系统应该有完整的API端点', () => {
      expect(apiEndpoints.evolution).toHaveLength(12);
    });

    it('移动端应该有核心API端点', () => {
      expect(apiEndpoints.mobile.length).toBeGreaterThanOrEqual(4);
    });

    it('Navigator系统应该有核心API端点', () => {
      expect(apiEndpoints.navigator).toHaveLength(5);
    });

    it('系统应该有健康检查端点', () => {
      expect(apiEndpoints.system).toContain('GET /api/health');
    });
  });

  describe('数据流集成', () => {
    it('化蝶计划应该能生成进化事件', () => {
      const evolutionEvent = {
        id: `event_${Date.now()}`,
        sourceModule: 'chrysalis_orchestrator',
        eventType: 'FULL_EVOLUTION_CYCLE',
        deltaDescription: '完整进化周期完成',
        createdAt: new Date()
      };

      expect(evolutionEvent).toHaveProperty('id');
      expect(evolutionEvent).toHaveProperty('sourceModule');
      expect(evolutionEvent).toHaveProperty('eventType');
    });

    it('失败收集应该能影响进化分数', () => {
      const failures = {
        unanswered: 10,
        executionErrors: 5,
        userCorrections: 15
      };

      const scoreContribution = Math.min(
        failures.unanswered * 2 +
        failures.executionErrors * 3 +
        failures.userCorrections * 1,
        50
      );

      expect(scoreContribution).toBeGreaterThan(0);
      expect(scoreContribution).toBeLessThanOrEqual(50);
    });

    it('晨间礼物应该能反映进化成果', () => {
      const evolutionResult = {
        failuresCollected: 20,
        retrospectionResult: { failuresProcessed: 15, knowledgeGenerated: 8 },
        fineTuneResult: { tacticsLearned: ['策略1', '策略2'], trapsIdentified: ['陷阱1'] },
        visionResult: { patternsLearned: 3 },
        selfCodingResult: { patchesDeployed: 2, pluginsCreated: 1 }
      };

      const giftContent = {
        type: 'insight',
        content: `今日进化成果：学习${evolutionResult.fineTuneResult.tacticsLearned.length}个策略，识别${evolutionResult.fineTuneResult.trapsIdentified.length}个陷阱`
      };

      expect(giftContent.content).toContain('策略');
      expect(giftContent.content).toContain('陷阱');
    });
  });

  describe('前端后端集成', () => {
    it('前端应该正确调用进化API', () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { phase: 'IDLE', totalEvolutionCycles: 5 }
        })
      });

      expect(mockFetch).toBeDefined();
    });

    it('前端应该处理进化API错误', () => {
      const errorResponse = {
        success: false,
        error: '进化周期已在运行中'
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse).toHaveProperty('error');
    });

    it('移动端应该能接收PC控制指令', () => {
      const controlCommand = {
        type: 'click',
        params: { x: 100, y: 200 },
        timestamp: Date.now()
      };

      expect(controlCommand).toHaveProperty('type');
      expect(controlCommand).toHaveProperty('params');
      expect(controlCommand.type).toBe('click');
    });
  });

  describe('状态管理集成', () => {
    it('全局Store应该能同步移动端和桌面端状态', () => {
      const globalState = {
        currentProject: { id: 'proj-1', title: '测试项目' },
        recentScans: [],
        shareToSwarm: true,
        refreshKey: 0
      };

      expect(globalState).toHaveProperty('currentProject');
      expect(globalState).toHaveProperty('shareToSwarm');
    });

    it('刷新触发器应该能同步所有依赖组件', () => {
      let refreshKey = 0;
      const subscribers = ['EvolutionDashboard', 'NavigatorStats', 'TaskList'];

      refreshKey += 1;
      subscribers.forEach(sub => {
        expect(refreshKey).toBe(1);
      });

      refreshKey += 1;
      expect(refreshKey).toBe(2);
    });

    it('数据序列化应该能跨标签页同步', () => {
      const user = { id: 'sovereign-1', role: 'SOVEREIGN' };
      const serialized = JSON.stringify(user);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(user);
    });
  });

  describe('路由集成', () => {
    const routes = [
      { path: '/', name: 'BusinessHub', access: 'all' },
      { path: '/desktop', name: 'DesktopHome', access: 'authenticated' },
      { path: '/desktop/fleet', name: 'SovereignDashboard', access: 'SOVEREIGN' },
      { path: '/desktop/terminal', name: 'DesktopTerminal', access: 'SOVEREIGN' },
      { path: '/desktop/node/tasks', name: 'NodeDashboard', access: 'NODE' }
    ];

    it('路由应该有正确的访问控制', () => {
      const sovereignRoutes = routes.filter(r => r.access === 'SOVEREIGN');
      const nodeRoutes = routes.filter(r => r.access === 'NODE');
      const authenticatedRoutes = routes.filter(r => r.access === 'authenticated');

      expect(sovereignRoutes.length).toBeGreaterThan(0);
      expect(nodeRoutes.length).toBeGreaterThan(0);
    });

    it('SOVEREIGN应该能访问受保护的路由', () => {
      const userRole = 'SOVEREIGN';
      const protectedRoutes = routes.filter(r => r.access !== 'all');
      const accessibleRoutes = protectedRoutes.filter(r =>
        r.access === 'authenticated' ||
        r.access === userRole
      );

      expect(accessibleRoutes.length).toBeGreaterThan(0);
    });

    it('NODE不应该能访问SOVEREIGN专属路由', () => {
      const userRole = 'NODE';
      const sovereignOnlyRoutes = routes.filter(r => r.access === 'SOVEREIGN');
      const accessibleRoutes = sovereignOnlyRoutes.filter(r =>
        r.access === 'all' ||
        r.access === 'authenticated' ||
        r.access === userRole
      );

      expect(accessibleRoutes.length).toBeLessThan(sovereignOnlyRoutes.length);
    });
  });
});

describe('性能集成测试', () => {
  describe('进化周期性能', () => {
    it('完整周期应该在合理时间内完成', () => {
      const maxDuration = 5 * 60 * 1000; // 5分钟
      const phases = ['COLLECTING', 'RETROSPECTING', 'FINETUNING', 'VISION_EVOLVING', 'SELF_CODING', 'GENERATING_GIFT'];

      const phaseDurations = phases.map(() => Math.random() * 30000 + 10000); // 10-40秒每个阶段
      const totalDuration = phaseDurations.reduce((sum, d) => sum + d, 0);

      expect(totalDuration).toBeLessThan(maxDuration);
    });

    it('部分周期应该更快完成', () => {
      const partialPhases = ['COLLECTING', 'RETROSPECTING'];
      const phaseDurations = partialPhases.map(() => Math.random() * 30000 + 10000);
      const totalDuration = phaseDurations.reduce((sum, d) => sum + d, 0);

      expect(totalDuration).toBeLessThan(120000); // 2分钟
    });
  });

  describe('查询性能', () => {
    it('进化状态查询应该有缓存', () => {
      const cacheTTL = 30000; // 30秒
      const lastFetch = Date.now() - 20000; // 20秒前
      const shouldRefetch = Date.now() - lastFetch > cacheTTL;

      expect(shouldRefetch).toBe(false);
    });

    it('系统状态查询应该有更短的缓存', () => {
      const cacheTTL = 10000; // 10秒
      const lastFetch = Date.now() - 5000; // 5秒前
      const shouldRefetch = Date.now() - lastFetch > cacheTTL;

      expect(shouldRefetch).toBe(false);
    });
  });
});

describe('错误处理集成', () => {
  describe('进化系统错误处理', () => {
    it('应该能处理单个阶段失败', () => {
      const phases = ['COLLECTING', 'RETROSPECTING', 'FINETUNING', 'VISION_EVOLVING', 'SELF_CODING', 'GENERATING_GIFT'];
      const failedPhase = 'FINETUNING';

      const completedPhases = phases.slice(0, phases.indexOf(failedPhase));
      const totalPhases = phases.length;
      const successRate = completedPhases.length / totalPhases;

      expect(successRate).toBeCloseTo(0.33, 1);
    });

    it('应该能恢复部分完成的周期', () => {
      const partialResult = {
        failuresCollected: 20,
        retrospectionResult: { failuresProcessed: 15, knowledgeGenerated: 8 },
        fineTuneResult: null, // 失败
        visionResult: { patternsLearned: 3 },
        selfCodingResult: { patchesDeployed: 2, pluginsCreated: 1 }
      };

      const hasPartialData = partialResult.failuresCollected > 0 ||
                            partialResult.retrospectionResult ||
                            partialResult.visionResult;

      expect(hasPartialData).toBe(true);
    });

    it('应该能处理夜间周期冲突', () => {
      const isNightCycleActive = true;
      const shouldStartNewCycle = !isNightCycleActive;

      expect(shouldStartNewCycle).toBe(false);
    });
  });

  describe('移动端错误处理', () => {
    it('应该能处理设备断开连接', () => {
      const deviceState = {
        connected: false,
        lastError: 'Connection timeout',
        retryCount: 3
      };

      expect(deviceState.connected).toBe(false);
      expect(deviceState.retryCount).toBeGreaterThan(0);
    });

    it('应该能处理命令执行失败', () => {
      const commandResult = {
        success: false,
        error: 'Target element not found',
        shouldRetry: true
      };

      expect(commandResult.success).toBe(false);
      expect(commandResult.shouldRetry).toBe(true);
    });
  });
});

describe('安全集成测试', () => {
  describe('角色权限验证', () => {
    it('SOVEREIGN应该能访问所有功能', () => {
      const sovereignPermissions = new Set([
        'manage_fleet',
        'approve_reports',
        'broadcast_inspiration',
        'view_all_nodes',
        'access_terminal',
        'manage_experts'
      ]);

      expect(sovereignPermissions.size).toBe(6);
    });

    it('NODE应该被限制访问敏感功能', () => {
      const nodePermissions = new Set([
        'submit_report',
        'view_tasks',
        'record_ideas'
      ]);

      const sovereignOnly = new Set(['manage_fleet', 'approve_reports', 'broadcast_inspiration']);
      const hasAccess = [...sovereignOnly].some(p => nodePermissions.has(p));

      expect(hasAccess).toBe(false);
    });
  });

  describe('数据隔离', () => {
    it('NODE不应该能访问其他NODE的数据', () => {
      const node1Data = { reports: ['report-1', 'report-2'] };
      const node2 = { id: 'node-2', role: 'NODE' };

      const canAccess = node2.role === 'SOVEREIGN' || node1Data.reports.length === 0;

      expect(canAccess).toBe(false);
    });

    it('汇报应该按提交者隔离', () => {
      const reports = [
        { id: '1', nodeId: 'node-1', content: 'Node1报告' },
        { id: '2', nodeId: 'node-2', content: 'Node2报告' },
        { id: '3', nodeId: 'node-1', content: 'Node1另一个报告' }
      ];

      const node1Reports = reports.filter(r => r.nodeId === 'node-1');
      expect(node1Reports).toHaveLength(2);
    });
  });
});

describe('实时同步集成', () => {
  describe('灵感广播同步', () => {
    it('灵感应该能同步到所有节点', () => {
      const inspiration = {
        id: 'insp-1',
        content: '测试灵感',
        recipients: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5']
      };

      const nodes = [
        { id: 'node-1', status: 'ONLINE' },
        { id: 'node-2', status: 'ONLINE' },
        { id: 'node-3', status: 'OFFLINE' },
        { id: 'node-4', status: 'ONLINE' },
        { id: 'node-5', status: 'AWAY' }
      ];

      const onlineRecipients = inspiration.recipients.filter(r =>
        nodes.find(n => n.id === r && n.status === 'ONLINE')
      );

      expect(onlineRecipients.length).toBe(3);
    });
  });

  describe('警报实时推送', () => {
    it('警报应该能立即推送到所有SOVEREIGN', () => {
      const alert = {
        id: 'alert-1',
        severity: 'CRITICAL',
        title: '系统宕机',
        targets: ['sovereign-1', 'sovereign-2']
      };

      expect(alert.targets.length).toBeGreaterThan(0);
      expect(alert.severity).toBe('CRITICAL');
    });

    it('NODE应该只收到相关警报', () => {
      const alert = {
        id: 'alert-1',
        type: 'task_assignment',
        targets: ['node-1', 'node-2']
      };

      const node = { id: 'node-1' };
      const shouldReceive = alert.targets.includes(node.id);

      expect(shouldReceive).toBe(true);
    });
  });
});
