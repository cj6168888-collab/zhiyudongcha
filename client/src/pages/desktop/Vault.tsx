/**
 * DesktopVault - 桌面端数字金库页面
 *
 * 功能：
 * - 文件管理
 * - 分类展示
 * - 搜索和筛选
 * - 安全存储
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database, Search, Upload, Camera, FileUp, Download, Trash2,
  MoreVertical, File, Folder, Image, Video, Music, FileText,
  Grid, List, Filter, Shield, Clock, HardDrive, Lock, Key,
  Eye, EyeOff, Star, FolderOpen, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// 文件类型
interface VaultFile {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'audio' | 'other';
  size: number;
  createdAt: Date;
  category: string;
  starred: boolean;
  encrypted: boolean;
}

// 模拟数据
const mockFiles: VaultFile[] = [
  { id: '1', name: '商业合同模板.docx', type: 'document', size: 256000, createdAt: new Date(Date.now() - 86400000), category: '合同', starred: true, encrypted: true },
  { id: '2', name: '会议纪要2024.pdf', type: 'document', size: 1024000, createdAt: new Date(Date.now() - 86400000 * 2), category: '会议', starred: false, encrypted: true },
  { id: '3', name: '产品原型图.png', type: 'image', size: 2048000, createdAt: new Date(Date.now() - 86400000 * 3), category: '设计', starred: true, encrypted: false },
  { id: '4', name: '商务洽谈视频.mp4', type: 'video', size: 51200000, createdAt: new Date(Date.now() - 86400000 * 5), category: '视频', starred: false, encrypted: true },
  { id: '5', name: '项目汇报音频.m4a', type: 'audio', size: 8192000, createdAt: new Date(Date.now() - 86400000 * 7), category: '音频', starred: false, encrypted: false },
  { id: '6', name: '财务分析报告.xlsx', type: 'document', size: 512000, createdAt: new Date(Date.now() - 86400000 * 10), category: '财务', starred: true, encrypted: true },
  { id: '7', name: '名片扫描件.jpg', type: 'image', size: 1536000, createdAt: new Date(Date.now() - 86400000 * 14), category: '人脉', starred: false, encrypted: false },
  { id: '8', name: '战略规划方案.pdf', type: 'document', size: 3072000, createdAt: new Date(Date.now() - 86400000 * 20), category: '战略', starred: true, encrypted: true },
];

const typeConfig: Record<string, { icon: typeof File; color: string; bg: string; label: string }> = {
  document: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/20', label: '文档' },
  image: { icon: Image, color: 'text-green-400', bg: 'bg-green-500/20', label: '图片' },
  video: { icon: Video, color: 'text-purple-400', bg: 'bg-purple-500/20', label: '视频' },
  audio: { icon: Music, color: 'text-amber-400', bg: 'bg-amber-500/20', label: '音频' },
  other: { icon: File, color: 'text-gray-400', bg: 'bg-gray-500/20', label: '其他' },
};

const categoryConfig: Record<string, { color: string; bg: string }> = {
  '合同': { color: 'text-red-400', bg: 'bg-red-500/20' },
  '会议': { color: 'text-blue-400', bg: 'bg-blue-500/20' },
  '设计': { color: 'text-pink-400', bg: 'bg-pink-500/20' },
  '视频': { color: 'text-purple-400', bg: 'bg-purple-500/20' },
  '音频': { color: 'text-amber-400', bg: 'bg-amber-500/20' },
  '财务': { color: 'text-green-400', bg: 'bg-green-500/20' },
  '人脉': { color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  '战略': { color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
};

export default function DesktopVault() {
  const [files] = useState<VaultFile[]>(mockFiles);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showEncrypted, setShowEncrypted] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // 过滤文件
  const filteredFiles = files.filter(f => {
    const matchesSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || f.type === typeFilter;
    const matchesEncrypted = !showEncrypted || !f.encrypted;
    return matchesSearch && matchesType && matchesEncrypted;
  });

  // 统计
  const stats = {
    total: files.length,
    totalSize: files.reduce((acc, f) => acc + f.size, 0),
    encrypted: files.filter(f => f.encrypted).length,
    starred: files.filter(f => f.starred).length,
    byType: {
      document: files.filter(f => f.type === 'document').length,
      image: files.filter(f => f.type === 'image').length,
      video: files.filter(f => f.type === 'video').length,
      audio: files.filter(f => f.type === 'audio').length,
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-[#030712]">
      {/* 顶部栏 */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 h-14 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-amber-400" />
          <h1 className="text-base font-bold text-white">数字金库</h1>
          <Badge variant="outline" className="text-xs gap-1">
            <Lock className="w-3 h-3" />
            AES-256加密
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <FileUp className="w-4 h-4" />
            上传文件
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Camera className="w-4 h-4" />
            扫描文档
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <div className="w-64 border-r border-white/10 bg-black/20 p-4">
          {/* 存储概览 */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">存储空间</span>
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-white">{formatSize(stats.totalSize)}</p>
              <Progress value={65} className="h-2 mt-2" />
              <p className="text-[10px] text-gray-500 mt-1">已用 65% · 可用 2.1 GB</p>
            </CardContent>
          </Card>

          {/* 统计 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-white">{stats.total}</p>
              <p className="text-[10px] text-gray-500">文件总数</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-green-400">{stats.encrypted}</p>
              <p className="text-[10px] text-gray-500">已加密</p>
            </div>
          </div>

          {/* 类型筛选 */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">文件类型</h3>
            <div className="space-y-1">
              <button
                onClick={() => setTypeFilter('ALL')}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between",
                  typeFilter === 'ALL'
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "hover:bg-white/5 text-gray-400"
                )}
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  全部
                </span>
                <Badge variant="outline" className="text-[10px]">{stats.total}</Badge>
              </button>
              {Object.entries(typeConfig).filter(([key]) => key !== 'other').map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between",
                    typeFilter === key
                      ? `${config.bg} ${config.color}`
                      : "hover:bg-white/5 text-gray-400"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <config.icon className="w-4 h-4" />
                    {config.label}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{stats.byType[key as keyof typeof stats.byType]}</Badge>
                </button>
              ))}
            </div>
          </div>

          {/* 安全选项 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">安全选项</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEncrypted}
                  onChange={(e) => setShowEncrypted(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600"
                />
                隐藏加密文件
              </label>
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
                placeholder="搜索文件..."
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

          {/* 文件列表 */}
          <ScrollArea className="flex-1 p-4">
            {filteredFiles.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Database className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">暂无文件</p>
                  <Button variant="outline" className="mt-4">
                    <Upload className="w-4 h-4 mr-2" />
                    上传第一个文件
                  </Button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-4 gap-4">
                {filteredFiles.map(file => {
                  const type = typeConfig[file.type];
                  const category = categoryConfig[file.category] || { color: 'text-gray-400', bg: 'bg-gray-500/20' };
                  const TypeIcon = type.icon;

                  return (
                    <Card
                      key={file.id}
                      className="bg-white/5 border-white/10 hover:border-white/20 transition-all cursor-pointer group"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", type.bg)}>
                            <TypeIcon className={cn("w-6 h-6", type.color)} />
                          </div>
                          <div className="flex items-center gap-1">
                            {file.starred && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                            {file.encrypted && <Lock className="w-4 h-4 text-green-400" />}
                          </div>
                        </div>

                        <h3 className="text-sm font-medium text-white truncate mb-2">{file.name}</h3>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <Badge className={cn("text-[10px]", category.bg, category.color)}>
                            {file.category}
                          </Badge>
                          <span>{formatSize(file.size)}</span>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                          <span className="text-[10px] text-gray-600">{formatDate(file.createdAt)}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1 hover:bg-white/10 rounded">
                              <Download className="w-4 h-4 text-gray-400" />
                            </button>
                            <button className="p-1 hover:bg-white/10 rounded">
                              <Trash2 className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFiles.map(file => {
                  const type = typeConfig[file.type];
                  const category = categoryConfig[file.category] || { color: 'text-gray-400', bg: 'bg-gray-500/20' };
                  const TypeIcon = type.icon;

                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group"
                    >
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", type.bg)}>
                        <TypeIcon className={cn("w-5 h-5", type.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white truncate">{file.name}</h3>
                          {file.starred && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />}
                          {file.encrypted && <Lock className="w-4 h-4 text-green-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500">{type.label} · {file.category}</p>
                      </div>

                      <span className="text-sm text-gray-400">{formatSize(file.size)}</span>
                      <span className="text-sm text-gray-500 w-20 text-right">{formatDate(file.createdAt)}</span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-white/10 rounded-lg">
                          <Download className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-2 hover:bg-white/10 rounded-lg">
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
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
