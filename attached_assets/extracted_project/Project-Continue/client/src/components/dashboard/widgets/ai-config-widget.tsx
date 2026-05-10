import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Brain, Volume2, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { UserSettings } from '@shared/schema';

const USER_ID = 'master';

const DEFAULT_SETTINGS = {
  voiceEnabled: 'false',
  autoAnalyze: 'true',
  wakeWordSensitivity: 0.5,
};

export function AiConfigWidget() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState(DEFAULT_SETTINGS);

  const { data: settings, isLoading, isError } = useQuery<UserSettings>({
    queryKey: ['/api/user-settings', USER_ID],
    queryFn: async () => {
      const res = await fetch(`/api/user-settings/${USER_ID}`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, any>) => 
      apiRequest('PATCH', `/api/user-settings/${USER_ID}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-settings', USER_ID] });
    },
    onError: () => {
      console.warn('[AiConfig] Failed to save, using local state');
    },
  });

  const currentSettings = settings || { ...DEFAULT_SETTINGS, ...localSettings };
  const voiceEnabled = currentSettings.voiceEnabled === 'true';
  const autoMode = currentSettings.autoAnalyze === 'true';
  const sensitivity = typeof currentSettings.wakeWordSensitivity === 'number' 
    ? currentSettings.wakeWordSensitivity 
    : 0.5;
  const creativityValue = [Math.round(sensitivity * 100)];

  const handleVoiceChange = (checked: boolean) => {
    const value = checked ? 'true' : 'false';
    setLocalSettings(prev => ({ ...prev, voiceEnabled: value }));
    updateMutation.mutate({ voiceEnabled: value });
  };

  const handleAutoModeChange = (checked: boolean) => {
    const value = checked ? 'true' : 'false';
    setLocalSettings(prev => ({ ...prev, autoAnalyze: value }));
    updateMutation.mutate({ autoAnalyze: value });
  };

  const handleCreativityChange = (value: number[]) => {
    const newValue = value[0] / 100;
    setLocalSettings(prev => ({ ...prev, wakeWordSensitivity: newValue }));
    updateMutation.mutate({ wakeWordSensitivity: newValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-3 text-muted-foreground">
        <AlertCircle className="h-4 w-4 mr-2" />
        <span className="text-xs">加载失败</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <Label htmlFor="voice" className="text-xs">语音响应</Label>
        </div>
        <Switch
          id="voice"
          checked={voiceEnabled}
          onCheckedChange={handleVoiceChange}
          disabled={updateMutation.isPending}
          data-testid="switch-voice"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <Label htmlFor="auto" className="text-xs">自动分析</Label>
        </div>
        <Switch
          id="auto"
          checked={autoMode}
          onCheckedChange={handleAutoModeChange}
          disabled={updateMutation.isPending}
          data-testid="switch-auto"
        />
      </div>

      <div className="flex flex-col gap-1 mt-auto">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <Label className="text-xs">灵敏度: {creativityValue[0]}%</Label>
        </div>
        <Slider
          value={creativityValue}
          onValueCommit={handleCreativityChange}
          max={100}
          step={10}
          className="w-full"
          disabled={updateMutation.isPending}
          data-testid="slider-creativity"
        />
      </div>
    </div>
  );
}
