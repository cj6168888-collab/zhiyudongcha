import { useZ3Store, AudioMode } from "@/lib/z3/spirit-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
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

export function StreamControl() {
  const { t } = useTranslation();
  const {
    streamConfig,
    setAudioMode,
    audioMutex,
    userStatus,
    stressLevel,
    setUserStatus,
    setStressLevel,
    setVisualOverlay,
    setHapticEnabled,
  } = useZ3Store();

  const audioModes: { value: AudioMode; labelKey: string; icon: React.ReactNode }[] = [
    { value: 'WHISPER', labelKey: 'stream.whisper', icon: <Headphones className="w-4 h-4" /> },
    { value: 'AMBIENT', labelKey: 'stream.ambient', icon: <Volume2 className="w-4 h-4" /> },
    { value: 'SILENT', labelKey: 'stream.silent', icon: <VolumeX className="w-4 h-4" /> },
  ];

  const statusLabels: Record<string, string> = {
    'ACTIVE': t('status.active'),
    'IDLE': t('status.idle'),
    'SLEEPING': t('status.sleeping'),
    'STRESSED': t('status.stressed'),
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-primary" />
          {t('stream.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('stream.audio_mode')}</Label>
            {audioMutex && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                {t('stream.mutex_locked')}
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
                <span className="hidden sm:inline">{t(mode.labelKey)}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <Eye className={cn("w-4 h-4", streamConfig.visualOverlay ? "text-primary" : "text-muted-foreground")} />
              <Label className="text-sm">{t('stream.visual_overlay')}</Label>
            </div>
            <Switch 
              checked={streamConfig.visualOverlay}
              onCheckedChange={setVisualOverlay}
              data-testid="switch-visual-overlay"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2">
              <Vibrate className={cn("w-4 h-4", streamConfig.hapticEnabled ? "text-primary" : "text-muted-foreground")} />
              <Label className="text-sm">{t('stream.haptic')}</Label>
            </div>
            <Switch 
              checked={streamConfig.hapticEnabled}
              onCheckedChange={setHapticEnabled}
              data-testid="switch-haptic"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm">{t('stream.user_status')}</Label>
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
                {statusLabels[status]}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('stream.stress_level')}</Label>
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
              <span>{t('stream.high_stress')}</span>
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-2 text-sm">
            <Headphones className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">{t('stream.intel_route')}</span>
            <Badge variant="outline" className="font-mono text-xs">
              {streamConfig.audioMode === 'WHISPER' ? 'WHISPER_CHANNEL' : 'STANDARD_CHANNEL'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('stream.whisper_note')}
          </p>
        </div>

      </CardContent>
    </Card>
  );
}
