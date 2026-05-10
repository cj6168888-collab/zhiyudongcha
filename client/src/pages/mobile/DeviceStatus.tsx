/**
 * DeviceStatus - 设备详情与允许模式配置
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { Wifi, WifiOff, ShieldOff, Save, RefreshCw, AlertCircle, Cpu, Smartphone, Monitor, Radio } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

interface Device {
  id: string;
  deviceId: string;
  deviceType: string;
  displayName: string | null;
  status: string;
  allowedModes: string[];
  capabilities: Record<string, unknown>;
  lastSeenAt: string | null;
  boundAt: string;
  revokedAt: string | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return res.json();
}

const ALL_MODES = [
  { id: "casual_chat", label: "闲聊", desc: "日常对话，不强制结构化" },
  { id: "record_note", label: "快速记事", desc: "语音/文字速记，生成笔记" },
  { id: "conversation_record", label: "会话记录", desc: "完整对话记录与整理" },
  { id: "task_request", label: "任务请求", desc: "创建任务候选，需手机确认" },
];

function deviceIcon(type: string) {
  if (type === "esp32_voice") return Cpu;
  if (type === "desktop") return Monitor;
  if (type === "omi") return Radio;
  return Smartphone;
}

interface Props {
  params: { deviceId: string };
}

export default function DeviceStatus({ params }: Props) {
  const { deviceId } = params;
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [localName, setLocalName] = useState("");
  const [localModes, setLocalModes] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["device-binding", deviceId],
    queryFn: () => apiFetch(`/api/device-bindings/${deviceId}`),
    staleTime: 15_000,
  });

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["device-status", deviceId],
    queryFn: () => apiFetch(`/api/device-bindings/${deviceId}/status`),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const { data: esp32Data } = useQuery({
    queryKey: ["esp32-status"],
    queryFn: () => apiFetch("/api/devices/esp32/status"),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const wsOnline = esp32Data?.online?.includes(deviceId) ?? false;

  const device: Device | undefined = data?.device;

  useEffect(() => {
    if (device) {
      setLocalName(device.displayName ?? "");
      setLocalModes(device.allowedModes);
    }
  }, [device]);

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`/api/device-bindings/${deviceId}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: localName || undefined, allowedModes: localModes }),
      }),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error ?? "保存失败"); return; }
      toast.success("设备配置已保存");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["device-binding", deviceId] });
      qc.invalidateQueries({ queryKey: ["device-bindings"] });
    },
    onError: () => toast.error("网络异常"),
  });

  const revoke = useMutation({
    mutationFn: () => apiFetch(`/api/device-bindings/${deviceId}/revoke`, { method: "POST" }),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error ?? "撤销失败"); return; }
      toast.success("设备已撤销");
      qc.invalidateQueries({ queryKey: ["device-bindings"] });
      setLocation("/devices");
    },
    onError: () => toast.error("网络异常"),
  });

  const toggleMode = (mode: string) => {
    setLocalModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
    setDirty(true);
  };

  if (isLoading) {
    return (
      <SafeLayout headerTitle="设备详情">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      </SafeLayout>
    );
  }

  if (!device) {
    return (
      <SafeLayout headerTitle="设备不存在">
        <div className="flex flex-col items-center py-20 gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-gray-500">找不到此设备</p>
        </div>
      </SafeLayout>
    );
  }

  const Icon = deviceIcon(device.deviceType);
  const isOnline = wsOnline || (statusData?.online ?? false);
  const isActive = device.status === "active";

  return (
    <SafeLayout headerTitle={device.displayName ?? "设备详情"}>
      {/* 设备头部状态 */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 mb-5">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-white truncate">{device.displayName ?? device.deviceType}</p>
            <div className={cn("flex items-center gap-1 text-[10px] font-bold", isOnline ? "text-emerald-400" : "text-gray-500")}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? "在线" : "离线"}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{device.deviceId}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            绑定于 {format(new Date(device.boundAt), "yyyy-MM-dd HH:mm")}
          </p>
        </div>
        <button onClick={() => refetchStatus()} className="p-2 text-gray-500 active:text-gray-300">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 设备名称 */}
      <div className="mb-5">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 block">显示名称</label>
        <input
          type="text"
          value={localName}
          onChange={(e) => { setLocalName(e.target.value); setDirty(true); }}
          placeholder={device.deviceType}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {/* 允许模式配置 */}
      <div className="mb-6">
        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3 block">允许的模式</label>
        <div className="space-y-2">
          {ALL_MODES.map((m) => {
            const active = localModes.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMode(m.id)}
                className={cn(
                  "w-full text-left flex items-start gap-3 p-4 rounded-xl border transition-all",
                  active
                    ? "border-indigo-500/40 bg-indigo-500/10"
                    : "border-white/10 bg-white/5 opacity-60"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors",
                  active ? "border-indigo-400 bg-indigo-400" : "border-gray-600"
                )}>
                  {active && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 设备能力 */}
      {Object.keys(device.capabilities).length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">设备能力</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(device.capabilities)
              .filter(([, v]) => v === true)
              .map(([k]) => (
                <span key={k} className="text-xs px-2 py-1 rounded-md bg-white/10 border border-white/15 text-gray-400">
                  {k}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* 保存按钮 */}
      {isActive && dirty && (
        <button
          onClick={() => update.mutate()}
          disabled={update.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 mb-4"
        >
          {update.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {update.isPending ? "保存中…" : "保存配置"}
        </button>
      )}

      {/* 撤销按钮 */}
      {isActive && (
        <button
          onClick={() => revoke.mutate()}
          disabled={revoke.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/40 text-red-400 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
        >
          <ShieldOff className="w-4 h-4" />
          {revoke.isPending ? "撤销中…" : "撤销此设备"}
        </button>
      )}
    </SafeLayout>
  );
}
