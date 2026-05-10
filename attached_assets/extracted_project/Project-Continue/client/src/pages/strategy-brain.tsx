import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useZ4Store, type ExpertType, type ExpertAnalysis, Z4_SCHEMA } from "@/lib/z4/strategy-orchestrator";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { 
  Brain, 
  Scale, 
  TrendingUp, 
  Briefcase, 
  Calendar, 
  Heart, 
  Lightbulb, 
  AlertTriangle,
  Play,
  Activity,
  MessageSquare,
  Upload,
  Camera,
  Eye
} from "lucide-react";

const expertIcons: Record<ExpertType, React.ReactNode> = {
  LEGAL: <Scale className="w-4 h-4" />,
  FINANCE: <TrendingUp className="w-4 h-4" />,
  STRATEGY: <Briefcase className="w-4 h-4" />,
  SECRETARY: <Calendar className="w-4 h-4" />,
  PSYCHOLOGY: <Heart className="w-4 h-4" />,
  PLANNING: <Lightbulb className="w-4 h-4" />,
};

const expertColors: Record<ExpertType, string> = {
  LEGAL: "text-blue-500 border-blue-500",
  FINANCE: "text-green-500 border-green-500",
  STRATEGY: "text-purple-500 border-purple-500",
  SECRETARY: "text-orange-500 border-orange-500",
  PSYCHOLOGY: "text-pink-500 border-pink-500",
  PLANNING: "text-amber-500 border-amber-500",
};

export default function StrategyBrain() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const [, navigate] = useLocation();
  const {
    activeExperts,
    expertHealth,
    currentTask,
    thoughtLog,
    ownerStressLevel,
    emotionalAlerts,
    processComplexInstruction,
    setOwnerStress,
    runLegalAudit,
    runFinanceAnalysis,
    runStrategyPlanning,
  } = useZ4Store();

  const [instruction, setInstruction] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedExpert, setSelectedExpert] = useState<ExpertType | null>(null);
  const [singleAnalysis, setSingleAnalysis] = useState<ExpertAnalysis | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast({
        title: "文件已添加",
        description: `成功添加 ${newFiles.length} 个文件`,
      });
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFiles(prev => [...prev, e.target.files![0]]);
      toast({
        title: "照片已添加",
        description: "照片已成功捕获",
      });
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

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
              策略大脑仅限主人协议级别访问
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleProcess = async () => {
    if (!instruction.trim()) {
      toast({
        title: "需要输入指令",
        description: "请输入要分析的任务描述",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await processComplexInstruction(instruction, "PRIVATE_OFFICE");
      toast({
        title: "分析完成",
        description: "专家团队已完成协同分析",
        className: "border-primary text-primary",
      });
    } catch (error) {
      toast({
        title: "分析失败",
        description: "请检查系统状态后重试",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleExpert = async (expert: ExpertType) => {
    setSelectedExpert(expert);
    setIsProcessing(true);
    
    try {
      let result: ExpertAnalysis;
      switch (expert) {
        case 'LEGAL':
          result = await runLegalAudit(instruction || "合同审查");
          break;
        case 'FINANCE':
          result = await runFinanceAnalysis({});
          break;
        case 'STRATEGY':
          result = await runStrategyPlanning(instruction || "策略分析");
          break;
        default:
          result = {
            expert,
            chainOfThought: [],
            finalVerdict: "分析完成",
            riskLevel: 'LOW',
            recommendations: [],
            executionTime: 0,
          };
      }
      setSingleAnalysis(result);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-24 md:pb-8">
      <GlobalWakeHeader 
        title="Z4: 策略大脑" 
        subtitle="六核专家协同 · 决策编排引擎"
      />

      <Tabs defaultValue="orchestrator" className="space-y-6">
        <TabsList>
          <TabsTrigger value="orchestrator" data-testid="tab-orchestrator">
            <Brain className="w-4 h-4 mr-2" />
            任务编排
          </TabsTrigger>
          <TabsTrigger value="experts" data-testid="tab-experts">
            <Activity className="w-4 h-4 mr-2" />
            专家面板
          </TabsTrigger>
          <TabsTrigger value="thoughts" data-testid="tab-thoughts">
            <MessageSquare className="w-4 h-4 mr-2" />
            推理链
          </TabsTrigger>
          <TabsTrigger value="psychology" data-testid="tab-psychology">
            <Heart className="w-4 h-4 mr-2" />
            心理洞察
          </TabsTrigger>
        </TabsList>
        
        <Button
          variant="outline"
          onClick={() => navigate("/oracle")}
          className="ml-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 hover:from-purple-600/30 hover:to-blue-600/30"
          data-testid="btn-oracle"
        >
          <Eye className="w-4 h-4 mr-2" />
          预言家协议
        </Button>

        {/* Orchestrator Tab */}
        <TabsContent value="orchestrator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>复杂指令处理</CardTitle>
              <CardDescription>
                输入任务描述，专家团队将协同分析并输出策略建议
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instruction">任务指令</Label>
                <Textarea
                  id="instruction"
                  placeholder="例：分析这个合同，找出对方的陷阱，结合他们的财报给我一个对策..."
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={4}
                  data-testid="input-instruction"
                />
              </div>

              {/* 文件上传区域 */}
              <div className="space-y-3">
                <Label>附件（合同文件/照片）</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    multiple
                    onChange={handleFileUpload}
                  />
                  <input
                    type="file"
                    ref={cameraInputRef}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-file"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    上传文件
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    data-testid="button-camera"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    拍照上传
                  </Button>
                </div>

                {/* 已上传文件列表 */}
                {uploadedFiles.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">已上传 {uploadedFiles.length} 页文件：</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {uploadedFiles.map((file, idx) => (
                        <div 
                          key={idx} 
                          className="relative group border rounded p-2 text-xs"
                          data-testid={`file-item-${idx}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 flex items-center justify-center bg-primary/10 rounded text-primary font-mono">
                              {idx + 1}
                            </span>
                            <span className="truncate flex-1">{file.name}</span>
                          </div>
                          <button
                            onClick={() => removeFile(idx)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-remove-file-${idx}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleProcess}
                disabled={isProcessing}
                className="w-full"
                data-testid="button-process"
              >
                <Play className="w-4 h-4 mr-2" />
                {isProcessing ? "专家协同分析中..." : "启动专家协同"}
              </Button>
            </CardContent>
          </Card>

          {/* Current Task Result */}
          {currentTask && (
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>分析结果</span>
                  <Badge variant="outline">{currentTask.outputMode}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm" data-testid="text-synthesis">
                    {currentTask.synthesizedStrategy}
                  </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentTask.expertAnalyses.map((analysis, idx) => (
                    <Card key={idx} className={`border ${expertColors[analysis.expert]}`}>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {expertIcons[analysis.expert]}
                          {Z4_SCHEMA.experts[analysis.expert].split('：')[0]}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        <Badge
                          variant={
                            analysis.riskLevel === 'CRITICAL' || analysis.riskLevel === 'HIGH'
                              ? 'destructive'
                              : analysis.riskLevel === 'MEDIUM'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {analysis.riskLevel}
                        </Badge>
                        <p className="text-xs mt-2 text-muted-foreground">
                          {analysis.finalVerdict.slice(0, 80)}...
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Experts Tab */}
        <TabsContent value="experts" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(Object.keys(Z4_SCHEMA.experts) as ExpertType[]).map((expert) => (
              <Card
                key={expert}
                className={`cursor-pointer hover:border-primary/50 transition-all ${
                  activeExperts.includes(expert) ? "border-primary/30" : "opacity-50"
                }`}
                onClick={() => handleSingleExpert(expert)}
                data-testid={`card-expert-${expert}`}
              >
                <CardHeader>
                  <CardTitle className={`text-sm flex items-center gap-2 ${expertColors[expert]}`}>
                    {expertIcons[expert]}
                    {Z4_SCHEMA.experts[expert].split('：')[0]}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {Z4_SCHEMA.experts[expert].split('：')[1]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>健康度</span>
                      <span>{expertHealth[expert]}%</span>
                    </div>
                    <Progress value={expertHealth[expert]} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Single Expert Analysis Result */}
          {singleAnalysis && selectedExpert && (
            <Card className={`border ${expertColors[selectedExpert]}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {expertIcons[selectedExpert]}
                  {Z4_SCHEMA.experts[selectedExpert].split('：')[0]} 分析报告
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded">
                  <p className="font-medium">{singleAnalysis.finalVerdict}</p>
                </div>
                
                {singleAnalysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">建议措施</h4>
                    <ul className="space-y-1">
                      {singleAnalysis.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>风险等级: {singleAnalysis.riskLevel}</span>
                  <span>分析耗时: {singleAnalysis.executionTime}ms</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Thoughts Tab */}
        <TabsContent value="thoughts">
          <Card>
            <CardHeader>
              <CardTitle>推理链</CardTitle>
              <CardDescription>
                专家推理过程完整记录 (严禁直接输出结果，必须输出推理过程)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {thoughtLog.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    暂无推理记录，执行任务后将显示完整推理链
                  </div>
                ) : (
                  <div className="space-y-4">
                    {thoughtLog.map((thought, idx) => (
                      <div
                        key={idx}
                        className={`p-4 border rounded-lg ${expertColors[thought.expertId]} bg-card`}
                        data-testid={`thought-${idx}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {expertIcons[thought.expertId]}
                          <span className="font-medium text-sm">
                            {Z4_SCHEMA.experts[thought.expertId].split('：')[0]}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            步骤 {thought.step}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            置信度: {thought.confidence}%
                          </span>
                        </div>
                        <p className="text-sm mb-2">{thought.reasoning}</p>
                        {thought.evidence.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            证据: {thought.evidence.join(' | ')}
                          </div>
                        )}
                        <div className="mt-2 p-2 bg-primary/10 rounded text-sm">
                          <strong>结论:</strong> {thought.conclusion}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Psychology Tab */}
        <TabsContent value="psychology" className="space-y-6">
          <Card className="border-pink-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-pink-500">
                <Heart className="w-5 h-5" />
                心理洞察模块
              </CardTitle>
              <CardDescription>
                情绪分析、谈判心理、对手心理画像
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>情绪状态追踪</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[ownerStressLevel]}
                    onValueChange={(v) => setOwnerStress(v[0])}
                    max={100}
                    step={1}
                    className="flex-1"
                    data-testid="slider-stress"
                  />
                  <span className={`font-mono w-12 ${
                    ownerStressLevel > 70 ? 'text-destructive' :
                    ownerStressLevel > 50 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {ownerStressLevel}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ownerStressLevel > 70 
                    ? "⚠️ 情绪波动：建议冷静后再进行重要决策"
                    : ownerStressLevel > 50
                    ? "📊 状态一般：注意调整沟通语气"
                    : "✅ 状态良好：适合进行重要谈判"}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">心理分析能力</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 对手心理画像分析</li>
                  <li>• 谈判策略心理建议</li>
                  <li>• 沟通措辞优化</li>
                  <li>• 决策心理评估</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
