/**
 * RemotePCConsole (Mobile) - 吉麟远程控制台 1.0 (移动端版)
 *
 * 功能：设备列表、屏幕预览、触控控制、快捷操作
 * 布局：设备卡片列表 + 全屏控制模式
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw,
  Keyboard,
  MousePointerClick,
  Circle,
  Camera,
  Play,
  Square,
  Copy,
  Clipboard,
  X,
  ChevronRight,
  Power,
  Plus,
  Loader2,
  Signal,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApiQuery } from "@/lib/useApi";
import { cn } from "@/lib/utils";

// ==================== 类型定义 ====================

interface PCDevice {
  id: string;
  name: string;
  platform: "WINDOWS" | "MACOS" | "LINUX";
  osVersion: string;
  status: "OFFLINE" | "ONLINE" | "BUSY" | "ERROR";
  lastSeen: number;
  capabilities?: {
    screenCapture?: boolean;
    mouseControl?: boolean;
    keyboardControl?: boolean;
    clipboard?: boolean;
  };
}

interface ScreenFrame {
  width: number;
  height: number;
  data: string;
  timestamp: number;
}

// ==================== 常量 ====================

const STATUS_COLORS: Record<string, string> = {
  ONLINE: "bg-green-500",
  BUSY: "bg-yellow-500",
  ERROR: "bg-red-500",
  OFFLINE: "bg-gray-500",
};

const STATUS_TEXT: Record<string, string> = {
  ONLINE: "在线",
  BUSY: "忙碌",
  ERROR: "异常",
  OFFLINE: "离线",
};

const PLATFORM_TEXT: Record<string, string> = {
  WINDOWS: "Windows",
  MACOS: "macOS",
  LINUX: "Linux",
};

// 快捷操作
const QUICK_ACTIONS = [
  { id: "alt-tab", label: "Alt+Tab", keys: ["alt", "tab"] },
  { id: "win", label: "Win", keys: ["win"] },
  { id: "ctrl-c", label: "Ctrl+C", keys: ["ctrl", "c"] },
  { id: "ctrl-v", label: "Ctrl+V", keys: ["ctrl", "v"] },
  { id: "ctrl-a", label: "Ctrl+A", keys: ["ctrl", "a"] },
  { id: "esc", label: "Esc", keys: ["esc"] },
  { id: "alt-f4", label: "Alt+F4", keys: ["alt", "f4"] },
  { id: "enter", label: "Enter", keys: ["enter"] },
];

// ==================== 主组件 ====================

export default function RemotePCConsoleMobile() {
  // 设备列表查询
  const {
    data: devices = [],
    isLoading: devicesLoading,
    refetch: refetchDevices,
  } = useApiQuery(["/api/remote/devices"], async () => {
    const res = await fetch("/api/remote/devices");
    const data = await res.json();
    return (data.data || data.items || []) as PCDevice[];
  });

  // 状态
  const [selectedDevice, setSelectedDevice] = useState<PCDevice | null>(null);
  const [screenFrame, setScreenFrame] = useState<ScreenFrame | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [controlMode, setControlMode] = useState(false); // 是否进入全屏控制模式

  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 获取截图
  const refreshScreenshot = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch(`/api/remote/screenshot/${selectedDevice.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setScreenFrame(data.data);
      }
    } catch {
      // silent fail
    }
  }, [selectedDevice]);

  // 发送控制命令
  const sendCommand = useCallback(
    async (type: string, action: string, params: Record<string, unknown> = {}) => {
      if (!selectedDevice) return;
      try {
        await fetch(`/api/remote/control/${selectedDevice.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, action, params }),
        });
      } catch {
        toast.error("命令发送失败");
      }
    },
    [selectedDevice]
  );

  // 定时刷新（非流模式）
  useEffect(() => {
    if (!selectedDevice || isStreaming || !controlMode) return;
    refreshScreenshot();
    const interval = setInterval(refreshScreenshot, 3000);
    return () => clearInterval(interval);
  }, [selectedDevice, isStreaming, controlMode, refreshScreenshot]);

  // 初始化连接
  const initConnection = useCallback(
    async (device: PCDevice) => {
      setSelectedDevice(device);
      setScreenFrame(null);
      setIsConnected(false);
      setControlMode(true);

      // 尝试建立 WebSocket（桌面端守护进程连接）
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/remote-control`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          ws.send(
            JSON.stringify({
              type: "REGISTER",
              deviceId: device.id,
              deviceName: device.name,
              platform: device.platform,
            })
          );
          ws.send(JSON.stringify({ type: "SCREENSTREAM_START", data: { interval: 800 } }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "SCREEN_FRAME" && msg.data) {
            setScreenFrame(msg.data);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          setIsStreaming(false);
        };
      } catch {
        // WebSocket 不可用，降级为轮询
        setIsConnected(false);
        refreshScreenshot();
      }
    },
    [refreshScreenshot]
  );

  // 屏幕点击
  const handleScreenClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !screenFrame) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * screenFrame.width;
    const y = ((e.clientY - rect.top) / rect.height) * screenFrame.height;
    await sendCommand("MOUSE", "CLICK", { x, y });
    refreshScreenshot();
  };

  // 键盘输入
  const handleKeyboardInput = async () => {
    if (!textInput.trim()) return;
    await sendCommand("KEYBOARD", "TYPE", { text: textInput });
    setTextInput("");
    refreshScreenshot();
  };

  // 快捷键
  const handleQuickAction = async (keys: string[]) => {
    await sendCommand("KEYBOARD", "HOTKEY", { keys });
    refreshScreenshot();
  };

  // 断开连接
  const handleDisconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    setIsStreaming(false);
    setControlMode(false);
    setSelectedDevice(null);
    setScreenFrame(null);
  };

  // 在线设备
  const onlineCount = devices.filter((d) => d.status === "ONLINE").length;

  return (
    <SafeLayout
      headerTitle="远程控制"
      headerRight={
        <button
          onClick={() => refetchDevices()}
          className="p-2 text-gray-400 active:text-primary"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      }
      showBack={true}
    >
      <div className="space-y-5 pb-10">
        {/* 全屏控制模式 */}
        {controlMode && selectedDevice ? (
          <div className="space-y-4">
            {/* 控制头部 */}
            <div className="flex items-center justify-between p-4 rounded-[2.5rem] bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{selectedDevice.name}</p>
                  <p className="text-[9px] text-gray-500">
                    {PLATFORM_TEXT[selectedDevice.platform]} · {selectedDevice.osVersion}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5">
                  {isConnected ? (
                    <Wifi className="w-3 h-3 text-green-400" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-gray-500" />
                  )}
                  <span className="text-[9px] font-bold">
                    {isConnected ? "已连接" : "轮询模式"}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>

            {/* 屏幕预览区 */}
            <div
              ref={containerRef}
              onClick={handleScreenClick}
              className="relative rounded-[2rem] overflow-hidden bg-black border border-white/5 aspect-video cursor-crosshair active:bg-white/5"
            >
              {screenFrame ? (
                <img
                  src={`data:image/jpeg;base64,${screenFrame.data}`}
                  alt="PC Screen"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-3">
                  <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
                  <p className="text-xs text-gray-600">等待画面...</p>
                </div>
              )}
              {/* 左键/右键快捷 */}
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendCommand("MOUSE", "CLICK", { x: 0, y: 0, button: "left" });
                    refreshScreenshot();
                  }}
                  className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center active:scale-90 transition-all"
                >
                  <MousePointerClick className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendCommand("MOUSE", "CLICK", { x: 0, y: 0, button: "right" });
                    refreshScreenshot();
                  }}
                  className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center active:scale-90 transition-all"
                >
                  <Circle className="w-4 h-4 text-white" />
                </button>
              </div>
              {/* 刷新按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  refreshScreenshot();
                }}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center active:scale-90 transition-all"
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* 快捷操作网格 */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
                Quick Actions
              </p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.keys)}
                    disabled={!selectedDevice}
                    className="h-12 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-gray-400 uppercase tracking-wider active:scale-95 transition-all disabled:opacity-30"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 文字输入 */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
                Keyboard Input
              </p>
              <div className="flex gap-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleKeyboardInput()}
                  placeholder="输入文字..."
                  className="flex-1 h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={handleKeyboardInput}
                  disabled={!textInput.trim()}
                  className="h-12 px-5 bg-primary rounded-2xl text-xs font-black text-white uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  <Keyboard className="w-4 h-4" />
                  发送
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* 设备列表模式 */
          <>
            {/* 概览卡片 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-[2.5rem] bg-white/5 border border-white/5 text-center">
                <p className="text-2xl font-black text-white">{devices.length}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                  总设备
                </p>
              </div>
              <div className="p-4 rounded-[2.5rem] bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-2xl font-black text-green-400">{onlineCount}</p>
                <p className="text-[9px] text-green-400/70 uppercase tracking-widest font-bold mt-1">
                  在线
                </p>
              </div>
              <div className="p-4 rounded-[2.5rem] bg-white/5 border border-white/5 text-center">
                <p className="text-2xl font-black text-white">
                  {devices.length - onlineCount}
                </p>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                  离线
                </p>
              </div>
            </div>

            {/* 说明 */}
            <div className="p-5 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Signal className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-400">连接说明</p>
                  <p className="text-[9px] text-blue-400/60 mt-1 leading-relaxed">
                    请在目标 PC 上启动「吉麟守护进程」，完成设备注册后即可在此远程控制。
                    支持屏幕监控、鼠标键盘控制、剪贴板同步等功能。
                  </p>
                </div>
              </div>
            </div>

            {/* 设备列表 */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
                Device Registry ({devices.length})
              </h3>

              {devicesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-[2.5rem] bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-12">
                  <Monitor className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-sm text-gray-500">暂无在线设备</p>
                  <button
                    onClick={() => refetchDevices()}
                    className="mt-4 px-6 py-3 rounded-full bg-primary text-white text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
                  >
                    刷新设备
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() =>
                        device.status !== "OFFLINE"
                          ? initConnection(device)
                          : toast.error("设备离线，无法连接")
                      }
                      className={cn(
                        "w-full p-5 rounded-[2.5rem] bg-white/5 border transition-all active:scale-[0.98] flex items-center",
                        device.status === "ONLINE"
                          ? "border-green-500/20"
                          : "border-white/5 opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                          device.status === "ONLINE"
                            ? "bg-green-500/10"
                            : "bg-gray-700/50"
                        )}
                      >
                        <Monitor
                          className={cn(
                            "w-5 h-5",
                            device.status === "ONLINE"
                              ? "text-green-400"
                              : "text-gray-500"
                          )}
                        />
                      </div>
                      <div className="flex-1 text-left ml-3">
                        <p className="text-sm font-bold text-white truncate">
                          {device.name}
                        </p>
                        <p className="text-[9px] text-gray-500 mt-0.5">
                          {PLATFORM_TEXT[device.platform]} ·{" "}
                          {device.osVersion} ·{" "}
                          <span
                            className={cn(
                              device.status === "ONLINE"
                                ? "text-green-400"
                                : "text-gray-600"
                            )}
                          >
                            {STATUS_TEXT[device.status]}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            STATUS_COLORS[device.status]
                          )}
                        />
                        {device.status !== "OFFLINE" && (
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </SafeLayout>
  );
}
