/**
 * NavigatorCommand - 领航者指挥中心
 *
 * 手机端不是远程桌面入口，而是把语音/文字意图分派给 PC 或服务端代理，
 * 再把执行结果回流给用户的指令与结果中心。
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { NavigatorMark } from "@/components/mobile/navigator/NavigatorMark";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  ListTodo,
  Monitor,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface FleetTask {
  id: string;
  node?: string;
  task?: string;
  progress?: number;
  status?: string;
}

interface FleetStatus {
  onlineCount?: number;
  tasks?: FleetTask[];
}

const quickActions = [
  {
    label: "回到对话",
    description: "用语音或文字发起真实指令",
    icon: Send,
    path: "/",
    tone: "cyan",
  },
  {
    label: "任务中心",
    description: "查看已沉淀的任务和草稿",
    icon: ListTodo,
    path: "/tasks",
    tone: "violet",
  },
  {
    label: "设备代理",
    description: "绑定 PC，接收执行回流",
    icon: Monitor,
    path: "/devices",
    tone: "sky",
  },
  {
    label: "权限统筹",
    description: "管理模型密钥和安全策略",
    icon: KeyRound,
    path: "/navigator-settings",
    tone: "amber",
    sovereignOnly: true,
  },
];

export default function NavigatorCommand() {
  const [, setLocation] = useLocation();

  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    initialData: { role: "NODE", username: "Navigator-X" },
  });

  const isSovereign = localStorage.getItem("jilin_user_role") === "SOVEREIGN";

  const { data: fleet } = useQuery<FleetStatus>({
    queryKey: ["/api/business/swarm/status"],
    refetchInterval: 5000,
    initialData: { onlineCount: 0, tasks: [] },
  });

  const fleetTasks = Array.isArray(fleet?.tasks) ? fleet.tasks : [];
  const onlineCount = fleet?.onlineCount ?? 0;
  const visibleActions = quickActions.filter((action) => !action.sovereignOnly || isSovereign);

  return (
    <SafeLayout headerTitle="领航者指挥中心">
      <div className="space-y-5 pb-10">
        <section className="rounded-2xl border border-cyan-200/15 bg-[#0b1420] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-300/[0.12] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.14)]">
              <NavigatorMark active className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black leading-tight text-white">领航者</h2>
                <span className="rounded-md border border-cyan-200/20 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-100">
                  {isSovereign ? "主控" : "节点"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                手机负责表达意图，PC 与服务端代理负责执行，结果回到对话和这里。
              </p>
              <p className="mt-2 truncate text-[10px] font-bold text-slate-500">
                当前身份：{user.username}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatusMetric label="设备代理" value={`${onlineCount}`} tone="cyan" />
            <StatusMetric label="执行中" value={`${fleetTasks.length}`} tone="violet" />
            <StatusMetric label="身份" value={isSovereign ? "主控" : "节点"} tone="amber" />
          </div>
        </section>

        <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <div className="min-w-0">
              <p className="text-xs font-black text-amber-100">这里展示真实执行状态</p>
              <p className="mt-0.5 text-[11px] leading-4 text-amber-100/70">
                没有设备代理或结果回流时，不展示演示任务。新的 PC 执行结果会自动出现在这里。
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">指令回流</h3>
            <span className="text-[10px] font-bold text-slate-500">{fleetTasks.length} 项执行中</span>
          </div>

          {fleetTasks.length > 0 ? (
            <div className="space-y-2">
              {fleetTasks.map((task) => (
                <ExecutionCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-100">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">暂无代理执行</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    从首页直接告诉小智要做什么。需要 PC 处理时，系统会发给设备代理，并把结果回流。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLocation("/")}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-sm font-black text-slate-950 active:scale-[0.99]"
              >
                <Send className="h-4 w-4" />
                去发起指令
              </button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">常用入口</h3>
            <span className="text-[10px] font-bold text-slate-500">按结果去处组织</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visibleActions.map((action) => (
              <button
                key={action.label}
                onClick={() => setLocation(action.path)}
                className="min-h-[104px] rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition active:scale-[0.98] active:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      toneClass(action.tone, "iconBg")
                    )}
                  >
                    <action.icon className={cn("h-5 w-5", toneClass(action.tone, "text"))} />
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600" />
                </div>
                <p className="mt-3 text-sm font-black text-white">{action.label}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{action.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            <p className="text-[11px] leading-5 text-emerald-100/75">
              高风险动作仍会回到手机确认；低风险整理、检索、草稿生成可以自动执行并汇报结果。
            </p>
          </div>
        </section>
      </div>
    </SafeLayout>
  );
}

function StatusMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-black", toneClass(tone, "text"))}>{value}</p>
    </div>
  );
}

function ExecutionCard({ task }: { task: FleetTask }) {
  const progress = Math.max(0, Math.min(100, task.progress ?? 0));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{task.task || "代理任务"}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {task.node ? `设备代理 ${task.node}` : "设备代理"} · {task.status || "执行中"}
          </p>
        </div>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-200" />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-300 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-right text-[10px] font-bold text-slate-500">{progress}%</p>
    </div>
  );
}

function toneClass(tone: string, part: "text" | "iconBg") {
  const tones = {
    cyan: {
      text: "text-cyan-100",
      iconBg: "bg-cyan-300/10",
    },
    violet: {
      text: "text-violet-200",
      iconBg: "bg-violet-300/10",
    },
    sky: {
      text: "text-sky-200",
      iconBg: "bg-sky-300/10",
    },
    amber: {
      text: "text-amber-200",
      iconBg: "bg-amber-300/10",
    },
  } as const;

  return tones[tone as keyof typeof tones]?.[part] ?? tones.cyan[part];
}
