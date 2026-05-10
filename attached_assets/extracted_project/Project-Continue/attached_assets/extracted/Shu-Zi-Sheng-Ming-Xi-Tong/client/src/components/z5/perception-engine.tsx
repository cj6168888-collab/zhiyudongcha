import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, AlertTriangle, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { tacticalTerminal, PerceptionResult } from '@/lib/z5/tactical-terminal';

interface PerceptionEngineProps {
  onRiskDetected?: (result: PerceptionResult) => void;
}

export function PerceptionEngine({ onRiskDetected }: PerceptionEngineProps) {
  const [isActive, setIsActive] = useState(false);
  const [whisperEnabled, setWhisperEnabled] = useState(true);
  const [perception, setPerception] = useState<PerceptionResult | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'ALERT'>('IDLE');
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const unsubscribe = tacticalTerminal.subscribe((state) => {
      setPerception(state.lastPerception);
      setStatus(state.perceptionStatus);
      
      if (state.lastPerception?.hasRisk) {
        onRiskDetected?.(state.lastPerception);
      }
    });
    
    return unsubscribe;
  }, [onRiskDetected]);
  
  useEffect(() => {
    if (isActive && videoRef.current) {
      const stream = tacticalTerminal.getCameraStream();
      if (stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [isActive]);
  
  const handleToggleCamera = async () => {
    if (isActive) {
      tacticalTerminal.stopVisionSniffing();
      setIsActive(false);
    } else {
      const success = await tacticalTerminal.startVisionSniffing();
      setIsActive(success);
    }
  };
  
  const handleWhisperToggle = (enabled: boolean) => {
    setWhisperEnabled(enabled);
    tacticalTerminal.setWhisperEnabled(enabled);
  };
  
  return (
    <Card className="border-slate-700 bg-slate-800/50" data-testid="perception-engine">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            主动感知引擎
          </div>
          <Badge 
            variant={status === 'ALERT' ? 'destructive' : status === 'SCANNING' ? 'default' : 'secondary'}
            className={cn(
              status === 'SCANNING' && 'animate-pulse'
            )}
          >
            {status === 'IDLE' && '待机'}
            {status === 'SCANNING' && '扫描中'}
            {status === 'ALERT' && '⚠️ 警戒'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden">
          {isActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              <AnimatePresence>
                {perception?.hasRisk && perception.targetArea && (
                  <motion.div
                    className="absolute border-2 border-red-500 bg-red-500/20"
                    style={{
                      left: perception.targetArea.x,
                      top: perception.targetArea.y,
                      width: perception.targetArea.width,
                      height: perception.targetArea.height,
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    data-testid="risk-highlight-box"
                  >
                    <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-0.5 rounded">
                      风险区域
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  status === 'SCANNING' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                )} />
                {status === 'SCANNING' ? '实时分析' : '警戒模式'}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <CameraOff className="w-12 h-12 mb-2" />
              <p className="text-sm">摄像头未启用</p>
              <p className="text-xs text-slate-600">点击下方按钮开启视觉嗅探</p>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <Button
            variant={isActive ? 'destructive' : 'default'}
            size="sm"
            onClick={handleToggleCamera}
            className="gap-2"
            data-testid="button-toggle-camera"
          >
            {isActive ? (
              <>
                <CameraOff className="w-4 h-4" />
                停止嗅探
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                启动视觉嗅探
              </>
            )}
          </Button>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="whisper-toggle" className="text-xs text-slate-400">
              耳语同步
            </Label>
            <Switch
              id="whisper-toggle"
              checked={whisperEnabled}
              onCheckedChange={handleWhisperToggle}
              data-testid="switch-whisper"
            />
            {whisperEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </div>
        
        {perception && (
          <div className="space-y-2 p-3 bg-slate-900/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">风险等级</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      perception.riskLevel > 70 ? 'bg-red-500' : 
                      perception.riskLevel > 40 ? 'bg-amber-500' : 'bg-green-500'
                    )}
                    style={{ width: `${perception.riskLevel}%` }}
                  />
                </div>
                <span className={cn(
                  "text-xs font-mono",
                  perception.riskLevel > 70 ? 'text-red-400' : 
                  perception.riskLevel > 40 ? 'text-amber-400' : 'text-green-400'
                )}>
                  {perception.riskLevel.toFixed(0)}%
                </span>
              </div>
            </div>
            
            {perception.detectedKeywords && perception.detectedKeywords.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-slate-400">检测到的关键词</span>
                <div className="flex flex-wrap gap-1">
                  {perception.detectedKeywords.map((keyword, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {perception.warningText && (
              <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300">{perception.warningText}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
