import { useZ1Store } from "@/lib/z1/god-protocol";
import { HpMonitor } from "@/components/z1/hp-monitor";
import { AIConfigPanel } from "@/components/z1/ai-config-panel";
import { CollaborationPanel } from "@/components/z3/collaboration-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, Activity, Network, Ghost, Brain, Smartphone, Server, FileSearch, FolderKanban, Sparkles, FileText, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { consumeHp, serverNode, hpBalance } = useZ1Store();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleAction = (type: string) => {
    const result = consumeHp(type);
    if (result.success) {
      toast({
        title: "算力已分配",
        description: result.message,
        className: "border-primary text-primary"
      });
    } else {
      toast({
        title: "算力不足",
        description: result.message,
        variant: "destructive"
      });
    }
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en');
  };

  return (
    <div className="min-h-screen bg-background p-6 font-sans text-foreground transition-colors duration-500">
      
      <header className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <BrainCircuit className="w-8 h-8 text-primary animate-pulse" />
          <div>
            <h1 className="text-2xl font-light tracking-tight">{t('system.name')}</h1>
            <p className="text-muted-foreground font-mono text-xs">
              {t('system.status')}: <span className="text-green-500">ONLINE</span> | {serverNode.ip}
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <AIConfigPanel />
          <Button variant="ghost" size="sm" onClick={toggleLang}>
            {i18n.language === 'en' ? '中文' : 'ENG'}
          </Button>
          <div className="px-2 py-1 bg-secondary rounded text-[10px] font-mono text-secondary-foreground">
            v6.0
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-2 space-y-4">
          <HpMonitor />
          
          <Card className="border-border/50">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                <Cpu className="w-3 h-3" />
                算力池
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="p-1.5 bg-secondary/30 rounded text-center">
                  <div className="text-primary font-mono font-bold">{Math.round(hpBalance * 0.3)}</div>
                  <div className="text-muted-foreground">推理</div>
                </div>
                <div className="p-1.5 bg-secondary/30 rounded text-center">
                  <div className="text-primary font-mono font-bold">{Math.round(hpBalance * 0.25)}</div>
                  <div className="text-muted-foreground">存储</div>
                </div>
                <div className="p-1.5 bg-secondary/30 rounded text-center">
                  <div className="text-primary font-mono font-bold">{Math.round(hpBalance * 0.25)}</div>
                  <div className="text-muted-foreground">同步</div>
                </div>
                <div className="p-1.5 bg-secondary/30 rounded text-center">
                  <div className="text-primary font-mono font-bold">{Math.round(hpBalance * 0.2)}</div>
                  <div className="text-muted-foreground">预留</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-3 rounded-lg border border-border/50 bg-card/50">
            <CollaborationPanel />
          </div>
        </div>

        <div className="lg:col-span-10">
          <div className="mb-4">
            <h2 className="text-lg font-light flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              核心模块
            </h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/network')}
            >
              <Network className="w-5 h-5" />
              <span className="text-sm">Z2 关系网</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/spirit')}
            >
              <Ghost className="w-5 h-5" />
              <span className="text-sm">Z3 灵魂仲裁</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/brain')}
            >
              <Brain className="w-5 h-5" />
              <span className="text-sm">Z4 决策大脑</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/terminal')}
            >
              <Smartphone className="w-5 h-5" />
              <span className="text-sm">Z5 战术终端</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/vault')}
            >
              <Server className="w-5 h-5" />
              <span className="text-sm">Z6 资源堡垒</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/intel')}
              data-testid="button-nav-intel"
            >
              <FileSearch className="w-5 h-5" />
              <span className="text-sm">情报决策</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/projects')}
              data-testid="button-nav-projects"
            >
              <FolderKanban className="w-5 h-5" />
              <span className="text-sm">项目管理</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/evolution')}
              data-testid="button-nav-evolution"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-sm">进化成长</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => setLocation('/reports')}
              data-testid="button-nav-reports"
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm">每日汇报</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary transition-all"
              onClick={() => handleAction('DREAM_SIMULATION')}
            >
              <Activity className="w-5 h-5" />
              <span className="text-sm">梦境模拟</span>
              <span className="text-[10px] text-muted-foreground">-20 HP</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
