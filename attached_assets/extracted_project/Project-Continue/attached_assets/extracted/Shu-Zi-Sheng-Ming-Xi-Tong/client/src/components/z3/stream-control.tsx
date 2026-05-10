import { useZ3Store, AudioMode } from "@/lib/z3/spirit-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Headphones, 
  Volume2, 
  VolumeX,
  Eye,
  Vibrate,
  Brain,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

const audioModes: { value: AudioMode; label: string; labelZh: string; icon: React.ReactNode }[] = [
  { value: 'WHISPER_EARPHONE', label: 'Whisper', labelZh: '耳语', icon: <Headphones className="w-4 h-4" /> },
  { value: 'AMBIENT_SPEAKER', label: 'Speaker', labelZh: '环境音', icon: <Volume2 className="w-4 h-4" /> },
  { value: 'SILENT_SUBTITLE', label: 'Silent', labelZh: '静默字幕', icon: <VolumeX className="w-4 h-4" /> },
];

export function StreamControl() {
  const {
    streamConfig,
    setAudioMode,
    audioMutex,
    userStatus,
    stressLevel,
    setUserStatus,
    setStressLevel,
  } = useZ3Store();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-primary" />
          多模态流控制 (Stream Control)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Audio Mode Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">音频输出模式</Label>
            {audioMutex && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                MUTEX LOCKED
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {audioModes.map((mode) => (
              <Button
                key={mode.value}
                variant={streamConfig.audioMode === mode.value ? "default" : "outline"}
                size="sm"
                className="flex-1 flex items-center gap-2"
                onClick={() => setAudioMode(mode.value)}
                disabled={audioMutex}
                data-testid={`button-audio-${mode.value}`}
              >
                {mode.icon}
                <span className="hidden sm:inline">{mode.labelZh}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Visual & Haptic Toggles */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm">视觉叠加</Label>
            </div>
            <Switch 
              checked={streamConfig.visualOverlay} 
              disabled
              data-testid="switch-visual-overlay"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <Vibrate className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm">触觉反馈</Label>
            </div>
            <Switch 
              checked={streamConfig.hapticEnabled} 
              disabled
              data-testid="switch-haptic"
            />
          </div>
        </div>

        {/* User Status */}
        <div className="space-y-3">
          <Label className="text-sm">用户状态 (User Status)</Label>
          <div className="flex gap-2 flex-wrap">
            {(['ACTIVE', 'IDLE', 'SLEEPING', 'STRESSED'] as const).map((status) => (
              <Button
                key={status}
                variant={userStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setUserStatus(status)}
                className={cn(
                  status === 'STRESSED' && userStatus === status && "bg-destructive hover:bg-destructive/90"
                )}
                data-testid={`button-status-${status}`}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {/* Stress Level */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">压力指数 (Stress Level)</Label>
            <span className={cn(
              "font-mono text-sm",
              stressLevel > 70 ? "text-destructive" : "text-muted-foreground"
            )}>
              {stressLevel}%
            </span>
          </div>
          <Slider
            value={[stressLevel]}
            max={100}
            step={5}
            onValueChange={([val]) => setStressLevel(val)}
            className={cn(
              stressLevel > 70 && "[&>span]:bg-destructive"
            )}
            data-testid="slider-stress"
          />
          
          {stressLevel > 70 && (
            <div className="flex items-center gap-2 text-xs text-destructive animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              <span>高压警告：已自动切换至静默模式，减少干扰</span>
            </div>
          )}
        </div>

        {/* Whisper Logic Indicator */}
        <div className="p-3 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-2 text-sm">
            <Headphones className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">机密情报路由：</span>
            <Badge variant="outline" className="font-mono text-xs">
              {streamConfig.audioMode === 'WHISPER_EARPHONE' ? 'WHISPER_CHANNEL' : 'STANDARD_CHANNEL'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            * 当检测到蓝牙耳机且内容涉及"对手弱点"时，强制走耳语通道
          </p>
        </div>

      </CardContent>
    </Card>
  );
}
