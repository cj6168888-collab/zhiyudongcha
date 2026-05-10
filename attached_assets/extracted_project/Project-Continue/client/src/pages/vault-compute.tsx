import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Download,
  Cpu,
  Moon,
  Trash2,
  Play,
  FileText,
  Video,
  BookOpen,
  Archive,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Brain,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useZ1Store } from '@/lib/z1/god-protocol';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { GlobalWakeHeader } from '@/components/ui/global-wake-header';

type DownloadCategory = 'RESEARCH' | 'SOFTWARE' | 'MEDIA' | 'BOOKS';
type ComputeJobType = 'PDF_EDIT' | 'VIDEO_TRANSCODE' | 'REPORT_ANALYSIS' | 'DREAM_SIMULATION';
type DreamType = 'BUSINESS_SIMULATION' | 'SELF_EVOLUTION' | 'MEMORY_CONSOLIDATION';

interface VaultStats {
  totalDownloads: number;
  activeDownloads: number;
  totalComputeJobs: number;
  activeComputeJobs: number;
  totalDreams: number;
  categories: Record<string, number>;
}

const categoryIcons: Record<DownloadCategory, React.ReactNode> = {
  RESEARCH: <FileText className="w-4 h-4" />,
  SOFTWARE: <Archive className="w-4 h-4" />,
  MEDIA: <Video className="w-4 h-4" />,
  BOOKS: <BookOpen className="w-4 h-4" />,
};

const categoryLabels: Record<DownloadCategory, string> = {
  RESEARCH: '资料库',
  SOFTWARE: '软件库',
  MEDIA: '影视库',
  BOOKS: '图书库',
};

export default function VaultComputePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useZ1Store();
  
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadCategory, setDownloadCategory] = useState<DownloadCategory>('RESEARCH');
  const [activeTab, setActiveTab] = useState('downloads');
  
  const { data: downloads = [], refetch: refetchDownloads } = useQuery({
    queryKey: ['/api/z6/downloads'],
    refetchInterval: 2000,
  });
  
  const { data: computeJobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ['/api/z6/compute'],
    refetchInterval: 2000,
  });
  
  const { data: dreamLogs = [], refetch: refetchDreams } = useQuery({
    queryKey: ['/api/z6/dream'],
    refetchInterval: 3000,
  });
  
  const { data: stats } = useQuery<VaultStats>({
    queryKey: ['/api/z6/stats'],
    refetchInterval: 5000,
  });
  
  const addDownloadMutation = useMutation({
    mutationFn: async (data: { url: string; category: string }) => {
      const res = await apiRequest('POST', '/api/z6/downloads', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '下载任务已添加', description: '资源正在获取中...' });
      setDownloadUrl('');
      refetchDownloads();
    },
    onError: () => {
      toast({ title: '添加失败', variant: 'destructive' });
    },
  });
  
  const submitComputeMutation = useMutation({
    mutationFn: async (data: { jobType: string; inputPayload: Record<string, unknown> }) => {
      const res = await apiRequest('POST', '/api/z6/compute', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '计算任务已提交', description: '服务器正在处理...' });
      refetchJobs();
    },
  });
  
  const initiateDreamMutation = useMutation({
    mutationFn: async (dreamType: string) => {
      const res = await apiRequest('POST', '/api/z6/dream', { dreamType });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '梦境推演启动', description: '系统进入深度模拟状态...' });
      refetchDreams();
    },
  });
  
  const handleAddDownload = () => {
    if (!downloadUrl) return;
    addDownloadMutation.mutate({ url: downloadUrl, category: downloadCategory });
  };
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      PENDING: { variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
      DOWNLOADING: { variant: 'default', icon: <Download className="w-3 h-3 animate-pulse" /> },
      INDEXING: { variant: 'outline', icon: <Sparkles className="w-3 h-3 animate-spin" /> },
      COMPLETE: { variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
      FAILED: { variant: 'destructive', icon: <AlertTriangle className="w-3 h-3" /> },
      QUEUED: { variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
      PROCESSING: { variant: 'default', icon: <Cpu className="w-3 h-3 animate-pulse" /> },
      SLEEPING: { variant: 'secondary', icon: <Moon className="w-3 h-3" /> },
      DREAMING: { variant: 'default', icon: <Brain className="w-3 h-3 animate-pulse" /> },
      AWAKENED: { variant: 'outline', icon: <Zap className="w-3 h-3" /> },
    };
    
    const config = variants[status] || { variant: 'secondary' as const, icon: null };
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };
  
  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <Card className="border-slate-700 bg-slate-800/50 max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">访问被拒绝</h2>
            <p className="text-slate-400 mb-4">
              Z6 资源堡垒需要 MASTER 权限
            </p>
            <Link href="/">
              <Button variant="outline">返回 Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" data-testid="page-vault-compute">
      <div className="container mx-auto px-4 py-6">
        <GlobalWakeHeader 
          title="Z6 资源堡垒" 
          subtitle="服务器重计算节点"
          rightActions={
            <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
              MASTER ACCESS
            </Badge>
          }
        />
      </div>
      
      <main className="container mx-auto px-4 pt-6 pb-24 md:pb-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">{stats.totalDownloads}</div>
                <div className="text-xs text-slate-400">总下载</div>
              </CardContent>
            </Card>
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{stats.activeDownloads}</div>
                <div className="text-xs text-slate-400">进行中</div>
              </CardContent>
            </Card>
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.totalComputeJobs}</div>
                <div className="text-xs text-slate-400">计算任务</div>
              </CardContent>
            </Card>
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.totalDreams}</div>
                <div className="text-xs text-slate-400">梦境日志</div>
              </CardContent>
            </Card>
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-slate-300">
                  {Object.values(stats.categories || {}).reduce((a, b) => (a as number) + (b as number), 0) as number}
                </div>
                <div className="text-xs text-slate-400">库存资源</div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="downloads" className="gap-2" data-testid="tab-downloads">
              <Download className="w-4 h-4" />
              代下引擎
            </TabsTrigger>
            <TabsTrigger value="compute" className="gap-2" data-testid="tab-compute">
              <Cpu className="w-4 h-4" />
              重计算
            </TabsTrigger>
            <TabsTrigger value="dream" className="gap-2" data-testid="tab-dream">
              <Moon className="w-4 h-4" />
              梦境推演
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="downloads" className="space-y-4 mt-4">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-base">添加下载任务</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="输入资源 URL (HTTP/磁力/BT)"
                      value={downloadUrl}
                      onChange={(e) => setDownloadUrl(e.target.value)}
                      className="bg-slate-900 border-slate-600"
                      data-testid="input-download-url"
                    />
                  </div>
                  <Select value={downloadCategory} onValueChange={(v) => setDownloadCategory(v as DownloadCategory)}>
                    <SelectTrigger className="w-32 bg-slate-900 border-slate-600" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {categoryIcons[key as DownloadCategory]}
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddDownload}
                    disabled={!downloadUrl || addDownloadMutation.isPending}
                    data-testid="button-add-download"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    添加
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400">下载队列</h3>
              <AnimatePresence>
                {(downloads as any[]).length === 0 ? (
                  <Card className="border-slate-700 bg-slate-800/30">
                    <CardContent className="py-8 text-center text-slate-500">
                      暂无下载任务
                    </CardContent>
                  </Card>
                ) : (
                  (downloads as any[]).map((task: any) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <Card className="border-slate-700 bg-slate-800/50">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {categoryIcons[task.category as DownloadCategory]}
                              <span className="text-sm font-medium truncate max-w-xs">
                                {task.fileName || task.url}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(task.status)}
                              {task.sandboxResult && (
                                <Badge variant={task.sandboxResult === 'SAFE' ? 'default' : 'destructive'}>
                                  {task.sandboxResult === 'SAFE' ? <Shield className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                                  {task.sandboxResult}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Progress value={task.progress} className="h-1" />
                          <div className="flex justify-between mt-1 text-xs text-slate-500">
                            <span>{categoryLabels[task.category as DownloadCategory]}</span>
                            <span>{task.progress}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </TabsContent>
          
          <TabsContent value="compute" className="space-y-4 mt-4">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-base">提交计算任务</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-1"
                    onClick={() => submitComputeMutation.mutate({ jobType: 'PDF_EDIT', inputPayload: { demo: true } })}
                    data-testid="button-pdf-edit"
                  >
                    <FileText className="w-6 h-6" />
                    <span className="text-xs">PDF 编辑</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-1"
                    onClick={() => submitComputeMutation.mutate({ jobType: 'VIDEO_TRANSCODE', inputPayload: { demo: true } })}
                    data-testid="button-video-transcode"
                  >
                    <Video className="w-6 h-6" />
                    <span className="text-xs">视频转码</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-1"
                    onClick={() => submitComputeMutation.mutate({ jobType: 'REPORT_ANALYSIS', inputPayload: { demo: true } })}
                    data-testid="button-report-analysis"
                  >
                    <Brain className="w-6 h-6" />
                    <span className="text-xs">财报解构</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-1"
                    onClick={() => submitComputeMutation.mutate({ jobType: 'DREAM_SIMULATION', inputPayload: { demo: true } })}
                    data-testid="button-dream-sim"
                  >
                    <Moon className="w-6 h-6" />
                    <span className="text-xs">模拟推演</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400">计算队列</h3>
              {(computeJobs as any[]).length === 0 ? (
                <Card className="border-slate-700 bg-slate-800/30">
                  <CardContent className="py-8 text-center text-slate-500">
                    暂无计算任务
                  </CardContent>
                </Card>
              ) : (
                (computeJobs as any[]).map((job: any) => (
                  <Card key={job.id} className="border-slate-700 bg-slate-800/50">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm font-medium">{job.jobType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(job.status)}
                          {job.processingTimeMs && (
                            <span className="text-xs text-slate-500">
                              {(job.processingTimeMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                      <Progress value={job.progress} className="h-1" />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="dream" className="space-y-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                小智的梦
              </h2>
              <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/30">
                深夜自动推演
              </Badge>
            </div>
            
            <div className="space-y-3">
              {(dreamLogs as any[]).length === 0 ? (
                <Card className="border-slate-700 bg-gradient-to-br from-slate-800 to-purple-900/20">
                  <CardContent className="py-12 text-center">
                    <Moon className="w-12 h-12 text-purple-400/50 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">小智还没有做过梦</p>
                    <p className="text-xs text-slate-500">
                      深夜时分，小智会自动进入梦境模式进行商业推演和自我进化
                    </p>
                  </CardContent>
                </Card>
              ) : (
                (dreamLogs as any[]).map((log: any, index: number) => {
                  const dreamTypeLabels: Record<string, string> = {
                    'BUSINESS_SIMULATION': '商业推演',
                    'SELF_EVOLUTION': '自举进化', 
                    'MEMORY_CONSOLIDATION': '记忆巩固',
                  };
                  const dreamTypeIcons: Record<string, React.ReactNode> = {
                    'BUSINESS_SIMULATION': <Sparkles className="w-4 h-4 text-cyan-400" />,
                    'SELF_EVOLUTION': <Zap className="w-4 h-4 text-purple-400" />,
                    'MEMORY_CONSOLIDATION': <Brain className="w-4 h-4 text-amber-400" />,
                  };
                  const dreamLabel = dreamTypeLabels[log.dreamType] || log.dreamType;
                  const dreamIcon = dreamTypeIcons[log.dreamType] || <Moon className="w-4 h-4 text-purple-400" />;
                  
                  return (
                    <Card key={log.id} className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-500/20 rounded-lg shrink-0">
                            {dreamIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-medium text-slate-200">{dreamLabel}</span>
                              {getStatusBadge(log.status)}
                            </div>
                            {log.status === 'AWAKENED' ? (
                              <div className="space-y-2">
                                <p className="text-xs text-slate-400">
                                  "主人，我做了一个关于{dreamLabel}的梦..."
                                </p>
                                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-900/50 rounded text-xs">
                                  <div>
                                    <span className="text-slate-500">模拟次数</span>
                                    <div className="text-cyan-400 font-mono">{log.simulationCount?.toLocaleString() || '-'}</div>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">优化决策</span>
                                    <div className="text-green-400 font-mono">{log.decisionsOptimized?.toLocaleString() || '-'}</div>
                                  </div>
                                </div>
                                {log.insightsDiscovered?.topRisk && (
                                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
                                    <span className="text-amber-400">洞察: </span>
                                    <span className="text-slate-300">{log.insightsDiscovered.topRisk}</span>
                                  </div>
                                )}
                              </div>
                            ) : log.status === 'DREAMING' ? (
                              <p className="text-xs text-slate-400 animate-pulse">
                                小智正在梦中推演...
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500">
                                等待进入梦境...
                              </p>
                            )}
                            <div className="text-[10px] text-slate-600 mt-2">
                              {new Date(log.createdAt).toLocaleString('zh-CN')}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
