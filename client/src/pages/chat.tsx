import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Mic, ArrowLeft, Check, X, Loader2, Zap
} from "lucide-react";
import { useZ1Store, MAX_HP } from "@/lib/z1/god-protocol";
import { cn } from "@/lib/utils";
import { useAvatarStore } from "@/lib/avatar/avatar-store";
import { useBirthStore, CHARACTER_OPTIONS } from "@/lib/birth-state-store";
import {
  approveAssistantAction,
  confirmAssistantDraft,
  denyAssistantAction,
  formatExecutionSummary,
  sendAssistantMessage,
  type AssistantResponse,
  type DraftItem,
} from "@/lib/assistant-api";

interface PendingConfirmation {
  responseId: string;
  message: string;
  reason?: string;
  action?: string;
}

interface PendingDraft {
  responseId: string;
  message: string;
  items: DraftItem[];
}

const ACTION_ICON: Record<string, string> = {
  create_project: '📁',
  create_task: '✅',
  save_memory: '🧠',
  create_person: '👤',
};

const LEVEL_SHORT: Record<string, string> = {
  BACHELOR: 'Lv1', MASTER: 'Lv2', DOCTOR: 'Lv3', PROFESSOR: 'Lv4', EXPERT: 'Lv5',
};

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const { avatarConfig } = useBirthStore();
  const {
    messages, isProcessing,
    addMessage,
  } = useAvatarStore();
  const { hpBalance, academicLevel } = useZ1Store();

  const [inputText, setInputText] = useState("");
  const [naturalMode, setNaturalMode] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const characterEmoji = CHARACTER_OPTIONS.find(c => c.type === avatarConfig.characterType)?.emoji || '🤖';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingConfirmation, pendingDraft]);

  const appendAssistantResponse = (response: AssistantResponse, executionSummary?: string | null) => {
    const content = executionSummary
      ? `${response.message}\n\n${executionSummary}`
      : response.message;

    addMessage({ role: 'assistant', content, timestamp: Date.now() });

    if (response.type === 'confirm') {
      setPendingConfirmation({
        responseId: response.id,
        message: response.message,
        reason: response.authorization?.reason,
        action: response.action,
      });
      setPendingDraft(null);
    } else if (response.type === 'draft' && response.draftItems?.length) {
      setPendingDraft({
        responseId: response.id,
        message: response.message,
        items: response.draftItems,
      });
      setPendingConfirmation(null);
    } else {
      setPendingConfirmation(null);
      setPendingDraft(null);
    }
  };

  const handleSend = async () => {
    const message = inputText.trim();
    if (!message || isProcessing) return;

    addMessage({ role: 'user', content: message, timestamp: Date.now() });
    setInputText("");
    setPendingConfirmation(null);
    setPendingDraft(null);

    try {
      useAvatarStore.getState().setProcessing(true);
      const result = await sendAssistantMessage(message);
      appendAssistantResponse(result.response, formatExecutionSummary(result.execution));
    } catch {
      addMessage({ role: 'assistant', content: '抱歉，连接助手服务失败了。请稍后再试。', timestamp: Date.now() });
    } finally {
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingConfirmation) return;
    try {
      useAvatarStore.getState().setProcessing(true);
      const result = await approveAssistantAction(pendingConfirmation.responseId);
      const summary = formatExecutionSummary(result.execution);
      addMessage({
        role: 'assistant',
        content: summary ? `${result.message}\n\n${summary}` : result.message,
        timestamp: Date.now(),
      });
      setPendingConfirmation(null);
    } catch {
      addMessage({ role: 'assistant', content: '确认执行失败，请稍后重试。', timestamp: Date.now() });
    } finally {
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!pendingConfirmation) return;
    try {
      await denyAssistantAction(pendingConfirmation.responseId);
    } finally {
      addMessage({ role: 'assistant', content: '好的，已取消。', timestamp: Date.now() });
      setPendingConfirmation(null);
    }
  };

  const handleConfirmDraft = async () => {
    if (!pendingDraft) return;
    try {
      useAvatarStore.getState().setProcessing(true);
      const result = await confirmAssistantDraft(pendingDraft.responseId);
      const succeeded = result.executions.filter(e => e.success).length;
      const failed = result.executions.filter(e => !e.success).length;
      const summary = failed > 0
        ? `已完成 ${succeeded} 项，${failed} 项失败。`
        : `已完成全部 ${succeeded} 项。`;
      addMessage({ role: 'assistant', content: summary, timestamp: Date.now() });
      setPendingDraft(null);
    } catch {
      addMessage({ role: 'assistant', content: '草案执行失败，请稍后重试。', timestamp: Date.now() });
    } finally {
      useAvatarStore.getState().setProcessing(false);
    }
  };

  const handleDenyDraft = () => {
    addMessage({ role: 'assistant', content: '好的，已取消草案。', timestamp: Date.now() });
    setPendingDraft(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#030712] relative overflow-hidden text-white">
      {/* 顶部标题栏 */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 border-b border-white/5 bg-black/20 gap-3 z-10">
        <button
          onClick={() => window.history.back()}
          className="p-2 -ml-2 text-gray-400 active:text-white active:scale-95 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xl shrink-0">
            {characterEmoji}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white leading-none truncate">{avatarConfig.name}</h1>
            <p className="text-[10px] text-gray-500 mt-1 truncate">
              {isProcessing ? '思考中...' : (naturalMode ? '自然对话中' : '在线')}
            </p>
          </div>
        </div>

        {/* HP 徽章 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="16" cy="16" r="12" fill="none"
                stroke={hpBalance > 300 ? '#fbbf24' : '#ef4444'}
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - hpBalance / MAX_HP)}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <Zap className="absolute inset-0 m-auto w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-right">
            <p className="text-[11px] font-mono font-bold text-amber-400 leading-none">{hpBalance}</p>
            <p className="text-[9px] text-gray-500 leading-none mt-0.5">{LEVEL_SHORT[academicLevel] ?? ''}</p>
          </div>
        </div>
      </header>

      {/* 聊天内容区 */}
      <ScrollArea className="flex-1 relative z-0">
        <div className="p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                msg.role === 'user'
                  ? "bg-primary text-white rounded-tr-none"
                  : "bg-white/10 border border-white/5 text-gray-100 rounded-tl-none"
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* 思考中动画 */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white/10 border border-white/5 rounded-2xl rounded-tl-none px-4 py-3">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* 确认操作卡片 */}
          {pendingConfirmation && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-none px-4 py-3 text-sm bg-amber-500/10 border border-amber-400/30 text-amber-50">
                <p className="font-medium">需要确认</p>
                <p className="mt-1 text-amber-100/90">{pendingConfirmation.reason || pendingConfirmation.message}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-8 gap-1 bg-emerald-500 hover:bg-emerald-600" onClick={handleApprove} disabled={isProcessing}>
                    <Check className="w-4 h-4" />
                    执行
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 border-white/10 bg-white/5" onClick={handleDeny} disabled={isProcessing}>
                    <X className="w-4 h-4" />
                    取消
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 结构化草案卡片 */}
          {pendingDraft && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl rounded-tl-none px-4 py-3 text-sm bg-indigo-500/10 border border-indigo-400/30 text-indigo-50">
                <p className="font-medium text-indigo-200 mb-2">
                  我整理了以下 {pendingDraft.items.length} 项，确认后一并执行：
                </p>
                <ul className="space-y-1.5 mb-3">
                  {pendingDraft.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-indigo-100/90 text-xs">
                      <span className="text-base leading-none">{ACTION_ICON[item.action] ?? '•'}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 gap-1 bg-indigo-500 hover:bg-indigo-600 text-xs"
                    onClick={handleConfirmDraft}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    全部执行
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-indigo-400/30 bg-indigo-500/10 text-indigo-200 text-xs"
                    onClick={handleDenyDraft}
                    disabled={isProcessing}
                  >
                    <X className="w-3 h-3" />
                    取消
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="flex-shrink-0 p-3 bg-black/40 border-t border-white/5 backdrop-blur-lg">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl border-white/10 bg-white/5"
            onClick={() => setNaturalMode(!naturalMode)}
          >
            <Mic className={cn("w-5 h-5", naturalMode ? "text-primary" : "text-gray-400")} />
          </Button>

          <Input
            placeholder="说点什么..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="h-11 bg-white/5 border-white/10 focus:border-primary/50 text-white"
          />

          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
