import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, Mic, MicOff,
  X, Minimize2, Settings, Sparkles, Bot,
  Volume2, VolumeX, Radio
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvatarStore } from "@/lib/avatar/avatar-store";
import { useVoiceActivity, VoiceState } from "@/hooks/use-voice-activity";
import { visualEnhancements, type PersonaMode } from "@/lib/avatar/visual-enhancements";
import { MessageFeedback } from "./message-feedback";

function VoiceMeter({ level, state }: { level: number; state: VoiceState }) {
  const bars = 5;
  const activeCount = Math.ceil(level * bars * 3);
  
  return (
    <div className="flex items-end gap-0.5 h-4" data-testid="voice-meter">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all duration-100",
            i < activeCount ? "bg-primary" : "bg-muted",
            state === 'speaking' && i < activeCount && "animate-pulse"
          )}
          style={{ 
            height: `${Math.max(4, (i + 1) * 3)}px`,
            opacity: i < activeCount ? 1 : 0.3 
          }}
        />
      ))}
    </div>
  );
}

export function AvatarChat() {
  const {
    messages,
    isListening: storeListening,
    isSpeaking,
    isProcessing,
    wakeWordEnabled,
    chatOpen,
    chatMinimized,
    addMessage,
    setListening: setStoreListening,
    setSpeaking,
    setProcessing,
    setChatOpen,
    setChatMinimized,
    executeCommand,
    speak,
    setCurrentTtsText,
  } = useAvatarStore();

  const [inputText, setInputText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [naturalMode, setNaturalMode] = useState(false);
  const [pendingSpeech, setPendingSpeech] = useState<string | null>(null);
  const [currentPersonaMode, setCurrentPersonaMode] = useState<PersonaMode>('DAUGHTER');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cooldownActiveRef = useRef(false);

  useEffect(() => {
    const unsubscribe = visualEnhancements.subscribe((event, data) => {
      if (event === 'expert_transform' && data.targetMode) {
        setCurrentPersonaMode(data.targetMode);
      }
    });
    return () => unsubscribe();
  }, []);
  
  const handleSpeechEnd = useCallback(async (transcript: string, wakeWordDetected: boolean) => {
    if (!transcript.trim()) return;
    
    if (cooldownActiveRef.current) {
      console.log('[AvatarChat] Ignoring speech during cooldown:', transcript.slice(0, 30));
      return;
    }
    
    if (isSpeaking) {
      console.log('[AvatarChat] Ignoring speech while speaking:', transcript.slice(0, 30));
      return;
    }
    
    if (naturalMode && !wakeWordDetected) {
      return;
    }

    addMessage({
      role: 'user',
      content: transcript,
      timestamp: Date.now(),
    });

    setProcessing(true);

    try {
      const result = await executeCommand(transcript);
      
      addMessage({
        role: 'assistant',
        content: result.message,
        timestamp: Date.now(),
        command: result.command,
      });

      if (result.success && naturalMode) {
        setPendingSpeech(result.message);
      } else if (result.success) {
        speak(result.message);
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试。',
        timestamp: Date.now(),
      });
    } finally {
      setProcessing(false);
    }
  }, [naturalMode, addMessage, setProcessing, executeCommand, speak]);

  const {
    voiceState,
    isListening,
    volumeLevel,
    transcript,
    interimTranscript,
    wakeWordDetected,
    startListening,
    stopListening,
    mute,
    unmute,
    isMuted,
    error: voiceError,
  } = useVoiceActivity(handleSpeechEnd, {
    enableWakeWord: naturalMode,
    userId: 'default',
  });

  useEffect(() => {
    if (pendingSpeech && mute && unmute) {
      cooldownActiveRef.current = true;
      mute();
      
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          
          const isProfessional = ['LEGAL', 'FINANCE', 'STRATEGY'].includes(currentPersonaMode);
          let cleanText = pendingSpeech.replace(/[*#`\[\]]/g, '').substring(0, 200);
          let speechRate = 0.95;
          
          if (isProfessional) {
            const effect = visualEnhancements.getExpertTransformEffect(currentPersonaMode);
            const { text, speechRate: newRate } = visualEnhancements.applyProfessionalTextConstraints(cleanText, effect);
            cleanText = text;
            speechRate = 0.95 * newRate;
          }
          
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'zh-CN';
          utterance.rate = speechRate;
          utterance.pitch = 1;
          utterance.volume = 0.8;
          
          utterance.onstart = () => {
            setSpeaking(true);
            setCurrentTtsText(cleanText); // 设置TTS文本用于自我声音过滤
            console.log('[AvatarChat] Speech started, mic muted');
          };
          utterance.onend = () => {
            setSpeaking(false);
            console.log('[AvatarChat] Speech ended, waiting before unmute...');
            setTimeout(() => {
              cooldownActiveRef.current = false;
              unmute();
              setCurrentTtsText(''); // 延迟清除TTS文本，防止听到自己最后一句话
              console.log('[AvatarChat] Mic unmuted after cooldown');
            }, 2000);
          };
          utterance.onerror = (e) => {
            console.error('[AvatarChat] Speech error:', e);
            setSpeaking(false);
            setTimeout(() => {
              cooldownActiveRef.current = false;
              unmute();
              setCurrentTtsText(''); // 延迟清除TTS文本
            }, 1000);
          };
          
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.error('[AvatarChat] Speech synthesis error:', err);
          setSpeaking(false);
          setCurrentTtsText(''); // 清除TTS文本
          cooldownActiveRef.current = false;
          unmute();
        }
      } else {
        cooldownActiveRef.current = false;
        unmute();
      }
      
      setPendingSpeech(null);
    }
  }, [pendingSpeech, mute, unmute, setSpeaking, currentPersonaMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setStoreListening(isListening && !isMuted);
  }, [isListening, isMuted, setStoreListening]);

  const handleUserInput = async (text: string) => {
    if (!text.trim()) return;

    addMessage({
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    setProcessing(true);

    try {
      const result = await executeCommand(text);
      
      addMessage({
        role: 'assistant',
        content: result.message,
        timestamp: Date.now(),
        command: result.command,
      });

      if (result.success) {
        speak(result.message);
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试。',
        timestamp: Date.now(),
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSend = () => {
    if (inputText.trim()) {
      handleUserInput(inputText);
      setInputText("");
    }
  };

  const toggleNaturalMode = async () => {
    if (naturalMode) {
      stopListening();
      setNaturalMode(false);
    } else {
      setNaturalMode(true);
      await startListening();
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getStateLabel = () => {
    if (isProcessing) return '思考中...';
    if (isMuted) return '已静音';
    switch (voiceState) {
      case 'speaking': return '聆听中...';
      case 'listening': return '待命中';
      case 'processing': return '处理中...';
      case 'responding': return '回复中...';
      default: return naturalMode ? '自然对话' : '在线';
    }
  };

  if (!chatOpen) {
    return (
      <Button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-50"
        data-testid="button-open-chat"
      >
        <Bot className="w-6 h-6" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-[10px] flex items-center justify-center text-white">
            {messages.length}
          </span>
        )}
      </Button>
    );
  }

  if (chatMinimized) {
    return (
      <div 
        className="fixed bottom-6 right-6 bg-card border border-border rounded-lg shadow-xl p-3 flex items-center gap-3 z-50 cursor-pointer hover:border-primary transition-colors"
        onClick={() => setChatMinimized(false)}
        data-testid="chat-minimized"
      >
        <Bot className="w-5 h-5 text-primary" />
        <span className="text-sm">小智</span>
        {isProcessing && <Sparkles className="w-4 h-4 text-primary animate-pulse" />}
        {naturalMode && isListening && <Radio className="w-4 h-4 text-green-500 animate-pulse" />}
        <Badge variant="secondary" className="text-[10px]">{messages.length}</Badge>
      </div>
    );
  }

  return (
    <div 
      className="fixed bottom-6 right-6 w-96 max-h-[600px] bg-card border border-border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden"
      data-testid="chat-window"
    >
      <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot className="w-6 h-6 text-primary" />
            {naturalMode && isListening && !isMuted && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            )}
            {voiceState === 'speaking' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">小智</span>
            <span className="text-[10px] text-muted-foreground">
              {getStateLabel()}
            </span>
            {naturalMode && isListening && (
              <VoiceMeter level={volumeLevel} state={voiceState} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setShowSettings(!showSettings)}
            data-testid="button-chat-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setChatMinimized(true)}
            data-testid="button-chat-minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setChatOpen(false)}
            data-testid="button-chat-close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {showSettings && (
        <div className="p-3 border-b border-border bg-secondary/20 space-y-3" data-testid="chat-settings-panel">
          <div className="text-xs font-medium text-muted-foreground">语音设置</div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Radio className={cn("w-4 h-4", naturalMode ? "text-green-500" : "text-muted-foreground")} />
              <div>
                <span>自然对话模式</span>
                {naturalMode && <Badge variant="default" className="ml-2 text-[9px] bg-green-500">开启</Badge>}
              </div>
            </div>
            <Button
              variant={naturalMode ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs"
              onClick={toggleNaturalMode}
              data-testid="button-natural-mode-toggle"
            >
              {naturalMode ? "关闭" : "开启"}
            </Button>
          </div>
          
          {naturalMode && (
            <div className="text-[10px] text-muted-foreground bg-secondary/50 rounded p-2">
              自然对话模式：持续监听麦克风，说话时自动识别并响应。
              {wakeWordDetected && <span className="text-green-500 ml-1">已检测到唤醒词</span>}
            </div>
          )}
          
          {voiceError && (
            <div className="text-[10px] text-destructive bg-destructive/10 rounded p-2">
              {voiceError}
            </div>
          )}
        </div>
      )}

      {naturalMode && interimTranscript && (
        <div className="px-3 py-2 bg-primary/10 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-xs text-muted-foreground italic">{interimTranscript}</span>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-3 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Bot className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-2">你好，我是小智</p>
            <p className="text-xs text-muted-foreground">
              我可以帮你管理项目、联系人、合同和方案
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
              {['添加项目', '查看联系人', '新建合同', '制定方案'].map((cmd) => (
                <Button
                  key={cmd}
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-6"
                  onClick={() => handleUserInput(cmd)}
                  data-testid={`button-quick-${cmd}`}
                >
                  {cmd}
                </Button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border w-full">
              <p className="text-[10px] text-muted-foreground mb-2">试试自然对话模式</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={toggleNaturalMode}
                data-testid="button-enable-natural-mode"
              >
                <Radio className="w-3 h-3 mr-1" />
                开启自然对话
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex group",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2",
                    msg.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.command && (
                    <Badge variant="outline" className="mt-1 text-[9px]">
                      {msg.command.action} {msg.command.entity}
                    </Badge>
                  )}
                  <span className="text-[9px] opacity-60 block mt-1">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.role === 'assistant' && (
                    <MessageFeedback
                      messageId={`msg-${i}-${msg.timestamp}`}
                      conversationId="default"
                      category={msg.command?.entity || "general"}
                      userMessage={messages[i - 1]?.content}
                      assistantResponse={msg.content}
                    />
                  )}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t border-border bg-secondary/20">
        <div className="flex gap-2">
          {naturalMode ? (
            <Button
              variant={isMuted ? "outline" : "default"}
              size="icon"
              className={cn("h-9 w-9 shrink-0", !isMuted && "bg-green-600 hover:bg-green-700")}
              onClick={toggleMute}
              data-testid="button-mute-toggle"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={toggleNaturalMode}
              data-testid="button-voice-input"
            >
              <Mic className="w-4 h-4" />
            </Button>
          )}
          <Input
            placeholder={naturalMode ? "自然对话中，直接说话即可..." : "输入指令或问题..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="h-9 text-sm"
            disabled={isProcessing}
            data-testid="input-chat"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            data-testid="button-send-chat"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {naturalMode && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>说 "小智" 唤醒</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-2"
              onClick={() => {
                stopListening();
                setNaturalMode(false);
              }}
              data-testid="button-exit-natural-mode"
            >
              退出自然对话
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
