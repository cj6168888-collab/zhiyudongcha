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
      <div className="mx-auto grid h-[78px] max-w-lg grid-cols-5 gap-1 px-2">
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
                "relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl transition-all duration-200 active:scale-95",
                isActive ? "text-[#b69cff]" : "text-slate-500"
              )}
            >
              {isActive && <span className="absolute top-1.5 h-1 w-8 rounded-full bg-[#8b5cf6]" />}
              <Icon className={cn("h-7 w-7", isActive && "drop-shadow-[0_0_10px_rgba(139,92,246,0.45)]")} />
              <span className="text-[13px] font-black leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,16px)]" />
    </nav>
  );
}
