import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useZ1Store, ACADEMIC_LEVELS, MAX_HP } from '@/lib/z1/god-protocol';
import { 
  GraduationCap, Zap, Brain, Star, TrendingUp, 
  Shield, BookOpen, Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_COLORS: Record<string, string> = {
  BACHELOR: 'from-green-500 to-emerald-600',
  MASTER: 'from-blue-500 to-indigo-600',
  DOCTOR: 'from-purple-500 to-violet-600',
  PROFESSOR: 'from-amber-500 to-orange-600',
  EXPERT: 'from-rose-500 to-red-600',
};

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  BACHELOR: <BookOpen className="w-5 h-5" />,
  MASTER: <GraduationCap className="w-5 h-5" />,
  DOCTOR: <Brain className="w-5 h-5" />,
  PROFESSOR: <Star className="w-5 h-5" />,
  EXPERT: <Sparkles className="w-5 h-5" />,
};

const LEVEL_NAMES: Record<string, string> = {
  BACHELOR: '本科级',
  MASTER: '硕士级',
  DOCTOR: '博士级',
  PROFESSOR: '教授级',
  EXPERT: '专家级·身外化身',
};

const LEVEL_ABILITIES: Record<string, string[]> = {
  BACHELOR: ['基础指令执行', '简单文档翻译', '计步数据同步'],
  MASTER: ['情报关键词过滤', '多模态分析', '复杂报告解读'],
  DOCTOR: ['深度推理链输出', 'Z4六核协同', '商业博弈推演'],
  PROFESSOR: ['命令预判', '本地模型进化', '自主素材准备'],
  EXPERT: ['身外化身', '虚拟CEO模式', '私有模型驱动'],
};

interface EvolutionDashboardProps {
  compact?: boolean;
}

export function EvolutionDashboard({ compact = false }: EvolutionDashboardProps) {
  const { academicLevel, academicXp, hpBalance, localModelProgress } = useZ1Store();
  const [animatedXp, setAnimatedXp] = useState(0);
  
  const currentLevelIndex = ACADEMIC_LEVELS.indexOf(academicLevel);
  const nextLevel = ACADEMIC_LEVELS[currentLevelIndex + 1];
  const xpForNextLevel = (currentLevelIndex + 1) * 1000;
  const xpProgress = Math.min((academicXp / xpForNextLevel) * 100, 100);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedXp(xpProgress), 100);
    return () => clearTimeout(timer);
  }, [xpProgress]);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30" data-testid="evolution-compact">
        <div className={cn(
          "p-2 rounded-full bg-gradient-to-br",
          LEVEL_COLORS[academicLevel]
        )}>
          {LEVEL_ICONS[academicLevel]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{LEVEL_NAMES[academicLevel]}</span>
            <Badge variant="outline" className="text-[10px]">
              XP: {academicXp}
            </Badge>
          </div>
          <Progress value={animatedXp} className="h-1.5 mt-1" />
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-background to-secondary/20 border-primary/20" data-testid="evolution-dashboard">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          学术进化阶梯
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-4 rounded-xl bg-gradient-to-br shadow-lg",
            LEVEL_COLORS[academicLevel]
          )}>
            <div className="text-white">
              {LEVEL_ICONS[academicLevel]}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{LEVEL_NAMES[academicLevel]}</h3>
            <p className="text-sm text-muted-foreground">
              {nextLevel ? `距离${LEVEL_NAMES[nextLevel]}还需 ${xpForNextLevel - academicXp} XP` : '已达最高等级'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>经验进度</span>
            <span className="font-mono">{academicXp} / {xpForNextLevel}</span>
          </div>
          <div className="relative">
            <Progress value={animatedXp} className="h-3" />
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ backgroundSize: '200% 100%' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Zap className="w-4 h-4" />
              HP算力
            </div>
            <div className="text-lg font-bold">{hpBalance} / {MAX_HP}</div>
            <Progress value={(hpBalance / MAX_HP) * 100} className="h-1.5 mt-1" />
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Shield className="w-4 h-4" />
              本地化进度
            </div>
            <div className="text-lg font-bold">{Math.round(localModelProgress * 100)}%</div>
            <Progress value={localModelProgress * 100} className="h-1.5 mt-1" />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4" />
            当前能力
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {LEVEL_ABILITIES[academicLevel]?.map((ability, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {ability}
              </Badge>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <h4 className="text-xs text-muted-foreground mb-2">进化路径</h4>
          <div className="flex items-center justify-between gap-1">
            {ACADEMIC_LEVELS.map((level, i) => (
              <div 
                key={level}
                className={cn(
                  "flex-1 h-2 rounded-full transition-colors",
                  i <= currentLevelIndex 
                    ? `bg-gradient-to-r ${LEVEL_COLORS[level]}` 
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            {ACADEMIC_LEVELS.map(level => (
              <span key={level} className={cn(
                level === academicLevel && 'text-primary font-medium'
              )}>
                {LEVEL_NAMES[level].slice(0, 2)}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
