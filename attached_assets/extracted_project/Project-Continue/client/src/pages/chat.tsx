import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, Mic, MicOff, ArrowLeft,
  Settings, Sparkles, Bot,
  Volume2, VolumeX, Radio, Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvatarStore } from "@/lib/avatar/avatar-store";
import { useVoiceActivity, VoiceState } from "@/hooks/use-voice-activity";
import { useBirthStore, CHARACTER_OPTIONS } from "@/lib/birth-state-store";

function VoiceMeter({ level, state }: { level: number; state: VoiceState }) {
  const bars = 7;
  const activeCount = Math.ceil(level * bars * 3);
  
  return (
    <div className="flex items-end gap-1 h-8" data-testid="voice-meter">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "w-1.5 rounded-full transition-all",
            i < activeCount ? "bg-cyan-400" : "bg-gray-700",
            state === 'speaking' && i < activeCount && "bg-green-400"
          )}
          animate={{
            height: i < activeCount ? `${Math.max(8, (i + 1) * 4 + level * 20)}px` : '8px',
            opacity: i < activeCount ? 1 : 0.3,
          }}
          transition={{ duration: 0.1 }}
        />
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const { avatarConfig } = useBirthStore();
  const {
    messages,
    isListening: storeListening,
    isSpeaking,
    isProcessing,
    wakeWordEnabled,
    addMessage,
    setListening: setStoreListening,
    setSpeaking,
    setProcessing,
    executeCommand,
    speak,
    clearMessages,
    setCurrentTtsText,
  } = useAvatarStore();

  const [inputText, setInputText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [naturalMode, setNaturalMode] = useState(false);
  const [pendingSpeech, setPendingSpeech] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cooldownActiveRef = useRef(false);

  const characterEmoji = CHARACTER_OPTIONS.find(c => c.type === avatarConfig.characterType)?.emoji || '🤖';

  const handleSpeechEnd = useCallback(async (transcript: string, wakeWordDetected: boolean) => {
    if (!transcript.trim()) return;
    
    if (cooldownActiveRef.current) return;
    if (isSpeaking) return;
    if (naturalMode && !wakeWordDetected) return;

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
  }, [naturalMode, addMessage, setProcessing, executeCommand, speak, isSpeaking]);

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
          const cleanText = pendingSpeech.replace(/[*#`\[\]]/g, '').substring(0, 200);
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'zh-CN';
          utterance.rate = 0.95;
          utterance.pitch = 1;
          utterance.volume = 0.8;
          
          utterance.onstart = () => {
            setSpeaking(true);
            setCurrentTtsText(cleanText); // 设置TTS文本用于自我声音过滤
          };
          utterance.onend = () => {
            setSpeaking(false);
            setTimeout(() => {
              cooldownActiveRef.current = false;
              unmute();
              setCurrentTtsText(''); // 延迟清除TTS文本，防止听到自己最后一句话
            }, 2000);
          };
          utterance.onerror = () => {
            setSpeaking(false);
            setTimeout(() => {
              cooldownActiveRef.current = false;
              unmute();
              setCurrentTtsText(''); // 延迟清除TTS文本
            }, 1000);
          };
          
          window.speechSynthesis.speak(utterance);
        } catch (err) {
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
  }, [pendingSpeech, mute, unmute, setSpeaking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setStoreListening(isListening && !isMuted);
  }, [isListening, isMuted, setStoreListening]);

  const handleUserInput = async (text: string, useDeepThinking = true) => {
    if (!text.trim()) return;

    addMessage({
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    setProcessing(true);

    try {
      if (useDeepThinking) {
        // 使用深度思考模型处理文字输入
        const response = await fetch('/api/avatar/deep-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: text,
            sessionId: 'default',
            autoSaveFiles: true
          }),
        });
        
        if (!response.ok) {
          throw new Error('Deep chat API request failed');
        }
        
        const data = await response.json();
        
        let messageContent = data.message || '深度思考完成，但没有具体回复...';
        
        // 如果有文件被保存，添加提示
        if (data.fileSaveResult?.success && data.fileSaveResult.savedFiles?.length > 0) {
          messageContent += `\n\n📁 ${data.fileSaveResult.message}`;
        }
        
        addMessage({
          role: 'assistant',
          content: messageContent,
          timestamp: Date.now(),
          command: data.filesDetected?.length > 0 ? { action: 'file_classify', entity: 'vault' } : undefined,
        });

        if (data.success && data.message) {
          speak(data.message);
        }
      } else {
        // 普通模式（语音输入仍使用快速模型）
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
    if (isProcessing) return naturalMode ? '思考中...' : '深度思考中...';
    if (isMuted) return '已静音';
    switch (voiceState) {
      case 'speaking': return '聆听中...';
      case 'listening': return '待命中';
      case 'processing': return '处理中...';
      case 'responding': return '回复中...';
      default: return naturalMode ? '自然对话模式' : '深度思考模式';
    }
  };

  return (
    <div className="fixed inset-0 bg-[#030712] flex flex-col" data-testid="chat-page">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628] via-[#030712] to-[#0a0f1e] pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9 text-gray-400 hover:text-white touch-manipulation"
            onClick={() => setLocation('/')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <motion.div 
              className="relative"
              animate={isSpeaking ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-2xl">
                {characterEmoji}
              </div>
              {naturalMode && isListening && !isMuted && (
                <motion.span 
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </motion.div>
            <div>
              <h1 className="text-white font-medium">{avatarConfig.name}</h1>
              <p className="text-xs text-gray-400">{getStateLabel()}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {naturalMode && isListening && (
            <VoiceMeter level={volumeLevel} state={voiceState} />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-400 hover:text-white"
            onClick={() => setShowSettings(!showSettings)}
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 border-b border-gray-800/50 bg-gray-900/30 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Radio className={cn("w-5 h-5", naturalMode ? "text-green-500" : "text-gray-500")} />
                  <div>
                    <p className="text-sm text-white">自然对话模式</p>
                    <p className="text-xs text-gray-400">持续监听，说话自动识别</p>
                  </div>
                </div>
                <Button
                  variant={naturalMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleNaturalMode}
                  className={naturalMode ? "bg-green-600 hover:bg-green-700" : ""}
                  data-testid="button-toggle-natural"
                >
                  {naturalMode ? "已开启" : "开启"}
                </Button>
              </div>
              
              {voiceError && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
                  {voiceError}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {naturalMode && interimTranscript && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-sm text-cyan-300 italic">{interimTranscript}</span>
          </div>
        </motion.div>
      )}

      <ScrollArea className="flex-1 relative z-10">
        <div className="p-4 min-h-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <motion.div
                className="text-7xl mb-6"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {characterEmoji}
              </motion.div>
              <h2 className="text-xl text-white mb-2">你好，主人</h2>
              <p className="text-gray-400 text-center mb-8">
                我是{avatarConfig.name}，你的专属数字生命<br/>
                有什么可以帮您的？
              </p>
              
              <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-sm w-full px-4">
                {['帮我分析一下', '今天有什么安排', '汇报工作进度', '给我一些建议'].map((cmd) => (
                  <Button
                    key={cmd}
                    variant="outline"
                    className="min-h-[48px] border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white active:scale-95 touch-manipulation text-sm"
                    onClick={() => handleUserInput(cmd)}
                    data-testid={`button-quick-${cmd}`}
                  >
                    {cmd}
                  </Button>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-gray-800 w-full max-w-sm text-center">
                <p className="text-xs text-gray-500 mb-3">开启语音对话</p>
                <Button
                  variant="outline"
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  onClick={toggleNaturalMode}
                  data-testid="button-start-voice"
                >
                  <Radio className="w-4 h-4 mr-2" />
                  自然对话模式
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn("flex items-end gap-2 max-w-[80%]", msg.role === 'user' && "flex-row-reverse")}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-lg shrink-0">
                        {characterEmoji}
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3",
                        msg.role === 'user' 
                          ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white" 
                          : "bg-gray-800/80 border border-gray-700/50 text-gray-100"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.command && (
                        <Badge variant="outline" className="mt-2 text-[10px] border-cyan-500/30 text-cyan-400">
                          {msg.command.action} {msg.command.entity}
                        </Badge>
                      )}
                      <span className="text-[10px] opacity-50 block mt-1">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-lg">
                      {characterEmoji}
                    </div>
                    <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl px-4 py-3">
                      <div className="flex gap-1.5">
                        <motion.span 
                          className="w-2 h-2 bg-cyan-400 rounded-full"
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                        />
                        <motion.span 
                          className="w-2 h-2 bg-cyan-400 rounded-full"
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                        />
                        <motion.span 
                          className="w-2 h-2 bg-cyan-400 rounded-full"
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="relative z-10 p-3 sm:p-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-[max(12px,env(safe-area-inset-bottom))] border-t border-gray-800/50 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex gap-2 sm:gap-3 max-w-2xl mx-auto">
          {naturalMode ? (
            <Button
              variant={isMuted ? "outline" : "default"}
              size="icon"
              className={cn(
                "h-11 w-11 shrink-0 rounded-full",
                !isMuted && "bg-green-600 hover:bg-green-700"
              )}
              onClick={toggleMute}
              data-testid="button-mute"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full border-gray-700 hover:border-cyan-500/50 hover:bg-cyan-500/10"
              onClick={toggleNaturalMode}
              data-testid="button-voice"
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
          
          <Input
            placeholder={naturalMode ? "自然对话中，直接说话即可..." : `对${avatarConfig.name}说点什么...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="h-11 bg-gray-800/50 border-gray-700 focus:border-cyan-500/50 text-white placeholder:text-gray-500"
            disabled={isProcessing}
            data-testid="input-message"
          />
          
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        
        {naturalMode && (
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
            <span>说 "{avatarConfig.name}" 唤醒</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-gray-500 hover:text-white"
              onClick={() => {
                stopListening();
                setNaturalMode(false);
              }}
              data-testid="button-exit-voice"
            >
              退出语音模式
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
