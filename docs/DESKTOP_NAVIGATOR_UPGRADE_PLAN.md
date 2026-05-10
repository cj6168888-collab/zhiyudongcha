# Navigator-X 桌面端升级计划

> **版本**: 2.0.0  
> **日期**: 2026-03-20  
> **定位**: 全能管家 + 办公助手

---

## 一、设计理念

### 1.1 核心定位

桌面端是**工作和办公环境**，系统应该是一个**全能管家和办公全能助手**：

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Navigator-X 桌面端 (全能管家)                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│   │   小智AI   │ + │  OpenClaw   │ + │ Navigator-X │               │
│   │  (对话助手) │   │  (系统控制)  │   │  (舰队协同)  │               │
│   └─────────────┘   └─────────────┘   └─────────────┘               │
│                                                                      │
│   = 集AI对话、系统控制、舰队协同于一体的全能助手                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 三大核心能力

| 能力 | 来源 | 功能描述 |
|------|------|----------|
| **AI对话** | 小智AI | 智能对话、知识问答、语音交互 |
| **系统控制** | OpenClaw | 远程控制PC、自动命令、任务自动化 |
| **舰队协同** | Navigator-X | 汇报审批、灵感广播、五大专家 |

---

## 二、现有功能继承

### 2.1 桌面端已有功能清单

| 模块 | 文件 | 功能 |
|------|------|------|
| **远程控制** | `remote-pc-console.tsx` | PC设备管理、屏幕截图、鼠标键盘控制、快捷键 |
| **任务中心** | `task-center.tsx` | Cron定时任务、手动触发、执行历史 |
| **系统控制** | `system-console.tsx` | 系统健康、安全状态、专家统计 |
| **设置** | `settings.tsx` | 形象选择、核心定义、安全准入 |
| **聊天** | `chat.tsx` | AI对话、语音输入 |
| **数字金库** | `vault-compute.tsx` | 数字资产管理 |
| **关系网络** | `relationship-network.tsx` | 人脉管理 |
| **战略大脑** | `strategy-brain.tsx` | 战略推演 |
| **项目中心** | `project-center.tsx` | 项目管理 |

### 2.2 OpenClaw 功能借鉴

| 功能 | 描述 | 集成方式 |
|------|------|----------|
| **全盘接管** | 完整控制PC所有操作 | 整合到远程控制模块 |
| **命令执行** | 自动运行Shell/PowerShell命令 | 整合到任务中心 |
| **定时任务** | Cron表达式定时执行 | 已有任务系统增强 |
| **设备联动** | PC与手机协同操作 | 已有UnifiedExecutor |

---

## 三、新架构设计

### 3.1 整体布局

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Navigator-X 桌面端主界面                            │
├─────────┬────────────────────────────────────────────────────────────┤
│         │  ┌─────────────────────────────────────────────────────┐  │
│         │  │                    顶部工具栏                         │  │
│  侧边栏  │  │  [搜索] [快捷命令] [通知] [设置] [形象切换]            │  │
│         │  └─────────────────────────────────────────────────────┘  │
│ [首页]   ├────────────────────────────────────────────────────────────┤
│ [对话]   │                                                            │
│ [控制]   │                     主工作区                               │
│ [任务]   │                                                            │
│ [舰队]   │    根据选择的功能模块动态加载：                            │
│ [金库]   │    - 首页仪表盘                                          │
│ [项目]   │    - AI对话                                              │
│ [系统]   │    - 远程控制                                            │
│         │    - 任务中心                                            │
│         │    - 舰队管理                                            │
│         │    - ...                                                 │
│         │                                                            │
├─────────┴────────────────────────────────────────────────────────────┤
│                    底部状态栏                                         │
│  [系统状态] [在线设备] [舰队状态] [通知中心]                          │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 侧边栏设计

```tsx
const desktopNavItems = [
  // 首页
  { id: 'home', icon: Home, label: '首页', path: '/desktop' },
  
  // 小智AI功能
  { id: 'chat', icon: MessageCircle, label: 'AI对话', path: '/desktop/chat' },
  { id: 'voice', icon: Mic, label: '语音交互', path: '/desktop/voice' },
  
  // OpenClaw功能
  { id: 'control', icon: Monitor, label: '远程控制', path: '/desktop/control' },
  { id: 'automation', icon: Zap, label: '任务中心', path: '/desktop/tasks' },
  { id: 'terminal', icon: Terminal, label: '命令终端', path: '/desktop/terminal' },
  
  // Navigator-X功能
  { id: 'fleet', icon: Ship, label: '舰队管理', path: '/desktop/fleet', role: 'SOVEREIGN' },
  { id: 'reports', icon: FileText, label: '汇报审批', path: '/desktop/reports', role: 'SOVEREIGN' },
  { id: 'experts', icon: Users, label: '专家咨询', path: '/desktop/experts' },
  { id: 'inspiration', icon: Sparkles, label: '灵感广播', path: '/desktop/inspiration', role: 'SOVEREIGN' },
  
  // 办公功能
  { id: 'projects', icon: FolderKanban, label: '项目管理', path: '/desktop/projects' },
  { id: 'contacts', icon: AddressBook, label: '人脉管理', path: '/desktop/contacts' },
  { id: 'vault', icon: Database, label: '数字金库', path: '/desktop/vault' },
  
  // 系统
  { id: 'settings', icon: Settings, label: '系统设置', path: '/desktop/settings' },
];
```

---

## 四、功能模块详细设计

### 4.1 首页仪表盘

**功能**: 整合所有核心信息一目了然

```tsx
interface DesktopHomeProps {
  // 系统概览
  systemStatus: {
    cpu: number;
    memory: number;
    uptime: string;
  };
  
  // 小智状态
  xiaojiStatus: {
    name: string;
    character: string;
    mood: string;
  };
  
  // OpenClaw状态
  openclawStatus: {
    onlineDevices: number;
    activeTasks: number;
    pendingAlerts: number;
  };
  
  // Navigator-X状态
  navigatorStatus: {
    fleetSize: number;
    pendingReports: number;
    activeAlerts: number;
  };
}
```

**UI布局**:
```
┌────────────────────────────────────────────────────────────────┐
│  欢迎回来，{用户名}                          [{形象图标} 小智]   │
├──────────────────────┬─────────────────────────────────────────┤
│                      │                                         │
│   ┌───────────────┐  │   ┌─────────────────────────────────┐  │
│   │   系统状态     │  │   │      快捷操作                   │  │
│   │   CPU: 45%    │  │   │  [对话] [控制] [任务] [灵感]     │  │
│   │   内存: 62%   │  │   └─────────────────────────────────┘  │
│   │   运行: 7天   │  │                                         │
│   └───────────────┘  │   ┌─────────────────────────────────┐  │
│                      │   │      待办事项                   │  │
│   ┌───────────────┐  │   │  • 审批3份汇报                  │  │
│   │   在线设备     │  │   │  • 执行2个任务                  │  │
│   │   PC: 1       │  │   │  • 1条预警                      │  │
│   │   手机: 2     │  │   └─────────────────────────────────┘  │
│   └───────────────┘  │                                         │
│                      │   ┌─────────────────────────────────┐  │
│   ┌───────────────┐  │   │      舰队概览 (SOVEREIGN)       │  │
│   │   任务执行     │  │   │   [节点1] [节点2] [节点3] ...   │  │
│   │   今日: 5      │  │   └─────────────────────────────────┘  │
│   │   成功率: 95% │  │                                         │
│   └───────────────┘  │                                         │
│                      │                                         │
└──────────────────────┴─────────────────────────────────────────┘
```

### 4.2 AI对话模块

**功能**: 与小智AI进行自然语言对话

**特性**:
- 多角色形象切换
- 语音输入/输出
- 历史对话记录
- 文件/图片上传
- 专家咨询入口

### 4.3 远程控制模块 (OpenClaw核心)

**功能**: 完整接管PC系统

```tsx
interface RemoteControlProps {
  // 设备管理
  devices: PCDevice[];
  
  // 控制功能
  controls: {
    screenCapture: boolean;  // 屏幕截图
    mouseControl: boolean;  // 鼠标控制
    keyboardControl: boolean; // 键盘控制
    fileSystem: boolean;    // 文件系统
    clipboard: boolean;     // 剪贴板
    commandExec: boolean;   // 命令执行
    processManage: boolean; // 进程管理
    systemSettings: boolean; // 系统设置
  };
}
```

**UI布局**:
```
┌────────────────────────────────────────────────────────────────┐
│  远程控制台                                    [设备选择 ▼]     │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                     │
│  设备列表 │   ┌─────────────────────────────────────────────┐  │
│          │   │                                             │  │
│  [PC-1]  │   │                                             │  │
│  [手机-1]│   │              实时屏幕画面                    │  │
│  [手机-2]│   │                                             │  │
│          │   │              (点击控制)                       │  │
│          │   │                                             │  │
├──────────┤   └─────────────────────────────────────────────┘  │
│          │                                                     │
│  快捷操作 │   ┌─────────────────────────────────────────────┐  │
│  [截图]   │   │  [开始直播] [截图] [键盘] [快捷键] [终端]     │  │
│  [快捷键] │   └─────────────────────────────────────────────┘  │
│  [终端]   │                                                     │
│  [文件]   │   ┌─────────────────────────────────────────────┐  │
│          │   │  命令历史 / 输出                              │  │
│          │   └─────────────────────────────────────────────┘  │
│          │                                                     │
└──────────┴─────────────────────────────────────────────────────┘
```

### 4.4 任务中心模块

**功能**: 自动化任务编排与执行

```tsx
interface TaskCenterProps {
  tasks: TaskDefinition[];
  executions: TaskExecution[];
  
  // 触发类型
  triggerTypes: {
    CRON: '定时执行';
    HEARTBEAT: '心跳触发';
    MANUAL: '手动触发';
    VOICE: '语音触发';
    SCHEDULE: '日程触发';
  };
  
  // 动作类型
  actionTypes: {
    CLICK: '鼠标点击';
    TYPE: '文字输入';
    COMMAND: '命令执行';
    HTTP: 'HTTP请求';
    FILE: '文件操作';
    APP: '应用操作';
  };
}
```

### 4.5 舰队管理模块 (Navigator-X)

**功能**: 团队协同管理（SOVEREIGN权限）

```tsx
interface FleetManagementProps {
  // 舰队信息
  fleet: {
    name: string;
    size: number;
    activeNodes: number;
    morale: number;
  };
  
  // 节点列表
  nodes: NavigatorNode[];
  
  // 功能
  functions: {
    reportApproval: boolean;   // 汇报审批
    inspirationBroadcast: boolean; // 灵感广播
    redAlertMonitoring: boolean;  // 预警监控
    taskDistribution: boolean;    // 任务分派
  };
}
```

---

## 五、权限设计

### 5.1 角色权限

| 功能 | SOVEREIGN | NODE | GUEST |
|------|-----------|------|-------|
| AI对话 | ✅ | ✅ | ✅ |
| 远程控制 | ✅ | ❌ | ❌ |
| 命令执行 | ✅ | ❌ | ❌ |
| 任务管理 | ✅(全部) | ✅(我的) | ❌ |
| 舰队管理 | ✅ | ❌ | ❌ |
| 汇报审批 | ✅ | ❌ | ❌ |
| 灵感广播 | ✅ | ❌ | ❌ |
| 节点端 | ❌ | ✅ | ❌ |
| 项目管理 | ✅(全部) | ✅(我的) | ✅(只读) |

### 5.2 登录方式

```tsx
interface LoginOptions {
  // 账号密码
  username: string;
  password: string;
  
  // 生物识别
  biometric: boolean;
  
  // 记住设备
  rememberDevice: boolean;
}
```

---

## 六、UI设计规范

### 6.1 主题色

```css
:root {
  /* 主色调 */
  --primary: #6366f1;           /* Indigo */
  --primary-foreground: #ffffff;
  
  /* 强调色 */
  --accent: #f59e0b;            /* Amber - SOVEREIGN标识 */
  --accent-foreground: #000000;
  
  /* 状态色 */
  --success: #22c55e;           /* Green */
  --warning: #f59e0b;            /* Amber */
  --danger: #ef4444;            /* Red */
  --info: #3b82f6;              /* Blue */
  
  /* 背景色 */
  --background: #030712;        /* 深色背景 */
  --surface: #0a0a0f;           /* 卡片背景 */
  --muted: rgba(255,255,255,0.05);
}
```

### 6.2 组件风格

| 组件 | 风格 |
|------|------|
| 按钮 | 圆角2xl，悬停缩放95% |
| 卡片 | 圆角3xl，border-white/10 |
| 侧边栏 | 宽度256px，深色背景 |
| 输入框 | 圆角2xl，背景white/5 |
| 标签页 | 底部边框高亮 |

---

## 七、实施计划

### Phase 1: 核心框架
- [ ] 桌面端主布局组件
- [ ] 侧边栏导航
- [ ] 路由配置
- [ ] 登录页面

### Phase 2: 功能迁移
- [ ] AI对话模块
- [ ] 远程控制模块
- [ ] 任务中心模块
- [ ] 系统控制模块

### Phase 3: Navigator-X集成
- [ ] 舰队管理
- [ ] 汇报审批
- [ ] 灵感广播
- [ ] 五大专家

### Phase 4: 办公功能
- [ ] 项目管理
- [ ] 人脉管理
- [ ] 数字金库

---

## 八、文件结构

```
client/src/
├── pages/
│   └── desktop/
│       ├── Login.tsx              # 登录页
│       ├── Home.tsx               # 首页仪表盘
│       ├── Chat.tsx               # AI对话
│       ├── Voice.tsx              # 语音交互
│       ├── Control.tsx            # 远程控制
│       ├── Tasks.tsx              # 任务中心
│       ├── Terminal.tsx           # 命令终端
│       ├── Fleet.tsx              # 舰队管理
│       ├── Reports.tsx            # 汇报审批
│       ├── Experts.tsx            # 专家咨询
│       ├── Inspiration.tsx        # 灵感广播
│       ├── Projects.tsx            # 项目管理
│       ├── Contacts.tsx            # 人脉管理
│       ├── Vault.tsx               # 数字金库
│       └── Settings.tsx            # 系统设置
├── components/
│   └── desktop/
│       ├── DesktopLayout.tsx      # 主布局
│       ├── DesktopSidebar.tsx      # 侧边栏
│       ├── DesktopHeader.tsx       # 顶部工具栏
│       ├── DesktopStatusBar.tsx    # 底部状态栏
│       └── DesktopNav.tsx          # 导航组件
```

---

**文档结束**
