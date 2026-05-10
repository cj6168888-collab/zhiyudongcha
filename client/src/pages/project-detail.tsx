import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle,
  Pause,
  Target,
  Calendar,
  FileText,
  MessageSquare,
  Send,
  Upload,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Brain,
  Loader2,
  Eye,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  category: string;
  leaderId: string | null;
  responsiblePersonId: string | null;
  relatedPersonIds: string[] | null;
  executorIds: string[] | null;
  currentConditions: string[] | null;
  missingConditions: string[] | null;
  swotAnalysis: {
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
  reviewNotes: string | null;
}

interface ProjectNote {
  id: string;
  projectId: string;
  content: string;
  noteType: string;
  createdAt: string;
}

interface ProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  aiAnalysis: string | null;
  uploadedAt: string;
}

interface Person {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: '待定', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-4 h-4" /> },
  PENDING_REVIEW: { label: '待审', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Clock className="w-4 h-4" /> },
  APPROVED: { label: '立项', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-4 h-4" /> },
  ON_HOLD: { label: '暂缓', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Pause className="w-4 h-4" /> },
  DEPRECATED: { label: '废除', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="w-4 h-4" /> },
  COMPLETED: { label: '完成', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Target className="w-4 h-4" /> },
};

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: '紧急', color: 'bg-red-600 text-white' },
  3: { label: '高', color: 'bg-orange-500 text-white' },
  5: { label: '中', color: 'bg-yellow-500 text-black' },
  7: { label: '低', color: 'bg-gray-500 text-white' },
};

const fileTypeLabels: Record<string, string> = {
  PROPOSAL: '策划书',
  SOP: 'SOP手册',
  CONTRACT: '合同',
  REPORT: '报告',
  ANALYSIS: '分析文档',
  OTHER: '其他',
};

const getStatusConfig = (status: string) => statusConfig[status] || { label: '未知', color: 'bg-gray-500/20 text-gray-400', icon: <Clock className="w-4 h-4" /> };
const getPriorityConfig = (priority: number) => priorityLabels[priority] || priorityLabels[5];

export default function ProjectDetail() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const projectId = window.location.pathname.split('/').pop() || '';

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: notes = [] } = useQuery<ProjectNote[]>({
    queryKey: [`/api/projects/${projectId}/notes`],
    enabled: !!projectId,
  });

  const { data: files = [] } = useQuery<ProjectFile[]>({
    queryKey: [`/api/projects/${projectId}/files`],
    enabled: !!projectId,
  });

  const { data: persons = [] } = useQuery<Person[]>({
    queryKey: ['/api/persons'],
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', `/api/projects/${projectId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      setNewNote("");
      toast({ title: "备注已添加" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest('DELETE', `/api/projects/${projectId}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      toast({ title: "备注已删除" });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileType: string; fileContent: string }) => {
      return apiRequest('POST', `/api/projects/${projectId}/files`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: "文件上传成功" });
      setUploadingFile(false);
    },
  });

  const analyzeFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest('POST', `/api/projects/${projectId}/files/${fileId}/analyze`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: "AI分析完成" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest('DELETE', `/api/projects/${projectId}/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: "文件已删除" });
    },
  });

  const generateSwotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/projects/${projectId}/generate-swot`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      toast({ title: "SWOT分析已生成", description: "AI已根据项目信息生成了SWOT分析" });
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "无法生成SWOT分析";
      toast({ 
        title: "生成失败", 
        description: errorMessage,
        variant: "destructive"
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest('PATCH', `/api/projects/${projectId}`, { status: newStatus });
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      const statusLabel = statusConfig[newStatus]?.label || newStatus;
      toast({ title: "状态已更新", description: `项目状态已改为: ${statusLabel}` });
    },
    onError: () => {
      toast({ title: "更新失败", variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await uploadFileMutation.mutateAsync({
        fileName: file.name,
        fileType: file.name.toLowerCase().includes('sop') ? 'SOP' : 
                  file.name.toLowerCase().includes('策划') ? 'PROPOSAL' : 'OTHER',
        fileContent: content,
      });
    };
    reader.readAsText(file);
  };

  const getPersonName = (id: string | null) => {
    if (!id) return '未指定';
    const person = persons.find(p => p.id === id);
    return person?.name || id;
  };

  const getPersonNames = (ids: string[] | null) => {
    if (!ids || ids.length === 0) return '无';
    return ids.map(id => getPersonName(id)).join('、');
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
        <div className="max-w-5xl mx-auto">
          <GlobalWakeHeader />
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
        <div className="max-w-5xl mx-auto">
          <GlobalWakeHeader />
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">项目不存在</h2>
              <Link href="/projects">
                <Button variant="outline" data-testid="button-back-to-projects">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回项目列表
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusConfig(project.status);
  const priorityInfo = getPriorityConfig(project.priority);
  const swot = project.swotAnalysis || { strengths: [], weaknesses: [], opportunities: [], threats: [] };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <GlobalWakeHeader />

        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
          </Link>
        </div>

        <Card className="bg-slate-800/50 border-slate-700" data-testid="card-project-header">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white" data-testid="text-project-title">{project.title}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${statusInfo.color} border flex items-center gap-1`} data-testid="badge-status">
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Badge>
                  <Badge className={priorityInfo.color} data-testid="badge-priority">
                    {priorityInfo.label}
                  </Badge>
                  <Badge variant="outline" className="text-slate-400 border-slate-600">
                    {project.category}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-right text-xs text-slate-500">
                  <div>创建: {format(new Date(project.createdAt), 'yyyy-MM-dd')}</div>
                  <div>更新: {format(new Date(project.updatedAt), 'yyyy-MM-dd')}</div>
                </div>
                {role === 'MASTER' && project.status !== 'DEPRECATED' && (
                  <div className="flex items-center gap-2">
                    {project.status === 'PENDING_REVIEW' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                        onClick={() => updateStatusMutation.mutate('APPROVED')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-approve"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        批准立项
                      </Button>
                    )}
                    {project.status !== 'ON_HOLD' && project.status !== 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                        onClick={() => updateStatusMutation.mutate('ON_HOLD')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-hold"
                      >
                        <Pause className="w-3 h-3 mr-1" />
                        暂缓
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                      onClick={() => updateStatusMutation.mutate('DEPRECATED')}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-deprecate"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      废弃
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="people">相关人员</TabsTrigger>
            <TabsTrigger value="conditions">核心要素</TabsTrigger>
            <TabsTrigger value="swot">SWOT分析</TabsTrigger>
            <TabsTrigger value="files">文件资料 ({files.length})</TabsTrigger>
            <TabsTrigger value="notes">备注 ({notes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  项目介绍
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap" data-testid="text-description">
                  {project.description || '暂无项目介绍，请编辑添加'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="people" className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  相关人员
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">主导人</div>
                    <div className="text-white font-medium">{getPersonName(project.leaderId)}</div>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">责任人</div>
                    <div className="text-white font-medium">{getPersonName(project.responsiblePersonId)}</div>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">关系人</div>
                    <div className="text-white font-medium">{getPersonNames(project.relatedPersonIds)}</div>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">执行人</div>
                    <div className="text-white font-medium">{getPersonNames(project.executorIds)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conditions" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    现有条件
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.currentConditions && project.currentConditions.length > 0 ? (
                    <ul className="space-y-2">
                      {project.currentConditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">暂无记录</p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    欠缺条件
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.missingConditions && project.missingConditions.length > 0 ? (
                    <ul className="space-y-2">
                      {project.missingConditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">暂无记录</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="swot" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button 
                onClick={() => generateSwotMutation.mutate()}
                disabled={generateSwotMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                data-testid="button-generate-swot"
              >
                {generateSwotMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                AI生成SWOT分析
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-800/50 border-green-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-green-400 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    优势 (Strengths)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {swot.strengths && swot.strengths.length > 0 ? (
                    <ul className="space-y-1">
                      {swot.strengths.map((s, i) => (
                        <li key={i} className="text-slate-300">• {s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">暂无分析</p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-red-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-red-400 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    劣势 (Weaknesses)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {swot.weaknesses && swot.weaknesses.length > 0 ? (
                    <ul className="space-y-1">
                      {swot.weaknesses.map((w, i) => (
                        <li key={i} className="text-slate-300">• {w}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">暂无分析</p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-blue-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    机会 (Opportunities)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {swot.opportunities && swot.opportunities.length > 0 ? (
                    <ul className="space-y-1">
                      {swot.opportunities.map((o, i) => (
                        <li key={i} className="text-slate-300">• {o}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">暂无分析</p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-amber-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    威胁 (Threats)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {swot.threats && swot.threats.length > 0 ? (
                    <ul className="space-y-1">
                      {swot.threats.map((t, i) => (
                        <li key={i} className="text-slate-300">• {t}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">暂无分析</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    文件资料
                  </CardTitle>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".txt,.md,.doc,.docx,.pdf"
                      className="hidden"
                      aria-label="上传项目文件"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="bg-purple-600 hover:bg-purple-700"
                      data-testid="button-upload-file"
                    >
                      {uploadingFile ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-1" />
                      )}
                      上传文件
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {files.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无文件，请上传项目策划书、SOP手册等资料</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div key={file.id} className="bg-slate-900/50 rounded-lg p-4" data-testid={`file-item-${file.id}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-400" />
                            <div>
                              <div className="text-white font-medium">{file.fileName}</div>
                              <div className="text-xs text-slate-500">
                                {fileTypeLabels[file.fileType] || file.fileType} · {format(new Date(file.uploadedAt), 'yyyy-MM-dd HH:mm')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => analyzeFileMutation.mutate(file.id)}
                              disabled={analyzeFileMutation.isPending}
                              className="text-blue-400 border-blue-400/50"
                              data-testid={`button-analyze-${file.id}`}
                            >
                              {analyzeFileMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Brain className="w-4 h-4" />
                              )}
                              AI分析
                            </Button>
                            {role === 'MASTER' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteFileMutation.mutate(file.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                data-testid={`button-delete-file-${file.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {file.aiAnalysis && (
                          <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <div className="text-xs text-blue-400 mb-1 flex items-center gap-1">
                              <Brain className="w-3 h-3" />
                              AI分析结果
                            </div>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{file.aiAnalysis}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  项目备注
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="添加新备注..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 text-white resize-none"
                    rows={2}
                    data-testid="input-new-note"
                  />
                  <Button 
                    onClick={() => newNote.trim() && addNoteMutation.mutate(newNote.trim())}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-add-note"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                <ScrollArea className="h-[300px]">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>暂无备注</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="bg-slate-900/50 rounded-lg p-3 group" data-testid={`note-item-${note.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-white flex-1 whitespace-pre-wrap">{note.content}</p>
                            {role === 'MASTER' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-opacity"
                                data-testid={`button-delete-note-${note.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-2">
                            {format(new Date(note.createdAt), 'yyyy-MM-dd HH:mm')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
