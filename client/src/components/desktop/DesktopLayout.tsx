/**
 * DesktopLayout - 桌面端布局组件
 *
 * 根据用户角色渲染不同的侧边栏和内容
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import DesktopSidebar from "@/components/desktop/DesktopSidebar";

interface DesktopUser {
  id: string;
  username: string;
  role: 'SOVEREIGN' | 'NODE';
}

function getUser(): DesktopUser | null {
  const stored = localStorage.getItem('desktop_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

interface DesktopLayoutProps {
  children: React.ReactNode;
}

export default function DesktopLayout({ children }: DesktopLayoutProps) {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<DesktopUser | null>(() => getUser());

  // 监听localStorage变化
  useEffect(() => {
    const handleStorageChange = () => {
      const newUser = getUser();
      setUser(newUser);
      if (!newUser) {
        setLocation('/desktop/login');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // 也监听自定义事件
    window.addEventListener('user_changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user_changed', handleStorageChange);
    };
  }, [setLocation]);

  // 未登录则跳转到登录页
  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser && location !== '/desktop/login') {
      setLocation('/desktop/login');
    }
    setUser(currentUser);
  }, [location, setLocation]);

  // 登录页不需要侧边栏
  if (location === '/desktop/login') {
    return <>{children}</>;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#030712]">
      {/* 侧边栏 */}
      <DesktopSidebar role={user?.role || 'NODE'} user={user || undefined} />

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
