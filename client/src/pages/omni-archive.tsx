import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Search, Users, FileText, MessageSquare, GitBranch, Network, 
  AlertTriangle, TrendingUp, Star, Shield, Building2, Phone, Mail,
  Calendar, Clock, RefreshCw, Zap, Target, Eye
} from "lucide-react";
import { useState } from "react";

interface UnifiedContact {
  id: string;
  name: string;
  aliases?: string[] | null;
  phone?: string[] | null;
  email?: string[] | null;
  wechatId?: string | null;
  dingdingId?: string | null;
  sources?: unknown;
  role?: string | null;
  organization?: string | null;
  department?: string | null;
  importance?: number | null;
  trustScore?: number | null;
  lastInteraction?: Date | null;
  interactionCount?: number | null;
  averageResponseTime?: number | null;
  initiatedByMe?: number | null;
  initiatedByThem?: number | null;
  tags?: string[] | null;
  notes?: string | null;
  privacyZone?: string | null;
}

interface FileKnowledge {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileHash?: string | null;
  fileSizeKb?: number | null;
  deviceId: string;
  extractedText?: string | null;
  summary?: string | null;
  keyPoints?: string[] | null;
  entities?: unknown;
  contractParties?: string[] | null;
  contractValue?: string | null;
  contractTerms?: unknown;
  expiryDate?: Date | null;
  embeddingVector?: string | null;
  relatedContacts?: string[] | null;
  relatedChats?: string[] | null;
  category?: string | null;
  tags?: string[] | null;
  privacyZone?: string | null;
  processingStatus?: string | null;
  lastProcessedAt?: Date | null;
}

interface ChatExtract {
  id: string;
  platform: string;
  deviceId: string;
  chatType: string;
  chatName?: string | null;
  contactId?: string | null;
  participants?: string[] | null;
  coreRequests?: unknown;
  commitments?: unknown;
  timelineEvents?: unknown;
  emotionPoints?: unknown;
  opportunities?: unknown;
  warnings?: unknown;
  totalMessages?: number | null;
  extractedMessages?: number | null;
  dateRange?: unknown;
  embeddingVector?: string | null;
  privacyZone?: string | null;
  localOnly?: boolean | null;
  lastSyncAt?: Date | null;
}

interface RelationLink {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  confidence?: number | null;
  description?: string | null;
  evidence?: string | null;
  isConflict?: boolean | null;
  conflictSeverity?: string | null;
  resolved?: boolean | null;
  detectedBy?: string | null;
  reviewedBy?: string | null;
}

interface SocialGraphNode {
  id: string;
  contactId?: string | null;
  nodeType: string;
  label: string;
  influence?: number | null;
  centrality?: number | null;
  cluster?: string | null;
  riskLevel?: string | null;
  riskFactors?: string[] | null;
  posX?: number | null;
  posY?: number | null;
}

interface SocialGraphEdge {
  id: string;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  relationType: string;
  strength?: number | null;
  interactionCount?: number | null;
  lastInteraction?: Date | null;
  sentiment?: string | null;
}

interface SearchResult {
  contacts: UnifiedContact[];
  files: FileKnowledge[];
  chats: ChatExtract[];
  total: number;
}

interface GraphData {
  nodes: SocialGraphNode[];
  edges: SocialGraphEdge[];
}

export default function OmniArchive() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useZ1Store();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("search");
  const [selectedContact, setSelectedContact] = useState<UnifiedContact | null>(null);

  const { data: contacts = [] } = useQuery<UnifiedContact[]>({
    queryKey: ["omni-archive", "contacts"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/contacts");
      return res.json();
    },
  });

  const { data: files = [] } = useQuery<FileKnowledge[]>({
    queryKey: ["omni-archive", "files"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/files");
      return res.json();
    },
  });

  const { data: conflicts = [] } = useQuery<RelationLink[]>({
    queryKey: ["omni-archive", "conflicts"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/conflicts");
      return res.json();
    },
  });

  const { data: pendingCommitments = [] } = useQuery({
    queryKey: ["omni-archive", "commitments"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/commitments/pending");
      return res.json();
    },
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["omni-archive", "opportunities"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/opportunities");
      return res.json();
    },
  });

  const { data: highRiskNodes = [] } = useQuery<SocialGraphNode[]>({
    queryKey: ["omni-archive", "high-risk"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/graph/high-risk");
      return res.json();
    },
  });

  const { data: highInfluence = [] } = useQuery<SocialGraphNode[]>({
    queryKey: ["omni-archive", "high-influence"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/graph/high-influence?limit=10");
      return res.json();
    },
  });

  const { data: graphData } = useQuery<GraphData>({
    queryKey: ["omni-archive", "graph"],
    queryFn: async () => {
      const res = await fetch("/api/omni-archive/graph");
      return res.json();
    },
  });

  const { data: searchResults, refetch: doSearch } = useQuery<SearchResult>({
    queryKey: ["omni-archive", "search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/omni-archive/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: false,
  });

  const buildGraphMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/omni-archive/graph/build", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["omni-archive", "graph"] });
      queryClient.invalidateQueries({ queryKey: ["omni-archive", "high-risk"] });
      queryClient.invalidateQueries({ queryKey: ["omni-archive", "high-influence"] });
      toast({ title: "图谱构建完成", description: "社交关系图谱已更新" });
    },
  });

  const handleSearch = () => {
    if (searchQuery.length > 1) {
      doSearch();
    }
  };

  const getImportanceColor = (importance: number) => {
    if (importance >= 80) return "text-yellow-500";
    if (importance >= 60) return "text-blue-500";
    if (importance >= 40) return "text-green-500";
    return "text-muted-foreground";
  };

  const getTrustColor = (trust: number) => {
    if (trust >= 80) return "bg-green-500/20 text-green-400";
    if (trust >= 50) return "bg-blue-500/20 text-blue-400";
    if (trust >= 30) return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "HIGH": return "bg-red-500/20 text-red-400";
      case "MEDIUM": return "bg-yellow-500/20 text-yellow-400";
      default: return "bg-green-500/20 text-green-400";
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-omni-archive">
      <GlobalWakeHeader />
      
      <div className="container mx-auto px-4 pt-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="w-6 h-6 text-primary" />
              全域归档 Omni-Archive
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              跨平台数据聚合 · 智能关联分析 · 人际图谱
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => buildGraphMutation.mutate()}
              disabled={buildGraphMutation.isPending}
              data-testid="button-build-graph"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${buildGraphMutation.isPending ? 'animate-spin' : ''}`} />
              构建图谱
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contacts.length}</p>
                  <p className="text-xs text-muted-foreground">统一联系人</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{files.length}</p>
                  <p className="text-xs text-muted-foreground">知识文件</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conflicts.length}</p>
                  <p className="text-xs text-muted-foreground">待处理冲突</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{opportunities.length}</p>
                  <p className="text-xs text-muted-foreground">商机线索</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-card/50">
            <TabsTrigger value="search" data-testid="tab-search">
              <Search className="w-4 h-4 mr-2" />
              全域搜索
            </TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">
              <Users className="w-4 h-4 mr-2" />
              通讯录
            </TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">
              <FileText className="w-4 h-4 mr-2" />
              文件库
            </TabsTrigger>
            <TabsTrigger value="insights" data-testid="tab-insights">
              <Zap className="w-4 h-4 mr-2" />
              智能洞察
            </TabsTrigger>
            <TabsTrigger value="graph" data-testid="tab-graph">
              <GitBranch className="w-4 h-4 mr-2" />
              关系图谱
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <Card className="bg-card/50">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Input
                    placeholder="搜索联系人、文件、聊天记录..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                    data-testid="input-global-search"
                  />
                  <Button onClick={handleSearch} data-testid="button-search">
                    <Search className="w-4 h-4 mr-2" />
                    搜索
                  </Button>
                </div>

                {searchResults && (
                  <div className="mt-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      找到 {searchResults.total} 条结果
                    </p>

                    {searchResults.contacts.length > 0 && (
                      <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <Users className="w-4 h-4" /> 联系人 ({searchResults.contacts.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {searchResults.contacts.map((contact) => (
                            <Card key={contact.id} className="bg-card/30 p-3" data-testid={`card-contact-${contact.id}`}>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-sm font-medium">{contact.name.charAt(0)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{contact.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {contact.organization || '未知组织'}
                                  </p>
                                </div>
                                <Star className={`w-4 h-4 ${getImportanceColor(contact.importance || 50)}`} />
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.files.length > 0 && (
                      <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> 文件 ({searchResults.files.length})
                        </h3>
                        <div className="space-y-2">
                          {searchResults.files.map((file) => (
                            <Card key={file.id} className="bg-card/30 p-3" data-testid={`card-file-${file.id}`}>
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{file.fileName}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {file.summary || file.category || '未分类'}
                                  </p>
                                </div>
                                <Badge variant="outline">{file.fileType}</Badge>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.chats.length > 0 && (
                      <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" /> 聊天 ({searchResults.chats.length})
                        </h3>
                        <div className="space-y-2">
                          {searchResults.chats.map((chat) => (
                            <Card key={chat.id} className="bg-card/30 p-3" data-testid={`card-chat-${chat.id}`}>
                              <div className="flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-green-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{chat.chatName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {chat.platform} · {chat.extractedMessages || 0} 条精华消息
                                  </p>
                                </div>
                                <Badge variant="outline">{chat.chatType}</Badge>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-2 gap-4">
                {contacts.map((contact) => (
                  <Card 
                    key={contact.id} 
                    className="bg-card/50 hover:bg-card/70 transition-colors cursor-pointer"
                    onClick={() => setSelectedContact(contact)}
                    data-testid={`card-contact-detail-${contact.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold">{contact.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold truncate">{contact.name}</h3>
                            <Badge className={getTrustColor(contact.trustScore || 50)} variant="outline">
                              信任 {contact.trustScore || 50}
                            </Badge>
                          </div>
                          
                          {contact.organization && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" />
                              {contact.organization}
                              {contact.department && ` · ${contact.department}`}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1 mt-2">
                            {contact.phone?.slice(0, 1).map((p, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <Phone className="w-3 h-3 mr-1" />{p}
                              </Badge>
                            ))}
                            {contact.email?.slice(0, 1).map((e, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <Mail className="w-3 h-3 mr-1" />{e}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Star className={`w-3 h-3 ${getImportanceColor(contact.importance || 50)}`} />
                              重要度 {contact.importance || 50}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              互动 {contact.interactionCount || 0} 次
                            </span>
                            {contact.lastInteraction && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(contact.lastInteraction).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {files.map((file) => (
                  <Card key={file.id} className="bg-card/50" data-testid={`card-file-detail-${file.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-blue-500/20">
                          <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold truncate">{file.fileName}</h3>
                            <Badge variant="outline">{file.fileType}</Badge>
                            <Badge variant={file.processingStatus === 'COMPLETED' ? 'default' : 'secondary'}>
                              {file.processingStatus}
                            </Badge>
                          </div>
                          
                          {file.summary && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {file.summary}
                            </p>
                          )}

                          {file.keyPoints && file.keyPoints.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {file.keyPoints.slice(0, 3).map((point, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {point}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {file.contractValue && (
                            <p className="text-sm font-medium text-primary mt-2">
                              合同金额: ¥{Number(file.contractValue).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    待处理冲突
                  </CardTitle>
                  <CardDescription>承诺与合同不一致的情况</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {conflicts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        暂无冲突
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {conflicts.map((conflict) => (
                          <Card key={conflict.id} className="bg-red-500/10 border-red-500/30">
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 mt-1" />
                                <div>
                                  <p className="text-sm font-medium">{conflict.description}</p>
                                  {conflict.evidence && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {conflict.evidence}
                                    </p>
                                  )}
                                  <Badge className={getRiskColor(conflict.conflictSeverity || 'LOW')} variant="outline">
                                    {conflict.conflictSeverity}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-500" />
                    商机线索
                  </CardTitle>
                  <CardDescription>从聊天中识别的潜在机会</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {opportunities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        暂无商机
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {opportunities.slice(0, 10).map((item: any, i: number) => (
                          <Card key={i} className="bg-green-500/10 border-green-500/30">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-medium">{item.opportunity.description}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    来源: {item.chat.chatName}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {item.opportunity.value && (
                                    <p className="text-sm font-bold text-green-500">
                                      ¥{item.opportunity.value.toLocaleString()}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    概率 {Math.round((item.opportunity.probability || 0) * 100)}%
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-500" />
                    高风险人物
                  </CardTitle>
                  <CardDescription>需要特别关注的联系人</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {highRiskNodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        暂无高风险人物
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {highRiskNodes.map((node) => (
                          <div key={node.id} className="flex items-center justify-between p-2 rounded bg-red-500/10">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-red-500" />
                              <span className="font-medium">{node.label}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {node.riskFactors?.slice(0, 2).map((factor, i) => (
                                <Badge key={i} variant="destructive" className="text-xs">
                                  {factor}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    高影响力人物
                  </CardTitle>
                  <CardDescription>社交网络中的关键节点</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {highInfluence.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        暂无数据，请先构建图谱
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {highInfluence.map((node, i) => (
                          <div key={node.id} className="flex items-center justify-between p-2 rounded bg-primary/10">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold">
                                {i + 1}
                              </span>
                              <span className="font-medium">{node.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(node.influence || 0) * 100} className="w-20 h-2" />
                              <span className="text-xs text-muted-foreground">
                                {Math.round((node.influence || 0) * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="graph" className="space-y-4">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  社交关系图谱
                </CardTitle>
                <CardDescription>
                  基于通讯录和聊天记录构建的人际关系网络
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] bg-card/30 rounded-lg flex items-center justify-center border border-dashed">
                  {graphData && graphData.nodes.length > 0 ? (
                    <div className="text-center">
                      <Network className="w-16 h-16 text-primary/50 mx-auto mb-4" />
                      <p className="text-lg font-medium">
                        {graphData.nodes.length} 个节点 · {graphData.edges.length} 条关系
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        图谱可视化功能开发中...
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {Array.from(new Set(graphData.nodes.map(n => n.cluster).filter(Boolean))).slice(0, 5).map((cluster, i) => (
                          <Badge key={i} variant="outline">{cluster}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Network className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        暂无图谱数据
                      </p>
                      <Button 
                        className="mt-4" 
                        onClick={() => buildGraphMutation.mutate()}
                        disabled={buildGraphMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${buildGraphMutation.isPending ? 'animate-spin' : ''}`} />
                        构建图谱
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold">{selectedContact?.name.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-xl">{selectedContact?.name}</h2>
                <p className="text-sm text-muted-foreground font-normal">
                  {selectedContact?.organization} {selectedContact?.department && `· ${selectedContact?.department}`}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-card/30">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{selectedContact.importance || 50}</p>
                      <p className="text-xs text-muted-foreground">重要程度</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/30">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-500">{selectedContact.trustScore || 50}</p>
                      <p className="text-xs text-muted-foreground">信任分数</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">联系方式</h4>
                {selectedContact.phone?.map((p, i) => (
                  <Badge key={i} variant="secondary" className="mr-2">
                    <Phone className="w-3 h-3 mr-1" />{p}
                  </Badge>
                ))}
                {selectedContact.email?.map((e, i) => (
                  <Badge key={i} variant="secondary" className="mr-2">
                    <Mail className="w-3 h-3 mr-1" />{e}
                  </Badge>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">互动统计</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded bg-card/30">
                    <p className="font-bold">{selectedContact.interactionCount || 0}</p>
                    <p className="text-xs text-muted-foreground">总互动</p>
                  </div>
                  <div className="p-2 rounded bg-card/30">
                    <p className="font-bold">{selectedContact.initiatedByMe || 0}</p>
                    <p className="text-xs text-muted-foreground">我主动</p>
                  </div>
                  <div className="p-2 rounded bg-card/30">
                    <p className="font-bold">{selectedContact.initiatedByThem || 0}</p>
                    <p className="text-xs text-muted-foreground">对方主动</p>
                  </div>
                </div>
              </div>

              {selectedContact.tags && selectedContact.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">标签</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedContact.tags.map((tag, i) => (
                      <Badge key={i} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedContact.notes && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">备注</h4>
                  <p className="text-sm text-muted-foreground">{selectedContact.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
