import { useQuery } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain,
  GraduationCap,
  Cpu,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  BookOpen,
  Target,
  CircuitBoard,
  Trophy,
  Star,
  Rocket,
  CheckCircle2,
  Circle,
  Lightbulb,
  MessageCircle,
  Moon,
  Award
} from "lucide-react";

interface EvolutionState {
  id: string;
  academicLadder: string;
  academicProgress: number;
  academicXp: number;
  nextLevelXp: number;
  externalLlmRatio: number;
  localModelRatio: number;
  knowledgeDistilled: number;
  totalDecisions: number;
  dreamSimulations: number;
  totalInsights: number;
  totalSkillCapsules: number;
  activeSkillCapsules: number;
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

interface SkillCapsule {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: number;
  usageCount: number;
  successRate: number;
  createdAt: string;
}

interface GrowthReport {
  currentLevel: string;
  totalXp: number;
  nextLevelXp: number;
  totalSkills: number;
  activeSkills: number;
  totalMemories: number;
  todayNewSkills: string[];
  todayEventsCount: number;
  topAbilities: { field: string; count: number; exp: number }[];
  milestones: { name: string; achieved: boolean; icon: string }[];
  recentGrowth: { type: string; description: string; module: string; time: string }[];
}

interface ShadowMemoryStats {
  totalMemories: number;
  totalExp: number;
  byField: { field: string; count: number; totalExp: number }[];
}

const academicLadders: Record<string, { label: string; level: number; color: string }> = {
  BACHELOR: { label: '本科', level: 1, color: 'text-blue-400' },
  MASTER: { label: '硕士', level: 2, color: 'text-green-400' },
  PHD: { label: '博士', level: 3, color: 'text-purple-400' },
  EXPERT: { label: '专家', level: 4, color: 'text-orange-400' },
  AVATAR: { label: '身外化身', level: 5, color: 'text-yellow-400' },
};

const categoryIcons: Record<string, string> = {
  'communication': '💬',
  'analysis': '🔍',
  'strategy': '🎯',
  'legal': '⚖️',
  'finance': '📊',
  'planning': '📅',
  'psychology': '🧠',
  'general': '✨',
};

const fieldLabels: Record<string, string> = {
  'user_preference': '用户偏好',
  'user_dislike': '用户禁忌',
  'user_identity': '身份认知',
  'usage_pattern': '使用习惯',
  'conversation': '对话学习',
  'general': '综合能力',
};

export default function EvolutionDashboard() {
  const { academicLevel, hpBalance, expMatrix } = useZ1Store();
  const [showGrowthReport, setShowGrowthReport] = useState(false);

  const { data: evolutionState } = useQuery<EvolutionState>({
    queryKey: ['/api/evolution-state'],
    refetchInterval: 30000,
  });

  const { data: evolutionEvents = [] } = useQuery<EvolutionEvent[]>({
    queryKey: ['/api/evolution'],
    refetchInterval: 30000,
  });

  const { data: skillCapsules = [] } = useQuery<SkillCapsule[]>({
    queryKey: ['/api/skill-capsules'],
    refetchInterval: 60000,
  });

  const { data: memoryStats } = useQuery<ShadowMemoryStats>({
    queryKey: ['/api/shadow-memories'],
    refetchInterval: 60000,
  });

  const { data: growthReport } = useQuery<GrowthReport>({
    queryKey: ['/api/evolution/growth-report'],
    refetchInterval: 60000,
  });

  useEffect(() => {
    const hasSeenToday = localStorage.getItem('growth_report_seen');
    const today = new Date().toDateString();
    if (hasSeenToday !== today && growthReport && (growthReport.todayEventsCount > 0 || growthReport.totalMemories > 0)) {
      setShowGrowthReport(true);
      localStorage.setItem('growth_report_seen', today);
    }
  }, [growthReport]);

  const currentLadder = academicLadders[evolutionState?.academicLadder || academicLevel] || academicLadders.BACHELOR;
  const localRatio = evolutionState?.localModelRatio ?? 0;
  const externalRatio = evolutionState?.externalLlmRatio ?? 100;
  const autonomyProgress = localRatio;

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-6" data-testid="evolution-dashboard-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <GlobalWakeHeader 
          title="进化中心" 
          subtitle="Evolution Center"
        />

        <div className="flex gap-2 mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowGrowthReport(true)}
            className="gap-2"
            data-testid="btn-growth-report"
          >
            <Rocket className="w-4 h-4" />
            成长报告
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-yellow-400" />
                学术阶梯
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="flex items-center justify-between">
                <span className={`text-lg md:text-2xl font-bold ${currentLadder.color}`} data-testid="text-academic-level">
                  {currentLadder.label}
                </span>
                <Badge variant="outline" className="bg-yellow-500/20 text-xs">
                  Lv.{currentLadder.level}
                </Badge>
              </div>
              <Progress value={(currentLadder.level / 5) * 100} className="h-1.5 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                XP: {evolutionState?.academicXp ?? 0}/{evolutionState?.nextLevelXp ?? 1000}
              </p>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                自主进化
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="flex items-center justify-between">
                <span className="text-lg md:text-2xl font-bold text-cyan-400" data-testid="text-autonomy-progress">
                  {autonomyProgress.toFixed(1)}%
                </span>
                <Cpu className="w-5 h-5 text-cyan-400/50" />
              </div>
              <Progress value={autonomyProgress} className="h-1.5 mt-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>本地: {localRatio}%</span>
                <span>云端: {externalRatio}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-green-400" />
                技能胶囊
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="flex items-center justify-between">
                <span className="text-lg md:text-2xl font-bold text-green-400" data-testid="text-skill-count">
                  {skillCapsules.length}
                </span>
                <span className="text-xs text-muted-foreground">个技能</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                活跃: {skillCapsules.filter(s => s.isActive === 1).length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                影子记忆
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="flex items-center justify-between">
                <span className="text-lg md:text-2xl font-bold text-purple-400" data-testid="text-memory-count">
                  {memoryStats?.totalMemories ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">条</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Star className="w-3 h-3 text-yellow-400" />
                经验值: {memoryStats?.totalExp ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Trophy className="w-5 h-5 text-yellow-400" />
                成长里程碑
              </CardTitle>
              <CardDescription>解锁成就，见证进化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {growthReport?.milestones.map((milestone, index) => (
                  <motion.div
                    key={milestone.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-3 rounded-lg border transition-all ${
                      milestone.achieved 
                        ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border-yellow-500/50' 
                        : 'bg-muted/30 border-border/50 opacity-60'
                    }`}
                    data-testid={`milestone-${index}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{milestone.icon}</span>
                      {milestone.achieved ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className={`text-sm font-medium ${milestone.achieved ? '' : 'text-muted-foreground'}`}>
                      {milestone.name}
                    </p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <CircuitBoard className="w-5 h-5 text-primary" />
                能力分布
              </CardTitle>
              <CardDescription>各领域学习积累</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {memoryStats?.byField.slice(0, 5).map((field, index) => (
                  <div key={field.field} className="space-y-1" data-testid={`ability-${field.field}`}>
                    <div className="flex justify-between text-sm">
                      <span>{fieldLabels[field.field] || field.field}</span>
                      <span className="text-muted-foreground">{field.totalExp} XP</span>
                    </div>
                    <Progress 
                      value={Math.min((field.totalExp / Math.max(...(memoryStats?.byField.map(f => f.totalExp) || [1]))) * 100, 100)} 
                      className="h-2" 
                    />
                  </div>
                ))}
                {(!memoryStats?.byField || memoryStats.byField.length === 0) && (
                  <div className="text-center text-muted-foreground py-4">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">尚未开始学习</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Sparkles className="w-5 h-5 text-green-400" />
                技能胶囊库
              </CardTitle>
              <CardDescription>已学会的能力</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                {skillCapsules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Zap className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">暂无技能胶囊</p>
                    <p className="text-xs mt-1">与小智对话可解锁新技能</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {skillCapsules.map((capsule) => (
                      <motion.div 
                        key={capsule.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-lg border ${
                          capsule.isActive === 1 
                            ? 'bg-green-500/10 border-green-500/30' 
                            : 'bg-muted/30 border-border/50'
                        }`}
                        data-testid={`skill-${capsule.id}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{categoryIcons[capsule.category] || '✨'}</span>
                          <span className="text-sm font-medium truncate">{capsule.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {capsule.description || '技能描述'}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>使用: {capsule.usageCount}次</span>
                          <span>成功率: {Math.round((capsule.successRate || 1) * 100)}%</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                进化事件
              </CardTitle>
              <CardDescription>最近的成长记录</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                {evolutionEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">暂无进化事件</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evolutionEvents.slice(0, 10).map((event) => (
                      <motion.div 
                        key={event.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg border bg-muted/30" 
                        data-testid={`event-${event.id}`}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              进化路线图
            </CardTitle>
            <CardDescription>从本科到身外化身的成长之路</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-4">
              {Object.entries(academicLadders).map(([key, ladder], index) => {
                const isActive = currentLadder.level >= ladder.level;
                const isCurrent = currentLadder.level === ladder.level;
                return (
                  <div key={key} className="flex items-center">
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex flex-col items-center p-3 md:p-4 rounded-lg border transition-all min-w-[80px] ${
                        isCurrent ? 'border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20' : 
                        isActive ? 'border-green-500/50 bg-green-500/10' : 'border-border bg-muted/30 opacity-50'
                      }`}
                      data-testid={`ladder-${key}`}
                    >
                      <GraduationCap className={`w-6 md:w-8 h-6 md:h-8 mb-2 ${isActive ? ladder.color : 'text-muted-foreground'}`} />
                      <span className={`font-bold text-sm md:text-base ${isActive ? ladder.color : 'text-muted-foreground'}`}>
                        {ladder.label}
                      </span>
                      <span className="text-xs text-muted-foreground">Lv.{ladder.level}</span>
                    </motion.div>
                    {index < Object.keys(academicLadders).length - 1 && (
                      <div className={`w-4 md:w-8 h-0.5 mx-1 md:mx-2 ${isActive ? 'bg-green-500' : 'bg-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircuitBoard className="w-5 h-5 text-primary" />
              专家经验矩阵
            </CardTitle>
            <CardDescription>六大专家模块的经验积累</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {[
                { key: 'legal', label: '法律专家', icon: '⚖️', exp: expMatrix.legal, color: 'text-blue-400' },
                { key: 'finance', label: '财务专家', icon: '💰', exp: expMatrix.finance, color: 'text-green-400' },
                { key: 'strategy', label: '策略专家', icon: '🎯', exp: expMatrix.strategy, color: 'text-orange-400' },
                { key: 'psychology', label: '心理专家', icon: '🧠', exp: expMatrix.psychology, color: 'text-purple-400' },
                { key: 'secretary', label: '秘书专家', icon: '📋', exp: expMatrix.secretary, color: 'text-cyan-400' },
                { key: 'planning', label: '规划专家', icon: '📅', exp: expMatrix.planning, color: 'text-yellow-400' },
              ].map((expert) => (
                <motion.div 
                  key={expert.key} 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 md:p-4 rounded-lg border bg-gradient-to-br from-muted/50 to-muted/30 hover:border-primary/50 transition-colors" 
                  data-testid={`expert-card-${expert.key}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{expert.icon}</span>
                    <span className={`font-medium text-sm ${expert.color}`}>{expert.label}</span>
                  </div>
                  <Progress value={Math.min(expert.exp, 100)} className="h-2" />
                  <div className="flex justify-between items-center mt-2">
                    <p className={`text-xs font-medium ${expert.color}`}>
                      XP: {expert.exp}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Lv.{Math.floor(expert.exp / 100) + 1}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {showGrowthReport && growthReport && (
          <Dialog open={showGrowthReport} onOpenChange={setShowGrowthReport}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  小智成长报告
                </DialogTitle>
                <DialogDescription>
                  主人，这是我今天的成长总结
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border border-yellow-500/30">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="font-bold">{academicLadders[growthReport.currentLevel]?.label || '本科'}</p>
                      <p className="text-xs text-muted-foreground">当前等级</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{growthReport.totalXp}</p>
                    <p className="text-xs text-muted-foreground">/ {growthReport.nextLevelXp} XP</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-green-400">{growthReport.totalSkills}</p>
                    <p className="text-xs text-muted-foreground">技能数</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-purple-400">{growthReport.totalMemories}</p>
                    <p className="text-xs text-muted-foreground">记忆数</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-cyan-400">{growthReport.todayEventsCount}</p>
                    <p className="text-xs text-muted-foreground">今日成长</p>
                  </div>
                </div>

                {growthReport.todayNewSkills.length > 0 && (
                  <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-green-400" />
                      今日新学技能
                    </p>
                    <div className="space-y-1">
                      {growthReport.todayNewSkills.map((skill, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {skill}</p>
                      ))}
                    </div>
                  </div>
                )}

                {growthReport.recentGrowth.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">最近成长</p>
                    {growthReport.recentGrowth.slice(0, 3).map((growth, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <TrendingUp className="w-3 h-3 text-primary mt-0.5" />
                        <span className="text-muted-foreground">{growth.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={() => setShowGrowthReport(false)}
                  data-testid="btn-close-report"
                >
                  继续进化
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
