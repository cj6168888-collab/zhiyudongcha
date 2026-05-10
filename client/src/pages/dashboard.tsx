import { useTranslation } from "react-i18next";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { AIConfigPanel } from "@/components/z1/ai-config-panel";
import { StaticDashboard } from "@/components/dashboard/static-dashboard";
import { LanguageSelector } from "@/components/ui/language-selector";
import { DreamInsightBubble, DreamInsightTrigger } from "@/components/z6/dream-insight-bubble";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { MobileLayout } from "@/components/ui/mobile-layout";
import { useIsMobile } from "@/hooks/use-device-info";
import { useLocation } from "wouter";
import { Settings, Languages, Radio } from "lucide-react";

export default function Dashboard() {
  const { t } = useTranslation();
  const { serverNode } = useZ1Store();
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();

  if (isMobile) {
    return (
      <MobileLayout
        showHeader
        headerTitle="数字生命控制台"
        headerAction={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLocation('/settings')}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-accent active:scale-95"
              aria-label="设置"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pb-10">
          {/* 移动端在线状态概览 */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-primary">系统在线</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground opacity-70">{serverNode.ip}</span>
          </div>

          <StaticDashboard />
          <DreamInsightBubble />
        </div>
      </MobileLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 pt-6 pb-24 md:pb-6">
      <GlobalWakeHeader
        showBack={false}
        subtitle={`${t('system.status')}: ${t('common.online')} | ${serverNode.ip}`}
        rightActions={
          <>
            <DreamInsightTrigger />
            <AIConfigPanel />
            <LanguageSelector />
            <div className="px-2 py-1 bg-secondary rounded text-[10px] font-mono text-secondary-foreground">
              v6.0
            </div>
          </>
        }
      />
      <StaticDashboard />
      <DreamInsightBubble />
    </div>
  );
}
