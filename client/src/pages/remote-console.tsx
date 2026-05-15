import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Server,
  Plus,
  Send,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  Moon,
  Zap,
  MessageSquare,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

interface Device {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: string;
  status: string;
  capabilities: string[] | null;
  lastSeen: string | null;
  createdAt: string;
}

interface RemoteCommand {
  id: string;
  deviceId: string;
  commandType: string;
  payload: any;
  status: string;
  resultPayload: any;
  errorMessage: string | null;
  issuedBy: string;
  issuedAt: string;
  acknowledgedAt: string | null;
  completedAt: string | null;
}

const DEVICE_ICONS: Record<string, typeof Smartphone> = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
  server: Server,
};

const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'bg-green-500',
  OFFLINE: 'bg-gray-500',
  SLEEPING: 'bg-blue-500',
  BUSY: 'bg-yellow-500',
};

const COMMAND_TYPES = [
  { value: 'WAKE', label: '唤醒', icon: Zap },
  { value: 'SLEEP', label: '休眠', icon: Moon },
  { value: 'PING', label: '心跳检测', icon: Activity },
  { value: 'PUSH_MESSAGE', label: '推送消息', icon: MessageSquare },
  { value: 'SYNC_SESSION', label: '同步会话', icon: RefreshCw },
];

export default function RemoteConsole() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('desktop');
  const [commandType, setCommandType] = useState('PING');
  const [commandPayload, setCommandPayload] = useState('');

  const { data: devices = [], isLoading: devicesLoading, refetch: refetchDevices } = useQuery<Device[]>({
    queryKey: ['/api/z3/devices'],
  });

  const { data: commands = [], refetch: refetchCommands } = useQuery<RemoteCommand[]>({
    queryKey: [`/api/z3/devices/${selectedDevice?.id}/commands`],
    enabled: !!selectedDevice,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { deviceName: string; deviceType: string }) => {
      return apiRequest('POST', '/api/z3/devices/register', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/z3/devices'] });
      setRegisterDialogOpen(false);
      setNewDeviceName('');
      setNewDeviceType('desktop');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest('DELETE', `/api/z3/devices/${deviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/z3/devices'] });
      if (selectedDevice) setSelectedDevice(null);
    },
  });

  const sendCommandMutation = useMutation({
    mutationFn: async (data: { deviceId: string; commandType: string; payload?: any }) => {
      return apiRequest('POST', `/api/z3/devices/${data.deviceId}/commands`, { 
        commandType: data.commandType, 
        payload: data.payload 
      });
    },
    onSuccess: () => {
      if (selectedDevice) {
        queryClient.invalidateQueries({ queryKey: [`/api/z3/devices/${selectedDevice.id}/commands`] });
      }
      setCommandDialogOpen(false);
      setCommandPayload('');
    },
  });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '从未';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getCommandStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'PENDING':
      case 'SENT': return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 pt-6 pb-24 md:pb-6">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-light">PC代理执行台</h1>
          <p className="text-sm text-muted-foreground">发出目标，等待设备执行并回传结果</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchDevices()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
          <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-register-device">
                <Plus className="w-4 h-4 mr-1" />
                注册设备
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>注册新设备</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>设备名称</Label>
                  <Input 
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="例如：主人的MacBook"
                    data-testid="input-device-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>设备类型</Label>
                  <Select value={newDeviceType} onValueChange={setNewDeviceType}>
                    <SelectTrigger data-testid="select-device-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">桌面电脑</SelectItem>
                      <SelectItem value="mobile">手机</SelectItem>
                      <SelectItem value="tablet">平板</SelectItem>
                      <SelectItem value="server">服务器</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => registerMutation.mutate({ deviceName: newDeviceName, deviceType: newDeviceType })}
                  disabled={!newDeviceName || registerMutation.isPending}
                  data-testid="button-confirm-register"
                >
                  {registerMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  注册
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                已注册设备 ({devices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {devicesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    暂无已注册设备
                  </div>
                ) : (
                  <div className="space-y-2">
                    {devices.map((device) => {
                      const Icon = DEVICE_ICONS[device.deviceType] || Monitor;
                      const isSelected = selectedDevice?.id === device.id;
                      return (
                        <div
                          key={device.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedDevice(device)}
                          data-testid={`device-card-${device.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Icon className="w-8 h-8 text-primary" />
                              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${STATUS_COLORS[device.status] || 'bg-gray-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{device.deviceName}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{device.deviceType}</span>
                                <span>·</span>
                                <span>{formatTime(device.lastSeen)}</span>
                              </div>
                            </div>
                            <Badge variant={device.status === 'ONLINE' ? 'default' : 'secondary'} className="text-xs">
                              {device.status === 'ONLINE' ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                              {device.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          {selectedDevice ? (
            <div className="space-y-4">
              <Card className="bg-card/50 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {(() => {
                        const Icon = DEVICE_ICONS[selectedDevice.deviceType] || Monitor;
                        return <Icon className="w-4 h-4 text-primary" />;
                      })()}
                      {selectedDevice.deviceName}
                    </span>
                    <div className="flex gap-2">
                      <Dialog open={commandDialogOpen} onOpenChange={setCommandDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-send-command">
                            <Send className="w-4 h-4 mr-1" />
                            发送指令
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>发送代理指令</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>指令类型</Label>
                              <Select value={commandType} onValueChange={setCommandType}>
                                <SelectTrigger data-testid="select-command-type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMMAND_TYPES.map((cmd) => (
                                    <SelectItem key={cmd.value} value={cmd.value}>
                                      <div className="flex items-center gap-2">
                                        <cmd.icon className="w-4 h-4" />
                                        {cmd.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {commandType === 'PUSH_MESSAGE' && (
                              <div className="space-y-2">
                                <Label>消息内容</Label>
                                <Textarea 
                                  value={commandPayload}
                                  onChange={(e) => setCommandPayload(e.target.value)}
                                  placeholder="输入要推送的消息..."
                                  data-testid="input-command-payload"
                                />
                              </div>
                            )}
                            <Button 
                              className="w-full"
                              onClick={() => sendCommandMutation.mutate({
                                deviceId: selectedDevice.id,
                                commandType,
                                payload: commandType === 'PUSH_MESSAGE' ? { message: commandPayload } : undefined,
                              })}
                              disabled={sendCommandMutation.isPending}
                              data-testid="button-confirm-command"
                            >
                              {sendCommandMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                              发送
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(selectedDevice.id)}
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">设备ID:</span>
                      <span className="ml-2 font-mono text-xs">{selectedDevice.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">用户:</span>
                      <span className="ml-2">{selectedDevice.userId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">类型:</span>
                      <span className="ml-2">{selectedDevice.deviceType}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">最后在线:</span>
                      <span className="ml-2">{formatTime(selectedDevice.lastSeen)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">支持指令:</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(selectedDevice.capabilities || []).map((cap) => (
                          <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    指令历史
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {commands.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无指令记录
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {commands.map((cmd) => (
                          <div key={cmd.id} className="p-3 rounded border border-border bg-secondary/20" data-testid={`command-${cmd.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getCommandStatusIcon(cmd.status)}
                                <span className="font-medium">{cmd.commandType}</span>
                                <Badge variant="outline" className="text-xs">{cmd.status}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(cmd.issuedAt).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            {cmd.payload && Object.keys(cmd.payload).length > 0 && (
                              <div className="mt-2 text-xs text-muted-foreground font-mono bg-secondary/30 p-2 rounded">
                                {JSON.stringify(cmd.payload)}
                              </div>
                            )}
                            {cmd.errorMessage && (
                              <div className="mt-2 text-xs text-red-500">
                                错误: {cmd.errorMessage}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-card/50 border-primary/20 h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>选择左侧设备查看详情</p>
                <p className="text-xs mt-1">或注册新设备开始使用</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
