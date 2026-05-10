/**
 * ProjectDetail - 项目详情页 1.0
 *
 * 功能：项目基本信息、进度追踪、关联联系人、关联文档、任务列表
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  ArrowLeft, Edit2, Trash2, Clock, CheckCircle2,
  Users2, FileText, Plus, ChevronRight, Calendar,
  TrendingUp, Target, Play, Pause
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  title?: string;
  description?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';
  progress: number;
  createdAt?: number;
  updatedAt?: number;
}

interface Contact {
  id: string;
  name: string;
  title?: string;
  company?: string;
}

interface Task {
  id: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate?: number;
}

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const projectId = params.id;

  // 获取项目详情
  const { data: project, isLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      return data.data || data;
    },
  });

  // 获取关联联系人
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/persons', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/persons?projectId=${projectId}`);
      const data = await res.json();
      return data.items || data || [];
    },
  });

  // 获取项目任务
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await res.json();
      return data.data || data || [];
    },
  });

  // 更新项目状态
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: Project['status']) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      toast.success("项目状态已更新");
    }
  });

  // 删除项目
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      return res;
    },
    onSuccess: () => {
      toast.success("项目已删除");
      setLocation('/projects');
    }
  });

  // 格式化时间
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  // 获取状态颜色
  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500';
      case 'COMPLETED': return 'bg-blue-500';
      case 'PAUSED': return 'bg-yellow-500';
      case 'ARCHIVED': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // 获取状态标签
  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'ACTIVE': return '进行中';
      case 'COMPLETED': return '已完成';
      case 'PAUSED': return '已暂停';
      case 'ARCHIVED': return '已归档';
      default: return '未知';
    }
  };

  if (isLoading) {
    return (
      <SafeLayout headerTitle="项目详情" showBack={true}>
        <div className="animate-pulse space-y-4 p-4">
          <div className="h-32 bg-white/5 rounded-3xl" />
          <div className="h-20 bg-white/5 rounded-2xl" />
          <div className="h-20 bg-white/5 rounded-2xl" />
        </div>
      </SafeLayout>
    );
  }

  return (
    <SafeLayout headerTitle="项目详情" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 项目头部信息 */}
        <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-transparent border border-white/5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-bold uppercase", getStatusColor(project?.status || 'ACTIVE') + "/20", getStatusColor(project?.status || 'ACTIVE').replace('bg-', 'text-'))}>
                  {getStatusLabel(project?.status || 'ACTIVE')}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white truncate">{project?.name || project?.title || '未命名项目'}</h1>
              <p className="text-xs text-gray-500 mt-1">ID: {projectId}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateStatusMutation.mutate(project?.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}
                className="p-2 rounded-xl bg-white/5 active:bg-white/10"
              >
                {project?.status === 'ACTIVE' ? (
                  <Pause className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Play className="w-4 h-4 text-green-500" />
                )}
              </button>
              <button
                onClick={() => {
                  if (confirm('确定要删除此项目吗？')) {
                    deleteMutation.mutate();
                  }
                }}
                className="p-2 rounded-xl bg-white/5 active:bg-white/10"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 uppercase">项目进度</span>
              <span className="text-primary font-bold">{project?.progress || 0}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${project?.progress || 0}%` }}
              />
            </div>
          </div>

          {/* 项目描述 */}
          {project?.description && (
            <p className="text-sm text-gray-400 mt-4 leading-relaxed">
              {project.description}
            </p>
          )}

          {/* 时间信息 */}
          <div className="flex gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>创建: {formatDate(project?.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>更新: {formatDate(project?.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-3 px-1">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
            <Target className="w-5 h-5 text-primary mx-auto mb-2" />
            <div className="text-lg font-bold text-white">{project?.progress || 0}%</div>
            <div className="text-[8px] text-gray-500 uppercase">完成度</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
            <Users2 className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <div className="text-lg font-bold text-white">{contacts.length}</div>
            <div className="text-[8px] text-gray-500 uppercase">联系人</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
            <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-2" />
            <div className="text-lg font-bold text-white">{tasks.filter(t => t.status === 'COMPLETED').length}</div>
            <div className="text-[8px] text-gray-500 uppercase">已完成</div>
          </div>
        </div>

        {/* 关联联系人 */}
        <section className="px-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase">关联联系人</h2>
            <button
              onClick={() => setLocation('/contacts')}
              className="text-[10px] text-primary flex items-center gap-1"
            >
              添加 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {contacts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <Users2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">暂无关联联系人</p>
              </div>
            ) : (
              contacts.slice(0, 3).map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {contact.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{contact.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{contact.title} @ {contact.company}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              ))
            )}
          </div>
        </section>

        {/* 项目任务 */}
        <section className="px-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase">项目任务</h2>
            <button
              onClick={() => setLocation('/tasks')}
              className="text-[10px] text-primary flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <CheckCircle2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">暂无任务</p>
              </div>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    task.status === 'COMPLETED' ? 'bg-green-500' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-500'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{task.name}</p>
                    {task.dueDate && (
                      <p className="text-[10px] text-gray-500">截止: {formatDate(task.dueDate)}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 操作按钮 */}
        <div className="px-1 space-y-3">
          <button
            onClick={() => setLocation('/vault')}
            className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between active:bg-white/10"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-white">项目文档</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>

          <button
            onClick={() => setLocation('/insight')}
            className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between active:bg-white/10"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-bold text-white">AI分析</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

      </div>
    </SafeLayout>
  );
}
