/**
 * DesktopTerminal - 桌面端命令终端页面
 *
 * 功能：
 * - 执行系统命令
 * - 查看命令历史
 * - 支持快捷命令
 */
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Terminal, Play, Trash2, Copy, Download, Clock,
  AlertCircle, CheckCircle, Loader2, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// 命令类型
interface Command {
  id: string;
  command: string;
  output: string;
  status: 'success' | 'error' | 'running';
  timestamp: Date;
  duration?: number;
}

// 快捷命令
const quickCommands = [
  { label: '系统信息', command: 'system:info' },
  { label: '清理缓存', command: 'system:clear-cache' },
  { label: '网络诊断', command: 'network:ping' },
  { label: '磁盘使用', command: 'disk:usage' },
  { label: '进程列表', command: 'process:list' },
  { label: '日志查看', command: 'logs:tail' },
];

export default function DesktopTerminal() {
  const [commands, setCommands] = useState<Command[]>([
    {
      id: '1',
      command: 'system:info',
      output: `操作系统: Windows 11 Pro
处理器: Intel(R) Core(TM) i7-12700K
内存: 32GB DDR5
磁盘: 1TB NVMe SSD
网络: 已连接 (1000Mbps)
运行时间: 7天 12小时 34分`,
      status: 'success',
      timestamp: new Date(Date.now() - 300000),
      duration: 234,
    },
    {
      id: '2',
      command: 'network:ping baidu.com',
      output: `正在 Ping baidu.com [220.181.38.149]:
Reply from 220.181.38.149: 时间=12ms TTL=54
Reply from 220.181.38.149: 时间=11ms TTL=54
Reply from 220.181.38.149: 时间=13ms TTL=54
Reply from 220.181.38.149: 时间=12ms TTL=54

Ping 统计:
    数据包: 已发送=4, 已接收=4, 丢失=0 (0%丢失)`,
      status: 'success',
      timestamp: new Date(Date.now() - 180000),
      duration: 1234,
    },
  ]);

  const [input, setInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commands]);

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    const newCommand: Command = {
      id: Date.now().toString(),
      command: cmd,
      output: '',
      status: 'running',
      timestamp: new Date(),
    };

    setCommands(prev => [...prev, newCommand]);
    setInput("");
    setIsExecuting(true);

    // 模拟命令执行
    setTimeout(() => {
      const result: Command = {
        ...newCommand,
        status: 'success',
        output: simulateCommandOutput(cmd),
        duration: Math.floor(Math.random() * 500) + 100,
      };

      setCommands(prev => prev.map(c => c.id === newCommand.id ? result : c));
      setIsExecuting(false);
    }, 1000 + Math.random() * 1000);
  };

  const simulateCommandOutput = (cmd: string): string => {
    const cmdLower = cmd.toLowerCase();

    if (cmdLower.includes('system:info')) {
      return `操作系统: Windows 11 Pro
处理器: Intel(R) Core(TM) i7-12700K
内存: 32GB DDR5
磁盘: 1TB NVMe SSD
网络: 已连接 (1000Mbps)`;
    }

    if (cmdLower.includes('clear-cache') || cmdLower.includes('清理')) {
      return `正在清理缓存...
✓ 清理临时文件 (2.3GB)
✓ 清理浏览器缓存 (456MB)
✓ 清理系统日志
缓存清理完成，释放空间: 2.8GB`;
    }

    if (cmdLower.includes('ping') || cmdLower.includes('网络')) {
      return `正在 Ping 目标主机...
Reply from 220.181.38.149: 时间=12ms TTL=54
Reply from 220.181.38.149: 时间=11ms TTL=54
Ping 统计: 丢失=0 (0%丢失)`;
    }

    if (cmdLower.includes('disk') || cmdLower.includes('磁盘')) {
      return `磁盘使用情况:
C:\\  465GB / 512GB  [90%] ██████████░
D:\\  780GB / 1TB    [78%] ███████░░░
E:\\  120GB / 256GB  [47%] ████░░░░░░`;
    }

    if (cmdLower.includes('process') || cmdLower.includes('进程')) {
      return `进程列表 (前5个):
  PID    名称                    内存
 1234    chrome.exe              1.2GB
 5678    code.exe                856MB
 9012    node.exe                234MB
 3456    explorer.exe             89MB
 7890    discord.exe             156MB`;
    }

    if (cmdLower.includes('logs') || cmdLower.includes('日志')) {
      return `[2026-04-19 10:30:15] INFO: System initialized
[2026-04-19 10:30:16] INFO: Database connected
[2026-04-19 10:30:18] WARN: High memory usage detected
[2026-04-19 10:30:20] INFO: User session created
[2026-04-19 10:30:25] ERROR: Connection timeout (retrying...)`;
    }

    return `命令 "${cmd}" 已执行完成`;
  };

  const clearHistory = () => {
    setCommands([]);
  };

  const copyCommand = (cmd: Command) => {
    navigator.clipboard.writeText(cmd.output);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* 顶部栏 */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h1 className="text-sm font-bold text-white">命令终端</h1>
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
            SOVEREIGN
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearHistory}>
            <Trash2 className="w-4 h-4 mr-1" />
            清空
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {}}>
            <Download className="w-4 h-4 mr-1" />
            导出
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 快捷命令侧边栏 */}
        <div className="w-48 border-r border-white/10 bg-black/20 p-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">快捷命令</h3>
          <div className="space-y-1">
            {quickCommands.map((qc) => (
              <button
                key={qc.command}
                onClick={() => executeCommand(qc.command)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center justify-between"
              >
                <span>{qc.label}</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">系统状态</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">CPU</span>
                <span className="text-green-400">23%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">内存</span>
                <span className="text-yellow-400">67%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">磁盘</span>
                <span className="text-blue-400">45%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 终端主体 */}
        <div className="flex-1 flex flex-col">
          {/* 命令输出区域 */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {commands.length === 0 && (
                <div className="text-center py-12">
                  <Terminal className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">输入命令开始执行</p>
                </div>
              )}

              {commands.map((cmd) => (
                <div key={cmd.id} className="space-y-2">
                  {/* 命令行 */}
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-mono text-sm">❯</span>
                    <span className="text-gray-300 font-mono text-sm">{cmd.command}</span>
                    <span className="text-gray-600 text-xs ml-auto">
                      {cmd.timestamp.toLocaleTimeString('zh-CN')}
                      {cmd.duration && ` · ${cmd.duration}ms`}
                    </span>
                  </div>

                  {/* 输出 */}
                  <Card className={cn(
                    "bg-black/40 border-0",
                    cmd.status === 'running' && "border-l-2 border-green-500",
                    cmd.status === 'success' && "border-l-2 border-blue-500",
                    cmd.status === 'error' && "border-l-2 border-red-500"
                  )}>
                    <CardContent className="p-3">
                      {cmd.status === 'running' ? (
                        <div className="flex items-center gap-2 text-green-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">执行中...</span>
                        </div>
                      ) : (
                        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {cmd.output}
                        </pre>
                      )}
                    </CardContent>
                  </Card>

                  {/* 操作按钮 */}
                  {cmd.status !== 'running' && (
                    <div className="flex items-center gap-2 ml-6">
                      <button
                        onClick={() => copyCommand(cmd)}
                        className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        复制
                      </button>
                      <button
                        onClick={() => executeCommand(cmd.command)}
                        className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        重复执行
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* 输入区 */}
          <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/20">
            <div className="flex items-center gap-2 bg-[#0d0d0d] rounded-lg px-4 py-2 border border-green-500/30 focus-within:border-green-500/60">
              <Terminal className="w-4 h-4 text-green-400 shrink-0" />
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeCommand(input)}
                placeholder="输入命令... (输入 help 查看帮助)"
                className="flex-1 bg-transparent border-none text-green-300 font-mono text-sm placeholder:text-gray-600 focus-visible:ring-0"
                disabled={isExecuting}
              />
              <Button
                size="sm"
                className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                onClick={() => executeCommand(input)}
                disabled={isExecuting || !input.trim()}
              >
                <Play className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[10px] text-gray-600">
                按 Enter 执行命令 · Ctrl+L 清空屏幕 · Ctrl+C 取消
              </p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-gray-600">就绪</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
