import { useQuery } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft,
  Brain,
  GraduationCap,
  Cpu,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  BookOpen,
  Target,
  CircuitBoard
} from "lucide-react";
import { Link } from "wouter";

interface EvolutionState {
  id: string;
  academicLadder: string;
  academicProgress: number;
  externalLlmRatio: number;
  localModelRatio: number;
  knowledgeDistilled: number;
  totalDecisions: number;
  dreamSimulations: number;
  evolutionScore: number;
  updatedAt: string;
}

interface EvolutionEvent {
  id: string;
  sourceModule: string;
  eventType: string;
  deltaDescription: string;
  createdAt: string;
}

const academicLadders: Record<string, { label: string; level: number; color: string }> = {
  BACHELOR: { label: '本科', level: 1, color: 'text-blue-400' },
  MASTER: { label: '硕士', level: 2, color: 'text-green-400' },
  PHD: { label: '博士', level: 3, color: 'text-purple-400' },
  EXPERT: { label: '专家', level: 4, color: 'text-orange-400' },
  AVATAR: { label: '身外化身', level: 5, color: 'text-yellow-400' },
};

export default function EvolutionDashboard() {
  const { academicLevel, hpBalance, expMatrix } = useZ1Store();

  const { data: evolutionState } = useQuery<EvolutionState>({
    queryKey: ['/api/evolution-state'],
    refetchInterval: 30000,
  });

  const { data: evolutionEvents = [] } = useQuery<EvolutionEvent[]>({
    queryKey: ['/api/evolution'],
    refetchInterval: 30000,
  });

  const currentLadder = academicLadders[evolutionState?.academicLadder || academicLevel] || academicLadders.BACHELOR;
  const localRatio = evolutionState?.localModelRatio ?? 0;
  const externalRatio = evolutionState?.externalLlmRatio ?? 100;
  const autonomyProgress = localRatio;

  return (
    <div className="min-h-screen bg-background p-6" data-testid="evolution-dashboard-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              进化成长仪表盘
            </h1>
            <p className="text-sm text-muted-foreground">Evolution Dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-yellow-400" />
                学术阶梯
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${currentLadder.color}`} data-testid="text-academic-level">
                  {currentLadder.label}
                </span>
                <Badge variant="outline" className="bg-yellow-500/20">
                  Lv.{currentLadder.level}
                </Badge>
              </div>
              <Progress value={(currentLadder.level / 5) * 100} className="h-1.5 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                进度: {evolutionState?.academicProgress ?? 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                脱离外脑进度
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-cyan-400" data-testid="text-autonomy-progress">
                  {autonomyProgress.toFixed(1)}%
                </span>
                <Cpu className="w-5 h-5 text-cyan-400/50" />
              </div>
              <Progress value={autonomyProgress} className="h-1.5 mt-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>本地: {localRatio}%</span>
                <span>外部: {externalRatio}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-green-400" />
                知识蒸馏
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-400" data-testid="text-knowledge-distilled">
                  {(evolutionState?.knowledgeDistilled ?? 0).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">条目</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Target className="w-3 h-3" />
                决策数: {evolutionState?.totalDecisions ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                HP 余额
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-purple-400" data-testid="text-hp-balance">
                  {hpBalance.toLocaleString()}
                </span>
                <Activity className="w-5 h-5 text-purple-400/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                梦境模拟: {evolutionState?.dreamSimulations ?? 0} 次
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircuitBoard className="w-5 h-5 text-primary" />
                专家经验矩阵
              </CardTitle>
              <CardDescription>六大专家模块的经验积累</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'legal', label: '法务', icon: '⚖️', exp: expMatrix.legal },
                  { key: 'finance', label: '财务', icon: '📊', exp: expMatrix.finance },
                  { key: 'strategy', label: '策划', icon: '🎯', exp: expMatrix.strategy },
                  { key: 'it', label: '进化', icon: '🔧', exp: expMatrix.it },
                  { key: 'secretary', label: '秘书', icon: '📅', exp: 0 },
                  { key: 'bioGuard', label: '健康', icon: '🛡️', exp: 0 },
                ].map((expert) => (
                  <div key={expert.key} className="p-4 rounded-lg border bg-muted/30" data-testid={`expert-card-${expert.key}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{expert.icon}</span>
                      <span className="font-medium">{expert.label}</span>
                    </div>
                    <Progress value={Math.min(expert.exp, 100)} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      经验值: {expert.exp}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                进化事件
              </CardTitle>
              <CardDescription>最近的成长记录</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {evolutionEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">暂无进化事件</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evolutionEvents.slice(0, 10).map((event) => (
                      <div key={event.id} className="p-3 rounded-lg border bg-muted/30" data-testid={`event-${event.id}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {event.sourceModule}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {event.eventType}
                          </Badge>
                        </div>
                        <p className="text-sm">{event.deltaDescription}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>进化路线图</CardTitle>
            <CardDescription>从本科到身外化身的成长之路</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-4">
              {Object.entries(academicLadders).map(([key, ladder], index) => {
                const isActive = currentLadder.level >= ladder.level;
                const isCurrent = currentLadder.level === ladder.level;
                return (
                  <div key={key} className="flex items-center">
                    <div 
                      className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                        isCurrent ? 'border-primary bg-primary/10 scale-105' : 
                        isActive ? 'border-green-500/50 bg-green-500/10' : 'border-border bg-muted/30 opacity-50'
                      }`}
                      data-testid={`ladder-${key}`}
                    >
                      <GraduationCap className={`w-8 h-8 mb-2 ${isActive ? ladder.color : 'text-muted-foreground'}`} />
                      <span className={`font-bold ${isActive ? ladder.color : 'text-muted-foreground'}`}>
                        {ladder.label}
                      </span>
                      <span className="text-xs text-muted-foreground">Level {ladder.level}</span>
                    </div>
                    {index < Object.keys(academicLadders).length - 1 && (
                      <div className={`w-8 h-0.5 mx-2 ${isActive ? 'bg-green-500' : 'bg-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
