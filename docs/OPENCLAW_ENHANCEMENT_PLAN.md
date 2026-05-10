# 小智AI - OpenClaw风格功能增强计划

> 版本: 1.0  
> 日期: 2026-03-13  
> 状态: 规划完成，等待实施

---

## 一、目标概述

将小智AI增强为支持以下三大核心功能的系统：

| 优先级 | 功能 | 描述 |
|:------:|------|------|
| P0 | 📱→💻 手机远程控制PC | 手机端操控电脑，任务结果自动回传 |
| P1 | ❤️ 心跳任务系统 | 设备定时向服务器汇报状态，支持定时/条件触发任务 |
| P2 | ⚙️ 底层设备操控 | 统一控制PC和手机，完成复杂自动化任务 |

---

## 二、现有能力分析

### 2.1 已有的基础设施

| 组件 | 位置 | 功能 |
|------|------|------|
| `PCExecutorService` | `server/services/mobile/PCExecutorService.ts` | PyAutoGUI鼠标键盘控制 |
| `MobileExecutorService` | `server/services/mobile/MobileExecutorService.ts` | Android无障碍服务控制 |
| `DesktopExecutorService` | `server/services/desktop-executor.ts` | 企业级执行器+安全沙箱 |
| `heartbeat-manager` | `server/services/heartbeat-manager.ts` | 设备心跳监控 |
| `companion-apps/pc` | `companion-apps/pc/` | PC守护进程(WebSocket) |
| `companion-apps/android` | `companion-apps/android/` | Android伴侣应用 |
| `mobile-control` | `server/routes/mobile-control.ts` | 移动设备控制REST API |
| `scheduler` | `server/services/scheduler.ts` | node-cron定时任务 |

### 2.2 缺失的关键功能

| 缺失项 | 影响 |
|--------|------|
| 统一的"远程控制台"移动端界面 | 无法从手机操控PC |
| PC屏幕实时预览/流传输 | 手机看不到PC屏幕 |
| 跨设备任务编排引擎 | 无法协调PC+手机完成复杂任务 |
| 任务结果自动回传机制 | 任务完成后结果无法推送至手机 |
| 完整的WebSocket实时控制通道 | 延迟高，无法实时操控 |

---

## 三、详细实施计划

### 阶段一：手机远程控制PC (4-5天)

#### 1.1 新增服务端API

```
新增文件: server/routes/remote-control.ts
```

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/remote/devices` | GET | 获取可控制的PC列表 |
| `/api/remote/connect/:deviceId` | POST | 建立远程控制会话 |
| `/api/remote/disconnect/:sessionId` | POST | 断开远程控制 |
| `/api/remote/screenshot/:deviceId` | GET | 获取PC实时截图 |
| `/api/remote/control/:deviceId` | POST | 发送控制指令(鼠标/键盘) |
| `/api/remote/files/:deviceId` | GET/POST | 浏览/传输PC文件 |
| `/api/remote/session/:sessionId` | GET | 获取会话状态 |

#### 1.2 新增WebSocket通道

```
新增文件: server/services/remote-control-ws.ts
```

- 路径: `/ws/remote-control`
- 功能: 实时屏幕流 + 低延迟控制指令
- 特性: 心跳保活、自动重连、带宽自适应

#### 1.3 PC守护进程增强

```
修改文件: companion-apps/pc/avatar_daemon/
```

- 增强WebSocket客户端，支持实时屏幕推流
- 添加JPEG/PNG压缩传输
- 添加远程执行结果回传

#### 1.4 移动端控制台页面

```
新增文件: client/src/pages/RemoteConsole.tsx
```

功能模块:

1. **设备列表**
   - 显示已在线的PC设备
   - 点击连接/断开
   - 显示设备状态(在线/忙碌/离线)

2. **远程桌面**
   - 定时截图显示(可调整频率)
   - 支持触摸点击/滑动
   - 虚拟键盘
   - 快捷操作按钮(Alt+Tab, Win键等)

3. **文件管理器**
   - 浏览PC文件系统
   - 上传/下载文件
   - 支持拖拽操作

4. **任务中心**
   - 发送控制命令
   - 查看执行历史
   - 结果展示

---

### 阶段二：心跳任务系统 (3-4天)

#### 2.1 心跳服务增强

```
修改文件: server/services/heartbeat-manager.ts
```

新增功能:

- 可配置心跳间隔(1秒~5分钟)
- 心跳超时阈值设置
- 心跳历史记录存储
- 设备状态变化回调

#### 2.2 任务编排引擎

```
新增文件: server/services/task-orchestrator.ts
```

核心功能:

| 功能 | 描述 |
|------|------|
| 定时任务 | 基于cron表达式的定时执行 |
| 条件触发 | 心跳状态变化时触发 |
| 任务链 | 多个任务顺序执行 |
| 并行任务 | 多个设备同时执行 |
| 任务依赖 | 任务A完成后触发任务B |
| 重试机制 | 失败自动重试 |
| 超时控制 | 任务超时自动终止 |

#### 2.3 任务定义schema

```typescript
interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  trigger: {
    type: 'cron' | 'heartbeat' | 'manual' | 'webhook';
    config: CronConfig | HeartbeatConfig;
  };
  actions: TaskAction[];
  options: {
    retryCount: number;
    retryDelay: number;
    timeout: number;
    onSuccess?: string; // 下一个任务ID
    onFailure?: string;
  };
}

interface TaskAction {
  deviceId: string;
  action: {
    type: 'click' | 'type' | 'screenshot' | 'file' | 'custom';
    params: Record<string, any>;
  };
}
```

#### 2.4 任务执行记录

```
新增表: task_executions
```

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 执行ID |
| task_id | UUID | 任务定义ID |
| device_id | STRING | 设备ID |
| status | ENUM | pending/running/completed/failed |
| started_at | TIMESTAMP | 开始时间 |
| completed_at | TIMESTAMP | 完成时间 |
| result | JSON | 执行结果 |
| error | TEXT | 错误信息 |

---

### 阶段三：底层设备操控增强 (5-7天)

#### 3.1 统一执行API

```
新增文件: server/services/unified-executor.ts
```

统一PC和手机的执行接口:

```typescript
interface UnifiedExecutor {
  // 设备操作
  click(deviceId: string, x: number, y: number): Promise<ActionResult>;
  type(deviceId: string, text: string): Promise<ActionResult>;
  screenshot(deviceId: string): Promise<string>;
  
  // 文件操作
  listFiles(deviceId: string, path: string): Promise<FileEntry[]>;
  readFile(deviceId: string, path: string): Promise<Buffer>;
  writeFile(deviceId: string, path: string, content: Buffer): Promise<void>;
  
  // 应用操作
  openApp(deviceId: string, appId: string): Promise<ActionResult>;
  closeApp(deviceId: string, appId: string): Promise<ActionResult>;
  
  // 系统操作
  executeCommand(deviceId: string, cmd: string): Promise<CommandResult>;
}
```

#### 3.2 跨设备工作流

```
新增文件: server/services/workflow-engine.ts
```

定义和执行跨设备工作流:

```typescript
interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  deviceId: string;
  action: DeviceAction;
  condition?: {
    type: 'result' | 'screen' | 'timeout';
    config: any;
  };
  onSuccess?: string; // 下一步ID
  onFailure?: string;
}
```

#### 3.3 智能屏幕分析

```
新增文件: server/services/screen-analyzer.ts
```

- OCR文字识别
- UI元素检测
- 状态变化检测
- 自动化流程自动适应UI变化

#### 3.4 任务结果回传

```
新增文件: server/services/result-notifier.ts
```

- WebSocket推送至手机
- 邮件通知
- 微信/短信通知(需配置)
- 结果存储和历史查询

---

## 四、技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      移动端 (iOS/Android)                   │
├─────────────────────────────────────────────────────────────┤
│  小智APP                                                     │
│  ├── 远程控制台页面                                           │
│  ├── 任务管理页面                                             │
│  └── 结果通知接收                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/WSS
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                     小智服务器 (Node.js)                      │
├──────────────────────────────────────────────────────────────┤
│  API层                                                        │
│  ├── /api/remote/* - 远程控制API                               │
│  ├── /api/tasks/* - 任务管理API                                │
│  └── /api/devices/* - 设备管理API                             │
├──────────────────────────────────────────────────────────────┤
│  服务层                                                        │
│  ├── RemoteControlService - 远程控制核心服务                   │
│  ├── TaskOrchestrator - 任务编排引擎                           │
│  ├── WorkflowEngine - 工作流引擎                              │
│  ├── HeartbeatManager - 心跳管理(已有)                        │
│  ├── UnifiedExecutor - 统一执行器                             │
│  └── ResultNotifier - 结果通知服务                             │
├──────────────────────────────────────────────────────────────┤
│  执行层                                                        │
│  ├── PCExecutorService - PC执行(PyAutoGUI)                    │
│  ├── MobileExecutorService - 手机执行(Accessibility)          │
│  └── DesktopExecutorService - 企业执行器                       │
└──────────────────────┬───────────────────────────────────────┘
                       │ WebSocket
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   配套应用 (Companion Apps)                   │
├──────────────────────┬──────────────────────────────────────┤
│  PC守护进程           │  Android伴侣应用                       │
│  ├── 屏幕捕获          │  ├── 无障碍服务                        │
│  ├── 输入模拟          │  ├── 屏幕捕获                         │
│  ├── 命令执行          │  ├── 输入模拟                         │
│  └── 结果回传          │  └── 结果回传                          │
└──────────────────────┴──────────────────────────────────────┘
```

---

## 五、开发任务清单

### Sprint 1: 远程控制基础 (4天)

| 任务ID | 任务描述 | 预估工时 | 责任人 |
|--------|----------|----------|--------|
| T-001 | 创建remote-control路由和API | 1天 | - |
| T-002 | 实现PC截图捕获和传输 | 0.5天 | - |
| T-003 | 实现鼠标/键盘远程控制 | 1天 | - |
| T-004 | 增强PC守护进程支持实时控制 | 1天 | - |
| T-005 | 创建移动端远程控制台页面 | 1.5天 | - |

### Sprint 2: 任务系统 (3天)

| 任务ID | 任务描述 | 预估工时 | 责任人 |
|--------|----------|----------|--------|
| T-006 | 增强heartbeat-manager | 0.5天 | - |
| T-007 | 创建task-orchestrator服务 | 1.5天 | - |
| T-008 | 实现定时任务执行 | 0.5天 | - |
| T-009 | 创建任务管理API和页面 | 1天 | - |

### Sprint 3: 高级功能 (5天)

| 任务ID | 任务描述 | 预估工时 | 责任人 |
|--------|----------|----------|--------|
| T-010 | 实现统一执行器 | 1.5天 | - |
| T-011 | 创建workflow-engine | 2天 | - |
| T-012 | 实现结果通知服务 | 1天 | - |
| T-013 | 文件传输功能 | 1天 | - |

### Sprint 4: 优化和测试 (3天)

| 任务ID | 任务描述 | 预估工时 | 责任人 |
|--------|----------|----------|--------|
| T-014 | 性能优化(屏幕流压缩) | 1天 | - |
| T-014 | 安全审计和权限控制 | 1天 | - |
| T-016 | 端到端测试 | 1天 | - |

---

## 六、风险和挑战

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 屏幕传输延迟 | 操控体验差 | JPEG压缩、调整帧率、考虑WebRTC |
| 设备兼容性 | 部分设备无法控制 | 能力检测、降级处理 |
| 安全风险 | 远程控制被滥用 | 严格权限验证、操作审计 |
| 网络不稳定 | 控制中断 | 自动重连、指令缓存 |

---

## 七、验收标准

### 7.1 远程控制

- [ ] 手机能查看PC实时屏幕(延迟<500ms)
- [ ] 手机能远程点击、输入文字
- [ ] 支持文件上传下载
- [ ] 控制会话稳定，断线自动重连

### 7.2 心跳任务

- [ ] 设备按时发送心跳，状态实时更新
- [ ] 支持cron定时任务执行
- [ ] 任务执行结果正确记录

### 7.3 底层操控

- [ ] 统一API同时支持PC和手机
- [ ] 跨设备工作流正确执行
- [ ] 任务完成后结果自动推送到手机

---

## 八、技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 屏幕传输 | WebSocket + JPEG压缩 | 简单可靠，延迟可接受 |
| 实时控制 | WebSocket | 低延迟双向通信 |
| 任务调度 | node-cron | 已有依赖，轻量级 |
| 移动端框架 | React Native/现有Web | 复用现有前端 |
| 状态管理 | Redis | 高性能、心跳数据缓存 |

---

*文档版本: 1.0*  
*下次评审: 实施前*
