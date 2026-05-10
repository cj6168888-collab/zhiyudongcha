import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, Mic, 
  X, Minimize2, Settings, Sparkles, Bot,
  Eye, Shield, Brain, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvatarStore } from "@/lib/avatar/avatar-store";

export function AvatarChat() {
  const {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    wakeWordEnabled,
    chatOpen,
    chatMinimized,
    addMessage,
    setListening,
    setSpeaking,
    setProcessing,
    setChatOpen,
    setChatMinimized,
    executeCommand,
    speak,
  } = useAvatarStore();

  const [inputText, setInputText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showPowers, setShowPowers] = useState(false);
  const [powerLoading, setPowerLoading] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleUserInput(transcript);
        setListening(false);
      };

      recognitionRef.current.onerror = () => {
        setListening(false);
      };

      recognitionRef.current.onend = () => {
        setListening(false);
      };
    }
  }, []);

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

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setListening(true);
      } catch (e) {
        console.error('Speech recognition error:', e);
      }
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
            {isListening && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <span className="font-medium text-sm">小智</span>
            <span className="text-[10px] text-muted-foreground ml-2">
              {isProcessing ? '思考中...' : isListening ? '聆听中...' : '在线'}
            </span>
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
        <div className="p-3 border-b border-border bg-secondary/20 space-y-2" data-testid="chat-settings-panel">
          <div className="text-xs font-medium text-muted-foreground">语音设置</div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <span>语音唤醒</span>
              <Badge variant="outline" className="ml-2 text-[9px]">开发中</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs opacity-50"
              disabled
              data-testid="button-wake-word-toggle"
            >
              敬请期待
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            提示：点击麦克风按钮后说话，或直接输入指令
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
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
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
          <Button
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={toggleListening}
            data-testid="button-voice-input"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Input
            placeholder="输入指令或问题..."
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
      </div>
    </div>
  );
}
