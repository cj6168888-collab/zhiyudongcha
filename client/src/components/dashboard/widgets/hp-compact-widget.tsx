import { useZ1Store, MAX_HP } from '@/lib/z1/god-protocol';
import { Cpu, Zap } from 'lucide-react';

export function HpCompactWidget() {
  const { hpBalance } = useZ1Store();
  const percentage = Math.round((hpBalance / MAX_HP) * 100);
  
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2 bg-card/50 border border-primary/20 rounded-lg backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-mono font-bold text-foreground">{hpBalance}</span>
        <span className="text-[10px] text-muted-foreground">HP</span>
      </div>
      <div className="hidden sm:block h-4 w-px bg-border" />
      <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>推理 {Math.round(hpBalance * 0.3)}</span>
        <span>•</span>
        <span>存储 {Math.round(hpBalance * 0.25)}</span>
        <span>•</span>
        <span>同步 {Math.round(hpBalance * 0.25)}</span>
      </div>
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <Cpu className="w-3 h-3 text-green-400" />
        <span className="text-[10px] text-green-400">在线</span>
      </div>
    </div>
  );
}
