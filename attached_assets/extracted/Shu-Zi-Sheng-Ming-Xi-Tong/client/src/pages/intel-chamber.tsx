import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  FileSearch, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Archive, 
  Trash2, 
  RefreshCw, 
  ArrowLeft,
  Plus,
  Eye,
  Search,
  Target
} from "lucide-react";
import { Link } from "wouter";
type IntelStatus = 'PENDING' | 'APPROVED' | 'CONTINUE_SEARCH' | 'ARCHIVED' | 'SHREDDED';

interface IntelItem {
  id: string;
  title: string;
  source: string;
  category: string;
  content: string;
  status: IntelStatus;
  priority: string;
  targetPerson: string | null;
  discoveredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const statusConfig: Record<IntelStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: '待审', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
  APPROVED: { label: '立项', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="w-3 h-3" /> },
  CONTINUE_SEARCH: { label: '续搜', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <RefreshCw className="w-3 h-3" /> },
  ARCHIVED: { label: '归档', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <Archive className="w-3 h-3" /> },
  SHREDDED: { label: '已粉碎', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <Trash2 className="w-3 h-3" /> },
};

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-500 text-black',
  LOW: 'bg-gray-500 text-white',
};

export default function IntelChamber() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const queryClient = useQueryClient();
  const [selectedIntel, setSelectedIntel] = useState<IntelItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newIntel, setNewIntel] = useState({ title: '', source: '', category: 'GENERAL', content: '', priority: 'MEDIUM', targetPerson: '' });

  const { data: intelItems = [], isLoading } = useQuery<IntelItem[]>({
    queryKey: ['/api/intel'],
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newIntel) => {
      return apiRequest('POST', '/api/intel', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/intel'] });
      setShowNewDialog(false);
      setNewIntel({ title: '', source: '', category: 'GENERAL', content: '', priority: 'MEDIUM', targetPerson: '' });
      toast({ title: "情报已录入", description: "新情报已添加到待审队列" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IntelStatus }) => {
      return apiRequest('PATCH', `/api/intel/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/intel'] });
      setSelectedIntel(null);
      toast({ title: "情报状态已更新", className: "border-primary" });
    },
  });

  const filteredItems = intelItems.filter((item: IntelItem) => {
    const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const pendingCount = intelItems.filter((i: IntelItem) => i.status === 'PENDING').length;

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-destructive/50" data-testid="access-denied-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              ZONE_RED: 访问被拒绝
            </CardTitle>
            <CardDescription>情报决策舱仅对 MASTER 角色开放</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" data-testid="intel-chamber-page">
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
                <FileSearch className="w-6 h-6 text-primary" />
                情报决策舱
              </h1>
              <p className="text-sm text-muted-foreground">Intel Decision Chamber</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" data-testid="badge-pending-count">
                {pendingCount} 待审
              </Badge>
            )}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-intel">
                  <Plus className="w-4 h-4 mr-2" />
                  录入情报
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>录入新情报</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
<Input 
  placeholder="情报标题" 
  value={newIntel.title} 
  onChange={(e) => setNewIntel(prev => ({ ...prev, title: e.target.value }))}
  data-testid="input-intel-title" 
  aria-label="情报标题"
/> 
                  <Input 
                    placeholder="情报来源" 
                    value={newIntel.source} 
                    onChange={(e) => setNewIntel(prev => ({ ...prev, source: e.target.value }))}
                    data-testid="input-intel-source"
                  />
                  <div className="flex gap-2">
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newIntel.category}
                      onChange={(e) => setNewIntel(prev => ({ ...prev, category: e.target.value }))}
                      data-testid="select-intel-category"
                    >
                      <option value="GENERAL">常规</option>
                      <option value="MARKET">市场</option>
                      <option value="COMPETITOR">竞对</option>
                      <option value="PERSON">人物</option>
                      <option value="TECHNOLOGY">技术</option>
                    </select>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newIntel.priority}
                      onChange={(e) => setNewIntel(prev => ({ ...prev, priority: e.target.value }))}
                      data-testid="select-intel-priority"
                    >
                      <option value="LOW">低</option>
                      <option value="MEDIUM">中</option>
                      <option value="HIGH">高</option>
                      <option value="CRITICAL">紧急</option>
                    </select>
                  </div>
                  <Input 
                    placeholder="关联人物（可选）" 
                    value={newIntel.targetPerson} 
                    onChange={(e) => setNewIntel(prev => ({ ...prev, targetPerson: e.target.value }))}
                    data-testid="input-intel-target"
                  />
                  <Textarea 
                    placeholder="情报内容..." 
                    value={newIntel.content} 
                    onChange={(e) => setNewIntel(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    data-testid="textarea-intel-content"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">取消</Button>
                  </DialogClose>
                  <Button 
                    onClick={() => createMutation.mutate(newIntel)} 
                    disabled={!newIntel.title || createMutation.isPending}
                    data-testid="button-submit-intel"
                  >
                    提交
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="搜索情报..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-intel"
            />
          </div>
          <Tabs value={filterStatus} onValueChange={setFilterStatus}>
            <TabsList>
              <TabsTrigger value="ALL" data-testid="tab-all">全部</TabsTrigger>
              <TabsTrigger value="PENDING" data-testid="tab-pending">待审</TabsTrigger>
              <TabsTrigger value="APPROVED" data-testid="tab-approved">立项</TabsTrigger>
              <TabsTrigger value="CONTINUE_SEARCH" data-testid="tab-continue">续搜</TabsTrigger>
              <TabsTrigger value="ARCHIVED" data-testid="tab-archived">归档</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">情报列表</CardTitle>
                <CardDescription>{filteredItems.length} 条情报</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground">加载中...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <FileSearch className="w-8 h-8 mb-2 opacity-50" />
                    <p>暂无情报记录</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {filteredItems.map((item: IntelItem) => (
                        <div 
                          key={item.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${selectedIntel?.id === item.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                          onClick={() => setSelectedIntel(item)}
                          data-testid={`intel-card-${item.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={priorityColors[item.priority] || priorityColors.MEDIUM} data-testid={`badge-priority-${item.id}`}>
                                  {item.priority === 'CRITICAL' ? '紧急' : item.priority === 'HIGH' ? '高' : item.priority === 'MEDIUM' ? '中' : '低'}
                                </Badge>
                                <span className="font-medium truncate" data-testid={`text-intel-title-${item.id}`}>{item.title}</span>
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-4">
                                <span>{item.source}</span>
                                <span>{item.category}</span>
                                {item.targetPerson && (
                                  <span className="flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    {item.targetPerson}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className={statusConfig[item.status].color} data-testid={`badge-status-${item.id}`}>
                              {statusConfig[item.status].icon}
                              <span className="ml-1">{statusConfig[item.status].label}</span>
                            </Badge>
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
                  <Eye className="w-4 h-4" />
                  情报详情
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedIntel ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2" data-testid="text-detail-title">{selectedIntel.title}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={priorityColors[selectedIntel.priority]}>
                          {selectedIntel.priority}
                        </Badge>
                        <Badge variant="outline" className={statusConfig[selectedIntel.status].color}>
                          {statusConfig[selectedIntel.status].label}
                        </Badge>
                        <Badge variant="secondary">{selectedIntel.category}</Badge>
                      </div>
                    </div>
                    <div className="text-sm space-y-2">
                      <div><span className="text-muted-foreground">来源：</span>{selectedIntel.source}</div>
                      {selectedIntel.targetPerson && (
                        <div><span className="text-muted-foreground">关联人物：</span>{selectedIntel.targetPerson}</div>
                      )}
                      <div><span className="text-muted-foreground">发现时间：</span>{new Date(selectedIntel.createdAt).toLocaleString('zh-CN')}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-sm" data-testid="text-detail-content">
                      {selectedIntel.content || '无详细内容'}
                    </div>
                    
                    {selectedIntel.status === 'PENDING' && (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm font-medium text-muted-foreground">决策操作</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => updateMutation.mutate({ id: selectedIntel.id, status: 'APPROVED' })}
                            disabled={updateMutation.isPending}
                            data-testid="button-approve"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            立项
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                            onClick={() => updateMutation.mutate({ id: selectedIntel.id, status: 'CONTINUE_SEARCH' })}
                            disabled={updateMutation.isPending}
                            data-testid="button-continue-search"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            续搜
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateMutation.mutate({ id: selectedIntel.id, status: 'ARCHIVED' })}
                            disabled={updateMutation.isPending}
                            data-testid="button-archive"
                          >
                            <Archive className="w-3 h-3 mr-1" />
                            归档
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => updateMutation.mutate({ id: selectedIntel.id, status: 'SHREDDED' })}
                            disabled={updateMutation.isPending}
                            data-testid="button-shred"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            粉碎
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Eye className="w-8 h-8 mb-2 opacity-50" />
                    <p>选择情报查看详情</p>
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
