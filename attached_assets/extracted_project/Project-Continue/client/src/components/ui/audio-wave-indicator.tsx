import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioWaveIndicatorProps {
  isActive: boolean;
  analyser?: AnalyserNode | null;
  volumeLevel?: number;
  className?: string;
  barCount?: number;
  color?: string;
  height?: number;
}

export function AudioWaveIndicator({
  isActive,
  analyser,
  volumeLevel = 0,
  className,
  barCount = 5,
  color = "primary",
  height = 24,
}: AudioWaveIndicatorProps) {
  const [levels, setLevels] = useState<number[]>(Array(barCount).fill(0.2));
  const animationRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!isActive) {
      setLevels(Array(barCount).fill(0.2));
      return;
    }

    if (analyser) {
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      const analyze = () => {
        if (!analyser || !dataArrayRef.current) return;
        
        analyser.getByteFrequencyData(dataArrayRef.current);
        const binSize = Math.floor(dataArrayRef.current.length / barCount);
        const newLevels: number[] = [];
        
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          const startBin = i * binSize;
          for (let j = 0; j < binSize; j++) {
            sum += dataArrayRef.current[startBin + j];
          }
          const avg = sum / binSize / 255;
          newLevels.push(Math.max(0.15, Math.min(1, avg * 3)));
        }
        
        setLevels(newLevels);
        animationRef.current = requestAnimationFrame(analyze);
      };
      
      analyze();
    } else {
      const animate = () => {
        const base = volumeLevel || 0.3;
        const newLevels = Array.from({ length: barCount }, (_, i) => {
          const phase = Date.now() / 200 + i * 0.5;
          const wave = Math.sin(phase) * 0.3 + 0.5;
          return Math.max(0.15, Math.min(1, base * wave * 2));
        });
        setLevels(newLevels);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, analyser, volumeLevel, barCount]);

  if (!isActive) return null;

  const colorClass = color === "primary" 
    ? "bg-primary" 
    : color === "amber" 
    ? "bg-amber-400" 
    : `bg-${color}`;

  return (
    <div 
      className={cn(
        "flex items-center justify-center gap-[3px]",
        className
      )}
      style={{ height }}
      data-testid="audio-wave-indicator"
    >
      {levels.map((level, i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full transition-all duration-75",
            colorClass
          )}
          style={{
            height: `${Math.max(4, level * height)}px`,
            opacity: 0.6 + level * 0.4,
          }}
        />
      ))}
    </div>
  );
}

export function ListeningBanner({
  isListening,
  transcript,
  volumeLevel,
  analyser,
  onClose,
}: {
  isListening: boolean;
  transcript?: string;
  volumeLevel?: number;
  analyser?: AnalyserNode | null;
  onClose?: () => void;
}) {
  if (!isListening) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-primary/30 px-4 py-2"
      data-testid="listening-banner"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AudioWaveIndicator
            isActive={true}
            analyser={analyser}
            volumeLevel={volumeLevel}
            barCount={5}
            height={20}
            color="amber"
          />
          <span className="text-sm text-amber-400 font-medium">正在聆听...</span>
        </div>
        
        {transcript && (
          <div className="flex-1 text-sm text-muted-foreground truncate max-w-md">
            {transcript}
          </div>
        )}
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xs"
            data-testid="button-close-listening"
          >
            停止
          </button>
        )}
      </div>
    </div>
  );
}
