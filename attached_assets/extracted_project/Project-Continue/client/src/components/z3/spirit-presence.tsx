import { useState } from "react";
import { useZ3Store, DeviceType } from "@/lib/z3/spirit-core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { 
  Monitor, 
  Smartphone, 
  Glasses, 
  Tv, 
  Wifi, 
  WifiOff,
  Zap,
  Ghost,
  ArrowRight,
  Plus,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const deviceIcons: Record<DeviceType, React.ReactNode> = {
  MASTER_PC: <Monitor className="w-5 h-5" />,
  MOBILE_TACTICAL: <Smartphone className="w-5 h-5" />,
  AR_GLASSES: <Glasses className="w-5 h-5" />,
  INMO_GO3: <Glasses className="w-5 h-5 text-cyan-400" />,
  TV: <Tv className="w-5 h-5" />,
  IOT_HUB: <Wifi className="w-5 h-5" />,
};

export function SpiritPresence() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: '',
    type: 'MASTER_PC' as DeviceType,
  });

  const deviceTypeLabels: Record<DeviceType, string> = {
    MASTER_PC: t('device.master_pc'),
    MOBILE_TACTICAL: t('device.mobile'),
    AR_GLASSES: t('device.ar_glasses'),
    INMO_GO3: t('device.inmo'),
    TV: t('device.tv'),
    IOT_HUB: t('device.iot'),
  };

  const { 
    devices, 
    activeNodeId, 
    isGhosting,
    ghostingTarget,
    initiateGhosting,
    registerDevice,
    unregisterDevice
  } = useZ3Store();

  const handleAddDevice = () => {
    if (!newDevice.name.trim()) {
      toast({ title: t('toast.enter_device_name'), variant: "destructive" });
      return;
    }

    const deviceId = `${newDevice.type.toLowerCase()}-${Date.now()}`;
    registerDevice({
      id: deviceId,
      type: newDevice.type,
      name: newDevice.name.trim(),
      isOnline: true,
      sensorScore: 70 + Math.floor(Math.random() * 30),
      proximity: 50 + Math.floor(Math.random() * 50),
      hasBluetooth: newDevice.type !== 'TV',
    });

    toast({ title: t('toast.device_added', { name: newDevice.name }) });
    setNewDevice({ name: '', type: 'MASTER_PC' });
    setIsAddDialogOpen(false);
  };

  const handleRemoveDevice = (deviceId: string, deviceName: string) => {
    unregisterDevice(deviceId);
    toast({ title: t('toast.device_removed', { name: deviceName }) });
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ghost className="w-5 h-5 text-primary" />
          {t('insight.presence_title')}
        </CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-add-device">
              <Plus className="w-4 h-4 mr-1" />
              {t('insight.add_device')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('insight.add_device')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{t('insight.device_name')}</Label>
                <Input 
                  placeholder={t('insight.example_name')}
                  value={newDevice.name}
                  onChange={(e) => setNewDevice(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-device-name"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('insight.device_type')}</Label>
                <Select 
                  value={newDevice.type} 
                  onValueChange={(v) => setNewDevice(prev => ({ ...prev, type: v as DeviceType }))}
                >
                  <SelectTrigger data-testid="select-device-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(deviceTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          {deviceIcons[value as DeviceType]}
                          <span>{label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddDevice} className="w-full" data-testid="button-confirm-add">
                {t('insight.confirm_add')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <AnimatePresence>
          {isGhosting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-primary"
              >
                <Zap className="w-12 h-12" />
              </motion.div>
              <span className="ml-4 text-primary font-mono text-sm">FRACTAL_PARTICLE_FLIGHT...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Ghost className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="mb-2">{t('insight.no_devices')}</p>
            <p className="text-xs">{t('insight.add_prompt')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {devices.map((device) => {
              const isActive = device.id === activeNodeId;
              const isTarget = device.id === ghostingTarget;
              
              return (
                <motion.div
                  key={device.id}
                  layout
                  className={cn(
                    "p-4 rounded-lg border transition-all cursor-pointer group relative",
                    isActive 
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                      : "border-border hover:border-primary/50",
                    isTarget && "animate-pulse border-accent",
                    !device.isOnline && "opacity-50"
                  )}
                  onClick={() => device.isOnline && !isActive && initiateGhosting(device.id)}
                  data-testid={`device-node-${device.id}`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveDevice(device.id, device.name);
                    }}
                    data-testid={`button-remove-${device.id}`}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-2 rounded-md",
                        isActive ? "bg-primary text-primary-foreground" : "bg-secondary"
                      )}>
                        {deviceIcons[device.type]}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{deviceTypeLabels[device.type]}</p>
                      </div>
                    </div>
                    
                    {device.isOnline ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="font-mono">
                      {t('common.perception')}:{device.sensorScore}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      {t('common.distance')}:{device.proximity}
                    </Badge>
                    {device.hasBluetooth && (
                      <Badge variant="secondary" className="text-xs">{t('common.bluetooth')}</Badge>
                    )}
                  </div>

                  {isActive && (
                    <div className="mt-2 pt-2 border-t border-primary/20">
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Zap className="w-3 h-3" />
                        <span>{t('insight.residing')}</span>
                      </div>
                    </div>
                  )}

                  {!isActive && device.isOnline && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        <span>{t('insight.click_transfer')}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
