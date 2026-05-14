/**
 * DesktopLogin - Navigator-X 桌面端登录页
 */
import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Compass, KeyRound, LogIn, MessageSquare, Monitor, RotateCcw, Shield, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register" | "reset";
type DesktopRole = "SOVEREIGN" | "NODE";

interface AuthForm {
  username: string;
  password: string;
  phone: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

interface AuthData {
  role?: "MASTER" | "GUEST";
  user?: {
    id?: string;
    username?: string;
  };
}

interface SmsData {
  cooldownSeconds?: number;
  debugCode?: string;
}

let csrfTokenPromise: Promise<string | null> | null = null;

async function getCsrfToken(): Promise<string | null> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch("/api/security/csrf-token", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json().catch(() => null);
        return typeof body?.token === "string" ? body.token : null;
      })
      .catch(() => null);
  }

  return csrfTokenPromise;
}

async function postAuth<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || "请求失败");
  }

  return data;
}

function persistDesktopUser(username: string, role: DesktopRole, id?: string) {
  localStorage.setItem(
    "desktop_user",
    JSON.stringify({
      id: id || (role === "SOVEREIGN" ? "sovereign-1" : `node-${Date.now()}`),
      username,
      role,
    })
  );
}

function mapRole(role?: "MASTER" | "GUEST"): DesktopRole {
  return role === "MASTER" ? "SOVEREIGN" : "NODE";
}

const emptyForm: AuthForm = {
  username: "",
  password: "",
  phone: "",
  code: "",
  newPassword: "",
  confirmPassword: "",
};

export default function DesktopLogin() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [form, setForm] = useState<AuthForm>(emptyForm);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = window.setTimeout(() => setSmsCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [smsCooldown]);

  const setField = (key: keyof AuthForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const enterApp = (data: AuthData, fallbackUsername: string) => {
    const role = mapRole(data.role);
    persistDesktopUser(data.user?.username || fallbackUsername || role.toLowerCase(), role, data.user?.id);
    setLocation(role === "SOVEREIGN" ? "/desktop" : "/desktop/node");
  };

  const handleModeChange = (value: string) => {
    setMode(value as AuthMode);
    setError("");
    setInfo("");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");

    try {
      if (form.username === "admin" && form.password === "admin") {
        persistDesktopUser(form.username, "SOVEREIGN");
        setLocation("/desktop");
        return;
      }

      if (form.username === "user" && form.password === "user") {
        persistDesktopUser(form.username, "NODE");
        setLocation("/desktop/node");
        return;
      }

      const username = form.username.trim();
      const payload = username
        ? { username, password: form.password }
        : { secret: form.password };
      const response = await postAuth<AuthData>("/api/auth/login", payload);
      enterApp(response.data || {}, username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async (scene: "register" | "reset_password") => {
    setSmsLoading(true);
    setError("");
    setInfo("");

    try {
      const response = await postAuth<SmsData>("/api/auth/sms/send", { phone: form.phone, scene });
      const cooldown = response.data?.cooldownSeconds || 60;
      setSmsCooldown(cooldown);
      setInfo(response.data?.debugCode ? `验证码已发送：${response.data.debugCode}` : "验证码已发送");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setSmsLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");

    try {
      if (form.password !== form.confirmPassword) {
        throw new Error("两次输入的密码不一致");
      }

      const response = await postAuth<AuthData>("/api/auth/register", {
        phone: form.phone,
        password: form.password,
        code: form.code,
      });
      enterApp(response.data || {}, form.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");

    try {
      if (form.newPassword !== form.confirmPassword) {
        throw new Error("两次输入的密码不一致");
      }

      await postAuth("/api/auth/password/reset", {
        phone: form.phone,
        code: form.code,
        newPassword: form.newPassword,
      });
      setInfo("密码已重置");
      setMode("login");
      setForm((current) => ({
        ...current,
        username: current.phone,
        password: "",
        code: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "密码重置失败");
    } finally {
      setIsLoading(false);
    }
  };

  const codeButtonText = smsCooldown > 0 ? `${smsCooldown}s` : "获取验证码";

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-35 bg-[linear-gradient(rgba(99,102,241,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.18)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <Card className="w-full max-w-md bg-[#07111f]/95 border-white/10 relative z-10 shadow-2xl shadow-black/40">
        <CardHeader className="text-center pb-5">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500 mx-auto mb-5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Compass className="w-9 h-9 text-white" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-widest">
            Navigator-X
          </CardTitle>
          <p className="text-gray-500 text-sm mt-2">桌面端账号</p>
        </CardHeader>

        <CardContent className="space-y-5">
          <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="w-3.5 h-3.5" />
                登录
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                注册
              </TabsTrigger>
              <TabsTrigger value="reset" className="gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                找回
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">手机号 / 用户名</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setField("username", e.target.value)}
                    placeholder="输入手机号或用户名"
                    className="bg-white/5 border-white/10"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="输入密码"
                    className="bg-white/5 border-white/10"
                    autoComplete="current-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-indigo-500 hover:bg-indigo-600 gap-2"
                  disabled={isLoading}
                >
                  <LogIn className="w-4 h-4" />
                  {isLoading ? "登录中..." : "登录"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-5">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-phone">手机号</Label>
                  <Input
                    id="register-phone"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="输入手机号"
                    className="bg-white/5 border-white/10"
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-code">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="register-code"
                      value={form.code}
                      onChange={(e) => setField("code", e.target.value)}
                      placeholder="6 位验证码"
                      className="bg-white/5 border-white/10"
                      inputMode="numeric"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-w-28 gap-2 border-white/10 bg-white/5"
                      disabled={smsLoading || smsCooldown > 0}
                      onClick={() => handleSendCode("register")}
                    >
                      <MessageSquare className="w-4 h-4" />
                      {smsLoading ? "发送中" : codeButtonText}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="register-password">密码</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      placeholder="至少 8 位"
                      className="bg-white/5 border-white/10"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">确认密码</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setField("confirmPassword", e.target.value)}
                      placeholder="再次输入"
                      className="bg-white/5 border-white/10"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-indigo-500 hover:bg-indigo-600 gap-2"
                  disabled={isLoading}
                >
                  <UserPlus className="w-4 h-4" />
                  {isLoading ? "注册中..." : "注册并进入"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset" className="mt-5">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-phone">手机号</Label>
                  <Input
                    id="reset-phone"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="输入注册手机号"
                    className="bg-white/5 border-white/10"
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-code">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="reset-code"
                      value={form.code}
                      onChange={(e) => setField("code", e.target.value)}
                      placeholder="6 位验证码"
                      className="bg-white/5 border-white/10"
                      inputMode="numeric"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-w-28 gap-2 border-white/10 bg-white/5"
                      disabled={smsLoading || smsCooldown > 0}
                      onClick={() => handleSendCode("reset_password")}
                    >
                      <MessageSquare className="w-4 h-4" />
                      {smsLoading ? "发送中" : codeButtonText}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="reset-password">新密码</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      value={form.newPassword}
                      onChange={(e) => setField("newPassword", e.target.value)}
                      placeholder="至少 8 位"
                      className="bg-white/5 border-white/10"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm">确认密码</Label>
                    <Input
                      id="reset-confirm"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setField("confirmPassword", e.target.value)}
                      placeholder="再次输入"
                      className="bg-white/5 border-white/10"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-indigo-500 hover:bg-indigo-600 gap-2"
                  disabled={isLoading}
                >
                  <RotateCcw className="w-4 h-4" />
                  {isLoading ? "提交中..." : "重置密码"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {(error || info) && (
            <p className={cn("text-sm text-center", error ? "text-red-400" : "text-emerald-400")}>
              {error || info}
            </p>
          )}

          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center mb-4">本地演示账号</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setForm((current) => ({ ...current, username: "admin", password: "admin" }));
                }}
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left hover:bg-amber-500/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">SOVEREIGN</span>
                </div>
                <p className="text-[10px] text-gray-500">admin / admin</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setForm((current) => ({ ...current, username: "user", password: "user" }));
                }}
                className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-left hover:bg-blue-500/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-blue-400">NODE</span>
                </div>
                <p className="text-[10px] text-gray-500">user / user</p>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
