import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Server, 
  Plus,
  Trash2,
  Settings2, 
  RefreshCw,
  TestTube,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Monitor,
  Sparkles
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, parseApiJson } from '@/lib/queryClient';

interface ServerConfig {
  endpoint: string;
  model: string;
  name?: string;
  gpuMemoryMB?: number;
  ramMB?: number;
  cpuCores?: number;
  maxConcurrent?: number;
  enabled?: boolean;
  healthy?: boolean;
  taskType?: 'CHAT' | 'SCREEN_OPERATION' | 'COMPLEX_ANALYSIS' | 'EXPERT';
}

interface ServerListResponse {
  servers?: ServerConfig[];
  healthyCount?: number;
}

interface ModelStatusResponse {
  status?: {
    preferredProvider?: string;
  };
}

interface MutationResponse {
  success?: boolean;
  error?: string;
  hint?: string;
  response?: string;
}

export function GpuServerSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [serverForm, setServerForm] = useState({
    endpoint: 'http://192.168.1.100:11434',
    model: 'qwen2:72b',
    name: '我的GPU服务器',
    gpuMemoryMB: 16384,
    ramMB: 32768,
    cpuCores: 8,
    taskType: 'CHAT' as 'CHAT' | 'SCREEN_OPERATION',
  });

  const MODEL_PRESETS = {
    CHAT: [
      { value: 'qwen2:72b', label: 'Qwen2-72B (推荐)', vram: '48GB+' },
      { value: 'qwen2:32b', label: 'Qwen2-32B', vram: '24GB+' },
      { value: 'qwen2:14b', label: 'Qwen2-14B', vram: '12GB+' },
      { value: 'qwen2:7b', label: 'Qwen2-7B', vram: '8GB+' },
      { value: 'deepseek-v2:16b', label: 'DeepSeek-V2-16B', vram: '12GB+' },
    ],
    SCREEN_OPERATION: [
      { value: 'autoglm:9b', label: 'AutoGLM-9B (推荐)', vram: '16GB+' },
      { value: 'qwen2-vl:7b', label: 'Qwen2-VL-7B', vram: '12GB+' },
      { value: 'cogagent:18b', label: 'CogAgent-18B', vram: '24GB+' },
    ],
  };

  const { data: serversData, refetch } = useQuery({
    queryKey: ['/api/servers'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/servers');
      return parseApiJson<ServerListResponse>(res, 'GPU 服务器列表接口');
    },
    refetchInterval: 30000,
  });

  const { data: modelStatusData } = useQuery({
    queryKey: ['/api/model/status'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/model/status');
      return parseApiJson<ModelStatusResponse>(res, '模型状态接口');
    },
    refetchInterval: 30000,
  });

  const addServerMutation = useMutation({
    mutationFn: async (data: typeof serverForm) => {
      const res = await apiRequest('POST', '/api/servers', data);
      return parseApiJson<MutationResponse>(res, 'GPU 服务器添加接口');
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: '服务器添加成功', description: `${serverForm.name} 已连接` });
        void queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
        void queryClient.invalidateQueries({ queryKey: ['/api/model/status'] });
        setIsAdding(false);
        setServerForm({
          endpoint: 'http://192.168.1.100:11434',
          model: 'qwen2:72b',
          name: '我的GPU服务器',
          gpuMemoryMB: 16384,
          ramMB: 32768,
          cpuCores: 8,
          taskType: 'CHAT',
        });
      } else {
        toast({ title: '添加失败', description: data.error || data.hint, variant: 'destructive' });
      }
    },
    onError: () => {
      toast({ title: '添加失败', description: '无法连接到服务器', variant: 'destructive' });
    },
  });

  const removeServerMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      const res = await apiRequest('DELETE', '/api/servers', { endpoint });
      return parseApiJson<MutationResponse>(res, 'GPU 服务器移除接口');
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: '服务器已移除' });
        void queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
        void queryClient.invalidateQueries({ queryKey: ['/api/model/status'] });
      }
    },
  });

  const testServerMutation = useMutation({
    mutationFn: async ({ endpoint, model }: { endpoint: string; model: string }) => {
      setIsTesting(endpoint);
      const res = await apiRequest('POST', '/api/servers/test', {
        endpoint,
        model,
        prompt: '你好，请用一句话介绍你自己。',
      });
      return parseApiJson<MutationResponse>(res, 'GPU 服务器测试接口');
    },
    onSuccess: (data) => {
      setIsTesting(null);
      if (data.success) {
        toast({ 
          title: '服务器测试成功', 
          description: `响应: ${data.response?.substring(0, 50)}...` 
        });
      } else {
        toast({ title: '测试失败', description: data.error, variant: 'destructive' });
      }
    },
    onError: () => {
      setIsTesting(null);
      toast({ title: '测试失败', description: '无法连接到服务器', variant: 'destructive' });
    },
  });

  const servers: ServerConfig[] = serversData?.servers || [];
  const healthyCount = serversData?.healthyCount || 0;
  const preferredProvider = modelStatusData?.status?.preferredProvider;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid="gpu-server-settings">
      <Card className="border-gold/20 bg-gradient-to-br from-background to-gold/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gold/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold/10">
                  <Server className="h-6 w-6 text-gold" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    GPU服务器集群
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                  <CardDescription>配置高性能服务器处理复杂任务</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={healthyCount > 0 ? "text-green-400 border-green-400/50" : "text-muted-foreground"}>
                  {healthyCount}/{servers.length} 在线
                </Badge>
                {preferredProvider === 'SERVER' && (
                  <Badge className="bg-gold/20 text-gold border-gold/50">
                    首选
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                data-testid="button-refresh-servers"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
              <Button 
                size="sm" 
                onClick={() => setIsAdding(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
                data-testid="button-add-server"
              >
                <Plus className="h-4 w-4 mr-1" />
                添加服务器
              </Button>
            </div>

            {isAdding && (
              <Card className="border-gold/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    添加GPU服务器
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="server-name" className="text-foreground">服务器名称</Label>
                      <Input
                        id="server-name"
                        placeholder="例如: 家庭服务器"
                        value={serverForm.name}
                        onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                        className="bg-background text-foreground"
                        data-testid="input-server-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="server-endpoint" className="text-foreground">Ollama端点</Label>
                      <Input
                        id="server-endpoint"
                        placeholder="http://192.168.1.100:11434"
                        value={serverForm.endpoint}
                        onChange={(e) => setServerForm({ ...serverForm, endpoint: e.target.value })}
                        className="bg-background text-foreground"
                        data-testid="input-server-endpoint"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">模型用途</Label>
                      <Select 
                        value={serverForm.taskType} 
                        onValueChange={(v: 'CHAT' | 'SCREEN_OPERATION') => {
                          const presets = MODEL_PRESETS[v];
                          setServerForm({ 
                            ...serverForm, 
                            taskType: v,
                            model: presets[0].value,
                            name: v === 'CHAT' ? '对话模型服务器' : '屏幕操作模型服务器'
                          });
                        }}
                      >
                        <SelectTrigger className="bg-background" data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHAT">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-blue-400" />
                              <span>对话/分析 (主模型)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="SCREEN_OPERATION">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-purple-400" />
                              <span>屏幕操作 (AutoGLM)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">选择模型</Label>
                      <Select 
                        value={serverForm.model} 
                        onValueChange={(v) => setServerForm({ ...serverForm, model: v })}
                      >
                        <SelectTrigger className="bg-background" data-testid="select-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_PRESETS[serverForm.taskType].map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              <div className="flex items-center justify-between gap-4">
                                <span>{preset.label}</span>
                                <Badge variant="outline" className="text-xs">{preset.vram}</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="server-gpu" className="text-foreground">GPU显存 (MB)</Label>
                      <Input
                        id="server-gpu"
                        type="number"
                        placeholder="16384"
                        value={serverForm.gpuMemoryMB}
                        onChange={(e) => setServerForm({ ...serverForm, gpuMemoryMB: parseInt(e.target.value) || 0 })}
                        className="bg-background text-foreground"
                        data-testid="input-server-gpu"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        推荐配置
                      </Label>
                      <p className="text-xs text-muted-foreground pt-2">
                        {serverForm.taskType === 'CHAT' 
                          ? '对话模型用于智能对话、问答、分析等任务' 
                          : '屏幕操作模型用于自动化控制手机/电脑'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAdding(false)}
                      data-testid="button-cancel-add"
                    >
                      取消
                    </Button>
                    <Button 
                      onClick={() => addServerMutation.mutate(serverForm)}
                      disabled={addServerMutation.isPending || !serverForm.endpoint || !serverForm.model}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
                      data-testid="button-confirm-add"
                    >
                      {addServerMutation.isPending ? '连接中...' : '添加服务器'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {servers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>还没有配置GPU服务器</p>
              </div>
            ) : (
              <div className="space-y-2">
                {servers.map((server) => (
                  <div 
                    key={server.endpoint} 
                    className={`flex items-center justify-between p-3 rounded-lg ${server.healthy ? 'bg-green-500/10' : 'bg-red-500/10'}`}
                    data-testid={`card-server-${server.endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      {server.taskType === 'SCREEN_OPERATION' ? (
                        <Monitor className={`h-5 w-5 ${server.healthy ? 'text-purple-500' : 'text-red-500'}`} />
                      ) : (
                        <MessageSquare className={`h-5 w-5 ${server.healthy ? 'text-blue-500' : 'text-red-500'}`} />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{server.name || '未命名'}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${server.taskType === 'SCREEN_OPERATION' ? 'border-purple-500/50 text-purple-400' : 'border-blue-500/50 text-blue-400'}`}
                          >
                            {server.taskType === 'SCREEN_OPERATION' ? '屏幕操作' : '对话/分析'}
                          </Badge>
                          <Badge variant={server.healthy ? 'default' : 'destructive'} className="text-xs">
                            {server.healthy ? '在线' : '离线'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{server.endpoint}</span>
                          <span>·</span>
                          <span>{server.model}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testServerMutation.mutate({ endpoint: server.endpoint, model: server.model })}
                        disabled={isTesting === server.endpoint}
                        data-testid={`button-test-server-${server.endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`}
                      >
                        {isTesting === server.endpoint ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeServerMutation.mutate(server.endpoint)}
                        className="text-red-500 hover:text-red-600"
                        data-testid={`button-remove-server-${server.endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
