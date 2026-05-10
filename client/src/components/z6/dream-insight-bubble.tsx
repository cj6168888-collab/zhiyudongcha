import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDreamInsightStore, type DreamInsight } from '@/lib/z6/dream-insight-store';
import {
  Moon,
  X,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Zap,
  ChevronRight,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DreamInsightBubbleProps {
  onViewDetails?: (insight: DreamInsight) => void;
}

export function DreamInsightBubble({ onViewDetails }: DreamInsightBubbleProps) {
  const showBubble = useDreamInsightStore(state => state.showBubble);
  const currentInsight = useDreamInsightStore(state => state.currentInsight);
  const dismissBubble = useDreamInsightStore(state => state.dismissBubble);
  const syncWithBackend = useDreamInsightStore(state => state.syncWithBackend);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    syncWithBackend();

    intervalRef.current = setInterval(() => {
      syncWithBackend();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const getTypeIcon = (type: DreamInsight['type']) => {
    switch (type) {
      case 'BUSINESS':
        return <TrendingUp className="w-5 h-5 text-cyan-400" />;
      case 'RISK':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'OPPORTUNITY':
        return <Sparkles className="w-5 h-5 text-amber-400" />;
      case 'EVOLUTION':
        return <Zap className="w-5 h-5 text-purple-400" />;
      default:
        return <Moon className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getUrgencyColor = (urgency: DreamInsight['urgency']) => {
    switch (urgency) {
      case 'HIGH':
        return 'border-red-500/50 bg-gradient-to-br from-red-950/50 to-slate-900';
      case 'MEDIUM':
        return 'border-amber-500/50 bg-gradient-to-br from-amber-950/50 to-slate-900';
      default:
        return 'border-indigo-500/50 bg-gradient-to-br from-indigo-950/50 to-slate-900';
    }
  };

  if (!currentInsight) return null;

  return (
    <AnimatePresence>
      {showBubble && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
          data-testid="dream-insight-bubble"
        >
          <Card className={cn(
            "shadow-2xl border-2",
            getUrgencyColor(currentInsight.urgency)
          )}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Brain className="w-8 h-8 text-indigo-400" />
                  </motion.div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-300">小星·梦境洞察</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          currentInsight.urgency === 'HIGH' && "border-red-500 text-red-400",
                          currentInsight.urgency === 'MEDIUM' && "border-amber-500 text-amber-400",
                          currentInsight.urgency === 'LOW' && "border-indigo-500 text-indigo-400"
                        )}
                      >
                        {currentInsight.urgency === 'HIGH' && '紧急'}
                        {currentInsight.urgency === 'MEDIUM' && '重要'}
                        {currentInsight.urgency === 'LOW' && '常规'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getTypeIcon(currentInsight.type)}
                      <span className="font-medium text-sm">{currentInsight.title}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 hover:bg-slate-700"
                  onClick={dismissBubble}
                  data-testid="button-dismiss-dream"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {currentInsight.content}
              </p>

              {currentInsight.details && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-900/50 rounded-lg text-xs">
                  {currentInsight.details.simulationCount && (
                    <div>
                      <span className="text-slate-500">模拟次数</span>
                      <div className="text-cyan-400 font-mono">
                        {currentInsight.details.simulationCount.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {currentInsight.details.decisionsOptimized && (
                    <div>
                      <span className="text-slate-500">优化决策</span>
                      <div className="text-green-400 font-mono">
                        {currentInsight.details.decisionsOptimized}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentInsight.details?.recommendations && currentInsight.details.recommendations.length > 0 && (
                <div className="text-xs space-y-1">
                  <span className="text-slate-500">建议行动:</span>
                  <ul className="space-y-0.5">
                    {currentInsight.details.recommendations.slice(0, 2).map((rec, i) => (
                      <li key={i} className="flex items-start gap-1 text-slate-300">
                        <span className="text-amber-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs border-slate-600 hover:bg-slate-800"
                  onClick={dismissBubble}
                  data-testid="button-dismiss-later"
                >
                  稍后再看
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                  onClick={() => {
                    onViewDetails?.(currentInsight);
                    dismissBubble();
                  }}
                  data-testid="button-view-dream-details"
                >
                  查看详情
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>

              <div className="text-[10px] text-slate-500 text-center">
                {new Date(currentInsight.timestamp).toLocaleString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })} · 深夜推演结果
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DreamInsightTrigger() {
  const insights = useDreamInsightStore(state => state.insights);
  const syncWithBackend = useDreamInsightStore(state => state.syncWithBackend);
  const showLatestInsight = useDreamInsightStore(state => state.showLatestInsight);
  const unreadCount = insights.filter(i => !i.isRead).length;

  const handleClick = useCallback(() => {
    if (unreadCount > 0) {
      showLatestInsight();
    } else {
      syncWithBackend();
    }
  }, [unreadCount, showLatestInsight, syncWithBackend]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={handleClick}
      data-testid="button-dream-trigger"
    >
      <Moon className="w-4 h-4 text-indigo-400" />
      {unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center"
        >
          {unreadCount}
        </motion.span>
      )}
    </Button>
  );
}
