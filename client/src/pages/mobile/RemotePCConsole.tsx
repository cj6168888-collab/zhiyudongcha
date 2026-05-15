/**
 * RemotePCConsole (Mobile) - PC 代理执行
 *
 * 手机端负责表达自然语言意图，PC 守护进程负责执行并回传结果。
 * 这里不提供远程桌面、鼠标或键盘模拟入口。
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { NavigatorMark } from "@/components/mobile/navigator/NavigatorMark";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Monitor,
  RefreshCw,
  Send,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApiQuery } from "@/lib/useApi";
import { cn } from "@/lib/utils";

interface PCDevice {
  id: string;
  name: string;
  platform: "WINDOWS" | "MACOS" | "LINUX";
  osVersion?: string;
  status: "OFFLINE" | "ONLINE" | "BUSY" | "ERROR";
  lastSeen?: number;
}

interface ExecutionItem {
  id: string;
  deviceName: string;
  instruction: string;
  status: "sent" | "failed";
  message: string;
  createdAt: number;
}

const STATUS_TEXT: Record<PCDevice["status"], string> = {
  ONLINE: "可执行",
  BUSY: "执行中",
  ERROR: "异常",
  OFFLINE: "离线",
};

const PLATFORM_TEXT: Record<PCDevice["platform"], string> = {
  WINDOWS: "Windows",
  MACOS: "macOS",
  LINUX: "Linux",
};

const commandSuggestions = [
  "把桌面上的会议录音整理成纪要，并把待办事项回传给我",
  "检查下载目录里最新合同，找出付款和违约风险",
  "打开本周项目资料，汇总今天最该推进的三件事",
];

function readDeviceList(value: unknown): PCDevice[] {
  if (Array.isArray(value)) return value as PCDevice[];
  if (!value || typeof value !== "object") return [];

  const payload = value as Record<string, unknown>;
  for (const key of ["data", "items", "devices"]) {
    const list = payload[key];
    if (Array.isArray(list)) return list as PCDevice[];
  }
  return [];
}

export default function RemotePCConsoleMobile() {
  const {
    data: devicesResponse,
    isLoading: devicesLoading,
    refetch: refetchDevices,
  } = useApiQuery<unknown>(["/api/remote/devices"], async () => {
    const response = await fetch("/api/remote/devices");
    const data = await response.json();
    return readDeviceList(data);
  });
  const devices = useMemo(() => readDeviceList(devicesResponse), [devicesResponse]);

  const onlineDevices = useMemo(
    () => devices.filter((device) => device.status === "ONLINE" || device.status === "BUSY"),
    [devices],
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);

  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ?? onlineDevices[0] ?? devices[0] ?? null;

  const handleSubmit = async () => {
    const text = instruction.trim();
    if (!text) {
      toast.error("先说清楚要让 PC 做什么");
      return;
    }
    if (!selectedDevice || selectedDevice.status === "OFFLINE") {
      toast.error("没有可用的 PC 代理");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/remote/control/${selectedDevice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SYSTEM",
          action: "EXECUTE",
          params: {
            instruction: text,
            source: "mobile_pc_agent",
            expectResultCallback: true,
          },
        }),
      });
      const result = await readControlResponse(response);

      const ok = response.ok && result.success !== false;
      setExecutions((current) => [
        {
          id: `${Date.now()}`,
          deviceName: selectedDevice.name,
          instruction: text,
          status: ok ? "sent" : "failed",
          message: ok ? result.message || "指令已送达，等待 PC 代理回传结果。" : result.message || "指令未送达。",
          createdAt: Date.now(),
        },
        ...current,
      ]);

      if (ok) {
        setInstruction("");
        toast.success("已发给 PC 代理");
      } else {
        toast.error(result.message || "指令未送达");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "网络错误";
      setExecutions((current) => [
        {
          id: `${Date.now()}`,
          deviceName: selectedDevice.name,
          instruction: text,
          status: "failed",
          message,
          createdAt: Date.now(),
        },
        ...current,
      ]);
      toast.error("指令发送失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeLayout
      headerTitle="PC 代理执行"
      headerRight={
        <button onClick={() => refetchDevices()} className="p-2 text-slate-400 active:text-cyan-100" aria-label="刷新设备">
          <RefreshCw className="h-5 w-5" />
        </button>
      }
      showBack={true}
    >
      <div className="space-y-5 pb-10">
        <section className="rounded-2xl border border-cyan-200/15 bg-[#0b1420] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-300/[0.12] text-cyan-100">
              <NavigatorMark active className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-white">让 PC 替你执行</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                你用语音或文字描述目标，PC 代理在电脑上处理文件、应用和资料，结果回到手机端。
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="设备" value={`${devices.length}`} tone="cyan" />
            <Metric label="可执行" value={`${onlineDevices.length}`} tone="emerald" />
            <Metric label="回流" value={`${executions.length}`} tone="violet" />
          </div>
        </section>

        <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.08] p-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <p className="text-[11px] leading-5 text-amber-100/75">
              这里不是远程桌面。手机不承担鼠标键盘操作，只负责发出目标、确认风险和接收执行汇报。
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">选择 PC 代理</h3>
            <button onClick={() => refetchDevices()} className="text-[10px] font-bold text-cyan-100">
              刷新
            </button>
          </div>

          {devicesLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/10 text-slate-300">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">暂无已绑定 PC</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    在电脑端启动守护进程并完成绑定后，才能把指令交给 PC 代理执行。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  selected={selectedDevice?.id === device.id}
                  onClick={() => setSelectedDeviceId(device.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="px-1 text-xs font-black text-slate-300">发出指令</h3>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="例如：把桌面上的合同整理成风险清单，并把结果发回手机。"
              className="min-h-[110px] w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/50"
            />
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !instruction.trim() || !selectedDevice || selectedDevice.status === "OFFLINE"}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-sm font-black text-slate-950 active:scale-[0.99] disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              交给 PC 代理
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {commandSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInstruction(suggestion)}
                className="min-w-[220px] rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left text-[11px] leading-5 text-slate-300 active:bg-white/[0.07]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">结果回流</h3>
            <span className="text-[10px] font-bold text-slate-500">{executions.length} 条</span>
          </div>
          {executions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <p className="text-xs leading-5 text-slate-400">
                  真实执行结果会在这里追加。没有发送过指令时，不展示演示结果。
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {executions.map((item) => (
                <ExecutionCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            <p className="text-[11px] leading-5 text-emerald-100/75">
              涉及删除、外发、付款、权限变更等高风险动作时，PC 代理应暂停并回到手机请求确认。
            </p>
          </div>
        </section>
      </div>
    </SafeLayout>
  );
}

function DeviceCard({ device, selected, onClick }: { device: PCDevice; selected: boolean; onClick: () => void }) {
  const available = device.status === "ONLINE" || device.status === "BUSY";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]",
        selected ? "border-cyan-200/40 bg-cyan-300/[0.08]" : "border-white/10 bg-white/[0.035]",
        !available && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          available ? "bg-emerald-300/10 text-emerald-100" : "bg-slate-200/10 text-slate-500",
        )}
      >
        <Monitor className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-black text-white">{device.name}</p>
          {available ? <Wifi className="h-3.5 w-3.5 text-emerald-200" /> : <WifiOff className="h-3.5 w-3.5 text-slate-500" />}
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-500">
          {PLATFORM_TEXT[device.platform]} {device.osVersion ? `· ${device.osVersion}` : ""} · {STATUS_TEXT[device.status]}
        </p>
      </div>
      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-100" />}
    </button>
  );
}

function ExecutionCard({ item }: { item: ExecutionItem }) {
  const ok = item.status === "sent";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{item.deviceName}</p>
          <p className="mt-1 text-sm font-black leading-5 text-white">{item.instruction}</p>
        </div>
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold", ok ? "bg-emerald-300/10 text-emerald-100" : "bg-red-300/10 text-red-100")}>
          {ok ? "已送达" : "失败"}
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-400">{item.message}</p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "cyan" | "emerald" | "violet" }) {
  const toneClass = {
    cyan: "text-cyan-100",
    emerald: "text-emerald-100",
    violet: "text-violet-200",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-black", toneClass)}>{value}</p>
    </div>
  );
}

async function readControlResponse(response: Response): Promise<{ success?: boolean; message?: string }> {
  const text = await response.text();
  if (!text) return { success: response.ok };

  try {
    const parsed = JSON.parse(text) as { success?: boolean; message?: string; error?: string };
    return {
      success: parsed.success,
      message: parsed.message || parsed.error,
    };
  } catch {
    return {
      success: false,
      message: response.ok ? "服务返回了非 JSON 内容，无法确认执行状态。" : `服务异常：${response.status}`,
    };
  }
}
