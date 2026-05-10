import { useZ3Store, DeviceType } from "@/lib/z3/spirit-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Monitor, 
  Smartphone, 
  Glasses, 
  Tv, 
  Wifi, 
  WifiOff,
  Zap,
  Ghost,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const deviceIcons: Record<DeviceType, React.ReactNode> = {
  PC: <Monitor className="w-5 h-5" />,
  MOBILE: <Smartphone className="w-5 h-5" />,
  GLASSES: <Glasses className="w-5 h-5" />,
  TV: <Tv className="w-5 h-5" />,
  IOT: <Wifi className="w-5 h-5" />,
};

export function SpiritPresence() {
  const { 
    devices, 
    activeNodeId, 
    isGhosting,
    ghostingTarget,
    initiateGhosting,
    registerDevice
  } = useZ3Store();

  // Demo: Register some devices if empty
  const initDemoDevices = () => {
    registerDevice({
      id: 'pc-main',
      type: 'PC',
      name: '战略指挥中心',
      isOnline: true,
      sensorScore: 90,
      proximity: 80,
      hasBluetooth: true,
    });
    registerDevice({
      id: 'mobile-01',
      type: 'MOBILE',
      name: '战术手机',
      isOnline: true,
      sensorScore: 70,
      proximity: 95,
      hasBluetooth: true,
    });
    registerDevice({
      id: 'glasses-ar',
      type: 'GLASSES',
      name: 'AR 眼镜',
      isOnline: false,
      sensorScore: 85,
      proximity: 0,
      hasBluetooth: true,
    });
    registerDevice({
      id: 'tv-living',
      type: 'TV',
      name: '客厅电视',
      isOnline: true,
      sensorScore: 60,
      proximity: 30,
      hasBluetooth: false,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ghost className="w-5 h-5 text-primary" />
          Z3: 灵魂仲裁 (Spirit Presence)
        </CardTitle>
        {devices.length === 0 && (
          <Button variant="outline" size="sm" onClick={initDemoDevices} data-testid="button-init-devices">
            初始化设备
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Ghosting Animation Overlay */}
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
            <p>无已注册设备</p>
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
                    "p-4 rounded-lg border transition-all cursor-pointer",
                    isActive 
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                      : "border-border hover:border-primary/50",
                    isTarget && "animate-pulse border-accent",
                    !device.isOnline && "opacity-50"
                  )}
                  onClick={() => device.isOnline && !isActive && initiateGhosting(device.id)}
                  data-testid={`device-node-${device.id}`}
                >
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
                        <p className="text-xs text-muted-foreground">{device.type}</p>
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
                      S:{device.sensorScore}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      P:{device.proximity}
                    </Badge>
                    {device.hasBluetooth && (
                      <Badge variant="secondary" className="text-xs">BT</Badge>
                    )}
                  </div>

                  {isActive && (
                    <div className="mt-2 pt-2 border-t border-primary/20">
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Zap className="w-3 h-3" />
                        <span>灵魂驻留中</span>
                      </div>
                    </div>
                  )}

                  {!isActive && device.isOnline && (
                    <div className="mt-2 pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        <span>点击穿行</span>
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
