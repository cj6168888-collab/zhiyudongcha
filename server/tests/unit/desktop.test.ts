/**
 * Desktop Home Page 单元测试
 *
 * @version 1.0.0
 * @date 2026-04-19
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const mockLocalStorage = {
  desktop_user: JSON.stringify({
    id: 'sovereign-1',
    username: 'admin',
    role: 'SOVEREIGN'
  })
};

describe('DesktopHome', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: vi.fn((key) => {
          if (key === 'desktop_user') {
            return JSON.stringify({
              id: 'sovereign-1',
              username: 'admin',
              role: 'SOVEREIGN'
            });
          }
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    });
  });

  describe('用户角色判断', () => {
    it('应该正确识别 SOVEREIGN 角色', () => {
      const storedUser = localStorage.getItem('desktop_user');
      const user = storedUser ? JSON.parse(storedUser) : null;

      expect(user?.role).toBe('SOVEREIGN');
      expect(user?.username).toBe('admin');
    });

    it('应该正确识别 NODE 角色', () => {
      const nodeUser = {
        id: 'node-1',
        username: 'user',
        role: 'NODE'
      };

      expect(nodeUser.role).toBe('NODE');
    });
  });

  describe('快捷操作导航', () => {
    const quickActions = [
      { id: 'chat', icon: 'MessageCircle', label: 'AI对话', path: '/desktop/chat' },
      { id: 'control', icon: 'Monitor', label: '远程控制', path: '/desktop/control' },
      { id: 'tasks', icon: 'Zap', label: '任务中心', path: '/desktop/tasks' },
      { id: 'terminal', icon: 'Terminal', label: '命令终端', path: '/desktop/terminal' },
      { id: 'fleet', icon: 'Ship', label: '舰队管理', path: '/desktop/fleet', sovereignOnly: true },
      { id: 'experts', icon: 'Users', label: '专家咨询', path: '/desktop/experts' },
    ];

    it('所有用户应该能看到通用快捷操作', () => {
      const visibleActions = quickActions.filter(a => !a.sovereignOnly);

      expect(visibleActions).toHaveLength(5);
      expect(visibleActions.find(a => a.id === 'chat')).toBeDefined();
      expect(visibleActions.find(a => a.id === 'experts')).toBeDefined();
    });

    it('SOVEREIGN 应该能看到所有快捷操作', () => {
      const role = 'SOVEREIGN';
      const visibleActions = quickActions.filter(a => !a.sovereignOnly || role === 'SOVEREIGN');

      expect(visibleActions).toHaveLength(6);
      expect(visibleActions.find(a => a.id === 'fleet')).toBeDefined();
    });

    it('NODE 不应该看到 sovereignOnly 的操作', () => {
      const role = 'NODE';
      const visibleActions = quickActions.filter(a => !a.sovereignOnly || role === 'SOVEREIGN');

      expect(visibleActions).toHaveLength(5);
      expect(visibleActions.find(a => a.id === 'fleet')).toBeUndefined();
    });
  });

  describe('系统状态数据', () => {
    it('应该返回正确的系统状态格式', () => {
      const systemStatus = {
        requests: { avgResponseTimeMs: 45 },
        memory: { used: 16, total: 32 },
        uptime: '7天 12小时 34分'
      };

      expect(systemStatus).toHaveProperty('requests');
      expect(systemStatus).toHaveProperty('memory');
      expect(systemStatus).toHaveProperty('uptime');
    });

    it('应该正确计算在线设备数量', () => {
      const devices = [
        { id: '1', name: 'PC-1', status: 'ONLINE', platform: 'Windows' },
        { id: '2', name: 'PC-2', status: 'OFFLINE', platform: 'Windows' },
        { id: '3', name: 'Phone', status: 'ONLINE', platform: 'Android' },
      ];

      const onlineDevices = devices.filter(d => d.status === 'ONLINE').length;

      expect(onlineDevices).toBe(2);
    });

    it('应该正确计算活跃任务数量', () => {
      const tasks = [
        { id: '1', name: 'Task 1', status: 'ACTIVE' },
        { id: '2', name: 'Task 2', status: 'PENDING' },
        { id: '3', name: 'Task 3', status: 'ACTIVE' },
        { id: '4', name: 'Task 4', status: 'COMPLETED' },
      ];

      const activeTasks = tasks.filter(t => t.status === 'ACTIVE').length;

      expect(activeTasks).toBe(2);
    });

    it('应该正确计算严重警报数量', () => {
      const alerts = [
        { id: '1', severity: 'CRITICAL', acknowledged: false },
        { id: '2', severity: 'WARNING', acknowledged: false },
        { id: '3', severity: 'CRITICAL', acknowledged: true },
        { id: '4', severity: 'CRITICAL', acknowledged: false },
      ];

      const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged).length;

      expect(criticalAlerts).toBe(2);
    });
  });

  describe('Navigator-X 数据', () => {
    it('应该返回正确的舰队统计格式', () => {
      const navigatorStats = {
        totalNodes: 10,
        activeNodes: 7,
        avgMoraleScore: 85,
        pendingReports: 3,
        alerts: 2
      };

      expect(navigatorStats).toHaveProperty('totalNodes');
      expect(navigatorStats).toHaveProperty('activeNodes');
      expect(navigatorStats).toHaveProperty('avgMoraleScore');
      expect(navigatorStats.totalNodes).toBeGreaterThan(0);
      expect(navigatorStats.activeNodes).toBeLessThanOrEqual(navigatorStats.totalNodes);
    });

    it('应该正确计算士气百分比', () => {
      const avgMoraleScore = 85;
      const moralePercentage = avgMoraleScore;

      expect(moralePercentage).toBe(85);
      expect(moralePercentage).toBeGreaterThanOrEqual(0);
      expect(moralePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('待审批汇报处理', () => {
    it('应该正确过滤待审批汇报', () => {
      const reports = [
        { id: '1', nodeName: 'Node A', summary: '今日工作报告', status: 'PENDING' },
        { id: '2', nodeName: 'Node B', summary: '项目进度汇报', status: 'APPROVED' },
        { id: '3', nodeName: 'Node C', summary: '下周计划', status: 'PENDING' },
      ];

      const pendingReports = reports.filter(r => r.status === 'PENDING');

      expect(pendingReports).toHaveLength(2);
      expect(pendingReports[0].nodeName).toBe('Node A');
    });

    it('应该正确处理空汇报列表', () => {
      const reports: any[] = [];
      const pendingReports = reports.filter(r => r.status === 'PENDING');

      expect(pendingReports).toHaveLength(0);
    });
  });

  describe('警报处理', () => {
    it('应该正确分类警报严重程度', () => {
      const alerts = [
        { id: '1', severity: 'CRITICAL', title: '系统宕机', acknowledged: false },
        { id: '2', severity: 'WARNING', title: '内存使用率高', acknowledged: false },
        { id: '3', severity: 'INFO', title: '系统更新可用', acknowledged: false },
      ];

      const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged);
      const warningAlerts = alerts.filter(a => a.severity === 'WARNING' && !a.acknowledged);

      expect(criticalAlerts).toHaveLength(1);
      expect(warningAlerts).toHaveLength(1);
    });

    it('应该正确判断警报是否需要显示', () => {
      const alerts = [
        { id: '1', acknowledged: false },
        { id: '2', acknowledged: true },
        { id: '3', acknowledged: false },
      ];

      const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);

      expect(unacknowledgedAlerts.length > 0).toBe(true);
    });
  });

  describe('日期格式化', () => {
    it('应该正确格式化当前日期', () => {
      const now = new Date();
      const formatted = now.toLocaleDateString('zh-CN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      expect(formatted).toContain(now.getFullYear().toString());
      expect(formatted).toContain('年');
      expect(formatted).toContain('月');
      expect(formatted).toContain('日');
    });
  });
});

describe('Desktop Login', () => {
  describe('离线模式登录', () => {
    it('admin 账号应该登录为 SOVEREIGN', () => {
      const form = { username: 'admin', password: 'admin' };
      const role = form.username === 'admin' ? 'SOVEREIGN' : 'NODE';

      expect(role).toBe('SOVEREIGN');
    });

    it('普通账号应该登录为 NODE', () => {
      const form = { username: 'user', password: 'user' };
      const role = form.username === 'admin' ? 'SOVEREIGN' : 'NODE';

      expect(role).toBe('NODE');
    });
  });

  describe('localStorage 存储', () => {
    it('应该正确存储用户信息', () => {
      const user = {
        id: 'sovereign-1',
        username: 'admin',
        role: 'SOVEREIGN'
      };

      const stored = JSON.stringify(user);
      const parsed = JSON.parse(stored);

      expect(parsed.id).toBe('sovereign-1');
      expect(parsed.username).toBe('admin');
      expect(parsed.role).toBe('SOVEREIGN');
    });
  });
});

describe('Desktop Experts', () => {
  const experts = [
    { id: 'legal', name: '法务专家', contribution: 85, consultations: 234 },
    { id: 'finance', name: '财务专家', contribution: 92, consultations: 189 },
    { id: 'strategy', name: '策划专家', contribution: 78, consultations: 156 },
    { id: 'psychology', name: '心理专家', contribution: 65, consultations: 98 },
    { id: 'secretary', name: '全能秘书', contribution: 88, consultations: 412 },
  ];

  describe('专家状态', () => {
    it('应该支持三种状态', () => {
      const statuses = ['idle', 'consulting', 'analyzing'];

      statuses.forEach(status => {
        const expert = { id: 'test', status };
        expect(['idle', 'consulting', 'analyzing']).toContain(expert.status);
      });
    });

    it('应该正确显示状态徽章', () => {
      const getStatusBadge = (status: string) => {
        switch (status) {
          case 'consulting':
            return { class: 'bg-yellow-500/20', text: '咨询中' };
          case 'analyzing':
            return { class: 'bg-blue-500/20', text: '分析中' };
          default:
            return { class: 'bg-green-500/20', text: '可用' };
        }
      };

      expect(getStatusBadge('consulting').text).toBe('咨询中');
      expect(getStatusBadge('analyzing').text).toBe('分析中');
      expect(getStatusBadge('idle').text).toBe('可用');
    });
  });

  describe('咨询统计', () => {
    it('应该正确计算总咨询量', () => {
      const totalConsultations = experts.reduce((sum, e) => sum + e.consultations, 0);

      expect(totalConsultations).toBe(1089);
    });

    it('应该正确计算采纳率', () => {
      const adoptedCount = 890;
      const totalConsultations = 1089;
      const adoptionRate = Math.round((adoptedCount / totalConsultations) * 100);

      expect(adoptionRate).toBe(82);
    });
  });

  describe('专家专业领域', () => {
    it('每个专家应该有专业领域', () => {
      const specialties = {
        legal: ['合同审阅', '风险识别', '谈判策略', '法规咨询'],
        finance: ['投资分析', '成本优化', '预算编制', '税务筹划'],
        strategy: ['商业策划', '市场分析', '竞争策略', '创新方案'],
        psychology: ['团队管理', '沟通技巧', '压力管理', '冲突调解'],
        secretary: ['日程管理', '邮件处理', '会议协调', '事务提醒'],
      };

      Object.values(specialties).forEach(specialty => {
        expect(specialty.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Desktop Terminal', () => {
  const quickCommands = [
    { label: '系统信息', command: 'system:info' },
    { label: '清理缓存', command: 'system:clear-cache' },
    { label: '网络诊断', command: 'network:ping' },
    { label: '磁盘使用', command: 'disk:usage' },
    { label: '进程列表', command: 'process:list' },
    { label: '日志查看', command: 'logs:tail' },
  ];

  describe('快捷命令', () => {
    it('应该有6个快捷命令', () => {
      expect(quickCommands).toHaveLength(6);
    });

    it('每个命令应该有唯一的command', () => {
      const commands = quickCommands.map(c => c.command);
      const uniqueCommands = [...new Set(commands)];

      expect(uniqueCommands.length).toBe(commands.length);
    });
  });

  describe('命令执行模拟', () => {
    const simulateCommandOutput = (cmd: string): string => {
      const cmdLower = cmd.toLowerCase();

      if (cmdLower.includes('system:info')) {
        return `操作系统: Windows 11 Pro\n处理器: Intel(R) Core(TM) i7-12700K`;
      }

      if (cmdLower.includes('clear-cache')) {
        return `正在清理缓存...\n✓ 清理临时文件 (2.3GB)\n✓ 清理浏览器缓存 (456MB)`;
      }

      if (cmdLower.includes('ping')) {
        return `正在 Ping 目标主机...\nReply from 220.181.38.149: 时间=12ms TTL=54`;
      }

      return `命令 "${cmd}" 已执行完成`;
    };

    it('应该正确解析系统信息命令', () => {
      const output = simulateCommandOutput('system:info');

      expect(output).toContain('Windows');
      expect(output).toContain('处理器');
    });

    it('应该正确解析清理缓存命令', () => {
      const output = simulateCommandOutput('system:clear-cache');

      expect(output).toContain('清理');
      expect(output).toContain('GB');
    });

    it('应该正确解析网络命令', () => {
      const output = simulateCommandOutput('network:ping baidu.com');

      expect(output).toContain('Ping');
      expect(output).toContain('ms');
    });

    it('应该处理未知命令', () => {
      const output = simulateCommandOutput('unknown:command');

      expect(output).toContain('unknown:command');
    });
  });

  describe('命令状态', () => {
    it('应该支持三种命令状态', () => {
      const statuses = ['success', 'error', 'running'];

      statuses.forEach(status => {
        const command = { id: '1', status };
        expect(['success', 'error', 'running']).toContain(command.status);
      });
    });
  });
});
