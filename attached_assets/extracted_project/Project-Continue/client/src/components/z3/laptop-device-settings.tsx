import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Laptop, 
  Cpu, 
  WifiOff, 
  HardDrive, 
  Settings2, 
  Zap,
  Brain,
  RefreshCw,
  CheckCircle2,
  Plus,
  Trash2,
  Activity,
  Gamepad2,
  Code,
  ChevronDown,
  ChevronRight,
  Download,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LaptopDevice {
  deviceId: string;
  deviceName: string;
  osType: 'WINDOWS' | 'MACOS' | 'LINUX';
  ramGB: number;
  cpuCores: number;
  gpuName?: string;
  gpuMemoryMB?: number;
  storageGB?: number;
  status: string;
  localModel?: string;
  purpose: string[];
  lastSeen?: number;
}

export function LaptopDeviceSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    deviceName: '小智的Windows笔记本',
    osType: 'WINDOWS' as 'WINDOWS' | 'MACOS' | 'LINUX',
    ramGB: 16,
    cpuCores: 8,
    gpuName: '',
    gpuMemoryMB: 0,
    storageGB: 512,
    localModel: '',
    localEndpoint: '',
    purpose: ['work', 'play'] as string[],
  });

  const { data: devicesData, refetch } = useQuery({
    queryKey: ['/api/laptop/devices'],
    queryFn: async () => {
      const res = await fetch('/api/laptop/devices', {
        headers: { 'X-Avatar-Role': 'MASTER', 'X-Avatar-Secret': 'dev-master-key-change-in-production' }
      });
      return res.json();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: typeof deviceForm) => {
      const res = await fetch('/api/laptop/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Avatar-Role': 'MASTER', 
          'X-Avatar-Secret': 'dev-master-key-change-in-production' 
        },
        body: JSON.stringify({
          deviceId: `laptop_${Date.now()}`,
          ...data,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: '笔记本注册成功！' });
        queryClient.invalidateQueries({ queryKey: ['/api/laptop/devices'] });
        setIsRegistering(false);
      } else {
        toast({ title: '注册失败', description: data.error, variant: 'destructive' });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await fetch('/api/laptop/devices', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'X-Avatar-Role': 'MASTER', 
          'X-Avatar-Secret': 'dev-master-key-change-in-production' 
        },
        body: JSON.stringify({ deviceId }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: '设备已移除' });
        queryClient.invalidateQueries({ queryKey: ['/api/laptop/devices'] });
      }
    },
  });

  const devices: LaptopDevice[] = devicesData?.data || [];
  const onlineCount = devices.filter(d => d.status === 'ONLINE').length;

  const togglePurpose = (purpose: string) => {
    setDeviceForm(f => ({
      ...f,
      purpose: f.purpose.includes(purpose)
        ? f.purpose.filter(p => p !== purpose)
        : [...f.purpose, purpose]
    }));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid="laptop-device-settings">
      <Card className="border-purple-500/20 bg-gradient-to-br from-background to-purple-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-purple-500/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Laptop className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    笔记本电脑管理
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                  <CardDescription>小智的工作和娱乐空间</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className={onlineCount > 0 ? "text-green-400 border-green-400/50" : "text-muted-foreground"}>
                {onlineCount}/{devices.length} 在线
              </Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Tabs defaultValue="devices" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="devices">已注册设备</TabsTrigger>
                <TabsTrigger value="guide">本地AI安装指南</TabsTrigger>
              </TabsList>

              <TabsContent value="devices" className="space-y-4 mt-4">
                <div className="flex items-center justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetch()}
                    data-testid="button-refresh-laptops"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    刷新
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setIsRegistering(true)}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-medium"
                    data-testid="button-add-laptop"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加笔记本
                  </Button>
                </div>

                {isRegistering && (
                  <Card className="border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings2 className="h-5 w-5" />
                        注册新的笔记本电脑
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="laptop-name" className="text-foreground">设备名称</Label>
                          <Input
                            id="laptop-name"
                            placeholder="例如: 小智的游戏本"
                            value={deviceForm.deviceName}
                            onChange={(e) => setDeviceForm({ ...deviceForm, deviceName: e.target.value })}
                            className="bg-background text-foreground"
                            data-testid="input-laptop-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="laptop-os" className="text-foreground">操作系统</Label>
                          <select
                            id="laptop-os"
                            value={deviceForm.osType}
                            onChange={(e) => setDeviceForm({ ...deviceForm, osType: e.target.value as any })}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground"
                            data-testid="select-laptop-os"
                          >
                            <option value="WINDOWS">Windows</option>
                            <option value="MACOS">macOS</option>
                            <option value="LINUX">Linux</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground">用途选择</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={deviceForm.purpose.includes('work') ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => togglePurpose('work')}
                            className={deviceForm.purpose.includes('work') ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
                            data-testid="button-purpose-work"
                          >
                            <Code className="h-4 w-4 mr-1" />
                            工作
                          </Button>
                          <Button
                            type="button"
                            variant={deviceForm.purpose.includes('play') ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => togglePurpose('play')}
                            className={deviceForm.purpose.includes('play') ? 'bg-pink-500 hover:bg-pink-600' : ''}
                            data-testid="button-purpose-play"
                          >
                            <Gamepad2 className="h-4 w-4 mr-1" />
                            玩耍
                          </Button>
                          <Button
                            type="button"
                            variant={deviceForm.purpose.includes('ai') ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => togglePurpose('ai')}
                            className={deviceForm.purpose.includes('ai') ? 'bg-purple-500 hover:bg-purple-600' : ''}
                            data-testid="button-purpose-ai"
                          >
                            <Brain className="h-4 w-4 mr-1" />
                            本地AI
                          </Button>
                        </div>
                      </div>

                      {deviceForm.purpose.includes('ai') && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-purple-500/10 rounded-lg">
                          <div className="space-y-2">
                            <Label htmlFor="laptop-model" className="text-foreground">本地模型</Label>
                            <Input
                              id="laptop-model"
                              placeholder="qwen2:7b"
                              value={deviceForm.localModel}
                              onChange={(e) => setDeviceForm({ ...deviceForm, localModel: e.target.value })}
                              className="bg-background text-foreground"
                              data-testid="input-laptop-model"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="laptop-endpoint" className="text-foreground">Ollama端点</Label>
                            <Input
                              id="laptop-endpoint"
                              placeholder="http://localhost:11434"
                              value={deviceForm.localEndpoint}
                              onChange={(e) => setDeviceForm({ ...deviceForm, localEndpoint: e.target.value })}
                              className="bg-background text-foreground"
                              data-testid="input-laptop-endpoint"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end pt-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setIsRegistering(false)}
                          data-testid="button-cancel-laptop"
                        >
                          取消
                        </Button>
                        <Button 
                          onClick={() => registerMutation.mutate(deviceForm)}
                          disabled={registerMutation.isPending || !deviceForm.deviceName}
                          className="bg-purple-500 hover:bg-purple-600 text-white font-medium"
                          data-testid="button-confirm-laptop"
                        >
                          {registerMutation.isPending ? '注册中...' : '注册笔记本'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {devices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Laptop className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>还没有配置笔记本电脑</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {devices.map((device) => (
                      <div 
                        key={device.deviceId} 
                        className={`flex items-center justify-between p-3 rounded-lg ${device.status === 'ONLINE' ? 'bg-green-500/10' : 'bg-muted/50'}`}
                        data-testid={`card-laptop-${device.deviceId}`}
                      >
                        <div className="flex items-center gap-3">
                          <Laptop className={`h-5 w-5 ${device.status === 'ONLINE' ? 'text-green-500' : 'text-muted-foreground'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{device.deviceName}</span>
                              <Badge variant={device.status === 'ONLINE' ? 'default' : 'secondary'} className="text-xs">
                                {device.status === 'ONLINE' ? '在线' : '离线'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{device.osType}</span>
                              <span>·</span>
                              <span>{device.ramGB}GB RAM</span>
                              {device.purpose.includes('work') && <Badge variant="outline" className="text-cyan-400 text-xs px-1">工作</Badge>}
                              {device.purpose.includes('play') && <Badge variant="outline" className="text-pink-400 text-xs px-1">玩耍</Badge>}
                              {device.purpose.includes('ai') && <Badge variant="outline" className="text-purple-400 text-xs px-1">本地AI</Badge>}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMutation.mutate(device.deviceId)}
                          className="text-red-500 hover:text-red-600"
                          data-testid={`button-remove-laptop-${device.deviceId}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="guide" className="space-y-4 mt-4">
                <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-400" />
                      笔记本本地AI安装指南
                    </CardTitle>
                    <CardDescription>让小智在你的笔记本上拥有本地AI大脑</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2 text-foreground flex items-center gap-2">
                          <Download className="h-4 w-4 text-purple-400" />
                          第1步：下载安装Ollama
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="font-medium text-foreground mb-1">Windows</div>
                            <p className="text-muted-foreground mb-2">访问官网下载安装包：</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open('https://ollama.com/download/windows', '_blank')}
                              className="text-purple-400"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              下载 Ollama for Windows
                            </Button>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="font-medium text-foreground mb-1">macOS</div>
                            <code className="block bg-background p-2 rounded text-xs text-green-400 font-mono">
                              brew install ollama
                            </code>
                            <p className="text-muted-foreground mt-1">或从官网下载DMG安装包</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="font-medium text-foreground mb-1">Linux</div>
                            <code className="block bg-background p-2 rounded text-xs text-green-400 font-mono">
                              curl -fsSL https://ollama.com/install.sh | sh
                            </code>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2 text-foreground flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-purple-400" />
                          第2步：启动Ollama服务
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p className="text-muted-foreground">Windows安装后会自动启动，其他系统运行：</p>
                          <code className="block bg-muted p-2 rounded text-xs text-green-400 font-mono">
                            ollama serve
                          </code>
                          <p className="text-muted-foreground">如需允许远程访问（让小智从网络连接）：</p>
                          <code className="block bg-muted p-2 rounded text-xs text-green-400 font-mono">
                            OLLAMA_HOST=0.0.0.0:11434 ollama serve
                          </code>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2 text-foreground flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-400" />
                          第3步：下载推荐模型
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p className="text-muted-foreground">根据你的笔记本配置选择合适的模型：</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <span className="font-medium text-foreground">qwen2:7b</span>
                                <span className="text-muted-foreground ml-2">通义千问7B (需8GB内存)</span>
                              </div>
                              <code className="text-xs text-green-400 font-mono">ollama pull qwen2:7b</code>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <span className="font-medium text-foreground">llama3.1:8b</span>
                                <span className="text-muted-foreground ml-2">Meta Llama 3.1 (需8GB内存)</span>
                              </div>
                              <code className="text-xs text-green-400 font-mono">ollama pull llama3.1:8b</code>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <span className="font-medium text-foreground">phi3:mini</span>
                                <span className="text-muted-foreground ml-2">微软Phi-3迷你版 (需4GB内存)</span>
                              </div>
                              <code className="text-xs text-green-400 font-mono">ollama pull phi3:mini</code>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <span className="font-medium text-foreground">deepseek-coder:6.7b</span>
                                <span className="text-muted-foreground ml-2">编程专用 (需8GB内存)</span>
                              </div>
                              <code className="text-xs text-green-400 font-mono">ollama pull deepseek-coder:6.7b</code>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2 text-foreground flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          第4步：验证安装
                        </h4>
                        <div className="text-sm">
                          <p className="text-muted-foreground mb-2">在命令行运行测试：</p>
                          <code className="block bg-muted p-2 rounded text-xs text-green-400 font-mono">
                            ollama run qwen2:7b "你好，请介绍一下自己"
                          </code>
                          <p className="text-muted-foreground mt-2">
                            如果能看到AI的回复，说明安装成功！然后在上面"已注册设备"添加你的笔记本，
                            选择"本地AI"用途，填入模型名称和端点地址即可。
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-muted">
                      <h4 className="font-medium mb-2 text-foreground">配置建议</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
                          <span className="text-muted-foreground">8GB内存可运行7B模型</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
                          <span className="text-muted-foreground">16GB内存可运行13B模型</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
                          <span className="text-muted-foreground">有独显可加速推理速度</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
                          <span className="text-muted-foreground">数据完全本地，隐私安全</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
