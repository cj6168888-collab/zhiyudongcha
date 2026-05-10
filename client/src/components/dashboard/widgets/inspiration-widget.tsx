import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lightbulb,
  Brain,
  TrendingUp,
  AlertTriangle,
  Send,
  Check,
  Clock,
  Search,
  FileText,
  Sparkles,
  Plus,
  ChevronRight
} from "lucide-react";
import type { Inspiration } from "@/shared/types";
import { apiRequest } from "@/lib/queryClient";

const TYPE_CONFIG = {
  idea: { icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-400/10", label: "想法" },
  opportunity: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10", label: "商机" },
  trend: { icon: Brain, color: "text-blue-400", bg: "bg-blue-400/10", label: "趋势" },
  warning: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10", label: "风险" },
};

const STATUS_CONFIG = {
  draft: { label: "草稿", color: "text-muted-foreground", icon: FileText },
  researching: { label: "研究中", color: "text-blue-400", icon: Search },
  refined: { label: "已完善", color: "text-amber-400", icon: Sparkles },
  confirmed: { label: "已确认", color: "text-green-400", icon: Check },
  archived: { label: "已归档", color: "text-muted-foreground", icon: Clock },
};

function InspirationCard({ item, onSelect }: { item: Inspiration; onSelect: () => void }) {
  const typeConfig = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.idea;
  const statusConfig = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-3 rounded-lg border border-primary/20 bg-card/50 hover:bg-card/80 cursor-pointer transition-all",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
      )}
      data-testid={`inspiration-card-${item.id}`}
    >
      <div className="flex items-start gap-2">
        <div className={cn("p-1.5 rounded-md", typeConfig.bg)}>
          <TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium truncate">{item.title}</h4>
            <Badge variant="outline" className={cn("text-[10px] h-4", statusConfig.color)}>
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {statusConfig.label}
            </Badge>
          </div>
          {item.aiSummary && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{item.aiSummary}</p>
          )}
          {!item.aiSummary && item.content && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
      </div>
    </div>
  );
}

function NewIdeaForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      return apiRequest("POST", "/api/inspirations", {
        source: "MASTER",
        type: "idea",
        title: data.title,
        content: data.content,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspirations"] });
      setTitle("");
      setContent("");
      onSuccess();
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim(), content: content.trim() });
  };

  return (
    <div className="space-y-2" data-testid="new-idea-form">
      <Input
        placeholder="灵感标题..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm"
        data-testid="input-idea-title"
      />
      <Textarea
        placeholder="描述你的想法，小星会帮你研究和完善..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[60px] text-sm resize-none"
        data-testid="input-idea-content"
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!title.trim() || createMutation.isPending}
        className="w-full"
        data-testid="button-submit-idea"
      >
        <Send className="h-3 w-3 mr-1" />
        {createMutation.isPending ? "提交中..." : "告诉小星"}
      </Button>
    </div>
  );
}

export function InspirationWidget() {
  const [activeTab, setActiveTab] = useState<"ai" | "master">("ai");
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: inspirations = [], isLoading } = useQuery<Inspiration[]>({
    queryKey: ["/api/inspirations"],
  });

  const aiInsights = inspirations.filter(i => i.source === "AI");
  const masterIdeas = inspirations.filter(i => i.source === "MASTER");

  const unreadAiCount = aiInsights.filter(i => !i.isRead).length;
  const pendingMasterCount = masterIdeas.filter(i => i.status !== "confirmed" && i.status !== "archived").length;

  return (
    <div className="space-y-3" data-testid="card-inspiration">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ai" | "master")}>
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="ai" className="text-xs gap-1" data-testid="tab-ai-insights">
            <Brain className="h-3 w-3" />
            小星洞察
            {unreadAiCount > 0 && (
              <Badge variant="destructive" className="h-4 min-w-4 text-[10px] px-1">
                {unreadAiCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="master" className="text-xs gap-1" data-testid="tab-master-ideas">
            <Lightbulb className="h-3 w-3" />
            主人灵感
            {pendingMasterCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 text-[10px] px-1">
                {pendingMasterCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-3 space-y-2">
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">加载中...</div>
          ) : aiInsights.length === 0 ? (
            <div className="text-center py-6" data-testid="empty-ai-insights">
              <Brain className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">暂无AI洞察</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                小星正在分析数据，发现商机后会第一时间通知主人
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {aiInsights.slice(0, 5).map(item => (
                <InspirationCard
                  key={item.id}
                  item={item}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="master" className="mt-3 space-y-2">
          {showNewForm ? (
            <NewIdeaForm onSuccess={() => setShowNewForm(false)} />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewForm(true)}
              className="w-full border-dashed border-primary/30 hover:border-primary/50"
              data-testid="button-new-idea"
            >
              <Plus className="h-3 w-3 mr-1" />
              我有一个想法...
            </Button>
          )}

          {!showNewForm && (
            <>
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground text-sm">加载中...</div>
              ) : masterIdeas.length === 0 ? (
                <div className="text-center py-4" data-testid="empty-master-ideas">
                  <Lightbulb className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
                  <p className="text-[11px] text-muted-foreground">
                    点击上方按钮，把灵感告诉小星
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {masterIdeas.slice(0, 5).map(item => (
                    <InspirationCard
                      key={item.id}
                      item={item}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
