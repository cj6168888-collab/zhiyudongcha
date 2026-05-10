import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Heart, Bell, AlertTriangle, RefreshCw, Trash2, Edit, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CareRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerCondition: any;
  actionType: string;
  actionConfig: any;
  priority: string;
  cooldownHours: number;
  isEnabled: boolean;
  isSystemRule: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface CareLog {
  id: string;
  ruleName: string;
  triggerType: string;
  actionType: string;
  actionResult: string;
  message: string;
  userResponse: string | null;
  createdAt: string;
}

export default function CareRulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CareRule | null>(null);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    triggerType: "HEALTH_EVENT",
    actionType: "DASHBOARD_BUBBLE",
    priority: "MEDIUM",
    cooldownHours: 24,
    message: "",
  });

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ["care-rules"],
    queryFn: async () => {
      const res = await fetch("/api/care/rules");
      return res.json();
    },
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["care-logs"],
    queryFn: async () => {
      const res = await fetch("/api/care/logs?limit=20");
      return res.json();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/care/scan", { method: "POST" });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "扫描完成",
        description: `检测到 ${data.eventsDetected} 个事件，触发 ${data.rulesTriggered} 条规则`,
      });
      queryClient.invalidateQueries({ queryKey: ["care-logs"] });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      const res = await fetch("/api/care/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "规则已创建" });
      queryClient.invalidateQueries({ queryKey: ["care-rules"] });
      setIsAddDialogOpen(false);
      setNewRule({
        name: "",
        description: "",
        triggerType: "HEALTH_EVENT",
        actionType: "DASHBOARD_BUBBLE",
        priority: "MEDIUM",
        cooldownHours: 24,
        message: "",
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await fetch(`/api/care/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/care/rules/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "规则已删除" });
      queryClient.invalidateQueries({ queryKey: ["care-rules"] });
    },
  });

  const handleCreateRule = () => {
    const rule = {
      name: newRule.name,
      description: newRule.description,
      triggerType: newRule.triggerType,
      triggerCondition: { eventType: newRule.triggerType },
      actionType: newRule.actionType,
      actionConfig: { message: newRule.message },
      priority: newRule.priority,
      cooldownHours: newRule.cooldownHours,
      isEnabled: true,
      isSystemRule: false,
    };
    createRuleMutation.mutate(rule);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "destructive";
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "secondary";
      case "LOW":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case "HEALTH_EVENT":
        return <Heart className="w-4 h-4 text-red-500" />;
      case "EMOTION_ANOMALY":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "CONTACT_IDLE":
        return <Bell className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const rules: CareRule[] = rulesData?.rules || [];
  const logs: CareLog[] = logsData?.logs || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">主动关怀规则</h1>
          <p className="text-muted-foreground">配置小智的主动关怀触发条件和动作</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            data-testid="button-scan"
          >
            <Play className="w-4 h-4 mr-2" />
            立即扫描
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-rule">
                <Plus className="w-4 h-4 mr-2" />
                新建规则
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>新建关怀规则</DialogTitle>
                <DialogDescription>设置触发条件和关怀动作</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">规则名称</Label>
                  <Input
                    id="name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="例如：工作压力关怀"
                    data-testid="input-rule-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">描述</Label>
                  <Input
                    id="description"
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="规则说明"
                    data-testid="input-rule-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>触发类型</Label>
                    <Select
                      value={newRule.triggerType}
                      onValueChange={(v) => setNewRule({ ...newRule, triggerType: v })}
                    >
                      <SelectTrigger data-testid="select-trigger-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HEALTH_EVENT">健康事件</SelectItem>
                        <SelectItem value="EMOTION_ANOMALY">情绪异常</SelectItem>
                        <SelectItem value="CONTACT_IDLE">联系人闲置</SelectItem>
                        <SelectItem value="CUSTOM">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>动作类型</Label>
                    <Select
                      value={newRule.actionType}
                      onValueChange={(v) => setNewRule({ ...newRule, actionType: v })}
                    >
                      <SelectTrigger data-testid="select-action-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DASHBOARD_BUBBLE">气泡提醒</SelectItem>
                        <SelectItem value="PUSH_NOTIFICATION">推送通知</SelectItem>
                        <SelectItem value="VOICE_REMINDER">语音提醒</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>优先级</Label>
                    <Select
                      value={newRule.priority}
                      onValueChange={(v) => setNewRule({ ...newRule, priority: v })}
                    >
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">低</SelectItem>
                        <SelectItem value="MEDIUM">中</SelectItem>
                        <SelectItem value="HIGH">高</SelectItem>
                        <SelectItem value="CRITICAL">紧急</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>冷却时间(小时)</Label>
                    <Input
                      type="number"
                      value={newRule.cooldownHours}
                      onChange={(e) => setNewRule({ ...newRule, cooldownHours: parseInt(e.target.value) || 24 })}
                      data-testid="input-cooldown"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message">关怀消息</Label>
                  <Textarea
                    id="message"
                    value={newRule.message}
                    onChange={(e) => setNewRule({ ...newRule, message: e.target.value })}
                    placeholder="触发时发送的消息内容"
                    data-testid="input-message"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
                <Button onClick={handleCreateRule} disabled={!newRule.name || createRuleMutation.isPending} data-testid="button-save-rule">
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                关怀规则列表
              </CardTitle>
              <CardDescription>共 {rules.length} 条规则</CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无规则</div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                        data-testid={`card-rule-${rule.id}`}
                      >
                        <div className="flex items-start gap-3">
                          {getTriggerIcon(rule.triggerType)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{rule.name}</span>
                              <Badge variant={getPriorityColor(rule.priority) as any}>
                                {rule.priority}
                              </Badge>
                              {rule.isSystemRule && (
                                <Badge variant="outline">系统</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {rule.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>冷却: {rule.cooldownHours}小时</span>
                              {rule.lastTriggeredAt && (
                                <span>
                                  上次触发: {new Date(rule.lastTriggeredAt).toLocaleString("zh-CN")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.isEnabled}
                            onCheckedChange={(checked) =>
                              toggleRuleMutation.mutate({ id: rule.id, isEnabled: checked })
                            }
                            data-testid={`switch-rule-${rule.id}`}
                          />
                          {!rule.isSystemRule && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              data-testid={`button-delete-${rule.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                最近触发日志
              </CardTitle>
              <CardDescription>最近20条触发记录</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无记录</div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="p-3 border rounded-lg text-sm" data-testid={`log-${log.id}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{log.ruleName}</span>
                          <Badge variant="outline">{log.actionResult}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs line-clamp-2">
                          {log.message}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
