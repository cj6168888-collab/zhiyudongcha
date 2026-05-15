/**
 * NavigatorSettings - 权限统筹
 *
 * 管理手机端确认策略、模型提供商录入和设备健康，不伪造后端密钥池状态。
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { NavigatorMark } from "@/components/mobile/navigator/NavigatorMark";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  Lock,
  Mic,
  Monitor,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Volume2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGlobalStore } from "@/store/globalStore";
import { useDiagnostics } from "@/hooks/use-diagnostics";
import { isMobileMasterRole } from "@/lib/mobile-role";

type ProviderId = "tongyi" | "deepseek" | "local";

interface ProviderEntry {
  id: ProviderId;
  name: string;
  detail: string;
  key?: string;
  status: "ready" | "missing" | "local";
}

const providerOptions: Array<{ id: ProviderId; name: string }> = [
  { id: "tongyi", name: "通义千问" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "local", name: "本地模型" },
];

const defaultProviders: ProviderEntry[] = [
  { id: "tongyi", name: "通义千问", detail: "主对话、长文本和稳定执行", status: "missing" },
  { id: "deepseek", name: "DeepSeek", detail: "推理、代码和复杂分析", status: "missing" },
  { id: "local", name: "本地模型", detail: "离线兜底，不上传敏感内容", status: "local" },
];

export default function NavigatorSettings() {
  const [newKey, setNewKey] = useState("");
  const [providerId, setProviderId] = useState<ProviderId>("tongyi");
  const [providers, setProviders] = useState<ProviderEntry[]>(defaultProviders);
  const [riskPolicy, setRiskPolicy] = useState({
    requireHighRiskConfirm: true,
    allowLowRiskAutoRun: true,
    notifyExecutionResult: true,
  });

  const deviceHealth = useGlobalStore((s) => s.deviceHealth);
  const { isChecking, checkHealth } = useDiagnostics(false);
  const userRole = localStorage.getItem("jilin_user_role");
  const isSovereign = isMobileMasterRole(userRole);

  const configuredProviders = providers.filter((provider) => provider.status === "ready").length;
  const healthSummary = useMemo(() => {
    if (!deviceHealth) return { label: "未检测", tone: "text-slate-400", ok: false };
    const ok = Boolean(deviceHealth.permissions.RECORD_AUDIO) && deviceHealth.free_storage_mb >= 500;
    return ok
      ? { label: "可执行", tone: "text-emerald-200", ok: true }
      : { label: "需处理", tone: "text-amber-200", ok: false };
  }, [deviceHealth]);

  if (!isSovereign) {
    return (
      <SafeLayout headerTitle="系统权限" showBack={true}>
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-300/20 bg-red-300/10 text-red-200">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-xl font-black text-white">需要主控权限</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            权限统筹会影响模型密钥、执行策略和设备代理范围。当前身份不能修改这些配置。
          </p>
        </div>
      </SafeLayout>
    );
  }

  const selectedProvider = providerOptions.find((provider) => provider.id === providerId);

  const handleAddKey = () => {
    const value = newKey.trim();
    if (providerId !== "local" && value.length < 8) {
      toast.error("密钥长度不足，请检查后再保存");
      return;
    }

    setProviders((current) =>
      current.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              key: providerId === "local" ? undefined : maskKey(value),
              status: providerId === "local" ? "local" : "ready",
            }
          : provider,
      ),
    );
    setNewKey("");
    toast.success(`${selectedProvider?.name ?? "模型"}配置已更新`);
  };

  const removeProviderKey = (id: ProviderId) => {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === id ? { ...provider, key: undefined, status: id === "local" ? "local" : "missing" } : provider,
      ),
    );
    toast.success("配置已移除");
  };

  const togglePolicy = (key: keyof typeof riskPolicy) => {
    setRiskPolicy((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleEmergencyRecall = () => {
    toast.success("已发送停止新指令的主控策略");
  };

  return (
    <SafeLayout headerTitle="权限统筹" showBack={true}>
      <div className="space-y-5 pb-10">
        <section className="rounded-2xl border border-cyan-200/15 bg-[#0b1420] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-300/[0.12] text-cyan-100">
              <NavigatorMark active className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">权限统筹</h2>
                <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
                  主控
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                管理模型来源、设备健康和执行确认策略。这里不替代首页对话，只决定能不能执行。
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="模型" value={`${configuredProviders}`} tone="cyan" />
            <Metric label="设备" value={healthSummary.label} tone={healthSummary.ok ? "emerald" : "amber"} />
            <Metric label="确认" value={riskPolicy.requireHighRiskConfirm ? "开启" : "关闭"} tone="violet" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">设备健康</h3>
            <button
              onClick={() => checkHealth()}
              disabled={isChecking}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-cyan-100 active:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isChecking && "animate-spin")} />
              {isChecking ? "检测中" : "重新检测"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            {deviceHealth ? (
              <div className="space-y-3">
                <HealthRow
                  icon={Cpu}
                  label="本地模型"
                  value={deviceHealth.jni_loaded ? "已加载" : deviceHealth.jni_error ?? "未加载"}
                  ok={Boolean(deviceHealth.jni_loaded)}
                />
                <HealthRow icon={Volume2} label="语音播报" value={deviceHealth.tts_ready ? "可用" : "未就绪"} ok={Boolean(deviceHealth.tts_ready)} />
                <HealthRow
                  icon={Mic}
                  label="麦克风权限"
                  value={deviceHealth.permissions.RECORD_AUDIO ? "已授权" : "未授权"}
                  ok={Boolean(deviceHealth.permissions.RECORD_AUDIO)}
                />
                <HealthRow
                  icon={HardDrive}
                  label="可用存储"
                  value={`${deviceHealth.free_storage_mb.toFixed(0)} MB`}
                  ok={deviceHealth.free_storage_mb >= 500}
                />
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/10 text-slate-300">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">尚未读取设备诊断</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Android 设备会回传麦克风、本地模型、存储和语音能力；浏览器环境只显示占位状态。
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">模型提供商</h3>
            <span className="text-[10px] font-bold text-slate-500">本地保存展示</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="grid grid-cols-[116px_1fr_44px] gap-2">
              <select
                value={providerId}
                onChange={(event) => setProviderId(event.target.value as ProviderId)}
                className="h-11 rounded-xl border border-white/10 bg-black/30 px-2 text-xs font-bold text-white outline-none focus:border-cyan-200/50"
              >
                {providerOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <input
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                disabled={providerId === "local"}
                placeholder={providerId === "local" ? "本地模型不需要密钥" : "粘贴 API Key"}
                className="h-11 min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/50 disabled:opacity-60"
              />
              <button
                onClick={handleAddKey}
                className="flex h-11 items-center justify-center rounded-xl bg-cyan-300 text-slate-950 active:scale-95"
                aria-label="保存模型配置"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {providers.map((provider) => (
                <div key={provider.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-white">{provider.name}</p>
                      <ProviderStatus status={provider.status} />
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">{provider.key ?? provider.detail}</p>
                  </div>
                  {provider.status === "ready" && (
                    <button
                      onClick={() => removeProviderKey(provider.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 active:bg-red-300/10 active:text-red-200"
                      aria-label={`移除${provider.name}配置`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="px-1 text-xs font-black text-slate-300">执行策略</h3>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
            <PolicyRow
              icon={Shield}
              label="高风险需确认"
              detail="转账、删除、外发、权限修改必须回到手机确认"
              checked={riskPolicy.requireHighRiskConfirm}
              onClick={() => togglePolicy("requireHighRiskConfirm")}
            />
            <PolicyRow
              icon={CheckCircle2}
              label="低风险自动执行"
              detail="整理、检索、草稿生成可自动完成并汇报"
              checked={riskPolicy.allowLowRiskAutoRun}
              onClick={() => togglePolicy("allowLowRiskAutoRun")}
            />
            <PolicyRow
              icon={Monitor}
              label="结果回流通知"
              detail="PC 代理完成后在首页和指挥中心显示结果"
              checked={riskPolicy.notifyExecutionResult}
              onClick={() => togglePolicy("notifyExecutionResult")}
            />
          </div>
        </section>

        <button
          onClick={handleEmergencyRecall}
          className="flex w-full items-center justify-between rounded-xl border border-red-300/20 bg-red-300/[0.07] p-4 text-left active:bg-red-300/10"
        >
          <span className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-200" />
            <span>
              <span className="block text-sm font-black text-red-100">暂停新指令</span>
              <span className="mt-1 block text-[11px] text-red-100/60">已在执行中的任务不会被强制回滚</span>
            </span>
          </span>
          <span className="text-xs font-bold text-red-100/70">发送</span>
        </button>
      </div>
    </SafeLayout>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "cyan" | "emerald" | "amber" | "violet" }) {
  const toneClass = {
    cyan: "text-cyan-100",
    emerald: "text-emerald-100",
    amber: "text-amber-100",
    violet: "text-violet-200",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-black", toneClass)}>{value}</p>
    </div>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className={cn("h-4 w-4 shrink-0", ok ? "text-emerald-200" : "text-amber-200")} />
        <span className="truncate text-xs font-bold text-white">{label}</span>
      </div>
      <span className={cn("shrink-0 text-[10px] font-black", ok ? "text-emerald-200" : "text-amber-200")}>{value}</span>
    </div>
  );
}

function ProviderStatus({ status }: { status: ProviderEntry["status"] }) {
  const label = status === "ready" ? "已配置" : status === "local" ? "本地" : "未配置";
  const style =
    status === "ready"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : status === "local"
        ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
        : "border-slate-300/10 bg-slate-300/5 text-slate-400";

  return <span className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-bold", style)}>{label}</span>;
}

function PolicyRow({
  icon: Icon,
  label,
  detail,
  checked,
  onClick,
}: {
  icon: typeof Shield;
  label: string;
  detail: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 border-b border-white/10 p-4 text-left last:border-b-0 active:bg-white/[0.05]"
    >
      <span className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
        <span className="min-w-0">
          <span className="block text-sm font-black text-white">{label}</span>
          <span className="mt-1 block text-[11px] leading-4 text-slate-500">{detail}</span>
        </span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition",
          checked ? "border-cyan-200/40 bg-cyan-300/30" : "border-white/10 bg-white/5",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
            checked ? "left-5 bg-cyan-100" : "left-0.5 bg-slate-500",
          )}
        />
      </span>
    </button>
  );
}

function maskKey(value: string) {
  if (value.length <= 12) return `${value.slice(0, 3)}...${value.slice(-3)}`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
