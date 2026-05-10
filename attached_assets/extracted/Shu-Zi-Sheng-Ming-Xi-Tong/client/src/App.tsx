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
import EvolutionDashboard from "@/pages/evolution-dashboard";
import DailyReportPage from "@/pages/daily-report";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { AvatarChat } from "@/components/avatar/avatar-chat";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/network" component={RelationshipNetwork} />
      <Route path="/spirit" component={SpiritControl} />
      <Route path="/brain" component={StrategyBrain} />
      <Route path="/terminal" component={TacticalTerminal} />
      <Route path="/vault" component={VaultCompute} />
      <Route path="/intel" component={IntelChamber} />
      <Route path="/projects" component={ProjectCenter} />
      <Route path="/evolution" component={EvolutionDashboard} />
      <Route path="/reports" component={DailyReportPage} />
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
        <RealtimeSyncProvider>
          <Toaster />
          <Router />
          <AvatarChat />
        </RealtimeSyncProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
