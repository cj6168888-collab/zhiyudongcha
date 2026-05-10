import { useZ1Store, MAX_HP } from '@/lib/z1/god-protocol';
import { HpRing, HpBar } from '@/components/ui/hp-ring';
import { SpriteAvatar } from '@/components/ui/sprite-avatar';
import { Cpu, Server } from 'lucide-react';

type AcademicLevel = 'BACHELOR' | 'MASTER' | 'PHD' | 'EXPERT' | 'SAGE';

function getAcademicLevel(hp: number): AcademicLevel {
  if (hp >= 800) return 'SAGE';
  if (hp >= 600) return 'EXPERT';
  if (hp >= 400) return 'PHD';
  if (hp >= 200) return 'MASTER';
  return 'BACHELOR';
}

export function HpWidget() {
  const { hpBalance, serverNode } = useZ1Store();
  const academicLevel = getAcademicLevel(hpBalance);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <SpriteAvatar
          level={academicLevel}
          state="idle"
          hp={hpBalance}
          maxHp={MAX_HP}
          size="md"
        />
        <div className="flex-1">
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-xl font-mono font-bold text-foreground">{hpBalance}</span>
            <span className="text-xs text-muted-foreground">/ {MAX_HP} HP</span>
          </div>
          <HpBar current={hpBalance} max={MAX_HP} className="mb-2" />
          <div className="text-[10px] text-muted-foreground font-mono">
            学术等级: <span className="text-primary">{academicLevel}</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 p-2 bg-secondary/30 rounded">
          <Server className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">节点</span>
          <span className="ml-auto font-mono text-[10px]">{serverNode.ip.split('.').slice(-2).join('.')}</span>
        </div>
        <div className="flex items-center gap-1.5 p-2 bg-secondary/30 rounded">
          <Cpu className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">状态</span>
          <span className="ml-auto text-green-400">在线</span>
        </div>
      </div>
    </div>
  );
}
