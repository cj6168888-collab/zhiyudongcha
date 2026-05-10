import { useZ1Store } from "@/lib/z1/god-protocol";
import { SpiritPresence } from "@/components/z3/spirit-presence";
import { StreamControl } from "@/components/z3/stream-control";
import { GuestIsolation } from "@/components/z3/guest-isolation";
import { MobileDeviceSettings } from "@/components/z3/mobile-device-settings";
import { GpuServerSettings } from "@/components/z3/gpu-server-settings";
import { LaptopDeviceSettings } from "@/components/z3/laptop-device-settings";
import { ServerConfigCard } from "@/components/z3/server-config-card";
import { LocalModelManager } from "@/components/settings/local-model-manager";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";

export default function SpiritControl() {
  const { t } = useTranslation();
  const { role } = useZ1Store();
  const [, setLocation] = useLocation();

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-8 pt-8 pb-24 md:pb-8">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Lock className="w-6 h-6" />
              {t('insight.access_denied')}
            </CardTitle>
            <CardDescription>
              {t('insight.master_only')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLocation('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('insight.back')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-24 md:pb-8">
      <GlobalWakeHeader 
        title={t('insight.title')} 
        subtitle={t('insight.subtitle')}
      />

      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ServerConfigCard />
          <LocalModelManager />
        </div>
        
        <GpuServerSettings />
        
        <LaptopDeviceSettings />
        
        <MobileDeviceSettings />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <SpiritPresence />
            <GuestIsolation />
          </div>
          
          <div className="space-y-6">
            <StreamControl />
          </div>
        </div>
      </div>
    </div>
  );
}
