import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import RelationshipNetwork from "@/pages/relationship-network";
import SpiritControl from "@/pages/spirit-control";
import StrategyBrain from "@/pages/strategy-brain";
import TacticalTerminal from "@/pages/tactical-terminal";
import VaultCompute from "@/pages/vault-compute";
import IntelChamber from "@/pages/intel-chamber";
import ProjectCenter from "@/pages/project-center";
import ProjectDetail from "@/pages/project-detail";
import ProjectDashboard from "@/pages/project-dashboard";
import ProjectTemplates from "@/pages/project-templates";
import SmartProjectCreate from "@/pages/smart-project-create";
import EvolutionDashboard from "@/pages/evolution-dashboard";
import DailyReportPage from "@/pages/daily-report";
import GenesisPage from "@/pages/genesis";
import BirthExperiencePage from "@/pages/birth-experience";
import DreamLogsPage from "@/pages/dream-logs";
import CareRulesPage from "@/pages/care-rules";
import DocumentManagerPage from "@/pages/document-manager";
import RemoteConsole from "@/pages/remote-console";
import TalkSessionPage from "@/pages/talk-session";
import InspirationPage from "@/pages/inspiration";
import ChatPage from "@/pages/chat";
import IntegrationsPage from "@/pages/integrations";
import EmailManagerPage from "@/pages/email-manager";
import ExpenseManagerPage from "@/pages/expense-manager";
import ArHudPage from "@/pages/ar-hud";
import CreatorGodPage from "@/pages/creator-god";
import GlassesCompanionPage from "@/pages/glasses-companion";
import ImmuneDashboard from "@/pages/immune-dashboard";
import OmniArchive from "@/pages/omni-archive";
import SettingsPage from "@/pages/settings";
import CommandCenter from "@/pages/command-center";
import InterfaceXPage from "@/pages/interface-x";
import OraclePage from "@/pages/oracle";
import DesktopFairyDemo from "@/pages/desktop-fairy-demo";
import SpineAvatarDemo from "@/pages/spine-avatar-demo";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { VaultStatusBar } from "@/components/ui/vault-status-bar";
import { SilentVoiceprintCollector } from "@/components/z1/silent-voiceprint-collector";
import { VoiceWakeProvider } from "@/hooks/use-voice-wake";
import { CopyrightFooter } from "@/components/ui/copyright-footer";
import { MobileNav } from "@/components/ui/mobile-nav";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
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
      <Route path="/chat" component={ChatPage} />
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
      <Route path="/omni-archive" component={OmniArchive} />
      <Route path="/archive" component={OmniArchive} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/safety" component={SettingsPage} />
      <Route path="/command" component={CommandCenter} />
      <Route path="/command-center" component={CommandCenter} />
      <Route path="/interface-x" component={InterfaceXPage} />
      <Route path="/cockpit" component={InterfaceXPage} />
      <Route path="/oracle" component={OraclePage} />
      <Route path="/predict" component={OraclePage} />
      <Route path="/fairy" component={DesktopFairyDemo} />
      <Route path="/desktop-fairy" component={DesktopFairyDemo} />
      <Route path="/spine" component={SpineAvatarDemo} />
      <Route path="/spine-avatar" component={SpineAvatarDemo} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VoiceWakeProvider>
          <RealtimeSyncProvider>
            <Toaster />
            <div className="pb-20 md:pb-6">
              <Router />
            </div>
            <MobileNav />
            <VaultStatusBar />
            <SilentVoiceprintCollector />
            <CopyrightFooter />
          </RealtimeSyncProvider>
        </VoiceWakeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
