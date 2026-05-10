import { useZ1Store } from "@/lib/z1/god-protocol";
import { Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function HpMonitor() {
  const hpBalance = useZ1Store((state) => state.hpBalance);
  const maxHp = 1000;
  const percentage = (hpBalance / maxHp) * 100;
  const isLow = percentage < 20;

  const segments = [100, 80, 60, 40, 20, 0];

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
      <div className="relative h-32 w-6 bg-secondary rounded-full overflow-hidden">
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 transition-all duration-500",
            isLow ? "bg-destructive" : "bg-primary"
          )}
          style={{ height: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex flex-col justify-between py-1">
          {segments.map((val) => (
            <div key={val} className="flex items-center justify-end pr-1">
              <span className="text-[8px] text-muted-foreground">{val}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col justify-between h-32">
        <div className="flex items-center gap-1.5">
          <Zap className={cn("w-4 h-4", isLow ? "text-destructive" : "text-primary")} />
          <span className="text-xs font-medium text-muted-foreground">算力</span>
        </div>
        
        <div className="space-y-1">
          <span className={cn("font-mono text-xl font-bold block", isLow ? "text-destructive" : "text-foreground")}>
            {hpBalance}
          </span>
          <span className="text-[10px] text-muted-foreground block">/ {maxHp} HP</span>
        </div>
        
        {isLow && (
          <div className="flex items-center gap-1 text-[10px] text-destructive animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            <span>需充能</span>
          </div>
        )}
      </div>
    </div>
  );
}
