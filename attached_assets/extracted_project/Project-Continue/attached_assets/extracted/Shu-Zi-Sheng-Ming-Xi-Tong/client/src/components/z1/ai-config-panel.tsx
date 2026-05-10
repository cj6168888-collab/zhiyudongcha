import { useState } from "react";
import { useZ1Store, type AIServiceType, type AIServiceConfig } from "@/lib/z1/god-protocol";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Key, 
  Settings, 
  CheckCircle, 
  XCircle,
  Scale,
  TrendingUp,
  Briefcase,
  Cpu,
  Eye,
  EyeOff
} from "lucide-react";

const serviceIcons: Record<AIServiceType, React.ReactNode> = {
  PRIMARY: <Bot className="w-5 h-5" />,
  LEGAL: <Scale className="w-5 h-5" />,
  FINANCE: <TrendingUp className="w-5 h-5" />,
  STRATEGY: <Briefcase className="w-5 h-5" />,
};

const serviceColors: Record<AIServiceType, string> = {
  PRIMARY: "border-primary text-primary",
  LEGAL: "border-blue-500 text-blue-500",
  FINANCE: "border-green-500 text-green-500",
  STRATEGY: "border-purple-500 text-purple-500",
};

const providerModels: Record<string, string[]> = {
  OPENAI: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o'],
  ANTHROPIC: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  DEEPSEEK: ['deepseek-chat', 'deepseek-coder'],
  QWEN: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  CUSTOM: ['custom-model'],
};

interface AIServiceCardProps {
  service: AIServiceConfig;
  onUpdate: (updates: Partial<AIServiceConfig>) => void;
}

function AIServiceCard({ service, onUpdate }: AIServiceCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [localKey, setLocalKey] = useState(service.apiKey);

  const handleSaveKey = () => {
    onUpdate({ apiKey: localKey, isActive: localKey.length > 0 });
  };

  const maskedKey = service.apiKey 
    ? `${service.apiKey.slice(0, 8)}...${service.apiKey.slice(-4)}` 
    : '未配置';

  return (
    <Card className={`${serviceColors[service.type]} ${service.isActive ? 'bg-card' : 'bg-muted/30 opacity-70'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {serviceIcons[service.type]}
            {service.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {service.isActive ? (
              <Badge variant="outline" className="text-green-500 border-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <XCircle className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          {service.provider} · {service.model}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10 text-xs"
                data-testid={`input-apikey-${service.type}`}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button 
              size="sm" 
              onClick={handleSaveKey}
              disabled={localKey === service.apiKey}
              data-testid={`button-save-${service.type}`}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select
              value={service.provider}
              onValueChange={(v) => onUpdate({ provider: v as AIServiceConfig['provider'] })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPENAI">OpenAI</SelectItem>
                <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
                <SelectItem value="DEEPSEEK">DeepSeek</SelectItem>
                <SelectItem value="QWEN">Qwen</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Model</Label>
            <Select
              value={service.model}
              onValueChange={(v) => onUpdate({ model: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerModels[service.provider]?.map((model) => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Assigned Experts</Label>
          <div className="flex flex-wrap gap-1">
            {service.assignedExperts.map((expert) => (
              <Badge key={expert} variant="secondary" className="text-xs">
                {expert}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Label className="text-xs">Enable Service</Label>
          <Switch
            checked={service.isActive}
            onCheckedChange={(checked) => onUpdate({ isActive: checked })}
            disabled={!service.apiKey}
            data-testid={`switch-active-${service.type}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function AIConfigPanel() {
  const { toast } = useToast();
  const { role, aiServices, updateAIService } = useZ1Store();
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = aiServices.filter(s => s.isActive).length;

  const handleUpdate = (type: AIServiceType, updates: Partial<AIServiceConfig>) => {
    updateAIService(type, updates);
    
    if (updates.apiKey && updates.isActive) {
      toast({
        title: "API Key 已保存",
        description: `${type} 服务已激活`,
        className: "border-green-500 text-green-500",
      });
    }
  };

  const handleClick = () => {
    if (role !== 'MASTER') {
      toast({
        title: "权限不足",
        description: "请先切换到 MASTER 模式以配置 AI 服务",
        variant: "destructive",
      });
      return;
    }
    setIsOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={`gap-2 ${role !== 'MASTER' ? 'opacity-60' : ''}`} 
          onClick={handleClick}
          data-testid="button-ai-config"
        >
          <Key className="w-4 h-4" />
          AI 配置
          <Badge variant="secondary" className="ml-1">
            {activeCount}/{aiServices.length}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            多 AI 服务配置 (Multi-AI Configuration)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="text-muted-foreground">
              配置不同的 AI 服务为不同的专家模块提供能力。每个 API Key 只存储在本地浏览器中。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiServices.map((service) => (
              <AIServiceCard
                key={service.type}
                service={service}
                onUpdate={(updates) => handleUpdate(service.type, updates)}
              />
            ))}
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">专家分配说明</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>• PRIMARY: 秘书、IT进化模块</div>
              <div>• LEGAL: 法律合规专家</div>
              <div>• FINANCE: 财务分析、健康卫士</div>
              <div>• STRATEGY: 策略博弈专家</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
