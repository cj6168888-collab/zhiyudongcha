import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlobalWakeHeader } from '@/components/ui/global-wake-header';
import { Moon, Brain, Sparkles, Zap, Clock, CheckCircle, Loader2, TrendingUp, Bell, MessageCircle, Lightbulb, Star } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface EvolutionInsight {
  id: string;
  type: 'skill_learned' | 'pattern_discovered' | 'optimization_found' | 'milestone_reached';
  title: string;
  description: string;
  xpGained: number;
  timestamp: Date;
  isRead: boolean;
}

export default function DreamLogsPage() {
  const { data: dreamLogs = [], isLoading } = useQuery({
    queryKey: ['/api/z6/dream'],
    refetchInterval: 5000,
  });

  const { data: evolutionEvents = [] } = useQuery<any[]>({
    queryKey: ['/api/evolution-events'],
    refetchInterval: 10000,
  });

  const [showInsightPanel, setShowInsightPanel] = useState(true);

  const generateInsights = (): EvolutionInsight[] => {
    const insights: EvolutionInsight[] = [];
    
    if (evolutionEvents.length > 0) {
      evolutionEvents.slice(0, 5).forEach((event: any, index: number) => {
        insights.push({
          id: event.id || `insight-${index}`,
          type: event.eventType?.includes('SKILL') ? 'skill_learned' : 
                event.eventType?.includes('PATTERN') ? 'pattern_discovered' :
                event.eventType?.includes('MILESTONE') ? 'milestone_reached' : 'optimization_found',
          title: event.deltaDescription?.slice(0, 30) || '新发现',
          description: event.deltaDescription || '小智有了新的成长',
          xpGained: Math.floor(Math.random() * 50) + 10,
          timestamp: new Date(event.createdAt),
          isRead: false,
        });
      });
    }

    (dreamLogs as any[]).filter((log: any) => log.status === 'AWAKENED' && log.insightsDiscovered).forEach((log: any, index: number) => {
      if (log.insightsDiscovered?.topRisk) {
        insights.push({
          id: `dream-insight-${log.id}`,
          type: 'pattern_discovered',
          title: '梦境洞察',
          description: log.insightsDiscovered.topRisk,
          xpGained: log.decisionsOptimized || 20,
          timestamp: new Date(log.createdAt),
          isRead: false,
        });
      }
    });

    return insights.slice(0, 6);
  };

  const insights = generateInsights();
  const unreadCount = insights.filter(i => !i.isRead).length;

  const pushInsightToChat = (insight: EvolutionInsight) => {
    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-medium">小智学习报告</span>
        <span className="text-sm text-muted-foreground">{insight.description}</span>
        <span className="text-xs text-primary">+{insight.xpGained} XP</span>
      </div>,
      {
        duration: 5000,
        icon: <Sparkles className="w-5 h-5 text-yellow-400" />,
      }
    );
  };

  const pushAllInsights = () => {
    insights.forEach((insight, index) => {
      setTimeout(() => {
        pushInsightToChat(insight);
      }, index * 800);
    });
    toast.success('所有学习报告已推送到通知', { icon: <Bell className="w-4 h-4" /> });
  };

  const insightTypeIcons: Record<string, React.ReactNode> = {
    'skill_learned': <Zap className="w-4 h-4 text-green-400" />,
    'pattern_discovered': <Lightbulb className="w-4 h-4 text-yellow-400" />,
    'optimization_found': <TrendingUp className="w-4 h-4 text-cyan-400" />,
    'milestone_reached': <Star className="w-4 h-4 text-orange-400" />,
  };

  const insightTypeLabels: Record<string, string> = {
    'skill_learned': '新技能',
    'pattern_discovered': '新发现',
    'optimization_found': '优化建议',
    'milestone_reached': '里程碑',
  };

  const dreamTypeLabels: Record<string, string> = {
    'BUSINESS_SIMULATION': '商业推演',
    'SELF_EVOLUTION': '自举进化',
    'MEMORY_CONSOLIDATION': '记忆巩固',
  };

  const dreamTypeIcons: Record<string, React.ReactNode> = {
    'BUSINESS_SIMULATION': <Sparkles className="w-5 h-5 text-cyan-400" />,
    'SELF_EVOLUTION': <Zap className="w-5 h-5 text-purple-400" />,
    'MEMORY_CONSOLIDATION': <Brain className="w-5 h-5 text-amber-400" />,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAKENED':
        return (
          <Badge variant="outline" className="text-green-400 border-green-500/30 gap-1">
            <CheckCircle className="w-3 h-3" />
            已醒来
          </Badge>
        );
      case 'DREAMING':
        return (
          <Badge variant="outline" className="text-purple-400 border-purple-500/30 gap-1 animate-pulse">
            <Moon className="w-3 h-3" />
            梦中
          </Badge>
        );
      case 'SLEEPING':
        return (
          <Badge variant="outline" className="text-slate-400 border-slate-500/30 gap-1">
            <Clock className="w-3 h-3" />
            待机
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" data-testid="page-dream-logs">
      <div className="container mx-auto px-4 pt-6 pb-24 md:pb-6">
        <GlobalWakeHeader
          title="小智的梦"
          subtitle="深夜自动推演日志"
          rightActions={
            <Badge variant="outline" className="text-purple-400 border-purple-400/50">
              自动运行
            </Badge>
          }
        />
      </div>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <AnimatePresence>
          {showInsightPanel && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-slate-800/50" data-testid="evolution-insights-panel">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Brain className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          进化洞察
                          {unreadCount > 0 && (
                            <Badge variant="secondary" className="text-xs bg-purple-500/30 text-purple-300">
                              {unreadCount} 条新洞察
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>小智的学习报告与成长发现</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-purple-500/30 hover:bg-purple-500/20"
                      onClick={pushAllInsights}
                      disabled={insights.length === 0}
                      data-testid="btn-push-all-insights"
                    >
                      <Bell className="w-4 h-4" />
                      推送全部
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {insights.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">暂无进化洞察</p>
                      <p className="text-xs mt-1">小智正在努力学习中...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {insights.map((insight, index) => (
                        <motion.div
                          key={insight.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer group"
                          onClick={() => pushInsightToChat(insight)}
                          data-testid={`insight-card-${insight.id}`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <div className="p-1.5 bg-slate-700/50 rounded">
                              {insightTypeIcons[insight.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs px-1.5 py-0">
                                  {insightTypeLabels[insight.type]}
                                </Badge>
                                <span className="text-xs text-green-400 font-medium">+{insight.xpGained} XP</span>
                              </div>
                            </div>
                            <MessageCircle className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-2">{insight.description}</p>
                          <p className="text-xs text-slate-600 mt-2">
                            {insight.timestamp.toLocaleString('zh-CN', { 
                              month: '2-digit', 
                              day: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </CardContent>
          </Card>
        ) : (dreamLogs as any[]).length === 0 ? (
          <Card className="border-slate-700 bg-gradient-to-br from-slate-800 to-purple-900/20">
            <CardContent className="py-16 text-center">
              <Moon className="w-16 h-16 text-purple-400/50 mx-auto mb-6" />
              <h3 className="text-xl font-medium text-slate-300 mb-2">小智还没有做过梦</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                深夜时分，当系统进入闲置状态，小智会自动进入梦境模式，
                进行商业推演、知识蒸馏与系统自举进化。
                <br /><br />
                当您醒来时，梦境洞察会以气泡通知的方式呈现给您。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(dreamLogs as any[]).map((log: any) => {
              const dreamLabel = dreamTypeLabels[log.dreamType] || log.dreamType;
              const dreamIcon = dreamTypeIcons[log.dreamType] || <Moon className="w-5 h-5 text-purple-400" />;

              return (
                <Card key={log.id} className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
                  <CardContent className="py-5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-purple-500/20 rounded-xl shrink-0">
                        {dreamIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="text-base font-medium text-slate-200">{dreamLabel}</h3>
                          {getStatusBadge(log.status)}
                        </div>

                        {log.status === 'AWAKENED' ? (
                          <div className="space-y-3">
                            <p className="text-sm text-slate-400">
                              "主人，我做了一个关于{dreamLabel}的梦..."
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-900/50 rounded-lg">
                              <div>
                                <span className="text-xs text-slate-500 block">模拟次数</span>
                                <span className="text-cyan-400 font-mono text-sm">
                                  {log.simulationCount?.toLocaleString() || '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500 block">优化决策</span>
                                <span className="text-green-400 font-mono text-sm">
                                  {log.decisionsOptimized?.toLocaleString() || '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500 block">持续时间</span>
                                <span className="text-purple-400 font-mono text-sm">
                                  {log.durationMs ? `${(log.durationMs / 1000 / 60).toFixed(1)}分钟` : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500 block">补丁数</span>
                                <span className="text-amber-400 font-mono text-sm">
                                  {log.patchesGenerated?.length || 0}
                                </span>
                              </div>
                            </div>
                            {log.insightsDiscovered?.topRisk && (
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <span className="text-amber-400 text-sm font-medium">梦境洞察: </span>
                                <span className="text-slate-300 text-sm">{log.insightsDiscovered.topRisk}</span>
                              </div>
                            )}
                          </div>
                        ) : log.status === 'DREAMING' ? (
                          <p className="text-sm text-slate-400 animate-pulse">
                            小智正在梦中推演，请稍候...
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">
                            等待进入梦境状态...
                          </p>
                        )}

                        <div className="text-xs text-slate-600 mt-3">
                          {new Date(log.createdAt).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
