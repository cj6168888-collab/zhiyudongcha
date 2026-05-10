import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Shield,
  Key,
  AlertTriangle,
  Plus,
  Pause,
  XCircle,
  RefreshCw,
  Eye,
  Clock,
  Activity,
  FileText,
  Zap,
  Copy,
  CheckCircle
} from "lucide-react";

const CAPABILITIES = [
  { id: "TEXT_CHAT", label: "文字聊天", desc: "与小星进行文字对话" },
  { id: "VOICE_INTERACTION", label: "语音交互", desc: "语音对话功能" },
  { id: "CALENDAR_MANAGE", label: "日历管理", desc: "查看和创建日程" },
  { id: "CONTACT_LOOKUP", label: "联系人查询", desc: "搜索人脉网络" },
  { id: "REMINDER_SET", label: "设置提醒", desc: "创建提醒事项" },
  { id: "INSIGHT_VIEW", label: "查看洞察", desc: "查看智语洞察结果" },
  { id: "KNOWLEDGE_QUERY", label: "知识查询", desc: "搜索知识库" },
  { id: "KNOWLEDGE_ADD", label: "添加知识", desc: "向知识库添加内容" },
  { id: "MCTS_SIMULATE", label: "博弈推演", desc: "使用策略推演功能" },
  { id: "CONTRACT_DRAFT", label: "起草合同", desc: "使用合同起草功能" },
];

export default function SwarmConsole() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("entities");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const [newClone, setNewClone] = useState({
    name: "",
    type: "CLONE",
    capabilities: [] as string[],
    expiresIn: 7 * 24 * 60 * 60 * 1000,
    maxSessions: 5,
  });

  const { data: entities, isLoading: entitiesLoading } = useQuery<{ entities: any[]; count: number }>({
    queryKey: ["/api/swarm/entities"],
  });

  const { data: tokens } = useQuery<{ tokens: any[]; count: number }>({
    queryKey: ["/api/swarm/tokens"],
  });

  const { data: stats } = useQuery<{ totalEntities: number; activeClones: number; activeTokens: number; requests24h: number }>({
    queryKey: ["/api/swarm/stats"],
  });

  const { data: auditLogs } = useQuery<{ logs: any[]; count: number }>({
    queryKey: ["/api/swarm/audit"],
  });

  const createCloneMutation = useMutation({
    mutationFn: async (data: typeof newClone) => {
      const res = await fetch("/api/swarm/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("创建失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/stats"] });
      setCreateDialogOpen(false);
      setNewClone({ name: "", type: "CLONE", capabilities: [], expiresIn: 7 * 24 * 60 * 60 * 1000, maxSessions: 5 });
      toast({ title: "分身已创建", description: "新的分身实体已成功创建" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await fetch(`/api/swarm/entities/${entityId}/suspend`, { method: "POST" });
      if (!res.ok) throw new Error("暂停失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/entities"] });
      toast({ title: "已暂停", description: "分身已暂停使用" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await fetch(`/api/swarm/entities/${entityId}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error("召回失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/entities"] });
      toast({ title: "已召回", description: "分身已永久停用" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await fetch(`/api/swarm/entities/${entityId}/reactivate`, { method: "POST" });
      if (!res.ok) throw new Error("激活失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/entities"] });
      toast({ title: "已激活", description: "分身已重新激活" });
    },
  });

  const issueTokenMutation = useMutation({
    mutationFn: async (data: { entityId: string; type: string; expiresIn: number }) => {
      const res = await fetch("/api/swarm/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("签发失败");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/tokens"] });
      toast({
        title: "令牌已签发",
        description: `令牌: ${data.token?.token?.substring(0, 20)}...`
      });
    },
  });

  const emergencyRecallMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/swarm/emergency-recall", { method: "POST" });
      if (!res.ok) throw new Error("紧急召回失败");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/entities"] });
      toast({
        title: "紧急召回完成",
        description: `已召回 ${data.recalled} 个分身`,
        variant: "destructive"
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-500/20 text-green-400";
      case "SUSPENDED": return "bg-yellow-500/20 text-yellow-400";
      case "EXPIRED": return "bg-gray-500/20 text-gray-400";
      case "REVOKED": return "bg-red-500/20 text-red-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "MASTER": return "主体";
      case "CLONE": return "分身";
      case "AGENT": return "代理";
      case "OBSERVER": return "观察者";
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-amber-400 flex items-center gap-3">
              <Users className="w-8 h-8" />
              蜂群控制台
            </h1>
            <p className="text-gray-400 mt-1">管理小星分身实体、权限令牌和团队</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                  <Plus className="w-4 h-4 mr-2" />
                  创建分身
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-amber-400">创建新分身</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label htmlFor="分身名称" className="text-sm text-gray-400">分身名称</label>
                    <Input
                      value={newClone.name}
                      onChange={(e) => setNewClone({ ...newClone, name: e.target.value })}
                      placeholder="例如: 助理小星"
                      className="bg-slate-800 border-slate-600 mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="类型" className="text-sm text-gray-400">类型</label>
                    <Select value={newClone.type} onValueChange={(v) => setNewClone({ ...newClone, type: v })}>
                      <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="CLONE">分身 (功能受限)</SelectItem>
                        <SelectItem value="AGENT">代理 (特定任务)</SelectItem>
                        <SelectItem value="OBSERVER">观察者 (只读)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="有效期" className="text-sm text-gray-400">有效期</label>
                    <Select
                      value={String(newClone.expiresIn)}
                      onValueChange={(v) => setNewClone({ ...newClone, expiresIn: Number(v) })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value={String(24 * 60 * 60 * 1000)}>1天</SelectItem>
                        <SelectItem value={String(7 * 24 * 60 * 60 * 1000)}>7天</SelectItem>
                        <SelectItem value={String(30 * 24 * 60 * 60 * 1000)}>30天</SelectItem>
                        <SelectItem value={String(365 * 24 * 60 * 60 * 1000)}>1年</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="能力授权" className="text-sm text-gray-400 block mb-2">能力授权</label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {CAPABILITIES.map((cap) => (
                        <div key={cap.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={cap.id}
                            checked={newClone.capabilities.includes(cap.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewClone({ ...newClone, capabilities: [...newClone.capabilities, cap.id] });
                              } else {
                                setNewClone({ ...newClone, capabilities: newClone.capabilities.filter(c => c !== cap.id) });
                              }
                            }}
                          />
                          <label htmlFor={cap.id} className="text-sm cursor-pointer">{cap.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
                  <Button
                    className="bg-amber-500 hover:bg-amber-600 text-black"
                    onClick={() => createCloneMutation.mutate(newClone)}
                    disabled={!newClone.name || newClone.capabilities.length === 0}
                  >
                    创建
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="destructive"
              onClick={() => emergencyRecallMutation.mutate()}
              disabled={emergencyRecallMutation.isPending}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              紧急召回全部
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">总实体数</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalEntities || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">活跃分身</p>
                  <p className="text-2xl font-bold text-green-400">{stats?.activeClones || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">活跃令牌</p>
                  <p className="text-2xl font-bold text-amber-400">{stats?.activeTokens || 0}</p>
                </div>
                <Key className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">24h请求</p>
                  <p className="text-2xl font-bold text-purple-400">{stats?.requests24h || 0}</p>
                </div>
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="entities" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              实体管理
            </TabsTrigger>
            <TabsTrigger value="tokens" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <Key className="w-4 h-4 mr-2" />
              令牌管理
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <FileText className="w-4 h-4 mr-2" />
              审计日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">分身实体列表</CardTitle>
                <CardDescription>管理所有小星分身实例</CardDescription>
              </CardHeader>
              <CardContent>
                {entitiesLoading ? (
                  <p className="text-gray-400">加载中...</p>
                ) : (
                  <div className="space-y-3">
                    {entities?.entities?.map((entity: any) => (
                      <div
                        key={entity.id}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            entity.type === 'MASTER' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                          }`}>
                            {entity.type === 'MASTER' ? (
                              <Shield className="w-5 h-5 text-amber-400" />
                            ) : (
                              <Users className="w-5 h-5 text-blue-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{entity.name}</span>
                              <Badge variant="outline" className={getStatusColor(entity.status)}>
                                {entity.status}
                              </Badge>
                              <Badge variant="outline" className="bg-slate-700/50">
                                {getTypeLabel(entity.type)}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              能力: {entity.capabilities?.slice(0, 3).join(", ")}
                              {entity.capabilities?.length > 3 && ` +${entity.capabilities.length - 3}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entity.type !== 'MASTER' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedEntity(entity.id);
                                  setTokenDialogOpen(true);
                                }}
                              >
                                <Key className="w-4 h-4 mr-1" />
                                签发令牌
                              </Button>
                              {entity.status === 'ACTIVE' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => suspendMutation.mutate(entity.id)}
                                >
                                  <Pause className="w-4 h-4 mr-1" />
                                  暂停
                                </Button>
                              )}
                              {entity.status === 'SUSPENDED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reactivateMutation.mutate(entity.id)}
                                >
                                  <RefreshCw className="w-4 h-4 mr-1" />
                                  激活
                                </Button>
                              )}
                              {entity.status !== 'REVOKED' && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => revokeMutation.mutate(entity.id)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  召回
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!entities?.entities || entities.entities.length === 0) && (
                      <p className="text-gray-400 text-center py-8">暂无分身实体</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tokens" className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">访问令牌</CardTitle>
                <CardDescription>管理分身的访问令牌</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tokens?.tokens?.map((token: any) => (
                    <div
                      key={token.id}
                      className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-4">
                        <Key className="w-5 h-5 text-amber-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-white">{token.id}</span>
                            <Badge variant="outline" className={getStatusColor(token.status)}>
                              {token.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            类型: {token.type} | 使用: {token.usageCount}/{token.maxUsage || '∞'}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        <Clock className="w-4 h-4 inline mr-1" />
                        过期: {new Date(token.expiresAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  ))}
                  {(!tokens?.tokens || tokens.tokens.length === 0) && (
                    <p className="text-gray-400 text-center py-8">暂无令牌</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">审计日志</CardTitle>
                <CardDescription>追踪所有分身操作</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLogs?.logs?.slice(0, 20).map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700/50"
                    >
                      <div className="flex items-center gap-3">
                        {log.outcome === 'SUCCESS' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <div>
                          <span className="text-white text-sm">{log.action}</span>
                          <span className="text-gray-400 text-sm ml-2">- {log.resource}</span>
                        </div>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                  {(!auditLogs?.logs || auditLogs.logs.length === 0) && (
                    <p className="text-gray-400 text-center py-8">暂无日志</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-amber-400">签发访问令牌</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="令牌类型" className="text-sm text-gray-400">令牌类型</label>
                <Select defaultValue="SESSION">
                  <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="SESSION">会话令牌</SelectItem>
                    <SelectItem value="API">API令牌</SelectItem>
                    <SelectItem value="ONETIME">一次性令牌</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="有效期" className="text-sm text-gray-400">有效期</label>
                <Select defaultValue="86400000">
                  <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="3600000">1小时</SelectItem>
                    <SelectItem value="86400000">24小时</SelectItem>
                    <SelectItem value="604800000">7天</SelectItem>
                    <SelectItem value="2592000000">30天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>取消</Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-black"
                onClick={() => {
                  if (selectedEntity) {
                    issueTokenMutation.mutate({
                      entityId: selectedEntity,
                      type: "SESSION",
                      expiresIn: 86400000,
                    });
                    setTokenDialogOpen(false);
                  }
                }}
              >
                签发
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
