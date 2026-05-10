/**
 * BusinessBottomNav - 移动端底部导航 (测试增强版 + OpenClaw集成)
 */
import { LayoutGrid, Mic, HardDrive, Settings, Monitor, ListTodo, Sparkles, Layers, Inbox } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navItems = [
  { id: 'work', label: '工作台', icon: LayoutGrid, path: '/' },
  { id: 'insight', label: '聆听舱', icon: Mic, path: '/insight' },
  { id: 'vault', label: '智库', icon: HardDrive, path: '/vault' },
  { id: 'remote', label: '远程', icon: Monitor, path: '/remote-pc' },
  { id: 'tasks', label: '任务', icon: ListTodo, path: '/tasks' },
  { id: 'inbox', label: '收件箱', icon: Inbox, path: '/inbox' },
  { id: 'skills', label: '技能', icon: Sparkles, path: '/skills' },
  { id: 'workflow', label: '工作流', icon: Layers, path: '/workflow' },
  { id: 'control', label: '领航', icon: Settings, path: '/navigator-command' },
];

export function BusinessBottomNav() {
  const [location, setLocation] = useLocation();

  return (
    <nav
      data-testid="bottom-nav"
      className="flex-shrink-0 bg-[#0a0a0f] border-t border-white/10 z-[999] pt-2"
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <button
              key={item.id}
              onClick={() => setLocation(item.path)}
              data-testid={`nav-item-${item.id}`}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full active:scale-95 transition-all duration-200",
                isActive ? "text-[#6366f1] scale-105" : "text-gray-500 opacity-70"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,16px)]" />
    </nav>
  );
}
