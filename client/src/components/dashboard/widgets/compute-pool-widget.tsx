import { useZ1Store } from '@/lib/z1/god-protocol';

export function ComputePoolWidget() {
  const { hpBalance } = useZ1Store();

  return (
    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
      <div className="p-2 bg-secondary/30 rounded text-center">
        <div className="text-primary font-mono font-bold text-sm">{Math.round(hpBalance * 0.3)}</div>
        <div className="text-muted-foreground">推理</div>
      </div>
      <div className="p-2 bg-secondary/30 rounded text-center">
        <div className="text-primary font-mono font-bold text-sm">{Math.round(hpBalance * 0.25)}</div>
        <div className="text-muted-foreground">存储</div>
      </div>
      <div className="p-2 bg-secondary/30 rounded text-center">
        <div className="text-primary font-mono font-bold text-sm">{Math.round(hpBalance * 0.25)}</div>
        <div className="text-muted-foreground">同步</div>
      </div>
      <div className="p-2 bg-secondary/30 rounded text-center">
        <div className="text-primary font-mono font-bold text-sm">{Math.round(hpBalance * 0.2)}</div>
        <div className="text-muted-foreground">预留</div>
      </div>
    </div>
  );
}
