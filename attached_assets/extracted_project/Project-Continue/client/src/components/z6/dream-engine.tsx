import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useZ1Store } from '@/lib/z1/god-protocol';
import { 
  Moon, Sun, Play, Pause, RotateCcw, 
  Brain, Sparkles, AlertCircle, CheckCircle2,
  Zap, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export type DreamPhase = 'IDLE' | 'DREAMING' | 'ANALYZING' | 'COMPLETE';

export interface DreamScenario {
  id: string;
  title: string;
  description: string;
  variables: string[];
  outcomes: DreamOutcome[];
  timestamp: number;
}

export interface DreamOutcome {
  path: string;
  probability: number;
  impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  recommendation: string;
}

interface DreamEngineProps {
  onDreamComplete?: (scenario: DreamScenario) => void;
}

const DREAM_PROMPTS = [
  '如果竞争对手突然降价50%...',
  '假设关键合作方终止合同...',
  '万一核心团队成员离职...',
  '如果市场需求突然翻倍...',
  '假设监管政策发生重大变化...',
];

export function DreamEngine({ onDreamComplete }: DreamEngineProps) {
  const { consumeHp, addXp, hpBalance } = useZ1Store();
  const [phase, setPhase] = useState<DreamPhase>('IDLE');
  const [scenario, setScenario] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [currentDream, setCurrentDream] = useState<DreamScenario | null>(null);
  const [dreamHistory, setDreamHistory] = useState<DreamScenario[]>([]);

  const HP_COST = 20;
  const XP_REWARD = 50;

  const generateRandomPrompt = () => {
    const prompt = DREAM_PROMPTS[Math.floor(Math.random() * DREAM_PROMPTS.length)];
    setScenario(prompt);
  };

  const simulateDream = useCallback(async () => {
    if (hpBalance < HP_COST) {
      return;
    }

    consumeHp('DREAM_SIMULATION');
    setPhase('DREAMING');
    setProgress(0);

    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 100));
      setProgress(i);
    }

    setPhase('ANALYZING');
    await new Promise(r => setTimeout(r, 1500));

    const newDream: DreamScenario = {
      id: `dream_${Date.now()}`,
      title: scenario.slice(0, 30) + '...',
      description: scenario,
      variables: [
        '市场反应时间',
        '资源调配效率',
        '团队执行力',
        '外部环境变化',
      ],
      outcomes: [
        {
          path: '最优路径',
          probability: 0.35,
          impact: 'POSITIVE',
          recommendation: '提前布局备选方案，建立资源缓冲池',
        },
        {
          path: '中性路径',
          probability: 0.45,
          impact: 'NEUTRAL',
          recommendation: '维持现状观察，准备应急预案',
        },
        {
          path: '风险路径',
          probability: 0.20,
          impact: 'NEGATIVE',
          recommendation: '建立止损机制，保护核心资产',
        },
      ],
      timestamp: Date.now(),
    };

    setCurrentDream(newDream);
    setDreamHistory(prev => [newDream, ...prev].slice(0, 10));
    setPhase('COMPLETE');
    addXp(XP_REWARD);
    onDreamComplete?.(newDream);
  }, [scenario, hpBalance, consumeHp, addXp, onDreamComplete]);

  const reset = () => {
    setPhase('IDLE');
    setProgress(0);
    setCurrentDream(null);
    setScenario('');
  };

  const getOutcomeColor = (impact: string) => {
    switch (impact) {
      case 'POSITIVE': return 'text-green-400 bg-green-500/20';
      case 'NEGATIVE': return 'text-red-400 bg-red-500/20';
      default: return 'text-amber-400 bg-amber-500/20';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border-indigo-500/30" data-testid="dream-engine">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-indigo-400" />
          Z6·梦境推演引擎
          <Badge variant="outline" className="ml-auto text-xs">
            <Zap className="w-3 h-3 mr-1" />
            消耗: {HP_COST} HP
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'IDLE' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <div className="relative">
              <Textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="输入假设场景，启动梦境推演..."
                className="min-h-[100px] bg-secondary/30 border-indigo-500/30"
                data-testid="dream-input"
              />
              <Button
                size="sm"
                variant="ghost"
                className="absolute bottom-2 right-2 text-xs"
                onClick={generateRandomPrompt}
                data-testid="dream-random"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                随机场景
              </Button>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500"
              disabled={!scenario.trim() || hpBalance < HP_COST}
              onClick={simulateDream}
              data-testid="dream-start"
            >
              <Play className="w-4 h-4 mr-2" />
              启动梦境推演
            </Button>
            {hpBalance < HP_COST && (
              <p className="text-xs text-center text-red-400">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                HP不足，无法启动推演
              </p>
            )}
          </motion.div>
        )}

        {(phase === 'DREAMING' || phase === 'ANALYZING') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 py-8"
          >
            <div className="text-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-block"
              >
                <Brain className="w-12 h-12 text-indigo-400" />
              </motion.div>
              <p className="mt-4 text-sm text-muted-foreground">
                {phase === 'DREAMING' ? '梦境生成中...' : '分析推演结果...'}
              </p>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-indigo-300">
              正在模拟: {scenario.slice(0, 50)}...
            </p>
          </motion.div>
        )}

        {phase === 'COMPLETE' && currentDream && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="font-medium">推演完成</span>
              <Badge className="ml-auto bg-green-500/20 text-green-400">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{XP_REWARD} XP
              </Badge>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30">
              <h4 className="text-sm font-medium mb-2">关键变量</h4>
              <div className="flex flex-wrap gap-1">
                {currentDream.variables.map((v, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">推演路径</h4>
              {currentDream.outcomes.map((outcome, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-3 rounded-lg",
                    getOutcomeColor(outcome.impact)
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{outcome.path}</span>
                    <span className="text-xs">
                      概率: {Math.round(outcome.probability * 100)}%
                    </span>
                  </div>
                  <p className="text-xs opacity-80">{outcome.recommendation}</p>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={reset}
              data-testid="dream-reset"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              开始新推演
            </Button>
          </motion.div>
        )}

        {dreamHistory.length > 0 && phase === 'IDLE' && (
          <div className="pt-4 border-t border-border">
            <h4 className="text-xs text-muted-foreground mb-2">推演历史</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {dreamHistory.map(dream => (
                <div 
                  key={dream.id}
                  className="flex items-center justify-between text-xs p-2 rounded hover:bg-secondary/50 cursor-pointer"
                  onClick={() => setCurrentDream(dream)}
                >
                  <span className="truncate flex-1">{dream.title}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {new Date(dream.timestamp).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
