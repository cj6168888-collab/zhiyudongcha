import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personApi, z2CoreApi, type RelationshipInsight } from "@/lib/api";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { StarMap, PersonDetailOverlay } from "@/components/ui/star-map";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Network, Plus, Search, AlertTriangle, TrendingUp, Link as LinkIcon, Trash2, Eye, Shield, Globe, List, Edit, Users, FolderKanban, Camera, Fingerprint, Check, Loader2, Brain, Upload, MessageSquarePlus, Sparkles, Zap } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import type { InsertPerson, Person, Project } from "@/shared/schema";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export default function RelationshipNetwork() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useZ1Store();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; person: Person | null }>({ open: false, person: null });
  
  // Clear biometric and psych preview when dialog closes
  const handleEditDialogClose = () => {
    setEditDialog({ open: false, person: null });
    setBiometricPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPsychProfile(null);
    setPsychPreview(null);
    setPsychObservation("");
    if (psychFileInputRef.current) psychFileInputRef.current.value = '';
  };
  const [insightDialog, setInsightDialog] = useState<{ open: boolean; data: RelationshipInsight | null }>({ open: false, data: null });
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [viewMode, setViewMode] = useState<'starmap' | 'list'>('starmap');
  const [biometricEnrolling, setBiometricEnrolling] = useState(false);
  const [biometricPreview, setBiometricPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [psychProfile, setPsychProfile] = useState<any>(null);
  const [psychAnalyzing, setPsychAnalyzing] = useState(false);
  const [psychPreview, setPsychPreview] = useState<string | null>(null);
  const [psychObservation, setPsychObservation] = useState("");
  const psychFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all persons
  const { data: persons = [], isLoading } = useQuery({
    queryKey: ["persons"],
    queryFn: personApi.getAll,
  });

  // Fetch all projects for linking
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      return res.json();
    },
  });

  // Search by weakness
  const { data: searchResults } = useQuery({
    queryKey: ["persons", "weakness", searchKeyword],
    queryFn: () => personApi.searchByWeakness(searchKeyword),
    enabled: searchKeyword.length > 2,
  });

  // Generate star map connections from person data
  const starMapConnections = useMemo(() => {
    type ConnectionType = 'normal' | 'conflict' | 'interest';
    const connections: Array<{ from: string; to: string; strength: number; type: ConnectionType }> = [];
    const personIds = new Set(persons.map((p: Person) => p.id));
    const addedPairs = new Set<string>();

    const addConnection = (id1: string, id2: string, strength: number, type: ConnectionType) => {
      if (!personIds.has(id1) || !personIds.has(id2) || id1 === id2) return;
      const pairKey = [id1, id2].sort().join('|');
      if (addedPairs.has(pairKey)) return;
      addedPairs.add(pairKey);
      connections.push({
        from: id1,
        to: id2,
        strength,
        type
      });
    };

    persons.forEach((person: Person) => {
      // Connection nodes - normal relationships
      if (person.connectionNodes && Array.isArray(person.connectionNodes)) {
        person.connectionNodes.forEach((targetId: string) => {
          addConnection(person.id, targetId, person.bondStrength || 0.5, 'normal');
        });
      }

      // Interest chain - yellow lines
      if (person.interestChain && typeof person.interestChain === 'object') {
        const chain = person.interestChain as { linkedPersons?: string[]; strength?: number };
        if (chain.linkedPersons && Array.isArray(chain.linkedPersons)) {
          chain.linkedPersons.forEach((targetId: string) => {
            addConnection(person.id, targetId, chain.strength || 0.7, 'interest');
          });
        }
      }

      // Conflict points - red lines (check if any conflict mentions another person)
      if (person.conflictPoints && Array.isArray(person.conflictPoints)) {
        persons.forEach((otherPerson: Person) => {
          if (person.id === otherPerson.id) return;
          const hasConflict = person.conflictPoints?.some((conflict: string) => 
            conflict.toLowerCase().includes(otherPerson.name.toLowerCase())
          );
          if (hasConflict) {
            addConnection(person.id, otherPerson.id, 0.8, 'conflict');
          }
        });
      }
    });

    return connections;
  }, [persons]);

  // Generate star map nodes with interest info
  const starMapNodes = useMemo(() => {
    return (persons || []).map((p: Person) => {
      const hasInterest = p.interestChain && typeof p.interestChain === 'object' && Object.keys(p.interestChain).length > 0;
      const interestStrength = hasInterest ? (p.interestChain as any)?.strength || 0.5 : 0;
      return {
        id: p.id,
        name: p.name,
        role: p.role || undefined,
        organization: p.organization || undefined,
        bondStrength: p.bondStrength || 0.5,
        hasInterest: !!hasInterest,
        interestStrength: interestStrength
      };
    });
  }, [persons]);

  // Create person mutation
  const createMutation = useMutation({
    mutationFn: personApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      setIsAddDialogOpen(false);
      toast({
        title: "目标已录入",
        description: "新联系人已添加到关系矩阵",
        className: "border-primary text-primary"
      });
    },
    onError: () => {
      toast({
        title: "操作失败",
        description: "无法添加联系人",
        variant: "destructive"
      });
    }
  });

  // Shred mutation
  const shredMutation = useMutation({
    mutationFn: (targetId: string) => z2CoreApi.permanentShred(targetId, 'person'),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      toast({
        title: "销毁完成",
        description: result.message,
        className: "border-destructive text-destructive"
      });
    },
    onError: () => {
      toast({
        title: "销毁失败",
        description: "无法删除目标",
        variant: "destructive"
      });
    }
  });

  // Update person mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertPerson> }) => personApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      handleEditDialogClose();
      toast({
        title: "资料已更新",
        description: "联系人信息已成功保存",
        className: "border-primary text-primary"
      });
    },
    onError: () => {
      toast({
        title: "更新失败",
        description: "无法保存联系人信息",
        variant: "destructive"
      });
    }
  });

  // Enroll face biometric mutation
  const enrollFaceMutation = useMutation({
    mutationFn: async ({ personId, imageBase64 }: { personId: string; imageBase64: string }) => {
      const res = await fetch('/api/contacts/biometrics/enroll/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Avatar-Role': 'MASTER' },
        body: JSON.stringify({ personId, imageBase64 })
      });
      return res.json();
    },
    onSuccess: (result) => {
      setBiometricEnrolling(false);
      setBiometricPreview(null);
      if (result.success) {
        toast({
          title: "人脸录入成功",
          description: `质量评分: ${result.qualityScore?.toFixed(0)}%`,
          className: "border-primary text-primary"
        });
      } else {
        toast({
          title: "录入失败",
          description: result.error || "请重新拍摄清晰的正面照片",
          variant: "destructive"
        });
      }
    },
    onError: () => {
      setBiometricEnrolling(false);
      toast({
        title: "录入失败",
        description: "网络错误，请重试",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setBiometricPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleEnrollFace = () => {
    if (!editDialog.person || !biometricPreview) return;
    setBiometricEnrolling(true);
    
    // Extract base64 data (remove data:image/...;base64, prefix)
    const imageBase64 = biometricPreview.includes(',') 
      ? biometricPreview.split(',')[1] 
      : biometricPreview;
    
    enrollFaceMutation.mutate({
      personId: editDialog.person.id,
      imageBase64
    });
  };

  const handlePsychFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPsychPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzePsych = async () => {
    if (!editDialog.person || !psychPreview) return;
    setPsychAnalyzing(true);
    
    try {
      const imageBase64 = psychPreview.includes(',') 
        ? psychPreview.split(',')[1] 
        : psychPreview;
      
      const res = await fetch(`/api/psych-profiles/${editDialog.person.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64,
          personName: editDialog.person.name 
        })
      });
      const result = await res.json();
      
      if (result.success) {
        setPsychProfile(result.profile);
        setPsychPreview(null);
        toast({
          title: "心理侧写生成成功",
          description: `已为 ${editDialog.person.name} 生成心理侧写`,
          className: "border-primary text-primary"
        });
      } else {
        toast({
          title: "分析失败",
          description: result.error || "无法生成心理侧写",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "分析失败",
        description: "网络错误，请重试",
        variant: "destructive"
      });
    } finally {
      setPsychAnalyzing(false);
    }
  };

  const handleFetchPsychProfile = async (personId: string) => {
    try {
      const res = await fetch(`/api/psych-profiles/${personId}`);
      if (res.ok) {
        const data = await res.json();
        setPsychProfile(data);
      }
    } catch {
      // No profile exists yet, that's ok
    }
  };

  const handleAddPsychObservation = async () => {
    if (!editDialog.person || !psychObservation.trim()) return;
    
    try {
      const res = await fetch(`/api/psych-profiles/${editDialog.person.id}/observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: psychObservation })
      });
      const result = await res.json();
      
      if (result.success) {
        setPsychObservation("");
        handleFetchPsychProfile(editDialog.person.id);
        toast({
          title: "观察备注已添加",
          description: "您的修正意见已记录",
          className: "border-primary text-primary"
        });
      } else {
        toast({
          title: "添加失败",
          description: result.error || "无法保存观察备注",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "添加失败",
        description: "网络错误，请重试",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newPerson: InsertPerson = {
      name: formData.get("name") as string,
      role: formData.get("role") as string || null,
      organization: formData.get("organization") as string || null,
      weakness: formData.get("weakness") as string || null,
      decisionStyle: formData.get("decisionStyle") as string || null,
      tags: (formData.get("tags") as string)?.split(",").map(t => t.trim()).filter(Boolean) || [],
      interestChain: null,
      decisionDna: null,
      lastInteraction: null,
      connectionNodes: [],
      bondStrength: 0.5,
      conflictPoints: [],
      accessLevel: formData.get("accessLevel") as string || "ZONE_BLUE",
    };

    createMutation.mutate(newPerson);
  };

  const handleInsight = async (name: string) => {
    try {
      const insight = await z2CoreApi.getRelationshipInsight(name);
      setInsightDialog({ open: true, data: insight });
    } catch {
      toast({
        title: "分析失败",
        description: "无法生成此目标的关系洞察",
        variant: "destructive"
      });
    }
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editDialog.person) return;
    
    const formData = new FormData(e.currentTarget);
    const selectedConnections = Array.from(formData.getAll("connections")) as string[];
    const selectedProjects = Array.from(formData.getAll("projects")) as string[];
    
    const nameValue = formData.get("name") as string;
    const updateData: Partial<InsertPerson> = {
      name: nameValue || editDialog.person.name,
      role: formData.get("role") as string || null,
      organization: formData.get("organization") as string || null,
      weakness: formData.get("weakness") as string || null,
      decisionStyle: formData.get("decisionStyle") as string || null,
      decisionDna: formData.get("decisionDna") as string || null,
      tags: (formData.get("tags") as string)?.split(",").map(t => t.trim()).filter(Boolean) || [],
      accessLevel: formData.get("accessLevel") as string || editDialog.person.accessLevel || "ZONE_BLUE",
      bondStrength: parseFloat(formData.get("bondStrength") as string) || editDialog.person.bondStrength || 0.5,
      connectionNodes: selectedConnections.length > 0 ? selectedConnections : editDialog.person.connectionNodes || [],
      interestChain: selectedProjects.length > 0 ? { linkedProjects: selectedProjects } : (editDialog.person.interestChain as Record<string, unknown> | null),
    };

    updateMutation.mutate({ id: editDialog.person.id, data: updateData });
  };

  const displayPersons = searchKeyword.length > 2 ? searchResults : persons;

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              红色区域：访问被拒绝
            </CardTitle>
            <CardDescription>
              关系情报仅限主人协议级别访问
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-24 md:pb-8">
      <GlobalWakeHeader 
        title="关系网" 
        subtitle="博弈画像与利益链分析 · 情报网络"
        rightActions={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-person">
                <Plus className="w-4 h-4 mr-2" />
                添加目标
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>添加新目标到矩阵</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名 *</Label>
                  <Input id="name" name="name" required data-testid="input-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">职位</Label>
                    <Input id="role" name="role" placeholder="CEO、总监..." data-testid="input-role" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">组织</Label>
                    <Input id="organization" name="organization" data-testid="input-organization" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weakness">弱点</Label>
                  <Textarea id="weakness" name="weakness" placeholder="识别突破口..." data-testid="input-weakness" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="decisionStyle">决策风格</Label>
                    <Select name="decisionStyle" defaultValue="CONSERVATIVE">
                      <SelectTrigger data-testid="select-decision-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AGGRESSIVE">激进型</SelectItem>
                        <SelectItem value="CONSERVATIVE">保守型</SelectItem>
                        <SelectItem value="SWING">摇摆型</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessLevel">访问级别</Label>
                    <Select name="accessLevel" defaultValue="ZONE_BLUE">
                      <SelectTrigger data-testid="select-access-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ZONE_RED">红区 (仅主人)</SelectItem>
                        <SelectItem value="ZONE_BLUE">蓝区 (团队)</SelectItem>
                        <SelectItem value="ZONE_GREEN">绿区 (访客)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">标签 (逗号分隔)</Label>
                  <Input id="tags" name="tags" placeholder="投资人, 竞争对手, 盟友" data-testid="input-tags" />
                </div>
                <Button type="submit" className="w-full" data-testid="button-submit-person">
                  录入目标
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* View Toggle & Search */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode('starmap')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'starmap' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="button-view-starmap"
          >
            <Globe className="w-4 h-4 inline mr-1" />
            星图
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="button-view-list"
          >
            <List className="w-4 h-4 inline mr-1" />
            列表
          </button>
        </div>
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="搜索弱点..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-10"
            data-testid="input-search-weakness"
          />
        </div>
      </div>

      {/* Star Map View */}
      {viewMode === 'starmap' && (
        <Card className="mb-6">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="h-[500px] flex items-center justify-center text-muted-foreground">加载中...</div>
            ) : displayPersons && displayPersons.length === 0 ? (
              <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                <Network className="w-16 h-16 mb-4 opacity-50" />
                <p>暂无目标。添加第一个情报节点。</p>
              </div>
            ) : (
              <StarMap
                nodes={starMapNodes.filter(n => 
                  displayPersons?.some((p: Person) => p.id === n.id)
                )}
                connections={starMapConnections}
                selectedId={selectedPerson?.id || null}
                onNodeClick={(node) => {
                  const person = displayPersons?.find((p: Person) => p.id === node.id);
                  if (person) setSelectedPerson(person);
                }}
                className="h-[500px]"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        isLoading ? (
          <div className="text-center py-12 text-muted-foreground">加载中...</div>
        ) : displayPersons && displayPersons.length === 0 ? (
          <div className="text-center py-12">
            <Network className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">暂无目标。添加第一个情报节点。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayPersons?.map((person) => (
            <Card key={person.id} className="hover:border-primary/50 transition-all group" data-testid={`card-person-${person.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span data-testid={`text-person-name-${person.id}`}>{person.name}</span>
                  <div className="flex items-center gap-1">
                    {person.accessLevel && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          person.accessLevel === 'ZONE_RED' ? 'border-destructive text-destructive' :
                          person.accessLevel === 'ZONE_BLUE' ? 'border-primary text-primary' :
                          'border-green-500 text-green-500'
                        }`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {person.accessLevel.replace('ZONE_', '')}
                      </Badge>
                    )}
                    {person.bondStrength && person.bondStrength > 0.7 && (
                      <Badge variant="outline" className="text-xs">
                        <LinkIcon className="w-3 h-3 mr-1" />
                        紧密
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                <CardDescription className="space-y-1">
                  {person.role && <div className="text-xs">职位: {person.role}</div>}
                  {person.organization && <div className="text-xs">组织: {person.organization}</div>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {person.weakness && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                    <div className="flex items-center gap-1 text-destructive font-medium mb-1">
                      <AlertTriangle className="w-3 h-3" />
                      弱点
                    </div>
                    <p className="text-muted-foreground" data-testid={`text-weakness-${person.id}`}>{person.weakness}</p>
                  </div>
                )}
                
                {person.decisionStyle && (
                  <div className="flex items-center gap-2 text-xs">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground">风格:</span>
                    <Badge variant="secondary" className="text-xs">{person.decisionStyle}</Badge>
                  </div>
                )}

                {person.tags && person.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {person.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Capability Tags */}
                {(person as any).capabilities && (person as any).capabilities.length > 0 && (
                  <div className="p-2 bg-primary/5 border border-primary/20 rounded text-xs">
                    <div className="flex items-center gap-1 text-primary font-medium mb-1">
                      <Sparkles className="w-3 h-3" />
                      专业能力
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {((person as any).capabilities as string[]).slice(0, 5).map((cap: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                          {cap}
                          {(person as any).capabilityLevel && (person as any).capabilityLevel[cap] && (
                            <span className="ml-1 opacity-70">Lv{(person as any).capabilityLevel[cap]}</span>
                          )}
                        </Badge>
                      ))}
                      {(person as any).capabilities.length > 5 && (
                        <Badge variant="outline" className="text-xs opacity-60">
                          +{(person as any).capabilities.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Specialties */}
                {(person as any).specialties && (person as any).specialties.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span className="text-muted-foreground">特长:</span>
                    <div className="flex flex-wrap gap-1">
                      {((person as any).specialties as string[]).map((s: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs border-amber-500/30 text-amber-600">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditDialog({ open: true, person })}
                    data-testid={`button-edit-${person.id}`}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleInsight(person.name)}
                    data-testid={`button-insight-${person.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    洞察
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => shredMutation.mutate(person.id)}
                    data-testid={`button-shred-${person.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )
      )}

      {/* Person Detail Overlay */}
      <AnimatePresence>
        {selectedPerson && (
          <PersonDetailOverlay
            person={selectedPerson}
            onClose={() => setSelectedPerson(null)}
          />
        )}
      </AnimatePresence>

      {/* Insight Dialog */}
      <Dialog open={insightDialog.open} onOpenChange={(open) => setInsightDialog({ ...insightDialog, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              博弈素材分析
            </DialogTitle>
          </DialogHeader>
          {insightDialog.data && (
            <div className="space-y-4">
              <div className="p-3 bg-card border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">目标</div>
                <div className="font-medium text-lg">{insightDialog.data.person.name}</div>
                {insightDialog.data.person.organization && (
                  <div className="text-sm text-muted-foreground">{insightDialog.data.person.organization}</div>
                )}
              </div>
              
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="text-sm text-destructive font-medium mb-1">弱点分析</div>
                <p className="text-sm">{insightDialog.data.vulnerabilityAnalysis}</p>
              </div>

              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="text-sm text-primary font-medium mb-1">利益链摘要</div>
                <p className="text-sm">{insightDialog.data.interestChainSummary}</p>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-muted-foreground">风险等级: </span>
                  <Badge variant={
                    insightDialog.data.riskLevel === 'HIGH' ? 'destructive' :
                    insightDialog.data.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'
                  }>
                    {insightDialog.data.riskLevel}
                  </Badge>
                </div>
              </div>

              <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                <div className="text-sm text-accent font-medium mb-1">建议策略</div>
                <p className="text-sm">{insightDialog.data.suggestedApproach}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Person Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              编辑联系人资料
            </DialogTitle>
            <DialogDescription>
              修改联系人信息、关联项目和人物关系
            </DialogDescription>
          </DialogHeader>
          {editDialog.person && (
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">基本信息</TabsTrigger>
                  <TabsTrigger value="relations">
                    <Users className="w-4 h-4 mr-1" />
                    人物关系
                  </TabsTrigger>
                  <TabsTrigger value="projects">
                    <FolderKanban className="w-4 h-4 mr-1" />
                    关联项目
                  </TabsTrigger>
                  <TabsTrigger value="biometrics">
                    <Fingerprint className="w-4 h-4 mr-1" />
                    人脸识别
                  </TabsTrigger>
                  <TabsTrigger value="psych" onClick={() => editDialog.person && handleFetchPsychProfile(editDialog.person.id)}>
                    <Brain className="w-4 h-4 mr-1" />
                    心理侧写
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">姓名 *</Label>
                      <Input id="edit-name" name="name" defaultValue={editDialog.person.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-role">职位</Label>
                      <Input id="edit-role" name="role" defaultValue={editDialog.person.role || ''} placeholder="CEO, 总监..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-organization">组织/公司</Label>
                    <Input id="edit-organization" name="organization" defaultValue={editDialog.person.organization || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-weakness">弱点分析</Label>
                    <Textarea id="edit-weakness" name="weakness" defaultValue={editDialog.person.weakness || ''} placeholder="识别关键弱点..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-decisionDna">决策DNA</Label>
                    <Textarea id="edit-decisionDna" name="decisionDna" defaultValue={editDialog.person.decisionDna || ''} placeholder="决策模式、偏好、触发点..." />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-decisionStyle">决策风格</Label>
                      <Select name="decisionStyle" defaultValue={editDialog.person.decisionStyle || 'CONSERVATIVE'}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AGGRESSIVE">激进型</SelectItem>
                          <SelectItem value="CONSERVATIVE">保守型</SelectItem>
                          <SelectItem value="SWING">摇摆型</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-accessLevel">访问等级</Label>
                      <Select name="accessLevel" defaultValue={editDialog.person.accessLevel || 'ZONE_BLUE'}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ZONE_RED">红区 (仅主人)</SelectItem>
                          <SelectItem value="ZONE_BLUE">蓝区 (团队)</SelectItem>
                          <SelectItem value="ZONE_GREEN">绿区 (访客)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-bondStrength">关系强度</Label>
                      <Input id="edit-bondStrength" name="bondStrength" type="number" step="0.1" min="0" max="1" defaultValue={editDialog.person.bondStrength || 0.5} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-tags">标签 (逗号分隔)</Label>
                    <Input id="edit-tags" name="tags" defaultValue={(editDialog.person.tags || []).join(', ')} placeholder="投资人, 竞争对手, 盟友" />
                  </div>
                </TabsContent>
                
                <TabsContent value="relations" className="space-y-4 mt-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    选择与此联系人有关联的其他人物
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {persons.filter(p => p.id !== editDialog.person?.id).map(p => (
                      <label key={p.id} className="flex items-center gap-2 p-2 rounded border hover:bg-accent/10 cursor-pointer">
                        <Checkbox 
                          name="connections" 
                          value={p.id}
                          defaultChecked={(editDialog.person?.connectionNodes || []).includes(p.id)}
                        />
                        <span className="text-sm">{p.name}</span>
                        {p.organization && <span className="text-xs text-muted-foreground">({p.organization})</span>}
                      </label>
                    ))}
                  </div>
                  {persons.filter(p => p.id !== editDialog.person?.id).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无其他联系人可关联
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="projects" className="space-y-4 mt-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    选择与此联系人相关的项目
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                    {projects.map(project => {
                      const linkedProjects = (editDialog.person?.interestChain as { linkedProjects?: string[] })?.linkedProjects || [];
                      return (
                        <label key={project.id} className="flex items-center gap-2 p-3 rounded border hover:bg-accent/10 cursor-pointer">
                          <Checkbox 
                            name="projects" 
                            value={project.id}
                            defaultChecked={linkedProjects.includes(project.id)}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{project.title}</div>
                            {project.description && <div className="text-xs text-muted-foreground">{project.description}</div>}
                          </div>
                          <Badge variant="outline" className="text-xs">{project.status}</Badge>
                        </label>
                      );
                    })}
                  </div>
                  {projects.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无项目可关联。请先在项目中心创建项目。
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="biometrics" className="space-y-4 mt-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    录入联系人的人脸特征，让小智能够快速识别此人
                  </div>
                  
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    {biometricPreview ? (
                      <div className="space-y-4">
                        <img 
                          src={biometricPreview} 
                          alt="预览" 
                          className="w-48 h-48 object-cover rounded-full mx-auto border-4 border-primary/30"
                        />
                        <div className="flex justify-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setBiometricPreview(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                          >
                            重新选择
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleEnrollFace}
                            disabled={biometricEnrolling}
                            data-testid="button-enroll-face"
                          >
                            {biometricEnrolling ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                录入中...
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                确认录入
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-24 h-24 rounded-full bg-muted mx-auto flex items-center justify-center">
                          <Camera className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">上传 {editDialog.person?.name} 的正面照片</p>
                          <p className="text-xs text-muted-foreground">清晰的正面人脸照片效果最佳</p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                          data-testid="input-face-photo"
                        />
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          选择照片
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded">
                    <p>• 照片仅用于提取特征描述，不会保存原图</p>
                    <p>• 录入后，小智可以通过照片识别此联系人</p>
                    <p>• 建议使用清晰、光线充足的正面照片</p>
                  </div>
                </TabsContent>

                <TabsContent value="psych" className="space-y-4 mt-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    基于面部特征的心理学侧写分析，帮助您更好地理解和应对此联系人
                  </div>

                  {psychProfile ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">性格类型</div>
                          <div className="font-medium text-primary">{psychProfile.personalityType}</div>
                        </div>
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">沟通风格</div>
                          <div className="font-medium">{psychProfile.communicationStyle}</div>
                        </div>
                      </div>

                      {psychProfile.dominantTraits && psychProfile.dominantTraits.length > 0 && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-2">主要性格特质</div>
                          <div className="flex flex-wrap gap-2">
                            {psychProfile.dominantTraits.map((trait: string, i: number) => (
                              <Badge key={i} variant="secondary">{trait}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">情绪倾向</div>
                          <div className="text-sm">{psychProfile.emotionalTendency}</div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">决策风格</div>
                          <div className="text-sm">{psychProfile.decisionMakingStyle}</div>
                        </div>
                      </div>

                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">压力反应</div>
                        <div className="text-sm">{psychProfile.stressResponse}</div>
                      </div>

                      {psychProfile.motivationDrivers && psychProfile.motivationDrivers.length > 0 && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-2">动机驱动因素</div>
                          <div className="flex flex-wrap gap-2">
                            {psychProfile.motivationDrivers.map((driver: string, i: number) => (
                              <Badge key={i} variant="outline">{driver}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div className="text-xs text-green-600 font-medium mb-1">互动建议</div>
                        <div className="text-sm">{psychProfile.approachSuggestions}</div>
                      </div>

                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="text-xs text-destructive font-medium mb-1">避免行为</div>
                        <div className="text-sm">{psychProfile.avoidBehaviors}</div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground p-2 bg-muted/20 rounded">
                        <span>可信度评分: {(psychProfile.trustworthinessScore * 100).toFixed(0)}%</span>
                        <span>分析置信度: {(psychProfile.confidenceLevel * 100).toFixed(0)}%</span>
                      </div>

                      {psychProfile.observationNotes && psychProfile.observationNotes.length > 0 && (
                        <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                          <div className="text-xs text-accent font-medium mb-2">观察备注（人工修正）</div>
                          <div className="space-y-2">
                            {psychProfile.observationNotes.map((note: { note: string; addedAt: string }, i: number) => (
                              <div key={i} className="text-sm p-2 bg-background rounded border">
                                <p>{note.note}</p>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(note.addedAt).toLocaleString('zh-CN')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-4 border-t">
                        <Label htmlFor="psych-observation">添加观察备注（修正AI分析）</Label>
                        <div className="flex gap-2">
                          <Textarea 
                            id="psych-observation"
                            value={psychObservation}
                            onChange={(e) => setPsychObservation(e.target.value)}
                            placeholder="输入您对此人的观察和修正意见..."
                            className="flex-1"
                            data-testid="input-psych-observation"
                          />
                          <Button 
                            type="button" 
                            size="sm"
                            onClick={handleAddPsychObservation}
                            disabled={!psychObservation.trim()}
                            data-testid="button-add-observation"
                          >
                            <MessageSquarePlus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setPsychProfile(null);
                          if (psychFileInputRef.current) psychFileInputRef.current.value = '';
                        }}
                        data-testid="button-reanalyze-psych"
                      >
                        重新分析
                      </Button>
                    </div>
                  ) : psychPreview ? (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <img 
                          src={psychPreview} 
                          alt="预览" 
                          className="w-48 h-48 object-cover rounded-lg mx-auto border-4 border-primary/30"
                        />
                        <div className="flex justify-center gap-2 mt-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPsychPreview(null);
                              if (psychFileInputRef.current) psychFileInputRef.current.value = '';
                            }}
                          >
                            重新选择
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAnalyzePsych}
                            disabled={psychAnalyzing}
                            data-testid="button-analyze-psych"
                          >
                            {psychAnalyzing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                分析中...
                              </>
                            ) : (
                              <>
                                <Brain className="w-4 h-4 mr-1" />
                                开始分析
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-4">
                      <div className="w-24 h-24 rounded-full bg-muted mx-auto flex items-center justify-center">
                        <Brain className="w-10 h-10 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">上传 {editDialog.person?.name} 的照片进行心理分析</p>
                        <p className="text-xs text-muted-foreground">通过面部特征推断性格和沟通风格</p>
                      </div>
                      <input
                        ref={psychFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePsychFileSelect}
                        className="hidden"
                        data-testid="input-psych-photo"
                      />
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => psychFileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        选择照片
                      </Button>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded">
                    <p>• 心理侧写仅供参考，需结合实际观察验证</p>
                    <p>• 您可以添加观察备注来修正AI的分析结果</p>
                    <p>• 分析基于面相学和微表情研究，准确度有限</p>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleEditDialogClose}>
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? '保存中...' : '保存更改'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
