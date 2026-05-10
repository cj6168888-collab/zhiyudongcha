/**
 * NodeDashboard - Navigator-X NODE (员工) 节点端
 *
 * 员工专属功能：
 * 1. 节点首页 - 我的任务概览
 * 2. 草案生成 - AI辅助生成汇报草案
 * 3. 汇报提交 - 提交工作汇报
 * 4. 灵感记录 - 记录个人灵感
 * 5. 任务执行 - 执行分配的任务
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Monitor, FileText, Send, Lightbulb, CheckSquare,
  Clock, Zap, RefreshCw, CheckCircle, Activity,
  Sparkles, Upload, Eye, AlertTriangle
} from "lucide-react";

interface DesktopUser {
  id: string;
  username: string;
  role: 'SOVEREIGN' | 'NODE';
}

// 获取用户信息
function getUser(): DesktopUser | null {
  const stored = localStorage.getItem('desktop_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export default function NodeDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user] = useState<DesktopUser | null>(getUser);
  const [, setLocation] = useLocation();

  const [coreData, setCoreData] = useState('');
  const [draftType, setDraftType] = useState<'REPORT' | 'PLAN' | 'PROPOSAL'>('REPORT');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState('');

  // 检查权限
  useEffect(() => {
    if (!user || user.role !== 'NODE') {
      toast({ title: '您没有权限访问此页面', variant: 'destructive' });
      setLocation('/desktop/login');
    }
  }, [user, setLocation, toast]);

  // 获取分配给我的任务
  const { data: myTasks = [] } = useQuery<any[]>({
    queryKey: ['/api/tasks', user?.id],
    refetchInterval: 5000,
  });

  // 获取灵感记录
  const { data: myIdeas = [] } = useQuery<any[]>({
    queryKey: ['/api/navigator/node/ideas', user?.id],
  });

  // 获取我的汇报历史
  const { data: myReports = [] } = useQuery<any[]>({
    queryKey: ['/api/navigator/node/reports', user?.id],
  });

  // 生成草案
  const handleGenerateDraft = async () => {
    if (!coreData.trim()) return;

    setIsGenerating(true);
    toast({ title: "正在根据领导偏好生成草案..." });

    // 模拟生成
    await new Promise(resolve => setTimeout(resolve, 2000));

    setGeneratedDraft(`【${draftType === 'REPORT' ? '工作汇报' : draftType === 'PLAN' ? '计划书' : '方案书'}草案】

基于核心数据"${coreData.slice(0, 30)}..."，已按照领导的偏好风格自动优化。

1. 执行摘要
2. 当前进展
3. 下一步计划
4. 所需支持

[AI优化内容将在正式版中根据您的领导偏好自动生成]`);

    setIsGenerating(false);
  };

  // 提交汇报
  const submitReportMutation = useMutation({
    mutationFn: async (content: string) => {
      await fetch('/api/navigator/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: user?.id,
          nodeName: user?.username,
          content,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: '汇报已提交，等待审批' });
      setGeneratedDraft('');
      setCoreData('');
    },
  });

  // 记录灵感
  const recordIdeaMutation = useMutation({
    mutationFn: async (idea: string) => {
      await fetch('/api/navigator/node/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: user?.id,
          idea,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: '灵感已记录' });
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/node/ideas', user?.id] });
    },
  });

  // 完成任务
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' });
    },
    onSuccess: () => {
      toast({ title: '任务已完成' });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', user?.id] });
    },
  });

  if (!user || user.role !== 'NODE') {
    return null;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">节点工作台</h1>
            <p className="text-gray-500 text-sm">欢迎回来，{user.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">
              NODE
            </span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400">在线</span>
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-indigo-500/10 border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="w-8 h-8 text-indigo-400" />
              <div>
                <p className="font-bold">草案生成</p>
                <p className="text-xs text-gray-500">AI辅助编写</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20 cursor-pointer hover:bg-green-500/20 transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <Send className="w-8 h-8 text-green-400" />
              <div>
                <p className="font-bold">汇报提交</p>
                <p className="text-xs text-gray-500">一键汇报</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-amber-400" />
              <div>
                <p className="font-bold">灵感记录</p>
                <p className="text-xs text-gray-500">捕捉灵感</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckSquare className="w-8 h-8 text-blue-400" />
              <div>
                <p className="font-bold">任务执行</p>
                <p className="text-xs text-gray-500">执行任务</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 主要内容区 */}
        <div className="grid grid-cols-2 gap-6">
          {/* 草案生成 */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                草案生成
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 草案类型 */}
              <div className="flex gap-2">
                {(['REPORT', 'PLAN', 'PROPOSAL'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDraftType(type)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all",
                      draftType === type
                        ? "bg-indigo-500 text-white"
                        : "bg-white/5 text-gray-500"
                    )}
                  >
                    {type === 'REPORT' ? '汇报' : type === 'PLAN' ? '计划书' : '方案'}
                  </button>
                ))}
              </div>

              {/* 核心数据输入 */}
              <Textarea
                value={coreData}
                onChange={(e) => setCoreData(e.target.value)}
                placeholder="输入核心数据和要点，AI将自动生成完整草案..."
                className="min-h-[80px] bg-white/5 border-white/10"
              />

              <Button
                className="w-full bg-indigo-500 hover:bg-indigo-600 gap-2"
                disabled={!coreData.trim() || isGenerating}
                onClick={handleGenerateDraft}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    根据领导偏好生成草案
                  </>
                )}
              </Button>

              {/* 草案预览 */}
              {generatedDraft && (
                <div className="p-4 rounded-xl bg-white/5 border border-indigo-500/20">
                  <p className="text-xs text-indigo-400 mb-2">草案预览</p>
                  <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">
                    {generatedDraft}
                  </pre>
                  <Button
                    className="w-full mt-4 bg-green-500 hover:bg-green-600 gap-2"
                    onClick={() => submitReportMutation.mutate(generatedDraft)}
                    disabled={submitReportMutation.isPending}
                  >
                    <Upload className="w-4 h-4" />
                    提交汇报
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 任务执行 */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-400" />
                我的任务
              </CardTitle>
              <Badge variant="outline">{myTasks.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {myTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>暂无分配任务</p>
                </div>
              ) : (
                myTasks.map((task: any) => (
                  <div key={task.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                      </div>
                      <Badge className={cn(
                        task.priority === 'URGENT' ? "bg-red-500" :
                        task.priority === 'HIGH' ? "bg-orange-500" : "bg-gray-500"
                      )}>
                        {task.priority === 'URGENT' ? '紧急' : task.priority === 'HIGH' ? '重要' : '普通'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>截止: {task.deadline ? new Date(task.deadline).toLocaleDateString() : '无'}</span>
                      </div>
                      <Button
                        size="sm"
                        className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        onClick={() => completeTaskMutation.mutate(task.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        完成
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* 汇报历史 */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              我的汇报
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myReports.length === 0 ? (
                <p className="text-center py-4 text-gray-500">暂无汇报记录</p>
              ) : (
                myReports.slice(0, 5).map((report: any) => (
                  <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        report.status === 'APPROVED' ? "bg-green-500" :
                        report.status === 'PENDING' ? "bg-yellow-500" : "bg-gray-500"
                      )} />
                      <div>
                        <p className="text-sm">{report.summary?.slice(0, 50)}...</p>
                        <p className="text-xs text-gray-500">
                          {new Date(report.submittedAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn(
                      report.status === 'APPROVED' ? "bg-green-500/20 text-green-400" :
                      report.status === 'PENDING' ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-500/20"
                    )}>
                      {report.status === 'APPROVED' ? '已采纳' : report.status === 'PENDING' ? '待审批' : '已打回'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 灵感记录 */}
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Lightbulb className="w-5 h-5" />
              灵感记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myIdeas.slice(0, 3).map((idea: any) => (
                <div key={idea.id} className="p-3 rounded-lg bg-amber-500/10">
                  <p className="text-sm">{idea.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(idea.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              ))}
              <p className="text-xs text-gray-500 text-center">
                共 {myIdeas.length} 条灵感记录
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
