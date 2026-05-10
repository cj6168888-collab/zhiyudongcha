import { useTranslation } from "react-i18next";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { AIConfigPanel } from "@/components/z1/ai-config-panel";
import { StaticDashboard } from "@/components/dashboard/static-dashboard";
import { LanguageSelector } from "@/components/ui/language-selector";
import { DreamInsightBubble, DreamInsightTrigger } from "@/components/z6/dream-insight-bubble";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";

export default function Dashboard() {
  const { t } = useTranslation();
  const { serverNode } = useZ1Store();

  return (
    <div className="min-h-screen bg-background px-6 pt-6 pb-24 md:pb-6 font-sans text-foreground transition-colors duration-500">
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
