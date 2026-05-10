/**
 * DesktopProjects - 桌面端项目管理页面
 *
 * 功能：
 * - 项目列表展示
 * - 项目状态筛选
 * - 搜索功能
 * - 新建项目
 * - 项目详情
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FolderKanban, Plus, Search, Clock, CheckCircle2, Pause, Play,
  MoreVertical, Trash2, Edit, Eye, Users, Calendar, TrendingUp,
  Filter, Grid, List, ChevronRight, Star, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// 项目状态类型
type ProjectStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';

// 项目数据
interface Project {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';
  progress: number;
  tasks: number;
  completedTasks: number;
  teamSize: number;
  createdAt: Date;
  updatedAt: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
}

// 模拟数据
const mockProjects: Project[] = [
  {
    id: '1',
    name: '小星AI助手升级',
    description: '整合OpenClaw能力，提升对话理解和执行效率',
    status: 'ACTIVE',
    progress: 65,
    tasks: 24,
    completedTasks: 16,
    teamSize: 3,
    createdAt: new Date(Date.now() - 30 * 86400000),
    updatedAt: new Date(Date.now() - 3600000),
    priority: 'HIGH',
    tags: ['AI', 'Web']
  },
  {
    id: '2',
    name: 'Navigator-X 舰船系统',
    description: '企业级团队协作和管理功能开发',
    status: 'ACTIVE',
    progress: 42,
    tasks: 56,
    completedTasks: 24,
    teamSize: 5,
    createdAt: new Date(Date.now() - 45 * 86400000),
    updatedAt: new Date(Date.now() - 7200000),
    priority: 'HIGH',
    tags: ['企业', '协作']
  },
  {
    id: '3',
    name: '移动端UI重构',
    description: '基于新设计系统重构移动端界面',
    status: 'PAUSED',
    progress: 30,
    tasks: 18,
    completedTasks: 5,
    teamSize: 2,
    createdAt: new Date(Date.now() - 60 * 86400000),
    updatedAt: new Date(Date.now() - 86400000 * 7),
    priority: 'MEDIUM',
    tags: ['UI', '移动端']
  },
  {
    id: '4',
    name: '化蝶计划自我进化',
    description: '实现AI系统的自我学习和进化能力',
    status: 'COMPLETED',
    progress: 100,
    tasks: 12,
    completedTasks: 12,
    teamSize: 2,
    createdAt: new Date(Date.now() - 90 * 86400000),
    updatedAt: new Date(Date.now() - 86400000 * 3),
    priority: 'MEDIUM',
    tags: ['AI', '进化']
  },
  {
    id: '5',
    name: '数据安全加固',
    description: '全面提升系统数据安全等级',
    status: 'ACTIVE',
    progress: 78,
    tasks: 15,
    completedTasks: 12,
    teamSize: 4,
    createdAt: new Date(Date.now() - 20 * 86400000),
    updatedAt: new Date(Date.now() - 1800000),
    priority: 'HIGH',
    tags: ['安全', '后端']
  },
];

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: '进行中', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Play },
  COMPLETED: { label: '已完成', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle2 },
  PAUSED: { label: '已暂停', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Pause },
  ARCHIVED: { label: '已归档', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Clock },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  HIGH: { label: '高', color: 'text-red-400' },
  MEDIUM: { label: '中', color: 'text-amber-400' },
  LOW: { label: '低', color: 'text-gray-400' },
};

export default function DesktopProjects() {
  const [projects] = useState<Project[]>(mockProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);

  // 过滤项目
  const filteredProjects = projects.filter(p => {
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 统计数据
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'ACTIVE').length,
    completed: projects.filter(p => p.status === 'COMPLETED').length,
    totalTasks: projects.reduce((acc, p) => acc + p.tasks, 0),
    completedTasks: projects.reduce((acc, p) => acc + p.completedTasks, 0),
  };

  return (
    <div className="flex flex-col h-full bg-[#030712]">
      {/* 顶部栏 */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 h-14 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-5 h-5 text-blue-400" />
          <h1 className="text-base font-bold text-white">项目管理</h1>
          <Badge variant="outline" className="text-xs">
            {stats.active} 个进行中
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            新建项目
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏统计 */}
        <div className="w-64 border-r border-white/10 bg-black/20 p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">项目统计</h3>

          <div className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">总项目</span>
                  <FolderKanban className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-black text-white">{stats.total}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">进行中</span>
                  <Play className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-black text-blue-400">{stats.active}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">已完成</span>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-2xl font-black text-green-400">{stats.completed}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">任务完成率</span>
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-2xl font-black text-purple-400">
                  {Math.round((stats.completedTasks / stats.totalTasks) * 100)}%
                </p>
                <Progress
                  value={(stats.completedTasks / stats.totalTasks) * 100}
                  className="h-1 mt-2"
                />
              </CardContent>
            </Card>
          </div>

          {/* 状态筛选 */}
          <div className="mt-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">状态筛选</h3>
            <div className="space-y-1">
              {(['ALL', 'ACTIVE', 'COMPLETED', 'PAUSED'] as ProjectStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between",
                    statusFilter === status
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "hover:bg-white/5 text-gray-400"
                  )}
                >
                  <span>{status === 'ALL' ? '全部' : statusConfig[status]?.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {status === 'ALL'
                      ? projects.length
                      : projects.filter(p => p.status === status).length}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col">
          {/* 搜索和视图切换 */}
          <div className="flex-shrink-0 flex items-center gap-4 p-4 border-b border-white/10">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="搜索项目..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded transition-all",
                  viewMode === 'grid' ? "bg-indigo-500 text-white" : "text-gray-400 hover:text-white"
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded transition-all",
                  viewMode === 'list' ? "bg-indigo-500 text-white" : "text-gray-400 hover:text-white"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 项目列表 */}
          <ScrollArea className="flex-1 p-4">
            {filteredProjects.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <FolderKanban className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">暂无项目</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    创建第一个项目
                  </Button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-4">
                {filteredProjects.map(project => {
                  const status = statusConfig[project.status];
                  const priority = priorityConfig[project.priority];
                  const StatusIcon = status.icon;

                  return (
                    <Card
                      key={project.id}
                      className="bg-white/5 border-white/10 hover:border-white/20 transition-all cursor-pointer group"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-[10px]", status.bg, status.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px]", priority.color)}>
                              {priority.label}
                            </Badge>
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                        <CardTitle className="text-base mt-3">{project.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-gray-500 mb-4 line-clamp-2">{project.description}</p>

                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-500">进度</span>
                              <span className={cn(
                                project.progress === 100 ? "text-green-400" : "text-white"
                              )}>{project.progress}%</span>
                            </div>
                            <Progress value={project.progress} className="h-2" />
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-4">
                              <span className="text-gray-500 flex items-center gap-1">
                                <Edit className="w-3 h-3" />
                                {project.completedTasks}/{project.tasks}
                              </span>
                              <span className="text-gray-500 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {project.teamSize}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                          {project.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map(project => {
                  const status = statusConfig[project.status];
                  const priority = priorityConfig[project.priority];
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={project.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <FolderKanban className="w-5 h-5 text-indigo-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-white truncate">{project.name}</h3>
                          <Badge className={cn("text-[10px]", status.bg, status.color)}>
                            {status.label}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[10px]", priority.color)}>
                            {priority.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{project.description}</p>
                      </div>

                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">进度</span>
                          <span>{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-1" />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Edit className="w-3 h-3" />
                          {project.completedTasks}/{project.tasks}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {project.teamSize}
                        </span>
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
