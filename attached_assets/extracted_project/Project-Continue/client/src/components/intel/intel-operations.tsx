import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileSearch, FolderInput, Shield, Trash2, 
  Eye, CheckCircle, AlertTriangle, Clock,
  ChevronRight, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type IntelPhase = 'INITIATE' | 'COLLECT' | 'AUDIT' | 'SHRED';

export interface IntelItem {
  id: string;
  title: string;
  source: string;
  category: string;
  status: IntelPhase;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: Date;
  content?: string;
  aiSummary?: string;
}

interface IntelOperationsProps {
  intel: IntelItem;
  onPhaseChange: (id: string, newPhase: IntelPhase) => void;
  onShred: (id: string) => void;
}

const PHASE_CONFIG: Record<IntelPhase, { 
  label: string; 
  icon: React.ReactNode; 
  color: string;
  nextPhase?: IntelPhase;
  nextLabel?: string;
}> = {
  INITIATE: {
    label: '待立项',
    icon: <FolderInput className="w-4 h-4" />,
    color: 'bg-blue-500',
    nextPhase: 'COLLECT',
    nextLabel: '开始搜集',
  },
  COLLECT: {
    label: '搜集中',
    icon: <FileSearch className="w-4 h-4" />,
    color: 'bg-amber-500',
    nextPhase: 'AUDIT',
    nextLabel: '提交审计',
  },
  AUDIT: {
    label: '审计中',
    icon: <Shield className="w-4 h-4" />,
    color: 'bg-purple-500',
    nextPhase: 'SHRED',
    nextLabel: '归档/粉碎',
  },
  SHRED: {
    label: '已处理',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-green-500',
  },
};

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-green-500/20 text-green-400',
  MEDIUM: 'bg-amber-500/20 text-amber-400',
  HIGH: 'bg-red-500/20 text-red-400',
};

export function IntelOperations({ intel, onPhaseChange, onShred }: IntelOperationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const phaseConfig = PHASE_CONFIG[intel.status];

  return (
    <Card 
      className={cn(
        "transition-all cursor-pointer hover:border-primary/50",
        isExpanded && "ring-1 ring-primary"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
      data-testid={`intel-card-${intel.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{intel.title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              来源: {intel.source}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={RISK_COLORS[intel.riskLevel]}>
              {intel.riskLevel === 'HIGH' && <AlertTriangle className="w-3 h-3 mr-1" />}
              {intel.riskLevel}
            </Badge>
            <Badge className={cn("text-white", phaseConfig.color)}>
              {phaseConfig.icon}
              <span className="ml-1">{phaseConfig.label}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 space-y-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {intel.createdAt.toLocaleString('zh-CN')}
            <span className="mx-1">·</span>
            <Badge variant="outline" className="text-[10px]">{intel.category}</Badge>
          </div>

          {intel.aiSummary && (
            <div className="p-2 rounded bg-secondary/50 text-sm">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Eye className="w-3 h-3" />
                AI摘要
              </div>
              {intel.aiSummary}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex gap-1">
              {(['INITIATE', 'COLLECT', 'AUDIT', 'SHRED'] as IntelPhase[]).map((phase, i) => (
                <div
                  key={phase}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i <= ['INITIATE', 'COLLECT', 'AUDIT', 'SHRED'].indexOf(intel.status)
                      ? PHASE_CONFIG[phase].color
                      : 'bg-muted'
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {phaseConfig.nextPhase && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onPhaseChange(intel.id, phaseConfig.nextPhase!)}
                  data-testid={`intel-next-${intel.id}`}
                >
                  {phaseConfig.nextLabel}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    data-testid={`intel-shred-${intel.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    粉碎
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认物理级粉碎？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作将永久删除情报「{intel.title}」，无法恢复。
                      根据Z1安全协议，粉碎操作将被记录到审计日志。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground"
                      onClick={() => onShred(intel.id)}
                    >
                      确认粉碎
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface IntelListProps {
  items: IntelItem[];
  onPhaseChange: (id: string, newPhase: IntelPhase) => void;
  onShred: (id: string) => void;
}

export function IntelList({ items, onPhaseChange, onShred }: IntelListProps) {
  const [filterPhase, setFilterPhase] = useState<IntelPhase | 'ALL'>('ALL');
  
  const filteredItems = filterPhase === 'ALL' 
    ? items 
    : items.filter(i => i.status === filterPhase);

  const phaseCounts = {
    INITIATE: items.filter(i => i.status === 'INITIATE').length,
    COLLECT: items.filter(i => i.status === 'COLLECT').length,
    AUDIT: items.filter(i => i.status === 'AUDIT').length,
    SHRED: items.filter(i => i.status === 'SHRED').length,
  };

  return (
    <div className="space-y-4" data-testid="intel-list">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Button
          size="sm"
          variant={filterPhase === 'ALL' ? 'default' : 'outline'}
          className="h-7 text-xs shrink-0"
          onClick={() => setFilterPhase('ALL')}
        >
          <Filter className="w-3 h-3 mr-1" />
          全部 ({items.length})
        </Button>
        {(['INITIATE', 'COLLECT', 'AUDIT', 'SHRED'] as IntelPhase[]).map(phase => (
          <Button
            key={phase}
            size="sm"
            variant={filterPhase === phase ? 'default' : 'outline'}
            className={cn("h-7 text-xs shrink-0", filterPhase === phase && PHASE_CONFIG[phase].color)}
            onClick={() => setFilterPhase(phase)}
          >
            {PHASE_CONFIG[phase].icon}
            <span className="ml-1">{PHASE_CONFIG[phase].label}</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {phaseCounts[phase]}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无情报
          </div>
        ) : (
          filteredItems.map(intel => (
            <IntelOperations
              key={intel.id}
              intel={intel}
              onPhaseChange={onPhaseChange}
              onShred={onShred}
            />
          ))
        )}
      </div>
    </div>
  );
}
