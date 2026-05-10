import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Smartphone, 
  Laptop, 
  Server,
  Cpu,
  HardDrive,
  Zap,
  ChevronDown,
  ChevronRight,
  Gauge,
  Clock,
  WifiOff
} from 'lucide-react';

const MOBILE_CHIPS = [
  { id: 'snapdragon_8_gen3', name: '骁龙8 Gen3', tier: '旗舰' },
  { id: 'snapdragon_8_gen2', name: '骁龙8 Gen2', tier: '旗舰' },
  { id: 'snapdragon_8_gen1', name: '骁龙8 Gen1', tier: '旗舰' },
  { id: 'dimensity_9300', name: '天玑9300', tier: '旗舰' },
  { id: 'snapdragon_888', name: '骁龙888', tier: '高端' },
  { id: 'snapdragon_870', name: '骁龙870', tier: '高端' },
  { id: 'snapdragon_778g', name: '骁龙778G', tier: '中端' },
  { id: 'snapdragon_7_gen1', name: '骁龙7 Gen1', tier: '中端' },
  { id: 'dimensity_7200', name: '天玑7200', tier: '中端' },
  { id: 'snapdragon_695', name: '骁龙695', tier: '入门' },
];

const MOBILE_RAM_OPTIONS = [4, 6, 8, 12, 16];

const LAPTOP_CONFIGS = [
  { id: 'ultrabook', name: '轻薄本 (8GB/无独显)', ram: 8, hasGpu: false },
  { id: 'mainstream', name: '主流本 (16GB/无独显)', ram: 16, hasGpu: false },
  { id: 'gaming', name: '游戏本 (16GB/RTX 3060)', ram: 16, hasGpu: true, vram: 6 },
  { id: 'high_end', name: '高端本 (32GB/RTX 4070)', ram: 32, hasGpu: true, vram: 8 },
  { id: 'mac_m1', name: 'Mac M1/M2 (16GB统一内存)', ram: 16, hasGpu: true, vram: 16 },
  { id: 'mac_m3', name: 'Mac M3 Pro (18GB+统一内存)', ram: 18, hasGpu: true, vram: 18 },
];

function getRecommendation(chipId: string, ramGB: number): { model: string; size: string; speed: string; context: string } {
  const midRangeChips = ['snapdragon_778g', 'snapdragon_7_gen1', 'dimensity_7200', 'kirin_820'];
  const entryChips = ['snapdragon_695', 'snapdragon_680'];
  
  if (entryChips.includes(chipId)) {
    return { model: 'Qwen2-1.5B-Q4', size: '~1GB', speed: '1-2 t/s', context: '2K' };
  }
  
  if (midRangeChips.includes(chipId)) {
    if (ramGB >= 12) return { model: 'Qwen2-3B-Q8', size: '~3GB', speed: '2-4 t/s', context: '4K' };
    return { model: 'Qwen2-3B-Q4', size: '~2GB', speed: '2-4 t/s', context: '2K' };
  }
  
  if (ramGB >= 16) return { model: 'Qwen2-7B-Q8', size: '~7GB', speed: '10-15 t/s', context: '16K' };
  if (ramGB >= 12) return { model: 'Qwen2-7B-Q5', size: '~5GB', speed: '8-12 t/s', context: '8K' };
  if (ramGB >= 8) return { model: 'Qwen2-7B-Q4', size: '~4GB', speed: '8-10 t/s', context: '4K' };
  return { model: 'Qwen2-3B-Q4', size: '~2GB', speed: '5-8 t/s', context: '2K' };
}

function getLaptopRecommendation(configId: string): { model: string; size: string; speed: string; context: string } {
  switch (configId) {
    case 'ultrabook':
      return { model: 'Qwen2-3B-Q4 或 Phi-3-mini', size: '~2GB', speed: '3-5 t/s', context: '4K' };
    case 'mainstream':
      return { model: 'Qwen2-7B-Q4', size: '~4GB', speed: '5-10 t/s', context: '8K' };
    case 'gaming':
      return { model: 'Qwen2-7B-Q8', size: '~7GB', speed: '15-25 t/s', context: '16K' };
    case 'high_end':
      return { model: 'Qwen2-14B-Q4', size: '~8GB', speed: '20-30 t/s', context: '32K' };
    case 'mac_m1':
      return { model: 'Qwen2-7B-Q8', size: '~7GB', speed: '15-30 t/s', context: '16K' };
    case 'mac_m3':
      return { model: 'Qwen2-14B-Q6', size: '~12GB', speed: '25-40 t/s', context: '32K' };
    default:
      return { model: 'Qwen2-7B-Q4', size: '~4GB', speed: '5-10 t/s', context: '8K' };
  }
}

export function DeviceRecommendationSettings() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedChip, setSelectedChip] = useState('snapdragon_778g');
  const [selectedRam, setSelectedRam] = useState(16);
  const [selectedLaptop, setSelectedLaptop] = useState('mainstream');
  
  const mobileRec = getRecommendation(selectedChip, selectedRam);
  const laptopRec = getLaptopRecommendation(selectedLaptop);
  const selectedChipInfo = MOBILE_CHIPS.find(c => c.id === selectedChip);
  const selectedLaptopInfo = LAPTOP_CONFIGS.find(c => c.id === selectedLaptop);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid="device-recommendation-settings">
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">设备配置推荐</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10">三端架构</Badge>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
            <CardDescription>
              根据您的设备配置，获取最佳本地AI模型推荐
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-blue-500/30 bg-gradient-to-br from-blue-950/50 to-blue-900/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-400" />
                    <CardTitle className="text-base">手机端</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">选择芯片</Label>
                    <Select value={selectedChip} onValueChange={setSelectedChip}>
                      <SelectTrigger data-testid="select-mobile-chip" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOBILE_CHIPS.map(chip => (
                          <SelectItem key={chip.id} value={chip.id}>
                            {chip.name} ({chip.tier})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">内存大小</Label>
                    <Select value={String(selectedRam)} onValueChange={v => setSelectedRam(Number(v))}>
                      <SelectTrigger data-testid="select-mobile-ram" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOBILE_RAM_OPTIONS.map(ram => (
                          <SelectItem key={ram} value={String(ram)}>
                            {ram}GB RAM
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="rounded-lg bg-blue-950/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">推荐模型</span>
                      <Badge className="bg-blue-600">{mobileRec.model}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{mobileRec.size}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        <span>{mobileRec.speed}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{mobileRec.context}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <WifiOff className="h-3 w-3" />
                      <span>支持离线</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <strong>适用任务:</strong> 简单问候、离线对话、隐私模式
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-500/30 bg-gradient-to-br from-green-950/50 to-green-900/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-5 w-5 text-green-400" />
                    <CardTitle className="text-base">笔记本端</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">选择配置</Label>
                    <Select value={selectedLaptop} onValueChange={setSelectedLaptop}>
                      <SelectTrigger data-testid="select-laptop-config" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LAPTOP_CONFIGS.map(config => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="rounded-lg bg-green-950/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">推荐模型</span>
                      <Badge className="bg-green-600">{laptopRec.model}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{laptopRec.size}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        <span>{laptopRec.speed}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{laptopRec.context}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <WifiOff className="h-3 w-3" />
                      <span>支持离线</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <strong>适用任务:</strong> 日常对话、文档分析、本地备份
                  </div>
                  
                  <div className="text-xs text-amber-400/80">
                    <strong>安装命令:</strong><br/>
                    <code className="bg-black/30 px-1 rounded">ollama pull qwen2:7b</code>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-purple-900/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-purple-400" />
                    <CardTitle className="text-base">GPU服务器</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-purple-950/50 p-3 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">对话模型</span>
                        <Badge className="bg-purple-600">Qwen2-14B+</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        复杂分析、专家推理、长上下文
                      </div>
                    </div>
                    
                    <div className="border-t border-purple-500/20 pt-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">屏幕操作模型</span>
                        <Badge className="bg-amber-600">AutoGLM-9B</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        手机自动化、屏幕理解、任务执行
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">推荐显存</span>
                      <span className="text-purple-300">16GB+ (RTX 4090/A100)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">预估速度</span>
                      <span className="text-purple-300">30-50 t/s</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <strong>适用任务:</strong> 专家决策、复杂推理、屏幕自动化
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-amber-500/30 bg-gradient-to-r from-amber-950/30 to-orange-950/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <div className="font-medium text-amber-300">智能路由策略</div>
                    <div className="text-sm text-muted-foreground grid md:grid-cols-4 gap-3">
                      <div>
                        <div className="text-xs text-amber-400/70">简单问候</div>
                        <div>→ 手机本地</div>
                      </div>
                      <div>
                        <div className="text-xs text-amber-400/70">日常对话</div>
                        <div>→ 笔记本本地</div>
                      </div>
                      <div>
                        <div className="text-xs text-amber-400/70">复杂分析</div>
                        <div>→ GPU服务器</div>
                      </div>
                      <div>
                        <div className="text-xs text-amber-400/70">云端兜底</div>
                        <div>→ DashScope</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
