/**
 * DesktopSidebar - 桌面端共享侧边栏组件
 *
 * 根据用户角色显示不同的导航菜单
 */
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useZ1Store, MAX_HP, ACADEMIC_LEVELS, type AcademicLevel } from "@/lib/z1/god-protocol";
import {
  Home, MessageCircle, Monitor, Ship, FileText, Users,
  FolderKanban, Network, HardDrive, Settings, Zap, Terminal,
  CheckCircle, Lightbulb, Compass,
  Sparkles, LogOut, User
} from "lucide-react";

const LEVEL_LABELS: Record<AcademicLevel, string> = {
  BACHELOR: '学士', MASTER: '硕士', DOCTOR: '博士', PROFESSOR: '教授', EXPERT: '专家',
};

const XP_THRESHOLDS: Record<AcademicLevel, { start: number; end: number }> = {
  BACHELOR:  { start: 0,     end: 1000  },
  MASTER:    { start: 1000,  end: 5000  },
  DOCTOR:    { start: 5000,  end: 15000 },
  PROFESSOR: { start: 15000, end: 30000 },
  EXPERT:    { start: 30000, end: 30000 },
};

function SidebarHpEvolution() {
  const { hpBalance, academicLevel, academicXp } = useZ1Store();
  const hpPct = Math.min(100, Math.round((hpBalance / MAX_HP) * 100));
  const { start, end } = XP_THRESHOLDS[academicLevel];
  const xpInLevel = Math.max(0, academicXp - start);
  const xpNeeded = end - start;
  const xpPct = xpNeeded > 0 ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;
  const nextLevel = ACADEMIC_LEVELS[ACADEMIC_LEVELS.indexOf(academicLevel) + 1];

  return (
    <div className="px-4 pb-3 space-y-3">
      {/* HP 条 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />HP
          </span>
          <span className="text-[10px] font-mono text-amber-400">{hpBalance} / {MAX_HP}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-500"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>
      {/* 学术等级进度 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">
            {LEVEL_LABELS[academicLevel]}
          </span>
          <span className="text-[10px] font-mono text-indigo-400">
            {nextLevel ? `→ ${LEVEL_LABELS[nextLevel]}` : '满级'}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
          {xpInLevel.toLocaleString()} / {xpNeeded > 0 ? xpNeeded.toLocaleString() : '∞'} XP
        </p>
      </div>
    </div>
  );
}

interface SidebarProps {
  role: 'SOVEREIGN' | 'NODE';
  user?: {
    username: string;
    id: string;
  };
}

// 完整导航
const allNavItems = [
  // 首页
  { id: 'home', icon: Home, label: '首页', path: '/desktop' },

  // 小星AI功能
  { id: 'chat', icon: MessageCircle, label: 'AI对话', path: '/desktop/chat' },

  // OpenClaw功能 (SOVEREIGN专有)
  { id: 'control', icon: Monitor, label: 'PC代理', path: '/desktop/control', sovereignOnly: true },
  { id: 'tasks', icon: Zap, label: '任务中心', path: '/desktop/tasks' },
  { id: 'terminal', icon: Terminal, label: '命令终端', path: '/desktop/terminal', sovereignOnly: true },

  // Navigator-X功能 (SOVEREIGN专有)
  { id: 'fleet', icon: Ship, label: '舰队管理', path: '/desktop/fleet', sovereignOnly: true },
  { id: 'reports', icon: FileText, label: '汇报审批', path: '/desktop/reports', sovereignOnly: true },
  { id: 'inspiration', icon: Sparkles, label: '想法暂存', path: '/desktop/inspiration', sovereignOnly: true },

  // 五大专家
  { id: 'experts', icon: Users, label: '专家咨询', path: '/desktop/experts' },
];

// NODE专属导航
const nodeNavItems = [
  { id: 'draft', icon: FileText, label: '草案生成', path: '/desktop/node/draft' },
  { id: 'my-tasks', icon: CheckCircle, label: '我的任务', path: '/desktop/node/tasks' },
  { id: 'my-ideas', icon: Lightbulb, label: '灵感记录', path: '/desktop/node/ideas' },
];

// 共享导航
const sharedNavItems = [
  { icon: FolderKanban, label: '项目管理', path: '/desktop/projects' },
  { icon: Network, label: '人脉管理', path: '/desktop/contacts' },
  { icon: HardDrive, label: '数字金库', path: '/desktop/vault' },
  { icon: Settings, label: '系统设置', path: '/desktop/settings' },
];

export default function DesktopSidebar({ role, user }: SidebarProps) {
  const [location, setLocation] = useLocation();

  // 根据角色过滤导航项
  const filteredNavItems = allNavItems.filter(item => !item.sovereignOnly || role === 'SOVEREIGN');
  const filteredNodeNav = nodeNavItems.filter(item => role === 'NODE');

  const handleLogout = () => {
    localStorage.removeItem('desktop_user');
    setLocation('/desktop/login');
  };

  return (
    <aside className="w-64 h-screen bg-[#0a0a0f] border-r border-white/10 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider">Navigator-X</h1>
            <p className={cn(
              "text-[10px] font-mono uppercase",
              role === 'SOVEREIGN' ? "text-amber-400" : "text-blue-400"
            )}>
              {role}
            </p>
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* 通用导航 */}
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (item.path === '/desktop' && location === '/desktop');
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                isActive
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}

        {/* NODE专属导航 */}
        {filteredNodeNav.length > 0 && (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="text-[10px] text-gray-500 uppercase tracking-widest px-3 mb-2">
              节点功能
            </p>
            {filteredNodeNav.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                    isActive
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </>
        )}

        {/* 分隔线 */}
        <div className="my-4 border-t border-white/10" />
        <p className="text-[10px] text-gray-500 uppercase tracking-widest px-3 mb-2">
          办公功能
        </p>

        {sharedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                isActive
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* HP / 学术等级 */}
      <div className="border-t border-white/10 pt-3">
        <SidebarHpEvolution />
      </div>

      {/* 用户信息 */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <User className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username || '用户'}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.id || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">退出登录</span>
        </button>
      </div>
    </aside>
  );
}
