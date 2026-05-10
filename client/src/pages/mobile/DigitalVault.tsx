/**
 * DigitalVault - 成果智库 25.0 (增强版)
 *
 * 增强：搜索功能、文件筛选、分类视图、空状态展示
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { Search, FileUp, Camera, Globe, Download, FileText, ChevronRight, X, Filter, FolderOpen, Image, File, Video, Music, Fingerprint, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useApiQuery } from "@/lib/useApi";
import { useNativeBiometric } from "@/hooks/use-native-biometric";

interface VaultFile {
  id: string;
  name: string;
  type: string;
  size?: number;
  expertId?: string;
  projectId?: string;
  createdAt?: number;
  url?: string;
}

type FilterType = 'ALL' | 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'AUDIO';

export default function DigitalVault() {
  const [, setLocation] = useLocation();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [pendingType, setPendingType] = useState<'UPLOAD' | 'SCAN' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<FilterType>('ALL');

  const { isAvailable: bioAvailable, status: bioStatus, isGranted, authenticate } = useNativeBiometric();

  // 进入页面时自动触发生物验证
  useEffect(() => {
    if (bioAvailable && !isGranted) {
      authenticate().then((ok) => {
        if (!ok) toast.error('身份验证失败，保险库已锁定');
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioAvailable]);

  // 获取项目列表（统一 API）
  const { data: projectData = [] } = useApiQuery(
    ['/api/projects'],
    async () => {
      const res = await fetch('/api/projects');
      const data = await res.json();
      return (data.projects || data.items || data) as unknown[];
    }
  );

  const projects = Array.isArray(projectData) ? projectData : [];

  // 加载智库数据
  const loadVaultData = async () => {
    const res = await fetch('/api/vault');
    const data = await res.json();
    if (data.success) setFiles(data.items || []);
  };

  useEffect(() => { loadVaultData(); }, []);

  // 过滤文件
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const matchesSearch = !searchQuery || file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject = selectedProject === 'ALL' || file.projectId === selectedProject;
      const matchesType = filterType === 'ALL' || file.type?.startsWith(filterType.toLowerCase());
      return matchesSearch && matchesProject && matchesType;
    });
  }, [files, searchQuery, selectedProject, filterType]);

  // 获取文件图标
  const getFileIcon = (file: VaultFile) => {
    const type = file.type?.toLowerCase() || '';
    if (type.startsWith('image')) return { icon: Image, color: 'text-green-400', bg: 'bg-green-500/20' };
    if (type.startsWith('video')) return { icon: Video, color: 'text-purple-400', bg: 'bg-purple-500/20' };
    if (type.startsWith('audio')) return { icon: Music, color: 'text-amber-400', bg: 'bg-amber-500/20' };
    return { icon: File, color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // 格式化时间
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const handleAction = (type: 'UPLOAD' | 'SCAN') => {
    setPendingType(type);
    setShowProjectSelector(true);
  };

  const onProjectSelected = (id: string) => {
    setShowProjectSelector(false);
    if (pendingType === 'SCAN') {
      setLocation(`/scanner?projectId=${id}`);
    } else {
      toast.success("正在通过 Z3 协议同步本地资产...");
    }
  };

  // 处理文件预览/下载
  const handleFileAction = (file: VaultFile) => {
    if (file.url) {
      window.open(file.url, '_blank');
    } else {
      toast.info("文件预览功能开发中...");
    }
  };

  // 生物验证门控：未授权时显示锁屏，不渲染任何文件内容
  if (bioAvailable && !isGranted) {
    const isDenied = bioStatus === 'denied';
    return (
      <SafeLayout headerTitle="成果智库" showBack={true}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-8 text-center">
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            isDenied ? "bg-red-500/20" : "bg-primary/10"
          )}>
            {isDenied
              ? <ShieldAlert className="w-10 h-10 text-red-400" />
              : <Fingerprint className={cn("w-10 h-10", bioStatus === 'authenticating' ? "text-primary animate-pulse" : "text-gray-400")} />
            }
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tighter">
              {isDenied ? '身份验证失败' : '保险库已加密'}
            </h2>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              {isDenied
                ? '请重试指纹 / 面容 ID 验证以解锁保险库'
                : '请通过生物验证以访问本机密资产库'
              }
            </p>
          </div>
          <button
            onClick={() => authenticate()}
            disabled={bioStatus === 'authenticating'}
            className={cn(
              "px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-tighter transition-all",
              bioStatus === 'authenticating'
                ? "bg-white/5 text-gray-500 cursor-not-allowed"
                : "bg-primary text-white active:scale-95"
            )}
          >
            {bioStatus === 'authenticating' ? '验证中...' : isDenied ? '重新验证' : '解锁'}
          </button>
        </div>
      </SafeLayout>
    );
  }

  return (
    <SafeLayout headerTitle="成果智库" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 生物验证通过标记 */}
        {isGranted && bioAvailable && (
          <div className="flex items-center gap-1.5 px-1">
            <ShieldCheck className="w-3 h-3 text-green-400" />
            <span className="text-[9px] text-green-400 font-black uppercase tracking-widest">已验证</span>
          </div>
        )}

        {/* 搜索栏 */}
        <div className="relative px-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="检索智库文件..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* 筛选器 */}
        <div className="flex gap-2 px-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setFilterType('ALL')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
              filterType === 'ALL' ? "bg-primary text-white" : "bg-white/5 text-gray-500"
            )}
          >
            全部
          </button>
          <button
            onClick={() => setFilterType('DOCUMENT')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
              filterType === 'DOCUMENT' ? "bg-primary text-white" : "bg-white/5 text-gray-500"
            )}
          >
            文档
          </button>
          <button
            onClick={() => setFilterType('IMAGE')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
              filterType === 'IMAGE' ? "bg-primary text-white" : "bg-white/5 text-gray-500"
            )}
          >
            图片
          </button>
          <button
            onClick={() => setFilterType('VIDEO')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
              filterType === 'VIDEO' ? "bg-primary text-white" : "bg-white/5 text-gray-500"
            )}
          >
            视频
          </button>
          <button
            onClick={() => setSelectedProject(selectedProject === 'ALL' ? ((projects as Array<{id: string}>)?.[0]?.id || '') : 'ALL')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-1",
              selectedProject !== 'ALL' ? "bg-amber-500 text-white" : "bg-white/5 text-gray-500"
            )}
          >
            <FolderOpen className="w-3 h-3" />
            {selectedProject === 'ALL' ? '全项目' : '已筛选'}
          </button>
        </div>

        {/* 多模态入口 */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => handleAction('UPLOAD')} className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/5 border border-white/5 active:bg-blue-500/20">
            <FileUp className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] font-black text-gray-400 uppercase">导入</span>
          </button>
          <button onClick={() => handleAction('SCAN')} className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/5 border border-white/5 active:bg-purple-500/20">
            <Camera className="w-5 h-5 text-purple-400" />
            <span className="text-[10px] font-black text-gray-400 uppercase">扫瞄</span>
          </button>
          <button onClick={() => toast.info("全球猎杀引擎正在监控全网动态")} className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/5 border border-white/5 active:bg-green-500/20">
            <Globe className="w-5 h-5 text-green-400" />
            <span className="text-[10px] font-black text-gray-400 uppercase">全网</span>
          </button>
        </div>

        {/* 文件统计 */}
        <div className="flex justify-between items-center px-1 text-xs text-gray-500">
          <span>共 {filteredFiles.length} 个文件</span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-primary flex items-center gap-1">
              清除搜索 <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 文件列表 */}
        <div className="space-y-3">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500">
                {searchQuery ? '未找到匹配的文件' : '智库为空，点击上方按钮添加文件'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const { icon: FileIcon, color, bg } = getFileIcon(file);
              return (
                <div
                  key={file.id}
                  onClick={() => handleFileAction(file)}
                  className="p-4 rounded-[2rem] bg-white/5 border border-white/5 flex items-center justify-between active:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0", bg)}>
                      <FileIcon className={cn("w-5 h-5", color)} />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-medium text-white truncate">{file.name}</h3>
                      <p className="text-[9px] text-gray-500 mt-0.5 uppercase tracking-tighter italic">
                        {formatFileSize(file.size)} · {file.expertId || 'SYSTEM'} · {formatDate(file.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-600 mr-2" />
                </div>
              );
            })
          )}
        </div>

        {/* 项目归属选择器 */}
        {showProjectSelector && (
          <div className="fixed inset-0 z-[2000] flex items-end">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowProjectSelector(false)} />
            <div className="relative w-full bg-[#0f172a] rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300 border-t border-white/10 shadow-2xl">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-black text-white mb-6 uppercase tracking-tighter text-center">选择关联项目节点</h3>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto no-scrollbar">
                {projects.map((p: any) => (
                  <button key={p.id} onClick={() => onProjectSelected(p.id)} className="w-full p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between active:bg-primary/20 transition-all">
                    <span className="text-sm font-bold text-gray-200">{p.name || p.title}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                ))}
                {projects.length === 0 && <p className="text-center text-xs text-gray-600 py-4 italic">暂无活跃项目，请先建立项目。</p>}
              </div>
            </div>
          </div>
        )}

      </div>
    </SafeLayout>
  );
}
