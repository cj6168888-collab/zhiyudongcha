import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useZ4Store } from '@/lib/z4/strategy-orchestrator';
import { 
  Heart, Activity, Brain, AlertTriangle, 
  Shield, Thermometer, Timer, Phone,
  BellRing, Volume2, VolumeX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface BioMetrics {
  heartRate: number;
  stressLevel: number;
  fatigueIndex: number;
  focusScore: number;
  lastUpdate: number;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  priority: number;
}

interface BioGuardianProps {
  onEmergency?: (type: string, metrics: BioMetrics) => void;
}

const DEFAULT_THRESHOLDS = {
  heartRateHigh: 120,
  heartRateLow: 50,
  stressMax: 80,
  fatigueMax: 85,
};

export function BioGuardian({ onEmergency }: BioGuardianProps) {
  const { setOwnerStress, ownerStressLevel } = useZ4Store();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [metrics, setMetrics] = useState<BioMetrics>({
    heartRate: 72,
    stressLevel: 30,
    fatigueIndex: 20,
    focusScore: 85,
    lastUpdate: Date.now(),
  });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [emergencyContacts] = useState<EmergencyContact[]>([
    { name: '紧急联系人1', phone: '120', priority: 1 },
    { name: '家人', phone: '***', priority: 2 },
  ]);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      setMetrics(prev => {
        const newMetrics = {
          heartRate: prev.heartRate + Math.floor(Math.random() * 10 - 5),
          stressLevel: Math.min(100, Math.max(0, prev.stressLevel + Math.floor(Math.random() * 6 - 3))),
          fatigueIndex: Math.min(100, Math.max(0, prev.fatigueIndex + Math.floor(Math.random() * 4 - 1))),
          focusScore: Math.min(100, Math.max(0, prev.focusScore + Math.floor(Math.random() * 8 - 4))),
          lastUpdate: Date.now(),
        };

        newMetrics.heartRate = Math.min(150, Math.max(45, newMetrics.heartRate));

        setOwnerStress(newMetrics.stressLevel);

        const newAlerts: string[] = [];
        if (newMetrics.heartRate > thresholds.heartRateHigh) {
          newAlerts.push('心率过高');
        }
        if (newMetrics.heartRate < thresholds.heartRateLow) {
          newAlerts.push('心率过低');
        }
        if (newMetrics.stressLevel > thresholds.stressMax) {
          newAlerts.push('压力超标');
        }
        if (newMetrics.fatigueIndex > thresholds.fatigueMax) {
          newAlerts.push('疲劳预警');
        }

        if (newAlerts.length > 0 && !isMuted) {
          setAlerts(newAlerts);
          if (newMetrics.heartRate < 50 || newMetrics.heartRate > 140) {
            onEmergency?.('CRITICAL', newMetrics);
          }
        }

        return newMetrics;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring, isMuted, thresholds, setOwnerStress, onEmergency]);

  const getHeartRateColor = () => {
    if (metrics.heartRate < 50 || metrics.heartRate > 120) return 'text-red-500';
    if (metrics.heartRate < 60 || metrics.heartRate > 100) return 'text-amber-500';
    return 'text-green-500';
  };

  const getStressColor = () => {
    if (metrics.stressLevel > 80) return 'bg-red-500';
    if (metrics.stressLevel > 60) return 'bg-amber-500';
    if (metrics.stressLevel > 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const triggerEmergency = () => {
    onEmergency?.('MANUAL', metrics);
    setAlerts(['紧急呼救已触发']);
  };

  return (
    <Card className="border-red-500/20 bg-gradient-to-br from-background to-red-950/10" data-testid="bio-guardian">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Bio-Guardian 健康卫士
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setIsMuted(!isMuted)}
              data-testid="bio-mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Switch
              checked={isMonitoring}
              onCheckedChange={setIsMonitoring}
              data-testid="bio-monitor-toggle"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatePresence>
          {alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-lg bg-red-500/20 border border-red-500/50"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </motion.div>
                <div>
                  {alerts.map((alert, i) => (
                    <Badge key={i} variant="destructive" className="mr-1 mb-1">
                      {alert}
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Heart className="w-4 h-4" />
              心率
            </div>
            <motion.div
              className={cn("text-2xl font-bold", getHeartRateColor())}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.8, repeat: isMonitoring ? Infinity : 0 }}
            >
              {metrics.heartRate}
              <span className="text-sm font-normal ml-1">BPM</span>
            </motion.div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Brain className="w-4 h-4" />
              专注度
            </div>
            <div className="text-2xl font-bold">
              {metrics.focusScore}
              <span className="text-sm font-normal ml-1">%</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                压力指数
              </span>
              <span>{metrics.stressLevel}%</span>
            </div>
            <Progress 
              value={metrics.stressLevel} 
              className={cn("h-2", getStressColor())} 
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                疲劳指数
              </span>
              <span>{metrics.fatigueIndex}%</span>
            </div>
            <Progress 
              value={metrics.fatigueIndex} 
              className="h-2" 
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Thermometer className="w-3 h-3" />
            阈值设置
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs w-20">心率上限</span>
              <Slider
                value={[thresholds.heartRateHigh]}
                min={80}
                max={150}
                step={5}
                onValueChange={([v]) => setThresholds(t => ({ ...t, heartRateHigh: v }))}
                className="flex-1"
              />
              <span className="text-xs w-10 text-right">{thresholds.heartRateHigh}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs w-20">压力上限</span>
              <Slider
                value={[thresholds.stressMax]}
                min={50}
                max={100}
                step={5}
                onValueChange={([v]) => setThresholds(t => ({ ...t, stressMax: v }))}
                className="flex-1"
              />
              <span className="text-xs w-10 text-right">{thresholds.stressMax}</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Phone className="w-3 h-3" />
            紧急联系人
          </h4>
          <div className="flex gap-2">
            {emergencyContacts.map((contact, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {contact.name}
              </Badge>
            ))}
          </div>
        </div>

        <Button
          variant="destructive"
          className="w-full"
          onClick={triggerEmergency}
          data-testid="bio-emergency"
        >
          <BellRing className="w-4 h-4 mr-2" />
          紧急呼救
        </Button>

        {!isMonitoring && (
          <p className="text-xs text-center text-muted-foreground">
            开启监控以实时追踪生命体征
          </p>
        )}
      </CardContent>
    </Card>
  );
}
