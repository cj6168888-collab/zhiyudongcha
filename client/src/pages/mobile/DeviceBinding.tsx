/**
 * DeviceBinding - 设备绑定管理
 * 生成绑定码 / 查看已绑定设备 / 撤销设备
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Smartphone, Cpu, Monitor, Radio, RefreshCw, Copy, ShieldCheck,
  ShieldOff, Wifi, WifiOff, ChevronRight, Plus, AlertTriangle, Check,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";
import { useLocation } from "wouter";

// ── 类型 ──────────────────────────────────────────────

interface Device {
  id: string;
  deviceId: string;
  deviceType: string;
  displayName: string | null;
  status: string;
  allowedModes: string[];
  lastSeenAt: string | null;
  boundAt: string;
  revokedAt: string | null;
}

// ── 工具 ─────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return res.json();
}

function deviceIcon(type: string) {
  if (type === "esp32_voice") return Cpu;
  if (type === "desktop") return Monitor;
  if (type === "omi") return Radio;
  return Smartphone;
}

function modeLabel(mode: string) {
  const map: Record<string, string> = {
    casual_chat: "闲聊",
    record_note: "快速记事",
    conversation_record: "会话记录",
    task_request: "任务请求",
  };
  return map[mode] ?? mode;
}

function deviceTypeLabel(type: string) {
  const map: Record<string, string> = {
    esp32_voice: "ESP32 语音外设",
    desktop: "桌面端",
    mobile: "手机",
    omi: "Omi",
    browser: "浏览器",
  };
  return map[type] ?? type;
}

// ── 绑定码卡片 ────────────────────────────────────────

function BindCodeCard() {
  const [data, setData] = useState<{ code: string; expiresInSec: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/device-bindings/bind-code", { method: "POST", body: "{}" });
      if (!res.success) {
        if (res.error === "AWAKENING_REQUIRED") {
          toast.error("请先完成身份觉醒再绑定外设");
        } else {
          toast.error(res.message ?? "生成失败");
        }
        return;
      }
      setData({ code: res.code, expiresInSec: res.expiresInSec });
    } catch {
      toast.error("网络异常");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.code);
    setCopied(true);
    toast.success("绑定码已复制");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Plus className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">绑定新外设</span>
      </div>

      {!data ? (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
          {loading ? "生成中…" : "生成绑定码"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center">
            <div className="text-4xl font-black tracking-[0.3em] text-white font-mono py-3">
              {data.code}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-gray-300 font-semibold active:scale-95 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "已复制" : "复制"}
            </button>
            <button
              onClick={generate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-gray-300 font-semibold active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
          <p className="text-center text-xs text-gray-500">
            {data.expiresInSec} 秒内有效 · 在外设上输入此码完成绑定
          </p>
        </div>
      )}
    </div>
  );
}

// ── 设备卡片 ─────────────────────────────────────────

function DeviceCard({ device, onRevoke }: { device: Device; onRevoke: (id: string) => void }) {
  const Icon = deviceIcon(device.deviceType);
  const isActive = device.status === "active";
  const isOnline = device.lastSeenAt
    ? Date.now() - new Date(device.lastSeenAt).getTime() < 60_000
    : false;
  const [, setLocation] = useLocation();

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-colors",
        isActive ? "border-white/15 bg-white/5" : "border-red-500/20 bg-red-500/5 opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
          isActive ? "bg-indigo-500/20 border border-indigo-500/30" : "bg-red-500/20 border border-red-500/30"
        )}>
          <Icon className={cn("w-5 h-5", isActive ? "text-indigo-400" : "text-red-400")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white/90 truncate">
              {device.displayName ?? deviceTypeLabel(device.deviceType)}
            </p>
            {isActive && (
              <div className={cn("flex items-center gap-1 text-[10px] font-bold", isOnline ? "text-emerald-400" : "text-gray-500")}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? "在线" : "离线"}
              </div>
            )}
            {!isActive && (
              <span className="text-[10px] text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded-md font-bold">已撤销</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{deviceTypeLabel(device.deviceType)} · {device.deviceId.slice(0, 16)}</p>
          {device.lastSeenAt && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              最后在线：{formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale: zhCN })}
            </p>
          )}
        </div>
        {isActive && (
          <button
            onClick={() => setLocation(`/devices/${device.deviceId}`)}
            className="p-1.5 text-gray-600 active:text-gray-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 允许模式 */}
      {isActive && device.allowedModes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {device.allowedModes.map((m) => (
            <span key={m} className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-gray-400">
              {modeLabel(m)}
            </span>
          ))}
        </div>
      )}

      {/* 撤销按钮 */}
      {isActive && (
        <button
          onClick={() => onRevoke(device.deviceId)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-semibold active:scale-95 transition-all"
        >
          <ShieldOff className="w-3.5 h-3.5" />
          撤销此设备
        </button>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────

export default function DeviceBinding() {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["device-bindings"],
    queryFn: () => apiFetch("/api/device-bindings"),
    staleTime: 15_000,
  });

  const { data: awakeningData } = useQuery({
    queryKey: ["awakening-status"],
    queryFn: () => apiFetch("/api/device-bindings/awakening-status"),
    staleTime: 60_000,
  });

  const revoke = useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(`/api/device-bindings/${deviceId}/revoke`, { method: "POST" }),
    onSuccess: (data) => {
      if (!data.success) { toast.error(data.error ?? "撤销失败"); return; }
      toast.success("设备已撤销");
      qc.invalidateQueries({ queryKey: ["device-bindings"] });
    },
    onError: () => toast.error("网络异常"),
  });

  const devices: Device[] = data?.devices ?? [];
  const activeDevices = devices.filter((d) => d.status === "active");
  const revokedDevices = devices.filter((d) => d.status === "revoked");
  const awakeningComplete = awakeningData?.complete ?? true;

  return (
    <SafeLayout
      headerTitle="设备绑定"
      headerRight={
        <button onClick={() => refetch()} className="p-2 text-gray-400 active:text-primary">
          <RefreshCw className="w-5 h-5" />
        </button>
      }
    >
      {/* 未觉醒提示 */}
      {!awakeningComplete && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-300 font-semibold">需要先完成身份觉醒</p>
            <p className="text-xs text-amber-500 mt-1">绑定外设前，请先在领航者设置中完成身份初始化。</p>
          </div>
        </div>
      )}

      {/* 绑定新设备 */}
      <div className="mb-6">
        <BindCodeCard />
      </div>

      {/* 已绑定设备 */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/80">已绑定设备</h2>
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{activeDevices.length} 台活跃</span>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        )}

        {!isLoading && activeDevices.length === 0 && (
          <div className="flex flex-col items-center py-10 gap-2">
            <Smartphone className="w-10 h-10 text-gray-700" />
            <p className="text-sm text-gray-500">暂无绑定设备</p>
            <p className="text-xs text-gray-600">生成绑定码后在外设上输入即可完成绑定</p>
          </div>
        )}

        {activeDevices.map((d) => (
          <DeviceCard key={d.id} device={d} onRevoke={(id) => revoke.mutate(id)} />
        ))}
      </div>

      {/* 已撤销设备（折叠展示） */}
      {revokedDevices.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">已撤销</h2>
          <div className="space-y-2 opacity-50">
            {revokedDevices.slice(0, 3).map((d) => (
              <DeviceCard key={d.id} device={d} onRevoke={() => {}} />
            ))}
          </div>
        </div>
      )}
    </SafeLayout>
  );
}
