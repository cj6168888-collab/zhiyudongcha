/**
 * App.tsx - 性能优化版本
 * 
 * 优化内容:
 * 1. 路由级代码分割 (React.lazy)
 * 2. 组件级懒加载
 * 3. 预加载关键路由
 * 4. Suspense 加载状态
 */

import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VaultStatusBar } from "@/components/ui/vault-status-bar";
import { CopyrightFooter } from "@/components/ui/copyright-footer";
import { SilentVoiceprintCollector } from "@/components/z1/silent-voiceprint-collector";
import { VoiceWakeProvider } from "@/hooks/use-voice-wake";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

// 立即加载关键页面
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";

// 懒加载其他页面 - 按功能分组
const RelationshipNetwork = lazy(() => import("@/pages/relationship-network"));
const SpiritControl = lazy(() => import("@/pages/spirit-control"));
const StrategyBrain = lazy(() => import("@/pages/strategy-brain"));
const TacticalTerminal = lazy(() => import("@/pages/tactical-terminal"));
const VaultCompute = lazy(() => import("@/pages/vault-compute"));
const IntelChamber = lazy(() => import("@/pages/intel-chamber"));
const ProjectCenter = lazy(() => import("@/pages/project-center"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const ProjectDashboard = lazy(() => import("@/pages/project-dashboard"));
const ProjectTemplates = lazy(() => import("@/pages/project-templates"));
const SmartProjectCreate = lazy(() => import("@/pages/smart-project-create"));
const EvolutionDashboard = lazy(() => import("@/pages/evolution-dashboard"));
const DailyReportPage = lazy(() => import("@/pages/daily-report"));
const GenesisPage = lazy(() => import("@/pages/genesis"));
const BirthExperiencePage = lazy(() => import("@/pages/birth-experience"));
const DreamLogsPage = lazy(() => import("@/pages/dream-logs"));
const CareRulesPage = lazy(() => import("@/pages/care-rules"));
const DocumentManagerPage = lazy(() => import("@/pages/document-manager"));
const RemoteConsole = lazy(() => import("@/pages/remote-console"));
const TalkSessionPage = lazy(() => import("@/pages/talk-session"));
const InspirationPage = lazy(() => import("@/pages/inspiration"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const EmailManagerPage = lazy(() => import("@/pages/email-manager"));
const ExpenseManagerPage = lazy(() => import("@/pages/expense-manager"));
const ArHudPage = lazy(() => import("@/pages/ar-hud"));
const CreatorGodPage = lazy(() => import("@/pages/creator-god"));
const GlassesCompanionPage = lazy(() => import("@/pages/glasses-companion"));
const ImmuneDashboard = lazy(() => import("@/pages/immune-dashboard"));
const SystemConsole = lazy(() => import("@/pages/system-console"));
const OmniArchive = lazy(() => import("@/pages/omni-archive"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const CommandCenter = lazy(() => import("@/pages/command-center"));
const InterfaceXPage = lazy(() => import("@/pages/interface-x"));
const OraclePage = lazy(() => import("@/pages/oracle"));
const DesktopFairyDemo = lazy(() => import("@/pages/desktop-fairy-demo"));
const SpineAvatarDemo = lazy(() => import("@/pages/spine-avatar-demo"));
const InsightListenerPage = lazy(() => import("@/pages/insight-listener"));
const SwarmConsole = lazy(() => import("@/pages/swarm-console"));

// 页面加载骨架屏
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">加载中...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        {/* 关键页面 - 立即加载 */}
        <Route path="/" component={Dashboard} />
        <Route path="/chat" component={ChatPage} />
        
        {/* 懒加载页面 */}
        <Route path="/network" component={RelationshipNetwork} />
        <Route path="/spirit" component={SpiritControl} />
        <Route path="/spirit-control" component={SpiritControl} />
        <Route path="/brain" component={StrategyBrain} />
        <Route path="/terminal" component={TacticalTerminal} />
        <Route path="/vault" component={VaultCompute} />
        <Route path="/intel" component={IntelChamber} />
        <Route path="/projects" component={ProjectCenter} />
        <Route path="/projects/dashboard" component={ProjectDashboard} />
        <Route path="/projects/templates" component={ProjectTemplates} />
        <Route path="/projects/smart-create" component={SmartProjectCreate} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/evolution" component={EvolutionDashboard} />
        <Route path="/reports" component={DailyReportPage} />
        <Route path="/daily-report" component={DailyReportPage} />
        <Route path="/genesis" component={GenesisPage} />
        <Route path="/birth" component={BirthExperiencePage} />
        <Route path="/remote" component={RemoteConsole} />
        <Route path="/talk" component={TalkSessionPage} />
        <Route path="/inspiration" component={InspirationPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/email" component={EmailManagerPage} />
        <Route path="/expense" component={ExpenseManagerPage} />
        <Route path="/avatar" component={ChatPage} />
        <Route path="/dream" component={DreamLogsPage} />
        <Route path="/care" component={CareRulesPage} />
        <Route path="/documents" component={DocumentManagerPage} />
        <Route path="/ar" component={ArHudPage} />
        <Route path="/ar-hud" component={ArHudPage} />
        <Route path="/glasses" component={GlassesCompanionPage} />
        <Route path="/companion" component={GlassesCompanionPage} />
        <Route path="/creator" component={CreatorGodPage} />
        <Route path="/immune" component={ImmuneDashboard} />
        <Route path="/security" component={ImmuneDashboard} />
        <Route path="/console" component={SystemConsole} />
        <Route path="/system" component={SystemConsole} />
        <Route path="/omni-archive" component={OmniArchive} />
        <Route path="/archive" component={OmniArchive} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/safety" component={SettingsPage} />
        <Route path="/command" component={CommandCenter} />
        <Route path="/command-center" component={CommandCenter} />
        <Route path="/interface-x" component={InterfaceXPage} />
        <Route path="/x" component={InterfaceXPage} />
        <Route path="/oracle" component={OraclePage} />
        <Route path="/desktop-fairy" component={DesktopFairyDemo} />
        <Route path="/spine-demo" component={SpineAvatarDemo} />
        <Route path="/insight" component={InsightListenerPage} />
        <Route path="/swarm" component={SwarmConsole} />
        <Route path="/swarm-console" component={SwarmConsole} />
        <Route path="/accessibility-test" component={lazy(() => import("@/pages/accessibility-test"))} />
        
        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useRealtimeSync();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VoiceWakeProvider>
          <div className="min-h-screen bg-background">
            <VaultStatusBar />
             <Router />
            <Toaster />
            <CopyrightFooter />
            <SilentVoiceprintCollector />
          </div>
        </VoiceWakeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
