import { useState } from 'react';
import { VoiceprintLock } from '@/components/z1/voiceprint-lock';
import { RealtimeVoiceWidget } from './realtime-voice-widget';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, Wifi } from 'lucide-react';

export function VoiceprintWidget() {
  const [activeTab, setActiveTab] = useState('voiceprint');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="voiceprint" className="flex items-center gap-2">
          <Mic className="h-4 w-4" />
          声纹分析
        </TabsTrigger>
        <TabsTrigger value="realtime" className="flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          实时对话
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="voiceprint" className="mt-4">
        <VoiceprintLock />
      </TabsContent>
      
      <TabsContent value="realtime" className="mt-4">
        <RealtimeVoiceWidget />
      </TabsContent>
    </Tabs>
  );
}
