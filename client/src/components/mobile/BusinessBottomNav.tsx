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
      className="flex-shrink-0 bg-[#0a0a0f]/95 border-t border-white/10 z-[999] pt-1.5 backdrop-blur-xl"
    >
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (item.id === 'conversation' && location === '/chat');

          return (
            <button
              key={item.id}
              onClick={() => setLocation(item.path)}
              data-testid={`nav-item-${item.id}`}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 min-w-0 rounded-lg active:scale-95 transition-all duration-200",
                isActive ? "text-[#8b5cf6]" : "text-gray-500"
              )}
            >
              {isActive && <span className="absolute top-0 h-0.5 w-5 rounded-full bg-[#8b5cf6]" />}
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,16px)]" />
    </nav>
  );
}
