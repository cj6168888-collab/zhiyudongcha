/**
 * MobileBottomNav - 移动端底部导航 (固定定位加强版)
 *
 * 核心：使用 fixed 确保在所有页面之上，并增加显眼的背景色进行调试
 */

import { Home, MessageSquare, Settings, Mic } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navItems = [
  { id: 'home', label: '首页', icon: Home, path: '/' },
  { id: 'chat', label: '对话', icon: MessageSquare, path: '/chat' },
  { id: 'recordings', label: '历史', icon: Mic, path: '/recordings' },
  { id: 'settings', label: '设置', icon: Settings, path: '/settings' },
];

export function MobileBottomNav() {
  const [location, setLocation] = useLocation();

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0
        md:hidden
        bg-[#1a1a2e] /* 稍微加深颜色以示区分 */
        border-t border-primary/20
        z-[9999] /* 极高层级 */
        shadow-[0_-4px_20px_rgba(0,0,0,0.5)]
      "
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <button
              key={item.id}
              onClick={() => setLocation(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full active:scale-90 transition-all",
                isActive ? "text-primary" : "text-gray-500"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "fill-current")} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* 适配全面屏手势条 */}
      <div className="h-[env(safe-area-inset-bottom,16px)]" />
    </nav>
  );
}
