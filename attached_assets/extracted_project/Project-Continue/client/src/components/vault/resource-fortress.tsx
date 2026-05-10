import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Folder, File, FileText, Image, Video, Music,
  Search, Filter, Download, Lock, Unlock,
  HardDrive, Cloud, Trash2, Eye, MoreHorizontal,
  FolderOpen, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ResourceType = 'FOLDER' | 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
export type SecurityLevel = 'PUBLIC' | 'PRIVATE' | 'ENCRYPTED';

export interface VaultResource {
  id: string;
  name: string;
  type: ResourceType;
  size: number;
  securityLevel: SecurityLevel;
  tags: string[];
  aiSummary?: string;
  createdAt: Date;
  downloadProgress?: number;
}

interface ResourceFortressProps {
  resources: VaultResource[];
  onDownload?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSecurityChange?: (id: string, level: SecurityLevel) => void;
}

const TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  FOLDER: <Folder className="w-5 h-5 text-amber-500" />,
  DOCUMENT: <FileText className="w-5 h-5 text-blue-500" />,
  IMAGE: <Image className="w-5 h-5 text-green-500" />,
  VIDEO: <Video className="w-5 h-5 text-purple-500" />,
  AUDIO: <Music className="w-5 h-5 text-pink-500" />,
  OTHER: <File className="w-5 h-5 text-gray-500" />,
};

const SECURITY_COLORS: Record<SecurityLevel, string> = {
  PUBLIC: 'bg-green-500/20 text-green-400',
  PRIVATE: 'bg-amber-500/20 text-amber-400',
  ENCRYPTED: 'bg-red-500/20 text-red-400',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function ResourceFortress({ 
  resources, 
  onDownload, 
  onDelete,
  onSecurityChange 
}: ResourceFortressProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ResourceType | 'ALL'>('ALL');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredResources = useMemo(() => {
    return resources.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.aiSummary?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'ALL' || r.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [resources, searchQuery, filterType]);

  const stats = useMemo(() => {
    const totalSize = resources.reduce((acc, r) => acc + r.size, 0);
    const typeCount = resources.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalSize, typeCount, total: resources.length };
  }, [resources]);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="border-primary/20" data-testid="resource-fortress">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            私有资源堡垒
          </div>
          <div className="flex items-center gap-2 text-sm font-normal">
            <Cloud className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{formatSize(stats.totalSize)}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="语义搜索..."
              className="pl-9 bg-secondary/30"
              data-testid="vault-search"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilterType('ALL')}>
                全部 ({stats.total})
              </DropdownMenuItem>
              {(['FOLDER', 'DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO'] as ResourceType[]).map(type => (
                <DropdownMenuItem key={type} onClick={() => setFilterType(type)}>
                  <span className="mr-2">{TYPE_ICONS[type]}</span>
                  {type} ({stats.typeCount[type] || 0})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap gap-1">
          {(['FOLDER', 'DOCUMENT', 'IMAGE', 'VIDEO', 'AUDIO'] as ResourceType[]).map(type => (
            <Badge
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setFilterType(filterType === type ? 'ALL' : type)}
            >
              {TYPE_ICONS[type]}
              <span className="ml-1">{stats.typeCount[type] || 0}</span>
            </Badge>
          ))}
        </div>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          <AnimatePresence>
            {filteredResources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? '未找到匹配资源' : '暂无资源'}
              </div>
            ) : (
              filteredResources.map(resource => (
                <motion.div
                  key={resource.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer group",
                    selectedItems.has(resource.id) && "bg-primary/10 border border-primary/30"
                  )}
                  onClick={() => resource.type === 'FOLDER' ? toggleFolder(resource.id) : toggleSelection(resource.id)}
                  data-testid={`vault-item-${resource.id}`}
                >
                  <div className="shrink-0">
                    {resource.type === 'FOLDER' ? (
                      expandedFolders.has(resource.id) ? 
                        <FolderOpen className="w-5 h-5 text-amber-500" /> : 
                        <Folder className="w-5 h-5 text-amber-500" />
                    ) : TYPE_ICONS[resource.type]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{resource.name}</span>
                      {resource.securityLevel === 'ENCRYPTED' && (
                        <Lock className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                    {resource.aiSummary && (
                      <p className="text-xs text-muted-foreground truncate">
                        {resource.aiSummary}
                      </p>
                    )}
                    {resource.downloadProgress !== undefined && resource.downloadProgress < 100 && (
                      <Progress value={resource.downloadProgress} className="h-1 mt-1" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn("text-[10px]", SECURITY_COLORS[resource.securityLevel])}>
                      {resource.securityLevel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatSize(resource.size)}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); onDownload?.(resource.id); }}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {}}>
                            <Eye className="w-3 h-3 mr-2" />
                            预览
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSecurityChange?.(resource.id, 'ENCRYPTED')}>
                            <Lock className="w-3 h-3 mr-2" />
                            加密
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSecurityChange?.(resource.id, 'PUBLIC')}>
                            <Unlock className="w-3 h-3 mr-2" />
                            公开
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => onDelete?.(resource.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {selectedItems.size > 0 && (
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedItems.size} 项
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedItems(new Set())}>
                取消选择
              </Button>
              <Button size="sm" onClick={() => selectedItems.forEach(id => onDownload?.(id))}>
                <Download className="w-3 h-3 mr-1" />
                批量下载
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
