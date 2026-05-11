import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ChevronRight,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface XiaozhiStatusHeaderProps {
  avatarName: string;
  brainLabel: string;
  role: string;
  isProcessing: boolean;
  hpPercent: number;
  hpToneClass: string;
  deviceLabel: string;
  deviceHealthy: boolean;
  loading?: boolean;
  onOpenNavigator: () => void;
}

export function XiaozhiStatusHeader({
  avatarName,
  brainLabel,
  role,
  isProcessing,
  hpPercent,
  hpToneClass,
  deviceLabel,
  deviceHealthy,
  loading = false,
  onOpenNavigator,
}: XiaozhiStatusHeaderProps) {
  if (loading) {
    return (
      <header className="flex-shrink-0 border-b border-white/10 bg-[#050817]/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-24 bg-white/10" />
            <Skeleton className="h-3 w-40 bg-white/10" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <Skeleton className="h-3 w-10 bg-white/10" />
              <Skeleton className="mt-2 h-4 w-12 bg-white/10" />
            </div>
          ))}
        </div>
      </header>
    );
  }

  return (
    <header className="flex-shrink-0 border-b border-white/10 bg-[#050817]/95 px-4 pb-3 pt-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-violet-300/30 bg-white/5 shadow-[0_0_22px_rgba(139,92,246,0.22)]">
          <img src="/xiaoji-avatar.png" alt="小智" className="h-full w-full object-cover" />
          <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-[#050817] bg-emerald-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-black leading-tight">{avatarName || "小智"}</h1>
            <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
              {isProcessing ? "思考中" : "在线"}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-400">
            {brainLabel} · {role === "MASTER" ? "主人权限" : "访客权限"}
          </p>
        </div>

        <button
          onClick={onOpenNavigator}
          className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 active:bg-white/10"
          aria-label="打开领航"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="text-[10px] text-slate-500">HP</p>
          <p className={cn("mt-0.5 text-sm font-black", hpToneClass)}>{hpPercent}%</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="text-[10px] text-slate-500">安全区</p>
          <p className="mt-0.5 text-sm font-black text-blue-200">
            {role === "MASTER" ? "主控" : "受限"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="text-[10px] text-slate-500">设备</p>
          <p className={cn("mt-0.5 text-sm font-black", deviceHealthy ? "text-emerald-200" : "text-amber-200")}>
            {deviceLabel}
          </p>
        </div>
      </div>
    </header>
  );
}

type NowStripNoticeTone = "info" | "warning" | "danger";

interface NowStripProps {
  currentProjectTitle: string | null;
  pendingCount: number;
  automationCount: number;
  automationLabel: string;
  nextReminderLabel: string;
  nextReminderDetail: string;
  noticeTitle?: string | null;
  noticeDetail?: string | null;
  noticeTone?: NowStripNoticeTone;
  loading?: boolean;
  onOpenContext: () => void;
  onOpenPending: () => void;
  onOpenTasks: () => void;
}

export function NowStrip({
  currentProjectTitle,
  pendingCount,
  automationCount,
  automationLabel,
  nextReminderLabel,
  nextReminderDetail,
  noticeTitle,
  noticeDetail,
  noticeTone = "info",
  loading = false,
  onOpenContext,
  onOpenPending,
  onOpenTasks,
}: NowStripProps) {
  if (loading) {
    return (
      <section className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="min-h-16 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <Skeleton className="h-3 w-12 bg-white/10" />
              <Skeleton className="mt-2 h-4 w-full bg-white/10" />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-lg bg-white/10" />
      </section>
    );
  }

  const noticeToneClass = {
    info: "border-sky-400/20 bg-sky-400/10 text-sky-100",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    danger: "border-red-400/25 bg-red-400/10 text-red-100",
  }[noticeTone];

  return (
    <section data-testid="now-strip" aria-label="今日概览" className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          data-testid="now-context"
          aria-label={`当前上下文：${currentProjectTitle ?? "未选择项目"}`}
          onClick={onOpenContext}
          className="min-h-16 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left active:bg-white/10"
        >
          <p className="text-[10px] text-slate-500">当前上下文</p>
          <p className="mt-1 truncate text-xs font-bold text-white">{currentProjectTitle ?? "未选择项目"}</p>
        </button>
        <button
          data-testid="now-pending"
          aria-label={`待确认：${pendingCount} 项`}
          onClick={onOpenPending}
          className="min-h-16 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-left active:bg-amber-400/15"
        >
          <p className="text-[10px] text-amber-200/70">待确认</p>
          <p className="mt-1 text-xs font-black text-amber-100">{pendingCount} 项</p>
        </button>
        <button
          data-testid="now-automations"
          aria-label={`自动化：${automationCount} 项，${automationLabel}`}
          onClick={onOpenTasks}
          className="min-h-16 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left active:bg-white/10"
        >
          <p className="text-[10px] text-slate-500">自动化</p>
          <p className="mt-1 text-xs font-black text-slate-100">{automationCount} 项</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{automationLabel}</p>
        </button>
        <button
          data-testid="now-next-reminder"
          aria-label={`下次提醒：${nextReminderLabel}，${nextReminderDetail}`}
          onClick={onOpenTasks}
          className="min-h-16 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left active:bg-white/10"
        >
          <p className="text-[10px] text-slate-500">下次提醒</p>
          <p className="mt-1 truncate text-xs font-black text-slate-100">{nextReminderLabel}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{nextReminderDetail}</p>
        </button>
      </div>

      {noticeTitle && noticeDetail && (
        <div className={cn("rounded-lg border px-3 py-2", noticeToneClass)}>
          <p className="text-[11px] font-black">{noticeTitle}</p>
          <p className="mt-1 text-[10px] leading-relaxed opacity-80">{noticeDetail}</p>
        </div>
      )}
    </section>
  );
}

export function XiaozhiBrief() {
  return (
    <section className="mt-3 rounded-lg border border-violet-300/15 bg-violet-300/[0.06] p-3">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-violet-200" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-violet-100">我在。你可以直接说要我做什么。</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            我会先理解，再把需要写入、执行或高风险的动作拿给你确认。
          </p>
        </div>
      </div>
    </section>
  );
}

interface StarterPromptListProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export function StarterPromptList({ prompts, onSelect }: StarterPromptListProps) {
  return (
    <section className="mt-3 space-y-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-left text-xs text-slate-200 active:bg-white/10"
        >
          <span className="min-w-0 truncate">{prompt}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
        </button>
      ))}
    </section>
  );
}

export interface CapabilityItem {
  label: string;
  desc: string;
  path: string;
  icon: LucideIcon;
  status: string;
}

interface CapabilityRailProps {
  capabilities: CapabilityItem[];
  onOpenAll: () => void;
  onNavigate: (path: string) => void;
}

export function CapabilityRail({ capabilities, onOpenAll, onNavigate }: CapabilityRailProps) {
  return (
    <section className="mt-5 pb-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-black text-slate-500">能力</h2>
        <button onClick={onOpenAll} className="text-[11px] font-bold text-violet-200">
          全部
        </button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {capabilities.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className="w-24 shrink-0 rounded-lg border border-white/10 bg-white/[0.035] p-2.5 text-left active:bg-white/10"
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4 text-slate-200" />
                <span className="rounded border border-white/10 px-1 py-0.5 text-[8px] font-bold text-slate-400">
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-white">{item.label}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">{item.desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface CommandComposerProps {
  inputText: string;
  voiceActive: boolean;
  voiceSupported: boolean;
  voiceInterimText: string;
  voiceNotice: string | null;
  voiceAudioLevel: number;
  isProcessing: boolean;
  onInputChange: (value: string) => void;
  onToggleVoice: () => void;
  onAttach: () => void;
  onSend: () => void;
}

export function CommandComposer({
  inputText,
  voiceActive,
  voiceSupported,
  voiceInterimText,
  voiceNotice,
  voiceAudioLevel,
  isProcessing,
  onInputChange,
  onToggleVoice,
  onAttach,
  onSend,
}: CommandComposerProps) {
  const voiceLevelWidth = `${Math.max(8, Math.min(100, Math.round(voiceAudioLevel * 100)))}%`;

  return (
    <footer className="flex-shrink-0 border-t border-white/10 bg-[#050817]/95 px-3 pb-3 pt-2 backdrop-blur-xl">
      {(voiceActive || voiceInterimText || voiceNotice) && (
        <div className="mx-auto mb-2 max-w-lg rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                voiceActive ? "animate-pulse bg-red-300" : "bg-violet-300"
              )}
            />
            <p className="min-w-0 flex-1 truncate text-xs font-bold text-violet-100">
              {voiceInterimText || voiceNotice || "正在听..."}
            </p>
          </div>
          {voiceActive && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-violet-300 transition-all" style={{ width: voiceLevelWidth }} />
            </div>
          )}
        </div>
      )}
      <div className="mx-auto flex max-w-lg items-end gap-2">
        <button
          onClick={onToggleVoice}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]",
            voiceActive && "border-red-300/50 bg-red-400/15 text-red-100",
            !voiceSupported && "text-slate-600"
          )}
          aria-label={voiceActive ? "停止语音输入" : "语音输入"}
        >
          <Mic className="h-5 w-5" />
        </button>
        <button
          onClick={onAttach}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300"
          aria-label="添加材料"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 focus-within:border-violet-300/40">
          <textarea
            data-testid="conversation-input"
            value={inputText}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="直接告诉小智要做什么..."
            className="max-h-24 min-h-6 w-full resize-none bg-transparent text-sm leading-6 text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <button
          data-testid="conversation-send"
          onClick={onSend}
          disabled={!inputText.trim() || isProcessing}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white disabled:bg-white/10 disabled:text-slate-600"
          aria-label="发送"
        >
          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </footer>
  );
}
