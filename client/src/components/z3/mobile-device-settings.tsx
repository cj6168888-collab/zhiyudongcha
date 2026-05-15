import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Smartphone,
  Settings2,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, parseApiJson } from '@/lib/queryClient';

interface MobileDevice {
  deviceId: string;
  deviceName: string;
  osType: string;
  ramGB: number;
  status: string;
  localModel?: string;
  profile: {
    maxModelSize: string;
    recommendedModels: string[];
    estimatedTPS: number;
    offlineCapable: boolean;
  };
}

type MobileOsType = 'ANDROID' | 'IOS' | 'HARMONYOS';

export function MobileDeviceSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    deviceName: '',
    osType: 'ANDROID' as MobileOsType,
    ramGB: 16,
    localEndpoint: '',
    localModel: '',
  });

  const { data: devicesData, refetch } = useQuery({
    queryKey: ['/api/mobile/devices'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/mobile/devices');
      return parseApiJson<{ data?: MobileDevice[] }>(res, '移动设备接口');
    },
  });

  const { data: statusData } = useQuery({
    queryKey: ['/api/mobile/status'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/mobile/status');
      return parseApiJson<{ data?: { totalMobileDevices: number; onlineDevices: number } }>(res, '移动设备状态接口');
    },
    refetchInterval: 30000,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: typeof deviceForm) => {
      const res = await apiRequest('POST', '/api/mobile/register', {
        deviceId: `mobile_${Date.now()}`,
        ...data,
      });
      return parseApiJson<{ success?: boolean; error?: string }>(res, '移动设备注册接口');
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: '设备注册成功' });
        void queryClient.invalidateQueries({ queryKey: ['/api/mobile/devices'] });
        setIsRegistering(false);
        setDeviceForm({ deviceName: '', osType: 'ANDROID', ramGB: 16, localEndpoint: '', localModel: '' });
      } else {
        toast({ title: '注册失败', description: data.error, variant: 'destructive' });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await apiRequest('DELETE', '/api/mobile/devices', { deviceId });
      return parseApiJson<{ success?: boolean }>(res, '移动设备移除接口');
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: '设备已移除' });
        void queryClient.invalidateQueries({ queryKey: ['/api/mobile/devices'] });
      }
    },
  });

  const devices: MobileDevice[] = devicesData?.data || [];
  const status = statusData?.data || { totalMobileDevices: 0, onlineDevices: 0 };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid="mobile-device-settings">
      <Card className="border-cyan-500/20 bg-gradient-to-br from-background to-cyan-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-cyan-500/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Smartphone className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    移动设备管理
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                  <CardDescription>配置手机，让小星拥有本地AI大脑</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className={status.onlineDevices > 0 ? "text-green-400 border-green-400/50" : "text-muted-foreground"}>
                {status.onlineDevices}/{status.totalMobileDevices} 在线
              </Badge>
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
                data-testid="button-refresh-mobile"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
              <Button
                size="sm"
                onClick={() => setIsRegistering(true)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white font-medium"
                data-testid="button-add-mobile"
              >
                <Plus className="h-4 w-4 mr-1" />
                注册新设备
              </Button>
            </div>

            {isRegistering && (
              <Card className="border-cyan-500/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    注册新移动设备
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>设备名称</Label>
                      <Input
                        value={deviceForm.deviceName}
                        onChange={(e) => setDeviceForm(f => ({ ...f, deviceName: e.target.value }))}
                        placeholder="我的手机"
                        data-testid="input-device-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>系统类型</Label>
                      <select
                        value={deviceForm.osType}
                        onChange={(e) => setDeviceForm(f => ({ ...f, osType: e.target.value as MobileOsType }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground"
                        data-testid="select-os-type"
                      >
                        <option value="ANDROID">Android</option>
                        <option value="IOS">iOS</option>
                        <option value="HARMONYOS">HarmonyOS</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>内存大小 (GB)</Label>
                      <Input
                        type="number"
                        value={deviceForm.ramGB}
                        onChange={(e) => setDeviceForm(f => ({ ...f, ramGB: parseInt(e.target.value) || 8 }))}
                        min={4}
                        max={24}
                        data-testid="input-ram-size"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>本地模型 (可选)</Label>
                      <Input
                        value={deviceForm.localModel}
                        onChange={(e) => setDeviceForm(f => ({ ...f, localModel: e.target.value }))}
                        placeholder="qwen2-7b-Q8_0"
                        data-testid="input-local-model"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsRegistering(false)}
                      data-testid="button-cancel-register"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={() => registerMutation.mutate(deviceForm)}
                      disabled={!deviceForm.deviceName || registerMutation.isPending}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white font-medium"
                      data-testid="button-submit-device"
                    >
                      {registerMutation.isPending ? '注册中...' : '注册设备'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {devices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>还没有注册移动设备</p>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <div
                    key={device.deviceId}
                    className={`flex items-center justify-between p-3 rounded-lg ${device.status === 'ONLINE' ? 'bg-green-500/10' : 'bg-muted/50'}`}
                    data-testid={`card-mobile-${device.deviceId}`}
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className={`h-5 w-5 ${device.status === 'ONLINE' ? 'text-green-500' : 'text-muted-foreground'}`} />
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
                          {device.localModel && (
                            <>
                              <span>·</span>
                              <span className="text-cyan-400">{device.localModel}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(device.deviceId)}
                      className="text-red-500 hover:text-red-600"
                      data-testid={`button-remove-mobile-${device.deviceId}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
