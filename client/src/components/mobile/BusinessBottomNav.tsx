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
      className="z-[999] flex-shrink-0 border-t border-white/10 bg-[#0a0a0f]/95 pt-2 backdrop-blur-xl"
    >
      <div className="mx-auto grid h-[72px] max-w-lg grid-cols-5 gap-1.5 px-2">
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
                "relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl transition-all duration-200 active:scale-95",
                isActive ? "bg-violet-500/10 text-[#a78bfa]" : "text-slate-500"
              )}
            >
              {isActive && <span className="absolute top-1.5 h-0.5 w-7 rounded-full bg-[#8b5cf6]" />}
              <Icon className="h-6 w-6" />
              <span className="text-xs font-black leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,16px)]" />
    </nav>
  );
}
