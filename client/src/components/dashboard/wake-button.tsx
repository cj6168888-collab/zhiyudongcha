import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MousePointerClick, Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function WakeButton() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isListening, setIsListening] = useState(false);
  const [wakeStatus, setWakeStatus] = useState<'idle' | 'listening' | 'detected' | 'error'>('idle');
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const wakeStatusRef = useRef<'idle' | 'listening' | 'detected' | 'error'>('idle');

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    wakeStatusRef.current = wakeStatus;
  }, [wakeStatus]);

  const handleClickWake = () => {
    setLocation('/talk');
  };

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (wakeStatusRef.current !== 'detected') {
      setWakeStatus('idle');
    }
  }, []);

  const handleVoiceWake = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setWakeStatus('error');
      setTimeout(() => setWakeStatus('idle'), 2000);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListeningRef.current = true;
      wakeStatusRef.current = 'listening';
      setIsListening(true);
      setWakeStatus('listening');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');

      const wakeWords = ['小星', '小星小星', '唤醒小星', '你好小星'];
      const detected = wakeWords.some(word => transcript.includes(word));

      if (detected) {
        wakeStatusRef.current = 'detected';
        setWakeStatus('detected');
        stopListening();
        setTimeout(() => {
          setLocation('/talk');
        }, 500);
      }
    };

    recognition.onerror = () => {
      wakeStatusRef.current = 'error';
      isListeningRef.current = false;
      setWakeStatus('error');
      setIsListening(false);
      setTimeout(() => {
        wakeStatusRef.current = 'idle';
        setWakeStatus('idle');
      }, 2000);
    };

    recognition.onend = () => {
      if (isListeningRef.current && wakeStatusRef.current === 'listening') {
        try {
          recognition.start();
        } catch (e) {
          isListeningRef.current = false;
          wakeStatusRef.current = 'idle';
          setIsListening(false);
          setWakeStatus('idle');
        }
      } else if (wakeStatusRef.current !== 'detected') {
        isListeningRef.current = false;
        setIsListening(false);
        setWakeStatus('idle');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [setLocation, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-primary/20 p-6">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />

      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-lg border-2 border-primary/30"
                animate={{
                  scale: [1, 1.1, 1.2],
                  opacity: [0.5, 0.3, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.6,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="text-center">
          <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            {t('wake.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('wake.subtitle')}
          </p>
        </div>

        <div className="flex gap-4 w-full justify-center">
          <Button
            size="lg"
            onClick={handleClickWake}
            className="flex-1 max-w-[160px] h-16 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-105"
            data-testid="button-wake-click"
          >
            <div className="flex flex-col items-center gap-1">
              <MousePointerClick className="w-5 h-5" />
              <span className="text-xs">{t('wake.click')}</span>
            </div>
          </Button>

          <Button
            size="lg"
            variant={isListening ? "destructive" : "outline"}
            onClick={handleVoiceWake}
            className={cn(
              "flex-1 max-w-[160px] h-16 transition-all hover:scale-105",
              isListening && "animate-pulse bg-red-500 hover:bg-red-600",
              wakeStatus === 'detected' && "bg-green-500 hover:bg-green-600",
              wakeStatus === 'error' && "bg-yellow-500 hover:bg-yellow-600"
            )}
            data-testid="button-wake-voice"
          >
            <div className="flex flex-col items-center gap-1">
              {wakeStatus === 'listening' ? (
                <Volume2 className="w-5 h-5 animate-pulse" />
              ) : wakeStatus === 'detected' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
              <span className="text-xs">
                {wakeStatus === 'listening' ? t('wake.listening') :
                 wakeStatus === 'detected' ? t('wake.detected') :
                 wakeStatus === 'error' ? t('wake.error') :
                 t('wake.voice')}
              </span>
            </div>
          </Button>
        </div>

        {isListening && (
          <p className="text-xs text-muted-foreground animate-pulse">
            {t('wake.hint')}
          </p>
        )}
      </div>
    </Card>
  );
}
