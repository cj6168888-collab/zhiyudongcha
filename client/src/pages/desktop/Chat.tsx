/**
 * DesktopChat - 桌面端AI对话页面
 *
 * 特点：
 * - 更大的对话显示区域
 * - 侧边栏显示对话历史
 * - 增强的输入区域
 * - 支持Markdown渲染
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send, Mic, Paperclip, MoreVertical, Search, Plus,
  Settings, MessageSquare, ChevronLeft, Copy, Check, X
} from "lucide-react";
import { cn } from "@/lib/utils";
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

// 模拟对话历史
interface ChatHistory {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

const mockHistory: ChatHistory[] = [
  { id: '1', title: '项目方案讨论', lastMessage: '好的，我来整理一下...', timestamp: new Date() },
  { id: '2', title: '合同审阅', lastMessage: '发现第3条有风险点', timestamp: new Date(Date.now() - 3600000) },
  { id: '3', title: '市场分析', lastMessage: '根据数据，Q2增长...', timestamp: new Date(Date.now() - 86400000) },
  { id: '4', title: '团队协作', lastMessage: '已完成分配任务', timestamp: new Date(Date.now() - 172800000) },
];

// 模拟消息
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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

const mockMessages: Message[] = [
  { id: '1', role: 'assistant', content: '你好！我是小星，你的全能助手。今天有什么可以帮助你的吗？', timestamp: new Date() },
  { id: '2', role: 'user', content: '帮我分析一下这个项目方案，重点关注风险点', timestamp: new Date() },
  { id: '3', role: 'assistant', content: `好的，我来帮你分析这个项目方案。

## 主要风险点

### 1. 市场风险
- 目标用户群体定位不够清晰
- 竞争对手已占据先发优势

### 2. 技术风险
- 核心技术团队仅有2人
- 缺少关键技术专利

### 3. 资金风险
- 初期投入超出预算30%
- 现金流预测过于乐观

## 建议

1. **先做MVP验证**：用最小成本验证核心假设
2. **寻找战略伙伴**：弥补技术和渠道短板
3. **保守财务预测**：预留3个月运营资金

需要我针对某个风险点做深入分析吗？`, timestamp: new Date() },
];

export default function DesktopChat() {
  const [, setLocation] = useLocation();
  const { avatarConfig } = useBirthStore();
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const characterEmoji = CHARACTER_OPTIONS.find(c => c.type === avatarConfig.characterType)?.emoji || '✨';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const appendAssistantResponse = (response: AssistantResponse, executionSummary?: string | null) => {
    setMessages(prev => [
      ...prev,
      {
        id: response.id,
        role: 'assistant',
        content: executionSummary ? `${response.message}\n\n${executionSummary}` : response.message,
        timestamp: new Date(),
      },
    ]);

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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setPendingConfirmation(null);
    setPendingDraft(null);
    setIsProcessing(true);

    try {
      const result = await sendAssistantMessage(message);
      appendAssistantResponse(result.response, formatExecutionSummary(result.execution));
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: '抱歉，连接助手服务失败了。请稍后再试。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingConfirmation) return;
    setIsProcessing(true);
    try {
      const result = await approveAssistantAction(pendingConfirmation.responseId);
      const summary = formatExecutionSummary(result.execution);
      setMessages(prev => [
        ...prev,
        {
          id: `approved_${Date.now()}`,
          role: 'assistant',
          content: summary ? `${result.message}\n\n${summary}` : result.message,
          timestamp: new Date(),
        },
      ]);
      setPendingConfirmation(null);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `approve_error_${Date.now()}`,
          role: 'assistant',
          content: '确认执行失败，请稍后重试。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!pendingConfirmation) return;
    try {
      await denyAssistantAction(pendingConfirmation.responseId);
    } finally {
      setMessages(prev => [
        ...prev,
        {
          id: `deny_${Date.now()}`,
          role: 'assistant',
          content: '好的，已取消。',
          timestamp: new Date(),
        },
      ]);
      setPendingConfirmation(null);
    }
  };

  const handleConfirmDraft = async () => {
    if (!pendingDraft) return;
    setIsProcessing(true);
    try {
      const result = await confirmAssistantDraft(pendingDraft.responseId);
      const succeeded = result.executions.filter(e => e.success).length;
      const failed = result.executions.filter(e => !e.success).length;
      const summary = failed > 0
        ? `已完成 ${succeeded} 项，${failed} 项失败。`
        : `已完成全部 ${succeeded} 项。`;
      setMessages(prev => [
        ...prev,
        {
          id: `draft_done_${Date.now()}`,
          role: 'assistant',
          content: summary,
          timestamp: new Date(),
        },
      ]);
      setPendingDraft(null);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `draft_error_${Date.now()}`,
          role: 'assistant',
          content: '草案执行失败，请稍后重试。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDenyDraft = () => {
    setMessages(prev => [
      ...prev,
      {
        id: `draft_cancel_${Date.now()}`,
        role: 'assistant',
        content: '好的，已取消草案。',
        timestamp: new Date(),
      },
    ]);
    setPendingDraft(null);
  };

  return (
    <div className="flex h-full bg-[#030712]">
      {/* 对话历史侧边栏 */}
      <div className={cn(
        "w-64 border-r border-white/10 bg-black/20 flex flex-col transition-all",
        showHistory ? "" : "-ml-64"
      )}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">对话历史</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(false)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="搜索对话..."
              className="pl-9 h-9 bg-white/5 border-white/10 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {mockHistory.map(chat => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat.id)}
              className={cn(
                "w-full text-left p-3 rounded-xl mb-1 transition-all",
                selectedChat === chat.id
                  ? "bg-indigo-500/20 border border-indigo-500/30"
                  : "hover:bg-white/5"
              )}
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{chat.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{chat.lastMessage}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-white/10">
          <Button variant="outline" className="w-full justify-start gap-2 bg-white/5 border-white/10">
            <Plus className="w-4 h-4" />
            新建对话
          </Button>
        </div>
      </div>

      {/* 主对话区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <header className="flex-shrink-0 flex items-center px-4 h-14 border-b border-white/10 bg-black/20 gap-3">
          {!showHistory && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(true)}>
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg">
              {characterEmoji}
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">{avatarConfig.name}</h1>
              <p className="text-[10px] text-gray-500">
                {isProcessing ? '思考中...' : '在线'}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </header>

        {/* 消息区域 */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed",
                  msg.role === 'user'
                    ? "bg-indigo-500 text-white rounded-tr-sm"
                    : "bg-white/10 border border-white/10 text-gray-100 rounded-tl-sm"
                )}>
                  {/* 渲染Markdown简化版 */}
                  <div className="whitespace-pre-wrap">
                    {msg.content.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) {
                        return <h3 key={i} className="text-base font-bold mt-2 mb-1">{line.replace('## ', '')}</h3>;
                      }
                      if (line.startsWith('### ')) {
                        return <h4 key={i} className="text-sm font-semibold mt-2 text-indigo-300">{line.replace('### ', '')}</h4>;
                      }
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <p key={i} className="font-bold">{line.replace(/\*\*/g, '')}</p>;
                      }
                      if (line.startsWith('- ')) {
                        return <div key={i} className="flex gap-2"><span className="text-gray-400">•</span><span>{line.replace('- ', '')}</span></div>;
                      }
                      if (line.match(/^\d+\./)) {
                        return <div key={i} className="flex gap-2"><span className="text-indigo-400">{line.match(/^\d+/)?.[0]}.</span><span>{line.replace(/^\d+\.\s*/, '')}</span></div>;
                      }
                      return <p key={i}>{line || '\u00A0'}</p>;
                    })}
                  </div>

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                    <span className="text-[10px] text-gray-500">
                      {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.role === 'assistant' && (
                      <>
                        <button className="text-[10px] text-gray-500 hover:text-white">
                          <Copy className="w-3 h-3 inline mr-1" />复制
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-white/10 border border-white/10 rounded-2xl rounded-tl-sm px-5 py-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {pendingConfirmation && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-5 py-4 text-sm bg-amber-500/10 border border-amber-400/30 text-amber-50">
                  <p className="font-semibold">需要确认</p>
                  <p className="mt-1 text-amber-100/90">{pendingConfirmation.reason || pendingConfirmation.message}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="h-8 gap-1 bg-emerald-500 hover:bg-emerald-600" onClick={handleApprove}>
                      <Check className="w-4 h-4" />
                      执行
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1 border-white/10 bg-white/5" onClick={handleDeny}>
                      <X className="w-4 h-4" />
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {pendingDraft && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm px-5 py-4 text-sm bg-indigo-500/10 border border-indigo-400/30 text-indigo-50">
                  <p className="font-semibold text-indigo-200 mb-3">{pendingDraft.message}</p>
                  <ul className="space-y-2 mb-4">
                    {pendingDraft.items.map((item, idx) => {
                      const iconMap: Record<string, string> = {
                        create_project: '📁',
                        create_task: '✅',
                        save_memory: '🧠',
                        create_person: '👤',
                      };
                      return (
                        <li key={idx} className="flex items-center gap-2 text-indigo-100/90">
                          <span>{iconMap[item.action] ?? '•'}</span>
                          <span>{item.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-indigo-500 hover:bg-indigo-600"
                      onClick={handleConfirmDraft}
                      disabled={isProcessing}
                    >
                      <Check className="w-4 h-4" />
                      确认执行全部
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-white/10 bg-white/5"
                      onClick={handleDenyDraft}
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4" />
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 快捷提示 */}
        <div className="px-6 py-2 flex gap-2 flex-wrap">
          <Badge variant="outline" className="cursor-pointer hover:bg-white/10 text-xs" onClick={() => setInputText("帮我分析合同风险")}>
            分析合同风险
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-white/10 text-xs" onClick={() => setInputText("帮我写一封商务邮件")}>
            写商务邮件
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-white/10 text-xs" onClick={() => setInputText("项目进度汇报")}>
            项目汇报
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-white/10 text-xs" onClick={() => setInputText("市场分析报告")}>
            市场分析
          </Badge>
        </div>

        {/* 输入区 */}
        <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/20">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-lg hover:bg-white/10">
                    <Paperclip className="w-5 h-5 text-gray-400" />
                  </Button>
                  <Input
                    placeholder="给小星发送消息..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    className="h-10 bg-transparent border-none text-white placeholder:text-gray-500 focus-visible:ring-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-lg hover:bg-white/10"
                    onClick={() => {}}
                  >
                    <Mic className="w-5 h-5 text-gray-400" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-lg bg-indigo-500 hover:bg-indigo-600"
                    onClick={handleSend}
                    disabled={!inputText.trim() || isProcessing}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            <p className="text-[10px] text-gray-600 text-center mt-2">
              按 Enter 发送，Shift + Enter 换行。小星会尽力提供准确的信息
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
