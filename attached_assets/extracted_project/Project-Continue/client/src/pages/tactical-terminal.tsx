import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Smartphone, Glasses, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useZ1Store } from '@/lib/z1/god-protocol';
import { useZ3Store } from '@/lib/z3/spirit-core';
import { tacticalTerminal, Z5State, PerceptionResult } from '@/lib/z5/tactical-terminal';
import { GenesisAnimation } from '@/components/z5/genesis-animation';
import { DualModeInterface } from '@/components/z5/dual-mode-interface';
import { PerceptionEngine } from '@/components/z5/perception-engine';
import { MockOpLayer } from '@/components/z5/mock-op-layer';
import { GlobalWakeHeader } from '@/components/ui/global-wake-header';

export default function TacticalTerminalPage() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const { hp, level } = useZ3Store();
  
  const [showGenesis, setShowGenesis] = useState(true);
  const [z5State, setZ5State] = useState<Z5State>(tacticalTerminal.getState());
  const [activeTab, setActiveTab] = useState('interface');
  
  useEffect(() => {
    const unsubscribe = tacticalTerminal.subscribe(setZ5State);
    
    tacticalTerminal.bootSequence().then((validated) => {
      console.log('Z5 boot sequence complete, validated:', validated);
    });
    
    return unsubscribe;
  }, []);
  
  const handleGenesisComplete = (validated: boolean) => {
    setShowGenesis(false);
    
    if (validated) {
      toast({
        title: "身份验证成功",
        description: "MASTER 指挥权限已激活",
        className: "border-cyan-500 text-cyan-500",
      });
    } else {
      toast({
        title: "访客模式",
        description: "部分功能受限，请配置 API Key",
        variant: "destructive",
      });
    }
  };
  
  const handleRiskDetected = (result: PerceptionResult) => {
    toast({
      title: "⚠️ 风险检测",
      description: result.warningText || "检测到潜在风险",
      variant: "destructive",
    });
  };
  
  const handleModeChange = (mode: 'BUBBLE' | 'AVATAR') => {
    tacticalTerminal.setViewMode(mode);
  };
  
  return (
    <>
      <AnimatePresence>
        {showGenesis && (
          <GenesisAnimation onComplete={handleGenesisComplete} />
        )}
      </AnimatePresence>
      
      <MockOpLayer />
      
      <div className="min-h-screen bg-slate-900 text-slate-100" data-testid="page-tactical-terminal">
        <div className="container mx-auto px-4 py-4">
          <GlobalWakeHeader 
            title="Z5 战术终端" 
            subtitle="移动端全量战术系统"
            rightActions={
              <div className="flex items-center gap-2">
                <Badge 
                  variant={role === 'MASTER' ? 'default' : 'secondary'}
                  className={role === 'MASTER' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : ''}
                >
                  {role === 'MASTER' ? '指挥官' : '访客'}
                </Badge>
                
                {role === 'MASTER' && (
                  <Button variant="ghost" size="icon" data-testid="button-settings">
                    <Settings className="w-5 h-5" />
                  </Button>
                )}
              </div>
            }
          />
        </div>
        
        <main className="container mx-auto px-4 pt-6 pb-24 md:pb-6 space-y-6">
          <Card className="border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{hp}%</div>
                  <div className="text-xs text-slate-400">生命值</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-400">Lv.{level}</div>
                  <div className="text-xs text-slate-400">进化等级</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {z5State.genesisComplete ? '在线' : '离线'}
                  </div>
                  <div className="text-xs text-slate-400">连接状态</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800">
              <TabsTrigger value="interface" data-testid="tab-interface">
                形象系统
              </TabsTrigger>
              <TabsTrigger value="perception" data-testid="tab-perception">
                感知引擎
              </TabsTrigger>
              <TabsTrigger value="automation" data-testid="tab-automation">
                自主执行
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="interface" className="mt-4">
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    双模态视觉系统
                    <Badge variant="outline" className="text-xs">
                      {z5State.viewMode === 'BUBBLE' ? '商务气泡' : '二次元形象'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DualModeInterface
                      mode={z5State.viewMode}
                      onModeChange={handleModeChange}
                      hp={hp}
                      level={level}
                    />
                  </div>
                  
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">操作提示</h4>
                    <ul className="text-xs text-slate-400 space-y-1">
                      <li>• <strong>商务气泡模式</strong>：长按开启语音速记，拖拽至文件触发审计</li>
                      <li>• <strong>二次元形象</strong>：实时 3D 渲染，HP 过低时显示疲劳状态</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="perception" className="mt-4">
              {role === 'MASTER' ? (
                <PerceptionEngine onRiskDetected={handleRiskDetected} />
              ) : (
                <Card className="border-slate-700 bg-slate-800/50">
                  <CardContent className="py-12 text-center">
                    <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-400">权限受限</h3>
                    <p className="text-sm text-slate-500 mt-2">
                      感知引擎需要 MASTER 权限才能使用
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="automation" className="mt-4 space-y-4">
              {role === 'MASTER' ? (
                <>
                  <MockOpLayer />
                  
                  <Card className="border-slate-700 bg-slate-800/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Glasses className="w-4 h-4" />
                        设备兼容性
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-900/50 rounded-lg">
                          <Smartphone className="w-6 h-6 text-cyan-400 mb-2" />
                          <h4 className="text-sm font-medium">手机终端</h4>
                          <p className="text-xs text-slate-400 mt-1">触控优化，手势识别</p>
                          <Badge variant="default" className="mt-2 text-xs">已适配</Badge>
                        </div>
                        <div className="p-3 bg-slate-900/50 rounded-lg">
                          <Glasses className="w-6 h-6 text-amber-400 mb-2" />
                          <h4 className="text-sm font-medium">AR 眼镜</h4>
                          <p className="text-xs text-slate-400 mt-1">HUD 显示，语音控制</p>
                          <Badge variant="secondary" className="mt-2 text-xs">开发中</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-slate-700 bg-slate-800/50">
                  <CardContent className="py-12 text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-400">访客模式限制</h3>
                    <p className="text-sm text-slate-500 mt-2">
                      自主执行功能仅对 MASTER 开放
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
          
          {role !== 'MASTER' && (
            <motion.div
              className="fixed bottom-4 left-4 right-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-amber-400">访客模式</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    您当前处于访客模式。如需使用全部功能，请返回 Dashboard 激活 MASTER 权限。
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </main>
      </div>
    </>
  );
}
