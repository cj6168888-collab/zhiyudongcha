import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  Brain,
  TrendingUp,
  AlertTriangle,
  FileText,
  Search,
  Sparkles,
  Check,
  Clock,
  FolderPlus,
  RefreshCw,
  GitBranch,
  Pause,
  Trash2
} from "lucide-react";
import type { Inspiration } from "@/shared/types";

const TYPE_CONFIG = {
  idea: { icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-400/10", label: "想法" },
  opportunity: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10", label: "商机" },
  trend: { icon: Brain, color: "text-blue-400", bg: "bg-blue-400/10", label: "趋势" },
  warning: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10", label: "风险" },
};

const STATUS_CONFIG = {
  draft: { label: "草稿", color: "text-muted-foreground", bg: "bg-muted", icon: FileText },
  researching: { label: "研究中", color: "text-blue-400", bg: "bg-blue-400/10", icon: Search },
  refined: { label: "已完善", color: "text-amber-400", bg: "bg-amber-400/10", icon: Sparkles },
  confirmed: { label: "已确认", color: "text-green-400", bg: "bg-green-400/10", icon: Check },
  archived: { label: "已归档", color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
};

type DecisionAction = 'approve' | 'refine' | 'deduce' | 'pause' | 'discard';

function InspirationCard({ item, onAction, isUpdating }: {
  item: Inspiration;
  onAction: (id: string, action: DecisionAction) => void;
  isUpdating: boolean;
}) {
  const typeConfig = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.idea;
  const statusConfig = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="bg-card/50 border-primary/20 hover:border-primary/40 transition-all" data-testid={`inspiration-card-${item.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", typeConfig.bg)}>
            <TypeIcon className={cn("h-5 w-5", typeConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {item.source === "AI" ? "小星洞察" : "主人灵感"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {item.content && (
          <p className="text-sm text-muted-foreground">{item.content}</p>
        )}
        {item.aiSummary && (
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
            <div className="flex items-center gap-2 text-xs text-primary mb-1">
              <Brain className="h-3 w-3" />
              小星总结
            </div>
            <p className="text-sm">{item.aiSummary}</p>
          </div>
        )}
        {item.aiRefinedPlan && (
          <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
            <div className="flex items-center gap-2 text-xs text-amber-400 mb-1">
              <Sparkles className="h-3 w-3" />
              完善方案
            </div>
            <p className="text-sm">{item.aiRefinedPlan}</p>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground/50">
          {new Date(item.createdAt!).toLocaleString('zh-CN')}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="text-green-400 border-green-400/30 hover:bg-green-400/10"
            data-testid={`button-approve-${item.id}`}
            disabled={isUpdating}
            onClick={() => onAction(item.id, 'approve')}
          >
            <FolderPlus className="h-3 w-3 mr-1" />
            立项
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
            data-testid={`button-refine-${item.id}`}
            disabled={isUpdating}
            onClick={() => onAction(item.id, 'refine')}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            完善
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-purple-400 border-purple-400/30 hover:bg-purple-400/10"
            data-testid={`button-deduce-${item.id}`}
            disabled={isUpdating}
            onClick={() => onAction(item.id, 'deduce')}
          >
            <GitBranch className="h-3 w-3 mr-1" />
            推演
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-amber-400 border-amber-400/30 hover:bg-amber-400/10"
            data-testid={`button-pause-${item.id}`}
            disabled={isUpdating}
            onClick={() => onAction(item.id, 'pause')}
          >
            <Pause className="h-3 w-3 mr-1" />
            暂缓
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
            data-testid={`button-discard-${item.id}`}
            disabled={isUpdating}
            onClick={() => onAction(item.id, 'discard')}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            放弃
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const ACTION_TO_STATUS: Record<DecisionAction, string> = {
  approve: 'confirmed',
  refine: 'researching',
  deduce: 'researching',
  pause: 'archived',
  discard: 'archived',
};

const ACTION_LABELS: Record<DecisionAction, string> = {
  approve: '立项',
  refine: '完善',
  deduce: '推演',
  pause: '暂缓',
  discard: '放弃',
};

export default function InspirationPage() {
  const queryClient = useQueryClient();

  const { data: inspirations = [], isLoading } = useQuery<Inspiration[]>({
    queryKey: ["/api/inspirations"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: DecisionAction }) => {
      const status = ACTION_TO_STATUS[action];
      return apiRequest('PATCH', `/api/inspirations/${id}`, { status });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspirations"] });
      toast.success(`已${ACTION_LABELS[action]}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`操作失败: ${message}`);
    },
  });

  const handleAction = (id: string, action: DecisionAction) => {
    updateMutation.mutate({ id, action });
  };

  const aiInsights = inspirations.filter(i => i.source === "AI");
  const masterIdeas = inspirations.filter(i => i.source === "MASTER");

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <GlobalWakeHeader
          title="灵感"
          subtitle="小星分析发现的灵光一闪，等待主人决策"
        />

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">加载中...</div>
        ) : inspirations.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-lg text-muted-foreground">暂无灵感汇报</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              小星正在后台分析，发现灵感后会在这里汇报
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {aiInsights.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-400" />
                  小星洞察
                  <Badge variant="secondary">{aiInsights.length}</Badge>
                </h2>
                <div className="space-y-3">
                  {aiInsights.map(item => (
                    <InspirationCard key={item.id} item={item} onAction={handleAction} isUpdating={updateMutation.isPending} />
                  ))}
                </div>
              </div>
            )}

            {masterIdeas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-400" />
                  主人灵感
                  <Badge variant="secondary">{masterIdeas.length}</Badge>
                </h2>
                <div className="space-y-3">
                  {masterIdeas.map(item => (
                    <InspirationCard key={item.id} item={item} onAction={handleAction} isUpdating={updateMutation.isPending} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
