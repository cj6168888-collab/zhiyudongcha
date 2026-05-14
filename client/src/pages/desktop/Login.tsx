/**
 * DesktopLogin - Navigator-X 桌面端登录页
 *
 * 桌面端入口：
 * 1. 账号密码登录
 * 2. 自动判断 SOVEREIGN / NODE 角色
 * 3. 持久化登录状态
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Compass, Shield, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoginForm {
  username: string;
  password: string;
}

function persistDesktopUser(username: string, role: 'SOVEREIGN' | 'NODE') {
  localStorage.setItem('desktop_user', JSON.stringify({
    id: role === 'SOVEREIGN' ? 'sovereign-1' : `node-${Date.now()}`,
    username,
    role,
  }));
}

export default function DesktopLogin() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<LoginForm>({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (form.username === 'admin' && form.password === 'admin') {
        persistDesktopUser(form.username, 'SOVEREIGN');
        setLocation('/desktop');
        return;
      }

      if (form.username === 'user' && form.password === 'user') {
        persistDesktopUser(form.username, 'NODE');
        setLocation('/desktop/node');
        return;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: form.password }),
      });

      if (res.ok) {
        const data = await res.json();
        const role = data.data?.role === 'MASTER' ? 'SOVEREIGN' : 'NODE';
        persistDesktopUser(form.username || role.toLowerCase(), role);
        if (role === 'SOVEREIGN') {
          setLocation('/desktop');
        } else {
          setLocation('/desktop/node');
        }
      } else {
        setError('用户名或密码错误');
      }
    } catch {
      setError(form.username && form.password ? '登录服务暂不可用' : '请输入用户名和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md bg-white/5 border-white/10 relative z-10">
        <CardHeader className="text-center pb-8">
          {/* Logo */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Compass className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-widest">
            Navigator-X
          </CardTitle>
          <p className="text-gray-500 text-sm mt-2">桌面端登录</p>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="输入用户名"
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="输入密码"
                className="bg-white/5 border-white/10"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-600"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>

          {/* 角色说明 */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center mb-4">测试账号</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ username: 'admin', password: 'admin' })}
                className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left hover:bg-amber-500/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">SOVEREIGN</span>
                </div>
                <p className="text-[10px] text-gray-500">老板账号：admin</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ username: 'user', password: 'user' })}
                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-left hover:bg-blue-500/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-blue-400">NODE</span>
                </div>
                <p className="text-[10px] text-gray-500">员工账号：user</p>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
