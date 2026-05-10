import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Sparkles,
  Target,
  Lightbulb
} from "lucide-react";
import { Link } from "wouter";

interface DailyReport {
  id: string;
  reportDate: string;
  decisionSummary: string | null;
  opportunitiesFound: string[] | null;
  predictions: string[] | null;
  riskAlerts: string[] | null;
  tasksCompleted: number;
  hpConsumed: number;
  hpGained: number;
  createdAt: string;
}

export default function DailyReportPage() {
  const { toast } = useToast();
  const { role, hpBalance } = useZ1Store();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newReport, setNewReport] = useState({
    decisionSummary: '',
    opportunities: '',
    predictions: '',
    riskAlerts: '',
  });

  const { data: reports = [], isLoading } = useQuery<DailyReport[]>({
    queryKey: ['/api/daily-reports'],
    refetchInterval: 60000,
  });

  const { data: todayReport } = useQuery<DailyReport | null>({
    queryKey: ['/api/daily-reports/today'],
    refetchInterval: 60000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        reportDate: new Date().toISOString(),
        decisionSummary: data.decisionSummary,
        opportunitiesFound: data.opportunities.split('\n').filter((o: string) => o.trim()),
        predictions: data.predictions.split('\n').filter((p: string) => p.trim()),
        riskAlerts: data.riskAlerts.split('\n').filter((r: string) => r.trim()),
        tasksCompleted: 0,
        hpConsumed: 0,
        hpGained: 0,
      };
      return apiRequest('POST', '/api/daily-reports', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daily-reports'] });
      setIsCreating(false);
      setNewReport({ decisionSummary: '', opportunities: '', predictions: '', riskAlerts: '' });
      toast({ title: "日报已创建", className: "border-primary" });
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  return (
    <div className="min-h-screen bg-background p-6" data-testid="daily-report-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <FileText className="w-6 h-6 text-primary" />
                每日汇报板
              </h1>
              <p className="text-sm text-muted-foreground">Daily Report Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/20">
              HP: {hpBalance.toLocaleString()}
            </Badge>
            {!todayReport && !isCreating && role === 'MASTER' && (
              <Button onClick={() => setIsCreating(true)} data-testid="button-new-report">
                <Plus className="w-4 h-4 mr-2" />
                创建今日报告
              </Button>
            )}
          </div>
        </div>

        {isCreating && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                创建今日报告 - {formatDate(new Date().toISOString())}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">决策简报</label>
                <Textarea 
                  placeholder="今日主要决策与成果总结..."
                  value={newReport.decisionSummary}
                  onChange={(e) => setNewReport(prev => ({ ...prev, decisionSummary: e.target.value }))}
                  rows={3}
                  data-testid="textarea-decision-summary"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    商机发现（每行一条）
                  </label>
                  <Textarea 
                    placeholder="发现的商业机会..."
                    value={newReport.opportunities}
                    onChange={(e) => setNewReport(prev => ({ ...prev, opportunities: e.target.value }))}
                    rows={4}
                    data-testid="textarea-opportunities"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Target className="w-4 h-4 text-blue-400" />
                    事件预测（每行一条）
                  </label>
                  <Textarea 
                    placeholder="预测的未来事件..."
                    value={newReport.predictions}
                    onChange={(e) => setNewReport(prev => ({ ...prev, predictions: e.target.value }))}
                    rows={4}
                    data-testid="textarea-predictions"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    风险提醒（每行一条）
                  </label>
                  <Textarea 
                    placeholder="需要注意的风险..."
                    value={newReport.riskAlerts}
                    onChange={(e) => setNewReport(prev => ({ ...prev, riskAlerts: e.target.value }))}
                    rows={4}
                    data-testid="textarea-risk-alerts"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreating(false)}>取消</Button>
                <Button 
                  onClick={() => createMutation.mutate(newReport)} 
                  disabled={!newReport.decisionSummary || createMutation.isPending}
                  data-testid="button-submit-report"
                >
                  提交报告
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {todayReport && (
          <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  今日报告
                </CardTitle>
                <Badge className="bg-green-500/20 text-green-400">
                  {formatDate(todayReport.reportDate)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">决策简报</h4>
                  <p className="text-sm" data-testid="text-today-summary">{todayReport.decisionSummary || '暂无内容'}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                      <Lightbulb className="w-4 h-4 text-yellow-400" />
                      商机发现
                    </h4>
                    <ul className="text-sm space-y-1">
                      {(todayReport.opportunitiesFound || []).map((opp, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <Sparkles className="w-3 h-3 mt-1 text-yellow-400" />
                          {opp}
                        </li>
                      ))}
                      {(!todayReport.opportunitiesFound || todayReport.opportunitiesFound.length === 0) && (
                        <li className="text-muted-foreground">暂无</li>
                      )}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                      <Target className="w-4 h-4 text-blue-400" />
                      事件预测
                    </h4>
                    <ul className="text-sm space-y-1">
                      {(todayReport.predictions || []).map((pred, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <TrendingUp className="w-3 h-3 mt-1 text-blue-400" />
                          {pred}
                        </li>
                      ))}
                      {(!todayReport.predictions || todayReport.predictions.length === 0) && (
                        <li className="text-muted-foreground">暂无</li>
                      )}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      风险提醒
                    </h4>
                    <ul className="text-sm space-y-1">
                      {(todayReport.riskAlerts || []).map((risk, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-1 text-red-400" />
                          {risk}
                        </li>
                      ))}
                      {(!todayReport.riskAlerts || todayReport.riskAlerts.length === 0) && (
                        <li className="text-muted-foreground">暂无</li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground pt-2 border-t">
                  <span>任务完成: {todayReport.tasksCompleted}</span>
                  <span>HP 消耗: {todayReport.hpConsumed}</span>
                  <span>HP 获得: {todayReport.hpGained}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              历史报告
            </CardTitle>
            <CardDescription>过去的每日汇报记录</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">加载中...</div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <FileText className="w-8 h-8 mb-2 opacity-50" />
                <p>暂无历史报告</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {reports.filter(r => todayReport ? r.id !== todayReport.id : true).map((report) => (
                    <div 
                      key={report.id} 
                      className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      data-testid={`report-card-${report.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(report.reportDate)}
                        </Badge>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>任务: {report.tasksCompleted}</span>
                          <span>HP: +{report.hpGained}/-{report.hpConsumed}</span>
                        </div>
                      </div>
                      <p className="text-sm line-clamp-2">{report.decisionSummary || '无决策简报'}</p>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-yellow-400">
                          商机: {(report.opportunitiesFound || []).length}
                        </span>
                        <span className="text-blue-400">
                          预测: {(report.predictions || []).length}
                        </span>
                        <span className="text-red-400">
                          风险: {(report.riskAlerts || []).length}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
