/**
 * ProjectManager - 吉麟项目中心 13.0 (状态绑定修复版)
 *
 * 修复：搜索框状态绑定、新建项目完整绑定、动态进度计算
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { Plus, Clock, CheckCircle2, Search, Trash2, FileText, X } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiMutation } from "@/lib/useApi";
import { useLocation } from "wouter";
import { useGlobalStore, useCurrentProject } from "@/store/globalStore";

type ProjectStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'PAUSED';

export default function ProjectManager() {
  const [, setLocation] = useLocation();
  const setCurrentProject = useGlobalStore((s) => s.setCurrentProject);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus>('ALL');
  const [newProject, setNewProject] = useState({ title: '', description: '' });

  // 统一 API 查询
  const { data: projects = [], isLoading } = useApiQuery(
    ['/api/projects'],
    async () => {
      const res = await fetch('/api/projects');
      const data = await res.json();
      return (data.projects || data.items || data) as unknown[];
    }
  );

  // 统一 Mutation 封装
  const createMutation = useApiMutation(
    (payload: { title: string; description: string }) =>
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, status: 'ACTIVE' }),
      }).then(r => r.json()),
    {
      successMessage: '吉麟项目节点建立成功：知识库已自动挂载。',
      errorMessage: '项目创建失败，请稍后重试',
      invalidateKeys: [['/api/projects']],
      onSuccess: () => {
        setShowCreate(false);
        setNewProject({ title: '', description: '' });
      },
    }
  );

  const deleteMutation = useApiMutation(
    (projectId: string) =>
      fetch(`/api/projects/${projectId}`, { method: 'DELETE' }).then(r => r.json()),
    {
      successMessage: '项目已移除',
      errorMessage: '删除失败',
      invalidateKeys: [['/api/projects']],
    }
  );

  // 过滤项目列表
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p: any) => {
      const matchesSearch = !searchQuery ||
        (p.title || p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // 处理搜索提交
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 搜索逻辑已通过 useMemo 实时过滤
  };

  // 处理新建项目提交
  const handleCreateProject = () => {
    if (!newProject.title.trim()) {
      toast.error("请输入项目名称");
      return;
    }
    createMutation.mutate(newProject);
  };

  if (isLoading) return <SafeLayout headerTitle="项目中心" showBack={true}><div className="animate-pulse space-y-4 pt-10"><div className="h-20 bg-white/5 rounded-3xl" /><div className="h-20 bg-white/5 rounded-3xl" /></div></SafeLayout>;

  return (
    <SafeLayout headerTitle="项目建设" showBack={true}>
      <div className="space-y-6 pb-10">
        {/* 搜索区域 */}
        <form onSubmit={handleSearch} className="flex gap-3 px-1">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="检索商务项目库..."
              className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
            />
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 active:scale-95 transition-all">
            <Plus className="w-6 h-6 text-white" />
          </button>
        </form>

        {/* 状态筛选标签 */}
        <div className="flex gap-2 px-1 overflow-x-auto pb-2 scrollbar-hide">
          {(['ALL', 'ACTIVE', 'COMPLETED', 'PAUSED'] as ProjectStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
                statusFilter === status
                  ? "bg-primary text-white"
                  : "bg-white/5 text-gray-500 active:bg-white/10"
              )}
            >
              {status === 'ALL' ? '全部' : status === 'ACTIVE' ? '进行中' : status === 'COMPLETED' ? '已完成' : '已暂停'}
            </button>
          ))}
        </div>

        {/* 项目列表 */}
        <div className="space-y-3">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500">
                {searchQuery ? '未找到匹配的项目' : '暂无项目，点击 + 创建第一个项目'}
              </p>
            </div>
          ) : (
            filteredProjects.map((p: any) => (
              <div
                key={p.id}
                onClick={() => {
                  setLocation(`/projects/${p.id}`);
                  setCurrentProject({ id: p.id, title: p.title || p.name, status: p.status, progress: p.progress });
                }}
                className="p-5 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-4 active:bg-white/10 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white truncate">{p.title || p.name}</h3>
                      <p className="text-[9px] text-gray-500 font-mono italic uppercase">NODE ID: {p.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === 'ACTIVE' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : p.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-500" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('确定要删除此项目吗？')) {
                          deleteMutation.mutate(p.id);
                        }
                      }}
                      className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* 动态进度条 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-gray-500 uppercase">Progress</span>
                    <span className="text-primary font-bold">{p.progress || 0}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary shadow-[0_0_10px_#6366f1] transition-all duration-500"
                      style={{ width: `${p.progress || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 新建项目抽屉 */}
        {showCreate && (
          <div className="fixed inset-0 z-[1000] flex items-end">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowCreate(false)} />
            <div className="relative w-full bg-[#0f172a] rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300 border-t border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tighter">部署新商务节点</h3>
                <button onClick={() => setShowCreate(false)} className="p-2 text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  placeholder="项目全称..."
                  value={newProject.title}
                  onChange={(e) => setNewProject({...newProject, title: e.target.value})}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white outline-none focus:border-primary transition-colors"
                />
                <textarea
                  placeholder="项目描述（可选）..."
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary transition-colors resize-none"
                />
                <button
                  onClick={handleCreateProject}
                  disabled={createMutation.isPending || !newProject.title.trim()}
                  className="w-full h-16 bg-primary text-white font-black uppercase rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                >
                  {createMutation.isPending ? '创建中...' : '确认建设'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SafeLayout>
  );
}
