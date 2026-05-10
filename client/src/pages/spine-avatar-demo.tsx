/**
 * Spine骨骼动画头像演示页面
 */

import { useState } from 'react';
import { SpineAvatar } from '@/components/avatar/spine-avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type PoseType = 'front' | 'side' | 'back' | 'sitting' | 'phone_side' | 'backpack_front' | 'thinking';

const POSE_OPTIONS: { value: PoseType; label: string; emoji: string }[] = [
  { value: 'front', label: '正面', emoji: '👋' },
  { value: 'side', label: '侧面', emoji: '👤' },
  { value: 'back', label: '背面', emoji: '🔙' },
  { value: 'sitting', label: '盘坐', emoji: '🧘' },
  { value: 'phone_side', label: '看手机', emoji: '📱' },
  { value: 'backpack_front', label: '背书包', emoji: '🎒' },
  { value: 'thinking', label: '思考', emoji: '🤔' },
];

export default function SpineAvatarDemo() {
  const [mode, setMode] = useState<'DEFAULT' | 'WORK' | 'PROTECT'>('DEFAULT');
  const [pose, setPose] = useState<PoseType>('front');
  const [enablePhysics, setEnablePhysics] = useState(true);
  const [enableLookAt, setEnableLookAt] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [interactionLog, setInteractionLog] = useState<string[]>([]);

  const handleInteraction = (type: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setInteractionLog(prev => [`[${timestamp}] ${type}`, ...prev].slice(0, 10));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-400 mb-2">
            小星 骨骼动画系统
          </h1>
          <p className="text-slate-400">
            Pixar风格3D角色 · 多姿势切换 · 物理马尾/裙摆 · 眼神跟随 · 呼吸状态机
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-amber-400">实时预览</CardTitle>
                <CardDescription>
                  移动鼠标查看眼神跟随，点击触发开心动画
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="relative flex items-center justify-center min-h-[400px] rounded-lg"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(251, 191, 36, 0.1) 0%, transparent 70%)',
                  }}
                >
                  <SpineAvatar
                    width={250}
                    height={350}
                    mode={mode}
                    pose={pose}
                    enablePhysics={enablePhysics}
                    enableLookAt={enableLookAt}
                    showDebug={showDebug}
                    onInteraction={handleInteraction}
                  />
                </div>

                <div className="mt-6">
                  <Label className="text-slate-300 mb-3 block">姿势选择</Label>
                  <div className="flex flex-wrap gap-2">
                    {POSE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={pose === option.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPose(option.value)}
                        className={pose === option.value ? 'bg-amber-500 hover:bg-amber-600' : ''}
                        data-testid={`pose-${option.value}`}
                      >
                        <span className="mr-1">{option.emoji}</span>
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl mb-1">🦴</div>
                    <div className="text-sm text-slate-400">骨骼数量</div>
                    <div className="text-lg font-bold text-amber-400">14</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">🎬</div>
                    <div className="text-sm text-slate-400">动画数量</div>
                    <div className="text-lg font-bold text-amber-400">4</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">⚡</div>
                    <div className="text-sm text-slate-400">物理骨骼</div>
                    <div className="text-lg font-bold text-amber-400">7</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">🎭</div>
                    <div className="text-sm text-slate-400">姿势数量</div>
                    <div className="text-lg font-bold text-amber-400">{POSE_OPTIONS.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-amber-400">控制面板</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-slate-300 mb-3 block">模式切换</Label>
                  <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                    <TabsList className="grid grid-cols-3 bg-slate-700">
                      <TabsTrigger value="DEFAULT" data-testid="tab-default">默认</TabsTrigger>
                      <TabsTrigger value="WORK" data-testid="tab-work">工作</TabsTrigger>
                      <TabsTrigger value="PROTECT" data-testid="tab-protect">守护</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="physics" className="text-slate-300">物理模拟</Label>
                    <Switch
                      id="physics"
                      checked={enablePhysics}
                      onCheckedChange={setEnablePhysics}
                      data-testid="switch-physics"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    启用马尾和裙摆的惯性摆动效果
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lookat" className="text-slate-300">眼神跟随</Label>
                    <Switch
                      id="lookat"
                      checked={enableLookAt}
                      onCheckedChange={setEnableLookAt}
                      data-testid="switch-lookat"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    小星的眼睛和头部会在15度范围内跟随鼠标
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="debug" className="text-slate-300">调试信息</Label>
                    <Switch
                      id="debug"
                      checked={showDebug}
                      onCheckedChange={setShowDebug}
                      data-testid="switch-debug"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    显示骨骼动画参数实时数值
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-amber-400">交互日志</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {interactionLog.length === 0 ? (
                    <p className="text-slate-500 text-sm">等待交互...</p>
                  ) : (
                    interactionLog.map((log, i) => (
                      <div key={i} className="text-sm text-slate-400 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {log.includes('click') ? '点击' : '悬停'}
                        </Badge>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-amber-400">角色设计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-400 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">风格:</span>
                    Pixar 3D渲染
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">年龄:</span>
                    7-8岁亚洲小女孩
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">发型:</span>
                    黑色双马尾辫
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">服装:</span>
                    白色科技风装，青色装饰
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">配件:</span>
                    智能手环、透明书包
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-amber-400">技术特性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-lg font-bold text-blue-400 mb-1">精灵表抠图</div>
                <p className="text-sm text-slate-400">
                  从角色模型表中裁剪单独姿势，支持多视角和表情
                </p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-lg font-bold text-purple-400 mb-1">物理模拟</div>
                <p className="text-sm text-slate-400">
                  弹簧-阻尼系统模拟惯性、重力和风力效果
                </p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-lg font-bold text-green-400 mb-1">LookAt系统</div>
                <p className="text-sm text-slate-400">
                  眼睛和头部骨骼在±15度范围内丝滑跟随视线目标
                </p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="text-lg font-bold text-amber-400 mb-1">呼吸状态机</div>
                <p className="text-sm text-slate-400">
                  持续运行的呼吸动画配合透明度微调，营造数字生命感
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
