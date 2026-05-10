/**
 * App.tsx - main application shell.
 */
import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

import { BusinessBottomNav } from "@/components/mobile/BusinessBottomNav";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useHpEvolutionSync } from "@/hooks/use-hp-evolution-sync";
import { useDiagnostics } from "@/hooks/use-diagnostics";
import { useGlobalStore } from "@/store/globalStore";
import DesktopLayout from "@/components/desktop/DesktopLayout";

const Awakening = lazy(() => import("@/pages/mobile/Awakening"));
const BusinessHub = lazy(() => import("@/pages/mobile/BusinessHub"));
const ConversationHome = lazy(() => import("@/pages/mobile/ConversationHome"));
const ExpertWorkstation = lazy(() => import("@/pages/mobile/ExpertWorkstation"));
const ProjectManager = lazy(() => import("@/pages/mobile/ProjectManager"));
const ProjectDetail = lazy(() => import("@/pages/mobile/ProjectDetail"));
const ContactManager = lazy(() => import("@/pages/mobile/ContactManager"));
const ContactDetail = lazy(() => import("@/pages/mobile/ContactDetail"));
const DigitalVault = lazy(() => import("@/pages/mobile/DigitalVault"));
const NavigatorCommand = lazy(() => import("@/pages/mobile/NavigatorCommand"));
const SecurityCenter = lazy(() => import("@/pages/mobile/SecurityCenter"));
const CommandCenter = lazy(() => import("@/pages/mobile/CommandCenter"));
const InsightChamber = lazy(() => import("@/pages/mobile/InsightChamber"));
const ScannerLab = lazy(() => import("@/pages/mobile/ScannerLab"));
const ExpertCenter = lazy(() => import("@/pages/mobile/ExpertCenter"));
const ResourceManager = lazy(() => import("@/pages/mobile/ResourceManager"));
const NavigatorSettings = lazy(() => import("@/pages/mobile/NavigatorSettings"));
const RemotePCConsole = lazy(() => import("@/pages/mobile/RemotePCConsole"));
const SkillMarketplace = lazy(() => import("@/pages/mobile/SkillMarketplace"));
const WorkflowEditor = lazy(() => import("@/pages/mobile/WorkflowEditor"));
const TaskCenterMobile = lazy(() => import("@/pages/mobile/TaskCenter"));
const ConversationInbox = lazy(() => import("@/pages/mobile/ConversationInbox"));
const ConversationDetail = lazy(() => import("@/pages/mobile/ConversationDetail"));
const DeviceBinding = lazy(() => import("@/pages/mobile/DeviceBinding"));
const DeviceStatus = lazy(() => import("@/pages/mobile/DeviceStatus"));
const OmiImporter = lazy(() => import("@/pages/mobile/OmiImporter"));
const DreamReview = lazy(() => import("@/pages/mobile/DreamReview"));

const DesktopLogin = lazy(() => import("@/pages/desktop/Login"));
const DesktopHome = lazy(() => import("@/pages/desktop/Home"));
const DesktopChat = lazy(() => import("@/pages/desktop/Chat"));
const DesktopTerminal = lazy(() => import("@/pages/desktop/Terminal"));
const DesktopExperts = lazy(() => import("@/pages/desktop/Experts"));
const DesktopProjects = lazy(() => import("@/pages/desktop/Projects"));
const DesktopContacts = lazy(() => import("@/pages/desktop/Contacts"));
const DesktopVault = lazy(() => import("@/pages/desktop/Vault"));
const SovereignDashboard = lazy(() => import("@/pages/desktop/SovereignDashboard"));
const NodeDashboard = lazy(() => import("@/pages/desktop/NodeDashboard"));
const TaskCenterDesktop = lazy(() => import("@/pages/desktop/TaskCenter"));

function PageSkeleton() {
  return (
    <div className="flex-1 bg-[#030712] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function DesktopRoutes() {
  return (
    <DesktopLayout>
      <Switch>
        <Route path="/desktop/chat" component={DesktopChat} />
        <Route path="/desktop/control" component={RemotePCConsole} />
        <Route path="/desktop/tasks" component={TaskCenterDesktop} />
        <Route path="/desktop/terminal" component={DesktopTerminal} />
        <Route path="/desktop/node" component={NodeDashboard} />
        <Route path="/desktop/fleet" component={SovereignDashboard} />
        <Route path="/desktop/reports" component={SovereignDashboard} />
        <Route path="/desktop/experts" component={DesktopExperts} />
        <Route path="/desktop/inspiration" component={SovereignDashboard} />
        <Route path="/desktop/alerts" component={SovereignDashboard} />
        <Route path="/desktop/node/draft" component={NodeDashboard} />
        <Route path="/desktop/node/tasks" component={NodeDashboard} />
        <Route path="/desktop/node/ideas" component={NodeDashboard} />
        <Route path="/desktop/vault" component={DesktopVault} />
        <Route path="/desktop/projects" component={DesktopProjects} />
        <Route path="/desktop/contacts" component={DesktopContacts} />
        <Route path="/desktop/settings" component={DesktopHome} />
        <Route path="/desktop" component={DesktopHome} />
      </Switch>
    </DesktopLayout>
  );
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const realtimeSyncEnabled = location.startsWith("/desktop");
  useRealtimeSync(realtimeSyncEnabled);
  useHpEvolutionSync(realtimeSyncEnabled);

  const setDeviceHealth = useGlobalStore((s) => s.setDeviceHealth);
  const { health } = useDiagnostics(true);
  useEffect(() => {
    if (health) setDeviceHealth(health);
  }, [health, setDeviceHealth]);

  useEffect(() => {
    const handleGlobalEvent = (e: any) => {
      if (e.detail?.type === "MELTDOWN_TRIGGERED") {
        localStorage.clear();
        setLocation("/awakening");
        toast.error("安全协议执行：系统已进入静默态。");
      }
    };

    window.addEventListener("jilin_global_event", handleGlobalEvent);
    return () => window.removeEventListener("jilin_global_event", handleGlobalEvent);
  }, [setLocation]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#030712] text-white overflow-hidden relative font-sans">
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <Switch>
            <Route path="/awakening" component={Awakening} />
            <Route path="/" component={ConversationHome} />
            <Route path="/experts" component={ExpertCenter} />
            <Route path="/experts/:id" component={({ params }) => <ExpertWorkstation params={params} />} />
            <Route path="/projects" component={ProjectManager} />
            <Route path="/projects/:id" component={({ params }) => <ProjectDetail params={params} />} />
            <Route path="/contacts" component={ContactManager} />
            <Route path="/contacts/:id" component={({ params }) => <ContactDetail params={params} />} />
            <Route path="/vault" component={DigitalVault} />
            <Route path="/navigator-command" component={NavigatorCommand} />
            <Route path="/security" component={SecurityCenter} />
            <Route path="/command" component={CommandCenter} />
            <Route path="/insight" component={InsightChamber} />
            <Route path="/scanner" component={ScannerLab} />
            <Route path="/resources" component={ResourceManager} />
            <Route path="/navigator-settings" component={NavigatorSettings} />
            <Route path="/remote-pc" component={RemotePCConsole} />
            <Route path="/tasks" component={TaskCenterMobile} />
            <Route path="/chat" component={ConversationHome} />
            <Route path="/inbox" component={ConversationInbox} />
            <Route path="/inbox/:id" component={({ params }) => <ConversationDetail params={params} />} />
            <Route path="/devices" component={DeviceBinding} />
            <Route path="/devices/:deviceId" component={({ params }) => <DeviceStatus params={params} />} />
            <Route path="/omi-import" component={OmiImporter} />
            <Route path="/dream-review" component={DreamReview} />
            <Route path="/skills" component={SkillMarketplace} />
            <Route path="/workflow" component={WorkflowEditor} />
            <Route path="/navigator-overview" component={BusinessHub} />

            {/* Desktop routes */}
            <Route path="/desktop/login" component={DesktopLogin} />
            <Route path="/desktop/chat" component={DesktopRoutes} />
            <Route path="/desktop/:rest*" component={DesktopRoutes} />
            <Route path="/desktop" component={DesktopRoutes} />
          </Switch>
        </Suspense>
      </main>
      {/* Persistent mobile bottom navigation */}
      <BusinessBottomNav />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-center" expand={false} richColors />
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
