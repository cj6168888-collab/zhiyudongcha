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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { 
  FileText, 
  FolderPlus,
  BookTemplate,
  ClipboardList,
  FileSearch,
  Briefcase,
  TrendingUp,
  Plus,
  Sparkles,
  Clock,
  ArrowLeft
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  templateData: any;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  SOP: { label: 'SOP手册', icon: <ClipboardList className="w-4 h-4" />, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  PROPOSAL: { label: '策划书', icon: <Briefcase className="w-4 h-4" />, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  FEASIBILITY: { label: '可行性分析', icon: <FileSearch className="w-4 h-4" />, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  PROJECT_INIT: { label: '项目立项', icon: <FolderPlus className="w-4 h-4" />, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

const getCategoryConfig = (category: string) => categoryConfig[category] || { label: category, icon: <FileText className="w-4 h-4" />, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };

const defaultTemplates = [
  {
    name: "标准操作流程 (SOP)",
    description: "适用于日常业务流程的标准化操作模板，包含流程步骤、检查点、责任分工等",
    category: "SOP",
    templateData: {
      defaultTitle: "新SOP流程",
      defaultDescription: "标准操作流程文档",
      category: "BUSINESS",
      defaultPriority: 5,
      sections: ["流程目的", "适用范围", "职责分工", "操作步骤", "检查要点", "异常处理"],
      defaultConditions: ["流程需求明确", "相关人员已确认"],
      requiredConditions: ["流程文档编写", "培训计划", "验收测试"],
    }
  },
  {
    name: "商业策划书模板",
    description: "完整的商业策划书框架，涵盖市场分析、竞争分析、财务预测等核心内容",
    category: "PROPOSAL",
    templateData: {
      defaultTitle: "商业策划书",
      defaultDescription: "商业项目策划方案",
      category: "BUSINESS",
      defaultPriority: 3,
      sections: ["执行摘要", "项目背景", "市场分析", "竞争分析", "商业模式", "营销策略", "财务预测", "风险评估"],
      defaultConditions: ["市场调研数据", "竞品分析完成"],
      requiredConditions: ["详细财务模型", "团队组建", "资源确认"],
    }
  },
  {
    name: "可行性分析报告",
    description: "项目可行性评估模板，包含技术可行性、经济可行性、法律合规性分析",
    category: "FEASIBILITY",
    templateData: {
      defaultTitle: "可行性分析报告",
      defaultDescription: "项目可行性评估",
      category: "BUSINESS",
      defaultPriority: 4,
      sections: ["项目概述", "技术可行性", "经济可行性", "市场可行性", "法律合规", "风险分析", "结论建议"],
      defaultConditions: ["初步需求", "技术咨询"],
      requiredConditions: ["成本估算", "法律审核", "专家评审"],
    }
  },
  {
    name: "项目立项申请",
    description: "正式项目立项所需的标准申请模板，包含项目背景、目标、预算、时间计划",
    category: "PROJECT_INIT",
    templateData: {
      defaultTitle: "项目立项申请",
      defaultDescription: "新项目立项申请文档",
      category: "BUSINESS",
      defaultPriority: 2,
      sections: ["项目背景", "项目目标", "范围定义", "预算估算", "时间计划", "资源需求", "预期收益"],
      defaultConditions: ["业务需求确认", "初步预算"],
      requiredConditions: ["详细计划", "预算审批", "资源分配"],
    }
  },
  {
    name: "活动策划方案",
    description: "适用于市场活动、企业年会等活动策划，包含活动主题、流程、预算",
    category: "PROPOSAL",
    templateData: {
      defaultTitle: "活动策划方案",
      defaultDescription: "活动策划执行方案",
      category: "BUSINESS",
      defaultPriority: 4,
      sections: ["活动背景", "活动主题", "目标人群", "活动流程", "场地布置", "预算明细", "应急预案"],
      defaultConditions: ["活动日期确定", "初步预算"],
      requiredConditions: ["场地预订", "供应商确认", "宣传物料"],
    }
  },
];

export default function ProjectTemplates() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [newProjectTitle, setNewProjectTitle] = useState("");

  const { data: templates = [], isLoading } = useQuery<ProjectTemplate[]>({
    queryKey: ['/api/project-templates'],
    refetchInterval: 30000,
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async ({ templateId, title }: { templateId: string; title: string }) => {
      return apiRequest('POST', `/api/projects/from-template/${templateId}`, { title });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-templates'] });
      setShowCreateDialog(false);
      setSelectedTemplate(null);
      setNewProjectTitle("");
      toast({ title: "项目已创建", description: `已从模板「${data.templateUsed}」创建项目` });
      navigate("/projects");
    },
    onError: () => {
      toast({ title: "创建失败", description: "无法从模板创建项目", variant: "destructive" });
    },
  });

  const seedTemplatesMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const template of defaultTemplates) {
        try {
          const res = await apiRequest('POST', '/api/project-templates', template);
          results.push(res);
        } catch (e) {
          console.error('Failed to seed template:', template.name);
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-templates'] });
      toast({ title: "模板已初始化", description: "已添加预设模板到模板库" });
    },
  });

  const filteredTemplates = selectedCategory === "ALL" 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const handleUseTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setNewProjectTitle(template.templateData?.defaultTitle || template.name);
    setShowCreateDialog(true);
  };

  const handleCreateProject = () => {
    if (!selectedTemplate) return;
    createFromTemplateMutation.mutate({
      templateId: selectedTemplate.id,
      title: newProjectTitle || selectedTemplate.name,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pb-24 md:pb-6">
      <GlobalWakeHeader />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white w-fit" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回项目中心
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <BookTemplate className="w-8 h-8 text-amber-400 shrink-0" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">项目模板库</h1>
                <p className="text-slate-400 text-sm">SOP手册、策划书等标准化模板</p>
              </div>
            </div>
          </div>
          
          {role === 'MASTER' && templates.length === 0 && (
            <Button 
              onClick={() => seedTemplatesMutation.mutate()}
              disabled={seedTemplatesMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 w-full sm:w-auto"
              data-testid="button-init-templates"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {seedTemplatesMutation.isPending ? "初始化中..." : "初始化预设模板"}
            </Button>
          )}
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="bg-slate-800/50 border border-slate-700/50 inline-flex w-auto min-w-full sm:w-auto">
              <TabsTrigger value="ALL" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 whitespace-nowrap" data-testid="tab-all">
                全部
              </TabsTrigger>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <TabsTrigger 
                  key={key} 
                  value={key}
                  className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 whitespace-nowrap"
                  data-testid={`tab-${key.toLowerCase()}`}
                >
                  <span className="flex items-center gap-1">
                    {config.icon}
                    <span className="hidden sm:inline">{config.label}</span>
                    <span className="sm:hidden">{config.label.slice(0, 3)}</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={selectedCategory} className="mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-slate-400">加载中...</div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookTemplate className="w-16 h-16 text-slate-600 mb-4" />
                  <p className="text-slate-400 text-lg">暂无模板</p>
                  <p className="text-slate-500 text-sm mt-2">
                    {role === 'MASTER' ? "点击「初始化预设模板」添加常用模板" : "请联系管理员添加模板"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => {
                  const catConfig = getCategoryConfig(template.category);
                  return (
                    <Card 
                      key={template.id}
                      className="bg-slate-800/50 border-slate-700/50 hover:border-amber-500/50 transition-colors group"
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <Badge className={`${catConfig.color} border`}>
                            {catConfig.icon}
                            <span className="ml-1">{catConfig.label}</span>
                          </Badge>
                          <div className="flex items-center gap-1 text-slate-500 text-xs">
                            <TrendingUp className="w-3 h-3" />
                            <span>使用 {template.usageCount} 次</span>
                          </div>
                        </div>
                        <CardTitle className="text-lg mt-2 text-white group-hover:text-amber-400 transition-colors">
                          {template.name}
                        </CardTitle>
                        <CardDescription className="text-slate-400 line-clamp-2">
                          {template.description || "暂无描述"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {template.templateData?.sections && (
                          <div className="mb-4">
                            <p className="text-xs text-slate-500 mb-2">包含章节:</p>
                            <div className="flex flex-wrap gap-1">
                              {template.templateData.sections.slice(0, 4).map((section: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  {section}
                                </Badge>
                              ))}
                              {template.templateData.sections.length > 4 && (
                                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  +{template.templateData.sections.length - 4}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        <Button 
                          onClick={() => handleUseTemplate(template)}
                          className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
                          data-testid={`button-use-template-${template.id}`}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          使用此模板
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                从模板创建项目
              </DialogTitle>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`${getCategoryConfig(selectedTemplate.category).color} border`}>
                      {getCategoryConfig(selectedTemplate.category).label}
                    </Badge>
                  </div>
                  <p className="text-white font-medium">{selectedTemplate.name}</p>
                  <p className="text-slate-400 text-sm mt-1">{selectedTemplate.description}</p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="项目名称" className="text-sm text-slate-400">项目名称</label>
                  <Input
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="输入项目名称"
                    className="bg-slate-800 border-slate-600 text-white"
                    data-testid="input-project-title"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" className="text-slate-400" data-testid="button-cancel-create">
                  取消
                </Button>
              </DialogClose>
              <Button 
                onClick={handleCreateProject}
                disabled={createFromTemplateMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-confirm-create"
              >
                {createFromTemplateMutation.isPending ? "创建中..." : "创建项目"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
