/**
 * DesktopHome - Navigator-X 桌面端首页仪表盘
 *
 * 整合三大核心能力：
 * 1. 小星AI - 对话助手
 * 2. OpenClaw - 系统控制
 * 3. Navigator-X - 舰队协同
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Monitor, Zap, Terminal,
  Ship, FileText, Users, Sparkles, FolderKanban,
  Database, Settings, Bell, ChevronRight,
  Cpu, HardDrive, Clock, Activity,
  CheckCircle, AlertTriangle,
  Plus
} from "lucide-react";

interface DesktopUser {
  id: string;
  username: string;
  role: 'SOVEREIGN' | 'NODE';
}

function getUser(): DesktopUser | null {
  const stored = localStorage.getItem('desktop_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

// 快捷操作卡片
interface QuickAction {
  id: string;
  icon: typeof MessageCircle;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  path: string;
  sovereignOnly?: boolean;
}

const quickActions: QuickAction[] = [
  { id: 'chat', icon: MessageCircle, label: 'AI对话', description: '与小星对话', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20', path: '/desktop/chat' },
  { id: 'control', icon: Monitor, label: '远程控制', description: '控制PC设备', color: 'text-blue-400', bgColor: 'bg-blue-500/20', path: '/desktop/control' },
  { id: 'tasks', icon: Zap, label: '任务中心', description: '自动化任务', color: 'text-amber-400', bgColor: 'bg-amber-500/20', path: '/desktop/tasks' },
  { id: 'terminal', icon: Terminal, label: '命令终端', description: '执行命令', color: 'text-green-400', bgColor: 'bg-green-500/20', path: '/desktop/terminal' },
  { id: 'fleet', icon: Ship, label: '舰队管理', description: 'Navigator-X', color: 'text-purple-400', bgColor: 'bg-purple-500/20', path: '/desktop/fleet', sovereignOnly: true },
  { id: 'experts', icon: Users, label: '专家咨询', description: '五大专家', color: 'text-rose-400', bgColor: 'bg-rose-500/20', path: '/desktop/experts' },
];

// 类型定义
interface Device {
  id: string;
  name: string;
  status: string;
  platform: string;
}

interface Task {
  id: string;
  name: string;
  status: string;
  description?: string;
}

interface NavigatorStats {
  totalNodes: number;
  activeNodes: number;
  avgMoraleScore: number;
}

interface Report {
  id: string;
  nodeName: string;
  summary: string;
}

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: string;
  acknowledged: boolean;
}

interface SystemStatus {
  data?: {
    requests?: {
      avgResponseTimeMs?: number;
    };
  };
}

export default function DesktopHome() {
  const [location, setLocation] = useLocation();
  const [user] = useState<DesktopUser | null>(getUser());

  // 如果未登录，跳转到登录页
  useEffect(() => {
    if (!user) {
      setLocation('/desktop/login');
    }
  }, [user, setLocation]);

  // 获取系统状态
  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ['/api/telemetry/status'],
    refetchInterval: 10000,
  });

  // 获取远程设备状态
  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ['/api/remote/devices'],
    refetchInterval: 5000,
  });

  // 获取任务统计
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  // 获取Navigator状态
  const { data: navigatorStats } = useQuery<NavigatorStats>({
    queryKey: ['/api/navigator/stats'],
    refetchInterval: 5000,
  });

  // 获取待审批汇报
  const { data: pendingReports = [] } = useQuery<Report[]>({
    queryKey: ['/api/navigator/pending-reports'],
  });

  // 获取预警
  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['/api/navigator/alerts'],
  });

  // 在线设备数量
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;
  const activeTasks = tasks.filter((t) => t.status === 'ACTIVE').length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL' && !a.acknowledged).length;

  // 快捷操作（根据角色过滤）
  const visibleActions = quickActions.filter(a => !a.sovereignOnly || user?.role === 'SOVEREIGN');

  if (!user) {
    return null;
  }

  return (
    <div className="h-full overflow-auto">
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black">
                欢迎回来，{user.username}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {user.role === 'SOVEREIGN' ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1">
                  SOVEREIGN
                </Badge>
              ) : (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-3 py-1">
                  NODE
                </Badge>
              )}
              <Button variant="outline" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {(pendingReports.length > 0 || criticalAlerts > 0) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                    {pendingReports.length + criticalAlerts}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* 快捷操作 */}
          <div className="grid grid-cols-6 gap-3">
            {visibleActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => setLocation(action.path)}
                  className={cn(
                    "p-4 rounded-2xl border border-white/10 transition-all hover:scale-105 active:scale-95",
                    action.bgColor
                  )}
                >
                  <Icon className={cn("w-6 h-6 mb-2", action.color)} />
                  <p className="text-sm font-bold text-white">{action.label}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{action.description}</p>
                </button>
              );
            })}
          </div>

          {/* 主要内容区 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 左侧栏 - 系统状态 */}
            <div className="space-y-4">
              {/* 系统健康 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-400" />
                    系统状态
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-400" />
                      <span className="text-sm">CPU</span>
                    </div>
                    <span className="text-sm font-bold">
                      {systemStatus?.data?.requests?.avgResponseTimeMs || 45}%
                    </span>
                  </div>
                  <Progress value={systemStatus?.data?.requests?.avgResponseTimeMs || 45} className="h-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-purple-400" />
                      <span className="text-sm">内存</span>
                    </div>
                    <span className="text-sm font-bold">62%</span>
                  </div>
                  <Progress value={62} className="h-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-sm">运行时间</span>
                    </div>
                    <span className="text-sm font-bold">7天 12小时</span>
                  </div>
                </CardContent>
              </Card>

              {/* 在线设备 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-400" />
                    在线设备 ({onlineDevices})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {devices.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">暂无在线设备</p>
                  ) : (
                    <div className="space-y-2">
                      {devices.slice(0, 4).map((device) => (
                        <div key={device.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              device.status === 'ONLINE' ? "bg-green-500" : "bg-gray-500"
                            )} />
                            <span className="text-sm">{device.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {device.platform}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {devices.length > 4 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setLocation('/desktop/control')}>
                      查看全部 <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* 任务执行 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    任务执行
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <p className="text-2xl font-black">{tasks.length}</p>
                      <p className="text-[10px] text-gray-500">总任务</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <p className="text-2xl font-black text-green-400">{activeTasks}</p>
                      <p className="text-[10px] text-gray-500">进行中</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setLocation('/desktop/tasks')}>
                    <Plus className="w-4 h-4 mr-1" />
                    新建任务
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 中间栏 - Navigator-X (SOVEREIGN) 或 待办事项 */}
            <div className="space-y-4">
              {user.role === 'SOVEREIGN' ? (
                <>
                  {/* 舰队概览 */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Ship className="w-4 h-4 text-indigo-400" />
                        舰队概览
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-xl bg-indigo-500/10">
                          <p className="text-xl font-black">{navigatorStats?.totalNodes || 0}</p>
                          <p className="text-[10px] text-gray-400">总节点</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-green-500/10">
                          <p className="text-xl font-black text-green-400">{navigatorStats?.activeNodes || 0}</p>
                          <p className="text-[10px] text-gray-400">在线</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-amber-500/10">
                          <p className="text-xl font-black text-amber-400">{navigatorStats?.avgMoraleScore || 75}%</p>
                          <p className="text-[10px] text-gray-400">士气</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setLocation('/desktop/fleet')}>
                        管理舰队 <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 待审批汇报 */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        待审批汇报
                      </CardTitle>
                      <Badge variant="outline">{pendingReports.length}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {pendingReports.length === 0 ? (
                        <div className="text-center py-4">
                          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">暂无待审批汇报</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {pendingReports.slice(0, 3).map((report) => (
                            <div key={report.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                  <span className="text-xs font-bold text-blue-400">
                                    {report.nodeName?.slice(0, 2) || 'N'}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{report.nodeName}</p>
                                  <p className="text-[10px] text-gray-500">{report.summary?.slice(0, 20)}...</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setLocation('/desktop/reports')}>
                                审批
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 红线预警 */}
                  {alerts.filter((a) => !a.acknowledged).length > 0 && (
                    <Card className="bg-red-500/5 border-red-500/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          红线预警 ({alerts.filter((a) => !a.acknowledged).length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {alerts.filter((a) => !a.acknowledged).slice(0, 2).map((alert) => (
                          <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                            <div>
                              <p className="text-sm font-medium text-red-400">{alert.title}</p>
                              <p className="text-[10px] text-gray-400">{alert.description}</p>
                            </div>
                            <Badge className={cn(
                              alert.severity === 'CRITICAL' ? "bg-red-500" : "bg-orange-500"
                            )}>
                              {alert.severity}
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* 灵感广播 */}
                  <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                        <Sparkles className="w-4 h-4" />
                        灵感广播
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-400 mb-3">捕捉灵感，瞬间同步至全舰队</p>
                      <Button className="w-full bg-amber-500 hover:bg-amber-600" onClick={() => setLocation('/desktop/inspiration')}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        广播灵感
                      </Button>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* NODE: 我的任务 */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-400" />
                        我的任务
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {tasks.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">暂无分配任务</p>
                      ) : (
                        <div className="space-y-2">
                          {tasks.slice(0, 4).map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                              <div>
                                <p className="text-sm font-medium">{task.name}</p>
                                <p className="text-[10px] text-gray-500">{task.description?.slice(0, 30)}...</p>
                              </div>
                              <Button size="sm" variant="outline">
                                执行
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* NODE: 草案生成 */}
                  <Card className="bg-indigo-500/5 border-indigo-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-indigo-400">
                        <FileText className="w-4 h-4" />
                        草案生成
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-400 mb-3">AI辅助生成工作汇报草案</p>
                      <Button className="w-full bg-indigo-500 hover:bg-indigo-600" onClick={() => setLocation('/desktop/draft')}>
                        <Plus className="w-4 h-4 mr-2" />
                        生成草案
                      </Button>
                    </CardContent>
                  </Card>

                  {/* NODE: 灵感记录 */}
                  <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                        <Sparkles className="w-4 h-4" />
                        灵感记录
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-400 mb-3">记录工作中的灵感火花</p>
                      <Button variant="outline" className="w-full border-amber-500/20 text-amber-400" onClick={() => setLocation('/desktop/ideas')}>
                        <Plus className="w-4 h-4 mr-2" />
                        记录灵感
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* 右侧栏 - 快捷功能和系统信息 */}
            <div className="space-y-4">
              {/* 五大专家 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    五大专家
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { name: '法务', color: 'text-blue-400', bg: 'bg-blue-500/20' },
                      { name: '财务', color: 'text-green-400', bg: 'bg-green-500/20' },
                      { name: '策划', color: 'text-purple-400', bg: 'bg-purple-500/20' },
                      { name: '心理', color: 'text-rose-400', bg: 'bg-rose-500/20' },
                      { name: '秘书', color: 'text-amber-400', bg: 'bg-amber-500/20' },
                    ].map((expert) => (
                      <button
                        key={expert.name}
                        className={cn(
                          "p-2 rounded-xl text-center transition-all hover:scale-105",
                          expert.bg
                        )}
                        onClick={() => setLocation('/desktop/experts')}
                      >
                        <p className={cn("text-[10px] font-bold", expert.color)}>{expert.name}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 办公功能 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-cyan-400" />
                    办公功能
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { icon: FolderKanban, label: '项目管理', path: '/desktop/projects' },
                    { icon: Users, label: '人脉管理', path: '/desktop/contacts' },
                    { icon: Database, label: '数字金库', path: '/desktop/vault' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => setLocation(item.path)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              {/* 系统设置 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-400" />
                    系统
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <button
                    onClick={() => setLocation('/desktop/settings')}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <span className="text-sm">系统设置</span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setLocation('/desktop/login')}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-all text-red-400"
                  >
                    <span className="text-sm">退出登录</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
