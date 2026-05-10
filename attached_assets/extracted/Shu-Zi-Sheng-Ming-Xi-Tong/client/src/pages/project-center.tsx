import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  FolderKanban, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle,
  ArrowLeft,
  Plus,
  Target,
  Calendar,
  TrendingUp,
  Pause
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

type ProjectStatus = 'PENDING' | 'APPROVED' | 'ON_HOLD' | 'DEPRECATED' | 'COMPLETED';

interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: string;
  category: string;
  objectives: string[] | null;
  milestones: any[] | null;
  progress: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<ProjectStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: '待定', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
  APPROVED: { label: '立项', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-3 h-3" /> },
  ON_HOLD: { label: '暂缓', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Pause className="w-3 h-3" /> },
  DEPRECATED: { label: '废除', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="w-3 h-3" /> },
  COMPLETED: { label: '完成', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Target className="w-3 h-3" /> },
};

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-500 text-black',
  LOW: 'bg-gray-500 text-white',
};

export default function ProjectCenter() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', category: 'BUSINESS', priority: 'MEDIUM', objectives: '' });

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        objectives: data.objectives ? data.objectives.split('\n').filter((o: string) => o.trim()) : [],
      };
      return apiRequest('POST', '/api/projects', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setShowNewDialog(false);
      setNewProject({ title: '', description: '', category: 'BUSINESS', priority: 'MEDIUM', objectives: '' });
      toast({ title: "项目已创建", description: "新项目已添加到待定列表" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProjectStatus }) => {
      return apiRequest('PATCH', `/api/projects/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setSelectedProject(null);
      toast({ title: "项目状态已更新", className: "border-primary" });
    },
  });

  const filteredProjects = projects.filter((p: Project) => filterStatus === 'ALL' || p.status === filterStatus);
  const pendingCount = projects.filter((p: Project) => p.status === 'PENDING').length;
  const activeCount = projects.filter((p: Project) => p.status === 'APPROVED').length;

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-destructive/50" data-testid="access-denied-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              ZONE_RED: 访问被拒绝
            </CardTitle>
            <CardDescription>项目管理中心仅对 MASTER 角色开放</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" data-testid="project-center-page">
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
                <FolderKanban className="w-6 h-6 text-primary" />
                项目管理中心
              </h1>
              <p className="text-sm text-muted-foreground">Project Management Center</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400" data-testid="badge-pending">{pendingCount} 待定</Badge>
            <Badge variant="outline" className="bg-green-500/20 text-green-400" data-testid="badge-active">{activeCount} 进行中</Badge>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-project">
                  <Plus className="w-4 h-4 mr-2" />
                  新建项目
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>新建项目</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input 
                    placeholder="项目名称" 
                    value={newProject.title} 
                    onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                    data-testid="input-project-title"
                  />
                  <div className="flex gap-2">
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newProject.category}
                      onChange={(e) => setNewProject(prev => ({ ...prev, category: e.target.value }))}
                      data-testid="select-project-category"
                    >
                      <option value="BUSINESS">商业</option>
                      <option value="TECHNOLOGY">技术</option>
                      <option value="RESEARCH">研究</option>
                      <option value="PERSONAL">个人</option>
                    </select>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newProject.priority}
                      onChange={(e) => setNewProject(prev => ({ ...prev, priority: e.target.value }))}
                      data-testid="select-project-priority"
                    >
                      <option value="LOW">低优先级</option>
                      <option value="MEDIUM">中优先级</option>
                      <option value="HIGH">高优先级</option>
                      <option value="CRITICAL">紧急</option>
                    </select>
                  </div>
                  <Textarea 
                    placeholder="项目描述..." 
                    value={newProject.description} 
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    data-testid="textarea-project-description"
                  />
                  <Textarea 
                    placeholder="项目目标（每行一个）" 
                    value={newProject.objectives} 
                    onChange={(e) => setNewProject(prev => ({ ...prev, objectives: e.target.value }))}
                    rows={3}
                    data-testid="textarea-project-objectives"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">取消</Button>
                  </DialogClose>
                  <Button 
                    onClick={() => createMutation.mutate(newProject)} 
                    disabled={!newProject.title || createMutation.isPending}
                    data-testid="button-submit-project"
                  >
                    创建项目
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList>
            <TabsTrigger value="ALL" data-testid="tab-all">全部</TabsTrigger>
            <TabsTrigger value="PENDING" data-testid="tab-pending">待定</TabsTrigger>
            <TabsTrigger value="APPROVED" data-testid="tab-approved">进行中</TabsTrigger>
            <TabsTrigger value="ON_HOLD" data-testid="tab-hold">暂缓</TabsTrigger>
            <TabsTrigger value="COMPLETED" data-testid="tab-completed">已完成</TabsTrigger>
            <TabsTrigger value="DEPRECATED" data-testid="tab-deprecated">废除</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">项目列表</CardTitle>
                <CardDescription>{filteredProjects.length} 个项目</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground">加载中...</div>
                ) : filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <FolderKanban className="w-8 h-8 mb-2 opacity-50" />
                    <p>暂无项目</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {filteredProjects.map((project: Project) => (
                        <div 
                          key={project.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${selectedProject?.id === project.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                          onClick={() => setSelectedProject(project)}
                          data-testid={`project-card-${project.id}`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={priorityColors[project.priority]} data-testid={`badge-priority-${project.id}`}>
                                  {project.priority === 'CRITICAL' ? '紧急' : project.priority === 'HIGH' ? '高' : project.priority === 'MEDIUM' ? '中' : '低'}
                                </Badge>
                                <span className="font-medium" data-testid={`text-title-${project.id}`}>{project.title}</span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                            </div>
                            <Badge variant="outline" className={statusConfig[project.status].color} data-testid={`badge-status-${project.id}`}>
                              {statusConfig[project.status].icon}
                              <span className="ml-1">{statusConfig[project.status].label}</span>
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Progress value={project.progress || 0} className="h-1.5" />
                            </div>
                            <span className="text-xs text-muted-foreground">{project.progress || 0}%</span>
                            {project.deadline && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(project.deadline).toLocaleDateString('zh-CN')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  项目详情
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedProject ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2" data-testid="text-detail-title">{selectedProject.title}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={priorityColors[selectedProject.priority]}>{selectedProject.priority}</Badge>
                        <Badge variant="outline" className={statusConfig[selectedProject.status].color}>
                          {statusConfig[selectedProject.status].label}
                        </Badge>
                        <Badge variant="secondary">{selectedProject.category}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid="text-detail-description">{selectedProject.description || '暂无描述'}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">进度</span>
                        <span className="font-medium">{selectedProject.progress || 0}%</span>
                      </div>
                      <Progress value={selectedProject.progress || 0} className="h-2" />
                    </div>

                    {selectedProject.objectives && selectedProject.objectives.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">项目目标</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {selectedProject.objectives.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Target className="w-3 h-3 mt-1 text-primary" />
                              <span>{obj}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedProject.status === 'PENDING' && (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm font-medium text-muted-foreground">审批决策</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => updateMutation.mutate({ id: selectedProject.id, status: 'APPROVED' })}
                            disabled={updateMutation.isPending}
                            data-testid="button-approve"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            立项
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-orange-500 text-orange-500"
                            onClick={() => updateMutation.mutate({ id: selectedProject.id, status: 'ON_HOLD' })}
                            disabled={updateMutation.isPending}
                            data-testid="button-hold"
                          >
                            <Pause className="w-3 h-3 mr-1" />
                            待定
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => updateMutation.mutate({ id: selectedProject.id, status: 'DEPRECATED' })}
                            disabled={updateMutation.isPending}
                            data-testid="button-deprecate"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            废除
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {selectedProject.status === 'APPROVED' && (
                      <div className="space-y-2 pt-2 border-t">
                        <Button 
                          size="sm" 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => updateMutation.mutate({ id: selectedProject.id, status: 'COMPLETED' })}
                          disabled={updateMutation.isPending}
                          data-testid="button-complete"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          标记完成
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Target className="w-8 h-8 mb-2 opacity-50" />
                    <p>选择项目查看详情</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
