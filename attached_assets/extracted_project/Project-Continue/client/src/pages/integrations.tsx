import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft, Plus, Plug, RefreshCw, Trash2, CheckCircle, XCircle, Clock, Database, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { apiRequest } from "@/lib/queryClient";

interface IntegrationProvider {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  category: string;
  icon: string | null;
  description: string | null;
  capabilities: string[] | null;
  status: string | null;
}

interface IntegrationAccount {
  id: string;
  userId: string;
  providerId: string;
  name: string;
  status: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  syncEnabled: string | null;
}

const categoryIcons: Record<string, React.ReactNode> = {
  messaging: <MessageSquare className="w-5 h-5" />,
  database: <Database className="w-5 h-5" />,
};

const statusBadges: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  connected: { variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
  pending: { variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  error: { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
};

export default function IntegrationsPage() {
  const { role } = useZ1Store();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [accountName, setAccountName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const { data: providers = [], isLoading: loadingProviders } = useQuery<IntegrationProvider[]>({
    queryKey: ["/api/integrations/providers"],
  });

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<IntegrationAccount[]>({
    queryKey: ["/api/integrations/accounts"],
  });

  const seedProvidersMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/integrations/seed-providers", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/providers"] });
      toast({ title: "初始化成功", description: "默认提供商已创建" });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: { providerId: string; name: string; userId: string; credentials: object }) =>
      apiRequest("POST", "/api/integrations/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accounts"] });
      setShowAddDialog(false);
      setSelectedProvider("");
      setAccountName("");
      setCredentials({});
      toast({ title: "创建成功", description: "集成账户已添加" });
    },
    onError: () => {
      toast({ title: "创建失败", variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (accountId: string) =>
      apiRequest("POST", `/api/integrations/accounts/${accountId}/test`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accounts"] });
      toast({ title: "连接成功" });
    },
    onError: () => {
      toast({ title: "连接失败", variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (accountId: string) =>
      apiRequest("DELETE", `/api/integrations/accounts/${accountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accounts"] });
      toast({ title: "删除成功" });
    },
  });

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8" data-testid="access-denied-container">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Lock className="w-6 h-6" />
              权限不足
            </CardTitle>
            <CardDescription>
              此页面仅限主人访问
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLocation('/')} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getProviderById = (id: string) => providers.find(p => p.id === id);

  const handleAddAccount = () => {
    if (!selectedProvider || !accountName) return;
    createAccountMutation.mutate({
      providerId: selectedProvider,
      name: accountName,
      userId: "master",
      credentials,
    });
  };

  const credentialFields: Record<string, { label: string; type: string }[]> = {
    wecom: [
      { label: "企业ID (CorpId)", type: "text" },
      { label: "应用Secret", type: "password" },
      { label: "应用AgentId", type: "text" },
    ],
    dingtalk: [
      { label: "AppKey", type: "text" },
      { label: "AppSecret", type: "password" },
    ],
    lark: [
      { label: "App ID", type: "text" },
      { label: "App Secret", type: "password" },
    ],
    mysql: [
      { label: "主机地址", type: "text" },
      { label: "端口", type: "text" },
      { label: "数据库名", type: "text" },
      { label: "用户名", type: "text" },
      { label: "密码", type: "password" },
    ],
    postgres: [
      { label: "连接字符串 (DATABASE_URL)", type: "password" },
    ],
  };

  const selectedProviderCode = providers.find(p => p.id === selectedProvider)?.code || "";

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-24 md:pb-8" data-testid="integrations-page">
      <GlobalWakeHeader 
        title="外部系统连接" 
        subtitle="管理与企业微信、数据库等外部系统的连接"
      />

      {providers.length === 0 && !loadingProviders && (
        <Card className="mb-6 border-dashed" data-testid="card-init-providers">
          <CardContent className="py-8 text-center">
            <Plug className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">尚未初始化集成提供商</p>
            <Button 
              onClick={() => seedProvidersMutation.mutate()}
              disabled={seedProvidersMutation.isPending}
              data-testid="button-init-providers"
            >
              {seedProvidersMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              初始化默认提供商
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card data-testid="card-accounts">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>已连接账户</CardTitle>
                <CardDescription>管理您的外部系统连接</CardDescription>
              </div>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-account" disabled={providers.length === 0}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加连接
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-add-account">
                  <DialogHeader>
                    <DialogTitle>添加外部系统连接</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>选择系统类型</Label>
                      <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                        <SelectTrigger data-testid="select-provider">
                          <SelectValue placeholder="请选择..." />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.nameEn})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>连接名称</Label>
                      <Input
                        value={accountName}
                        onChange={e => setAccountName(e.target.value)}
                        placeholder="例如: 公司企业微信"
                        data-testid="input-account-name"
                      />
                    </div>
                    {selectedProviderCode && credentialFields[selectedProviderCode]?.map((field, idx) => (
                      <div key={idx} className="space-y-2">
                        <Label>{field.label}</Label>
                        <Input
                          type={field.type}
                          value={credentials[field.label] || ""}
                          onChange={e => setCredentials({ ...credentials, [field.label]: e.target.value })}
                          data-testid={`input-credential-${idx}`}
                        />
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)} data-testid="button-cancel">
                      取消
                    </Button>
                    <Button onClick={handleAddAccount} disabled={createAccountMutation.isPending} data-testid="button-save">
                      {createAccountMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                      保存
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-accounts">
                  暂无连接，点击上方按钮添加
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map(account => {
                    const provider = getProviderById(account.providerId);
                    const status = account.status || "pending";
                    const badge = statusBadges[status] || statusBadges.pending;
                    return (
                      <div 
                        key={account.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`account-item-${account.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {categoryIcons[provider?.category || "messaging"] || <Plug className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-medium">{account.name}</div>
                            <div className="text-sm text-muted-foreground">{provider?.name || "未知"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={badge.variant} className="flex items-center gap-1">
                            {badge.icon}
                            {status === "connected" ? "已连接" : status === "error" ? "错误" : "待验证"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testConnectionMutation.mutate(account.id)}
                            disabled={testConnectionMutation.isPending}
                            data-testid={`button-test-${account.id}`}
                          >
                            <RefreshCw className={`w-4 h-4 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAccountMutation.mutate(account.id)}
                            data-testid={`button-delete-${account.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card data-testid="card-providers">
            <CardHeader>
              <CardTitle>可用集成</CardTitle>
              <CardDescription>支持的外部系统类型</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProviders ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : providers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  请先初始化提供商
                </div>
              ) : (
                <div className="space-y-3">
                  {providers.map(provider => (
                    <div 
                      key={provider.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      data-testid={`provider-item-${provider.code}`}
                    >
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                        {categoryIcons[provider.category] || <Plug className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{provider.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{provider.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
