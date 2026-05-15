import {
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NavigatorMark } from "@/components/mobile/navigator/NavigatorMark";
import { cn } from "@/lib/utils";

const WAVE_BARS = [34, 58, 82, 46, 72, 52, 38];

interface XiaozhiStatusHeaderProps {
  avatarName: string;
  brainLabel: string;
  role: string;
  isProcessing: boolean;
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

        <div className="mt-3 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full bg-white/10" />
          <Skeleton className="h-6 w-20 rounded-full bg-white/10" />
        </div>
      </header>
    );
  }

  return (
    <header className="flex-shrink-0 border-b border-white/10 bg-[#050817]/96 px-4 pb-3 pt-3 shadow-[0_12px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-cyan-200/20 bg-white/5 shadow-[0_0_24px_rgba(34,211,238,0.16)]">
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
          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-200/25 bg-cyan-300/[0.07] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(34,211,238,0.12)] active:bg-cyan-300/12"
          aria-label="打开领航"
        >
          <span className="absolute inset-x-2 top-1 h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-transparent" />
          <NavigatorMark active className="h-7 w-7" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[11px] font-bold text-slate-300">
          {role === "MASTER" ? "主控" : "受限"}
        </span>
        {deviceLabel !== "未绑定" && (
          <span className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-bold",
            deviceHealthy
              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
              : "border-amber-300/20 bg-amber-300/10 text-amber-100"
          )}>
            设备 {deviceLabel}
          </span>
        )}
      </div>
    </header>
  );
}

type NowStripNoticeTone = "info" | "warning" | "danger";

interface NowStripProps {
  noticeTitle?: string | null;
  noticeDetail?: string | null;
  noticeTone?: NowStripNoticeTone;
  actionLabel?: string;
  loading?: boolean;
  onOpenNotice: () => void;
}

export function NowStrip({
  noticeTitle,
  noticeDetail,
  noticeTone = "info",
  actionLabel = "查看",
  loading = false,
  onOpenNotice,
}: NowStripProps) {
  if (loading) {
    return (
      <section className="mb-3">
        <Skeleton className="h-10 w-full rounded-lg bg-white/10" />
      </section>
    );
  }

  if (!noticeTitle || !noticeDetail) return null;

  const noticeToneClass = {
    info: "border-sky-400/20 bg-sky-400/10 text-sky-100",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    danger: "border-red-400/25 bg-red-400/10 text-red-100",
  }[noticeTone];

  return (
    <section data-testid="now-strip" aria-label="重要通知" className="mb-3">
      <button
        data-testid="home-notice"
        onClick={onOpenNotice}
        className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left active:bg-white/10", noticeToneClass)}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black">{noticeTitle}</p>
          <p className="mt-0.5 truncate text-[10px] opacity-80">{noticeDetail}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold opacity-75">{actionLabel}</span>
      </button>
    </section>
  );
}

export interface ConversationAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

interface CommandComposerProps {
  inputText: string;
  voiceActive: boolean;
  voiceSupported: boolean;
  voiceInterimText: string;
  voiceNotice: string | null;
  voiceAudioLevel: number;
  isProcessing: boolean;
  attachments: ConversationAttachment[];
  showVoiceButton: boolean;
  onInputChange: (value: string) => void;
  onToggleVoice: () => void;
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
}

interface ConversationLiveSurfaceProps {
  hasHistory: boolean;
  voiceActive: boolean;
  voiceSupported: boolean;
  voiceInterimText: string;
  voiceNotice: string | null;
  voiceAudioLevel: number;
  onToggleVoice: () => void;
}

export function ConversationLiveSurface({
  hasHistory,
  voiceActive,
  voiceSupported,
  voiceInterimText,
  voiceNotice,
  voiceAudioLevel,
  onToggleVoice,
}: ConversationLiveSurfaceProps) {
  const voiceLevelWidth = `${Math.max(8, Math.min(100, Math.round(voiceAudioLevel * 100)))}%`;
  const voiceLevel = Math.max(0.18, Math.min(1, voiceAudioLevel || 0.36));
  const voiceProblem = voiceNotice || (!voiceSupported ? "当前环境暂不能直接语音，可以先打字；如果刚拒绝了麦克风权限，请在浏览器或系统设置里重新允许。" : null);
  const statusText = voiceActive
    ? (voiceInterimText || "正在听你说")
    : voiceSupported
      ? "和小智说话"
      : "语音暂不可用";
  const statusDetail = voiceActive
    ? (voiceInterimText ? "实时转写中" : "保持说话，我会自动接住这次指令")
    : voiceSupported
      ? (voiceNotice || "语音、文字和材料会进入同一次对话")
      : (voiceProblem || "当前环境没有可用语音识别");

  return (
    <section
      data-testid="conversation-live-surface"
      className={cn(
        "relative overflow-hidden rounded-xl border transition-colors",
        hasHistory
          ? "mb-3 flex items-center gap-3 border-white/10 bg-[#0a1020]/82 px-3 py-3 text-left shadow-[0_18px_52px_rgba(0,0,0,0.22)]"
          : "flex min-h-[40vh] flex-col items-center justify-center border-cyan-200/12 bg-[#070c18]/90 px-4 py-8 text-center shadow-[0_26px_80px_rgba(0,0,0,0.34)]"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cyan-200/[0.055] via-transparent to-transparent" />
      {hasHistory ? (
        <div
          data-testid="conversation-live-compact-status"
          className={cn(
            "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-white shadow-[0_0_34px_rgba(34,211,238,0.18)]",
            voiceActive
              ? "border-rose-200/50 bg-rose-400/20"
              : "border-cyan-200/25 bg-cyan-300/10"
          )}
          aria-hidden="true"
        >
          <Mic className="h-5 w-5" />
        </div>
      ) : (
        <div className="relative z-10 flex h-36 w-36 items-center justify-center">
          <div className={cn(
            "absolute inset-0 rounded-full border",
            voiceActive ? "border-rose-200/18" : "border-cyan-200/14"
          )} />
          <div className={cn(
            "absolute inset-4 rounded-full border",
            voiceActive ? "border-rose-200/22 bg-rose-300/[0.03]" : "border-violet-200/18 bg-cyan-300/[0.03]"
          )} />
          <button
            data-testid="conversation-voice-toggle"
            onClick={onToggleVoice}
            disabled={!voiceSupported}
            className={cn(
              "relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border text-white transition active:scale-95 disabled:text-slate-600",
              voiceActive
                ? "border-rose-100/55 bg-rose-400/18 shadow-[0_0_52px_rgba(251,113,133,0.24)]"
                : "border-cyan-100/30 bg-cyan-300/10 shadow-[0_0_52px_rgba(34,211,238,0.18)]"
            )}
            aria-label={voiceActive ? "停止语音输入" : "语音输入"}
          >
            <Mic className="h-12 w-12" />
          </button>
        </div>
      )}

      <div className={cn("relative z-10 min-w-0", hasHistory ? "flex-1" : "mt-4 w-full max-w-[19rem]")}>
        <p className={cn("font-black text-slate-100", hasHistory ? "truncate text-sm" : "text-base")}>
          {statusText}
        </p>
        <p className={cn("mt-1 text-slate-400", hasHistory ? "truncate text-[10px]" : "text-xs")}>
          {statusDetail}
        </p>
        <div className={cn("overflow-hidden", hasHistory ? "mt-2 w-full" : "mx-auto mt-4 w-52")}>
          <div className="flex h-8 items-center justify-center gap-1.5 rounded-full border border-white/[0.08] bg-black/18 px-3">
            {WAVE_BARS.map((height, index) => (
              <span
                key={index}
                className={cn(
                  "w-1.5 rounded-full transition-all",
                  voiceActive ? "bg-rose-200" : "bg-cyan-200/70"
                )}
                style={{
                  height: `${Math.max(18, Math.round(height * (voiceActive ? voiceLevel : 0.42)))}%`,
                }}
              />
            ))}
          </div>
          <div className={cn("mt-2 h-1 overflow-hidden rounded-full bg-white/10", hasHistory ? "w-full" : "mx-auto w-44")}>
            <div
              className={cn("h-full rounded-full transition-all", voiceActive ? "bg-rose-200" : "bg-cyan-200")}
              style={{ width: voiceActive ? voiceLevelWidth : "36%" }}
            />
          </div>
        </div>
        {!hasHistory && (
          <div className={cn(
            "mt-7 rounded-xl border px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            voiceActive
              ? "border-rose-200/20 bg-rose-300/10"
              : "border-white/10 bg-white/[0.055]"
          )}>
            <p className={cn("text-sm font-bold leading-relaxed", voiceActive ? "text-red-50" : "text-slate-100")}>
              {voiceActive
                ? (voiceInterimText || "我在听，直接说完整指令。")
                : (voiceProblem || "点按麦克风直接说，也可以在下面打字；需要材料就先加到这次对话里。")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function CommandComposer({
  inputText,
  voiceActive,
  voiceSupported,
  voiceInterimText,
  voiceNotice,
  voiceAudioLevel,
  isProcessing,
  attachments,
  showVoiceButton,
  onInputChange,
  onToggleVoice,
  onAttachFiles,
  onRemoveAttachment,
  onSend,
}: CommandComposerProps) {
  const voiceLevelWidth = `${Math.max(8, Math.min(100, Math.round(voiceAudioLevel * 100)))}%`;

  return (
    <footer className="flex-shrink-0 border-t border-white/10 bg-[#050817]/96 px-3 pb-3 pt-2 shadow-[0_-16px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {attachments.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-lg flex-wrap gap-2">
          <p className="basis-full text-[10px] font-bold text-slate-500">材料已加入本次对话</p>
          {attachments.map((file) => (
            <div
              key={file.id}
              data-testid="conversation-attachment"
              className="flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-300" />
              <div className="min-w-0">
                <p className="max-w-44 truncate text-[11px] font-bold text-slate-100">{file.name}</p>
                <p className="text-[9px] text-slate-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => onRemoveAttachment(file.id)}
                className="ml-1 rounded-full p-1 text-slate-500 active:bg-white/10"
                aria-label={`移除 ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {(voiceActive || voiceInterimText || voiceNotice) && (
        <div className="mx-auto mb-2 max-w-lg rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                voiceActive ? "animate-pulse bg-rose-300" : "bg-cyan-300"
              )}
            />
            <p className="min-w-0 flex-1 truncate text-xs font-bold text-cyan-100">
              {voiceInterimText || voiceNotice || "正在听..."}
            </p>
          </div>
          {voiceActive && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: voiceLevelWidth }} />
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          "mx-auto grid max-w-lg items-center gap-2",
          showVoiceButton
            ? "grid-cols-[3.25rem_3.25rem_minmax(0,1fr)_3.25rem]"
            : "grid-cols-[3.25rem_minmax(0,1fr)_3.25rem]"
        )}
      >
        {showVoiceButton && (
          <button
            data-testid="conversation-voice-toggle"
            onClick={onToggleVoice}
            className={cn(
              "inline-flex h-[52px] min-h-[52px] w-full shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
              voiceActive && "border-rose-300/50 bg-rose-400/15 text-rose-100",
              !voiceSupported && "text-slate-600"
            )}
            aria-label={voiceActive ? "停止语音输入" : "语音输入"}
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
        <label className="relative block h-[52px] min-h-[52px] w-full shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.045] p-0 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] active:bg-white/10" aria-label="添加材料">
          <Paperclip className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2" />
          <input
            data-testid="conversation-file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              onAttachFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className="flex min-h-[52px] min-w-0 items-center rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-cyan-300/40">
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
          disabled={(!inputText.trim() && attachments.length === 0) || isProcessing}
          className="inline-flex h-[52px] min-h-[52px] w-full shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-[#041018] shadow-[0_10px_28px_rgba(34,211,238,0.18)] disabled:bg-white/10 disabled:text-slate-600 disabled:shadow-none"
          aria-label="发送"
        >
          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </footer>
  );
}
