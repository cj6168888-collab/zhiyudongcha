/**
 * BusinessBottomNav - 移动端底部导航
 */
import { Compass, HardDrive, ListTodo, MessageCircle, Smartphone } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navItems = [
  { id: 'conversation', label: '对话', icon: MessageCircle, path: '/' },
  { id: 'tasks', label: '任务', icon: ListTodo, path: '/tasks' },
  { id: 'vault', label: '智库', icon: HardDrive, path: '/vault' },
  { id: 'devices', label: '设备', icon: Smartphone, path: '/devices' },
  { id: 'navigator', label: '领航', icon: Compass, path: '/navigator-command' },
];

export function BusinessBottomNav() {
  const [location, setLocation] = useLocation();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="移动端主导航"
      className="flex-shrink-0 bg-[#0a0a0f]/95 border-t border-white/10 z-[999] pt-2 backdrop-blur-xl"
    >
      <div className="grid h-16 max-w-lg grid-cols-5 gap-1 px-2 mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (item.id === 'conversation' && location === '/chat');

          return (
            <button
              key={item.id}
              onClick={() => setLocation(item.path)}
              data-testid={`nav-item-${item.id}`}
              aria-label={`${item.label}${isActive ? "，当前页面" : ""}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-all duration-200",
                isActive ? "bg-violet-500/10 text-[#a78bfa]" : "text-slate-500"
              )}
            >
              {isActive && <span className="absolute top-1 h-0.5 w-6 rounded-full bg-[#8b5cf6]" />}
              <Icon className="h-6 w-6" />
              <span className="text-[11px] font-black leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,16px)]" />
    </nav>
  );
}
