import { useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Server, FileSearch, FolderKanban, Sparkles, FileText, Brain, Smartphone, Lightbulb, Mail, Send, Mic, MicOff, Loader2, Crown, Vault } from 'lucide-react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAvatarStore } from '@/lib/avatar/avatar-store';
import { useZ1Store } from '@/lib/z1/god-protocol';

interface ModuleItem {
  icon: React.ElementType;
  labelKey: string;
  path: string;
  priority: 'core' | 'main' | 'util';
  color: string;
}

export function ModulesWidget() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addMessage, executeCommand } = useAvatarStore();
  const { role } = useZ1Store();
  const isMaster = role === 'MASTER';

  const modules: ModuleItem[] = [
    { icon: Sparkles, labelKey: 'nav.chat', path: '/avatar', priority: 'core', color: 'from-cyan-500 to-blue-600' },
    { icon: Network, labelKey: 'nav.network', path: '/network', priority: 'main', color: 'from-violet-500 to-purple-600' },
    { icon: FolderKanban, labelKey: 'nav.projects', path: '/projects', priority: 'main', color: 'from-amber-500 to-orange-600' },
    { icon: Brain, labelKey: 'nav.dream', path: '/dream', priority: 'main', color: 'from-pink-500 to-rose-600' },
    { icon: Server, labelKey: 'nav.insight', path: '/spirit', priority: 'util', color: 'from-emerald-500 to-teal-600' },
    { icon: isMaster ? Crown : Vault, labelKey: isMaster ? 'nav.creator' : 'nav.vault_private', path: '/creator', priority: 'util', color: 'from-amber-400 to-yellow-600' },
    { icon: FileSearch, labelKey: 'nav.intel', path: '/intel', priority: 'util', color: 'from-sky-500 to-indigo-600' },
    { icon: FileText, labelKey: 'nav.reports', path: '/reports', priority: 'util', color: 'from-slate-400 to-slate-600' },
    { icon: Smartphone, labelKey: 'nav.remote', path: '/remote', priority: 'util', color: 'from-lime-500 to-green-600' },
    { icon: Lightbulb, labelKey: 'nav.inspiration', path: '/inspiration', priority: 'util', color: 'from-yellow-400 to-amber-500' },
    { icon: Mail, labelKey: 'nav.email', path: '/email', priority: 'util', color: 'from-red-400 to-pink-500' },
  ];

  const coreModule = modules.find(m => m.priority === 'core')!;
  const mainModules = modules.filter(m => m.priority === 'main');
  const utilModules = modules.filter(m => m.priority === 'util');

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const text = inputText.trim();
    setInputText('');
    setIsLoading(true);
    
    addMessage({ role: 'user', content: text, timestamp: Date.now() });
    
    try {
      const result = await executeCommand(text);
      addMessage({ role: 'assistant', content: result.message, timestamp: Date.now(), command: result.command });
    } catch {
      addMessage({ role: 'assistant', content: '抱歉，处理请求时出错了', timestamp: Date.now() });
    } finally {
      setIsLoading(false);
      setLocation('/avatar');
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsListening(false);
        };
        
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } else {
        setIsListening(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "w-full relative overflow-hidden rounded-xl",
          "bg-gradient-to-br from-cyan-500 to-blue-600",
          "shadow-lg shadow-cyan-500/20"
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
        <div className="absolute top-2 right-2 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
        
        <button 
          onClick={() => setLocation(coreModule.path)}
          className="relative w-full flex items-center gap-4 p-4 sm:p-5 hover:bg-white/5 transition-colors"
          data-testid="button-module-avatar"
        >
          <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
            <coreModule.icon className="w-7 h-7 text-white" />
          </div>
          <div className="text-left flex-1">
            <h3 className="text-base sm:text-lg font-bold text-white">{t(coreModule.labelKey)}</h3>
            <p className="text-xs text-white/70">AI对话 · 深度思考</p>
          </div>
          <div className="text-white/50 text-sm">→</div>
        </button>
        
        <div className="relative px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleVoice}
              className={cn(
                "h-10 w-10 rounded-full shrink-0",
                isListening 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-white/20 hover:bg-white/30 text-white"
              )}
              data-testid="button-voice-input"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="对小智说点什么..."
              className="h-10 bg-white/20 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              disabled={isLoading}
              data-testid="input-quick-chat"
            />
            
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="h-10 w-10 rounded-full shrink-0 bg-white/30 hover:bg-white/40 text-white"
              data-testid="button-quick-send"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {mainModules.map((mod, i) => (
          <motion.button
            key={mod.path}
            onClick={() => setLocation(mod.path)}
            className={cn(
              "relative overflow-hidden rounded-lg p-3 sm:p-4",
              "bg-gradient-to-br", mod.color,
              "shadow-md hover:shadow-lg",
              "transition-all duration-200 hover:scale-105 active:scale-95",
              "touch-manipulation"
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2 }}
            data-testid={`button-module-${mod.path.slice(1)}`}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="relative flex flex-col items-center gap-2">
              <mod.icon className="w-6 h-6 text-white" />
              <span className="text-xs sm:text-sm font-medium text-white">{t(mod.labelKey)}</span>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">更多功能</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>
        <div className="flex flex-wrap gap-2">
          {utilModules.map((mod, i) => (
            <motion.button
              key={mod.path}
              onClick={() => setLocation(mod.path)}
              className={cn(
                "relative rounded-full px-3 py-1.5 sm:px-4 sm:py-2",
                "bg-card/80 border border-border/50",
                "hover:bg-card hover:border-primary/30",
                "transition-all duration-200 active:scale-95",
                "touch-manipulation group"
              )}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.03 }}
              whileHover={{ scale: 1.02 }}
              data-testid={`button-module-${mod.path.slice(1)}`}
            >
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "p-1 rounded-full bg-gradient-to-br transition-all",
                  mod.color,
                  "opacity-80 group-hover:opacity-100"
                )}>
                  <mod.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                  {t(mod.labelKey)}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
