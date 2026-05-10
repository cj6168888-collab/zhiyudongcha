# Sheng-Yu-Zhu-Shou 修复升级计划

> 基于全系统代码扫描报告 (2026-03-16)
> 扫描范围: 600+ TypeScript/React 文件, 22 Android 原生文件

---

## 执行摘要

| 类别 | 数量 |
|------|------|
| 🔴 高危安全漏洞 | 2 |
| 🟡 中危安全问题 | 3 |
| 🟠 代码错误 | 4 |
| 🟢 逻辑阻塞风险 | 3 |

---

## 第一阶段: 高优先级修复 (立即执行)

### 1.1 XSS 跨站脚本攻击漏洞修复 🔴

**问题位置**: `client/src/lib/error/global-error-handler.ts:97`

**当前问题代码**:
```typescript:97:136:client/src/lib/error/global-error-handler.ts
dialog.innerHTML = `
  <div style="...">
    <p>${message}</p>  // 未经转义的 message
  </div>
`;
```

**修复方案**: 使用 DOM API 替代 innerHTML，防止 XSS 攻击

**修复代码**:
```typescript
// 创建容器
const container = document.createElement('div');
container.style.cssText = `
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  font-family: system-ui, -apple-system, sans-serif;
`;

// 创建对话框
const dialog = document.createElement('div');
dialog.style.cssText = `
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;

// 使用 textContent 防止 XSS
const title = document.createElement('h2');
title.style.cssText = 'margin: 0 0 16px; color: #D32F2F; font-size: 18px;';
title.textContent = '⚠️ 发生错误';

const messagePara = document.createElement('p');
messagePara.style.cssText = 'margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.5;';
messagePara.textContent = message;

const button = document.createElement('button');
button.id = 'reload-btn';
button.style.cssText = `
  padding: 8px 16px;
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
`;
button.textContent = '刷新页面';

// 组装 DOM
dialog.appendChild(title);
dialog.appendChild(messagePara);
container.appendChild(dialog);
document.body.appendChild(container);
```

**预期效果**: 消除 XSS 攻击风险，错误消息中的任何恶意代码都将被转义

---

### 1.2 WebSocket 自动重连机制 🔴

#### 1.2.1 InsightChamber.tsx (商务聆听舱)

**问题位置**: `client/src/pages/mobile/InsightChamber.tsx:17-24`

**当前问题**: WebSocket 断开后无重连机制

**修复方案**: 添加指数退避重连逻辑

```typescript
// 新增重连配置
const RECONNECT_CONFIG = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

export default function InsightChamber() {
  const [isRecording, setIsRecording] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  // 安全的 WebSocket 连接（含重连）
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}/ws/realtime-voice`);
    ws.current.binaryType = 'arraybuffer';
    
    ws.current.onopen = () => {
      console.log("Z3 Voice Channel Linked");
      reconnectAttempts.current = 0;
    };
    
    ws.current.onerror = () => toast.error("Z3 语音协议链路故障");
    
    ws.current.onclose = () => {
      // 自动重连逻辑
      if (reconnectAttempts.current < RECONNECT_CONFIG.maxAttempts) {
        const delay = Math.min(
          RECONNECT_CONFIG.baseDelay * Math.pow(2, reconnectAttempts.current),
          RECONNECT_CONFIG.maxDelay
        );
        
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
        
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, delay);
      } else {
        toast.error("连接失败，请刷新页面重试");
      }
    };
  }, []);

  // 清理函数
  useEffect(() => {
    connectWebSocket();
    return () => {
      reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
      ws.current?.close();
    };
  }, [connectWebSocket]);
  
  // 停止录制时清理重连
  const handleStop = () => {
    mediaRecorder.current?.stop();
    reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
    setIsRecording(false);
    toast.info("同步已封包，正在生成洞察摘要...");
  };
}
```

#### 1.2.2 remote-pc-console.tsx (远程控制台)

**问题位置**: `client/src/pages/remote-pc-console.tsx:208-263`

**当前问题**: WebSocket 断开后仅打印日志，无重连机制

**修复方案**: 同样添加指数退避重连，并添加连接状态指示器

```typescript
// 在组件内添加
const reconnectAttempts = useRef(0);
const reconnectTimeout = useRef<NodeJS.Timeout>();

// 修改 onclose 回调
ws.onclose = () => {
  console.log('WebSocket disconnected');
  setIsConnected(false);
  setIsStreaming(false);
  
  // 自动重连
  if (selectedDevice && reconnectAttempts.current < 5) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectTimeout.current = setTimeout(() => {
      reconnectAttempts.current++;
      connectWebSocket();
    }, delay);
  }
};

// 组件卸载时清理
useEffect(() => {
  return () => {
    reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
    wsRef.current?.close();
  };
}, []);
```

---

### 1.3 定时器内存泄漏修复 🔴

**问题位置**: `client/src/components/avatar/avatar-modes.tsx:49-63`

**当前问题代码**:
```typescript:49:63:client/src/components/avatar/avatar-modes.tsx
useEffect(() => {
  if (mode === 'anime') {
    if (hpPercentage < 20) {
      setAnimeState('tired');
    } else if (hpPercentage > 80) {
      const interval = setInterval(() => {
        setAnimeState('wave');
        setTimeout(() => setAnimeState('idle'), 1500);  // 内层 setTimeout 未清理
      }, 8000);
      return () => clearInterval(interval);  // 外层清理了，但内层泄漏
    } else {
      setAnimeState('idle');
    }
  }
}, [mode, hpPercentage]);
```

**修复方案**: 使用 ref 存储定时器 ID，确保所有定时器都能被清理

```typescript
const timeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  if (mode === 'anime') {
    // 清理之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (hpPercentage < 20) {
      setAnimeState('tired');
    } else if (hpPercentage > 80) {
      const interval = setInterval(() => {
        setAnimeState('wave');
        // 保存内层定时器 ID
        timeoutRef.current = setTimeout(() => setAnimeState('idle'), 1500);
      }, 8000);
      
      return () => {
        clearInterval(interval);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      setAnimeState('idle');
    }
  }
  
  // 组件卸载时清理
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}, [mode, hpPercentage]);
```

---

## 第二阶段: 中优先级修复 (本周内)

### 2.1 生产环境日志清理 🟡

**涉及文件**:
- `client/src/lib/sync/sync-controller.ts` - 5 处
- `client/src/pages/remote-pc-console.tsx` - 6 处
- `client/src/main-accessible.tsx` - 7 处

**建议方案**: 替换为统一的日志框架

```typescript
// 创建日志工具
// client/src/lib/logger.ts
const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isProduction) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (!isProduction) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
    // 可选: 上报生产环境错误
  },
};
```

---

### 2.2 React Error Boundary 添加 🟡

**涉及组件**:
- `ExpertWorkstation.tsx`
- `BusinessHub.tsx`
- 其他大型页面组件

**修复方案**: 创建可复用的 Error Boundary 组件

```typescript
// client/src/components/error/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <h2>出现了一些问题</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

### 2.3 localStorage 安全审查 🟡

**涉及文件**:
- `client/src/hooks/use-secure-storage.ts`
- `client/src/pages/mobile/IdentityControl.tsx`

**建议方案**:

| 当前方案 | 建议方案 | 适用场景 |
|---------|---------|---------|
| localStorage | sessionStorage | 临时会话数据 |
| localStorage | httpOnly Cookie | 敏感凭证 |
| localStorage | 加密存储 | 需要持久化的敏感数据 |

---

## 第三阶段: 低优先级优化 (计划内)

### 3.1 统一错误日志格式 🟢

建议使用结构化日志格式，便于日志分析:

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}
```

### 3.2 请求重试机制 🟢

已在 `client/src/lib/queryClient.ts` 中实现带指数退避的重试机制:
- 最大重试次数: 3
- 可重试状态码: 408, 429, 500, 502, 503, 504
- 退避延迟: 1s → 2s → 4s (最大 10s)

### 3.3 单元测试覆盖 🟢

建议优先为以下模块添加测试:
1. Error Boundary 行为
2. WebSocket 重连逻辑
3. 定时器清理逻辑

---

## 进度追踪

| 任务 | 状态 |
|------|------|
| XSS 漏洞修复 (global-error-handler) | ✅ 已完成 |
| WebSocket 重连 (InsightChamber) | ✅ 已完成 |
| WebSocket 重连 (remote-pc-console) | ✅ 已完成 |
| 定时器泄漏修复 (avatar-modes) | ✅ 已完成 |
| 日志框架集成 | ✅ 已完成 |
| Error Boundary 添加 | ✅ 已完成 |
| localStorage 安全审查 | ✅ 已完成 |
| 请求重试机制 | ✅ 已完成 |
| chart.tsx XSS 审查 | ✅ 已完成（安全） |

---

## 附录: 风险等级说明

| 等级 | 说明 |
|------|------|
| 🔴 高 | 必须立即修复，存在安全风险或严重 bug |
| 🟡 中 | 近期修复，影响用户体验或存在潜在风险 |
| 🟢 低 | 计划修复，属于优化项 |
