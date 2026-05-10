import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { BrainCircuit, MicOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListeningBanner } from "@/components/ui/audio-wave-indicator";
import { useVoiceWake } from "@/hooks/use-voice-wake";

interface GlobalWakeHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  rightActions?: ReactNode;
}

export function GlobalWakeHeader({ 
  title,
  subtitle,
  showBack = true,
  backPath = "/",
  rightActions 
}: GlobalWakeHeaderProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { isListening, transcript, analyser, toggleListening, stopListening } = useVoiceWake();

  return (
    <>
      <ListeningBanner
        isListening={isListening}
        transcript={transcript}
        analyser={analyser}
        onClose={stopListening}
      />
      
      <header className={`flex flex-wrap justify-between items-center gap-2 mb-4 border-b border-border pb-3 overflow-hidden ${isListening ? 'mt-12' : ''}`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {showBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation(backPath)} 
              data-testid="button-back"
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity group min-w-0"
            onClick={toggleListening}
            data-testid="button-wake-header"
          >
            {isListening ? (
              <MicOff className="w-6 h-6 sm:w-7 sm:h-7 text-red-500 group-hover:scale-110 transition-transform shrink-0" />
            ) : (
              <BrainCircuit className="w-6 h-6 sm:w-7 sm:h-7 text-primary animate-pulse group-hover:scale-110 transition-transform shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-semibold truncate">
                  {title || t('system.name')}
                </h1>
                <span className={`text-[10px] animate-pulse whitespace-nowrap ${isListening ? 'text-red-400' : 'text-amber-400'}`}>
                  {isListening ? '停止' : '唤醒'}
                </span>
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-none">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
        
        {rightActions && (
          <div className="flex gap-1 sm:gap-2 items-center shrink-0">
            {rightActions}
          </div>
        )}
      </header>
    </>
  );
}
