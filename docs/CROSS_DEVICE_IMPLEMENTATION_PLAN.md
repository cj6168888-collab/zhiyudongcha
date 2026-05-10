# 跨设备智能助手实施计划

> **版本**：1.0.0  
> **日期**：2026-04-19  
> **状态**：规划中

---

## 一、目标概述

实现一个真正的跨设备智能助手系统，支持：
- 手机和电脑双线并行操控
- 跨设备任务协调
- 渐进式授权管理
- 程序能力感知

---

## 二、实施原则（遵循开发宪法）

1. **权限真值源**：所有授权必须有可枚举、可持久化、可审计的依据
2. **诚实交付**：未完成的能力标注为「规划中」，不冒充已上线
3. **最小必要变更**：以完成任务为限，不做无关重构
4. **类型与边界**：业务逻辑优先落在 `server/services/`，路由层保持薄
5. **测试与回归**：核心功能需具备自动化验证

---

## 三、分阶段实施计划

### 【阶段一】核心服务层完善

**目标**：完善 server/services/ 中的跨设备服务

**任务清单**：

| 序号 | 任务 | 文件路径 | 状态 |
|------|------|----------|------|
| 1.1 | 完善 CloudHub 服务 - 连接现有设备连接服务 | `server/services/cloud/CloudHub.ts` | 待做 |
| 1.2 | 完善 DeviceRegistry 服务 - 连接现有程序数据库 | `server/services/device/DeviceRegistry.ts` | 待做 |
| 1.3 | 完善 CrossDeviceRouter - 对接 AutonomousAgent | `server/services/device/CrossDeviceRouter.ts` | 待做 |
| 1.4 | 完善 AuthorizationManager - 持久化授权 | `server/services/assistant/AuthorizationManager.ts` | 待做 |
| 1.5 | 完善 CrossDeviceAssistant - 整合所有能力 | `server/services/assistant/CrossDeviceAssistant.ts` | 待做 |

**验收标准**：
- [ ] CloudHub 能获取已连接设备的状态
- [ ] DeviceRegistry 能返回已知程序的调用方式
- [ ] CrossDeviceRouter 能将任务路由到合适的服务
- [ ] AuthorizationManager 授权记录持久化到数据库

---

### 【阶段二】API 层完善

**目标**：确保跨设备 API 正确注册并可用

**任务清单**：

| 序号 | 任务 | 文件路径 | 状态 |
|------|------|----------|------|
| 2.1 | 完善 cross-device.ts 路由 | `server/routes/cross-device.ts` | 待做 |
| 2.2 | 在 routes.ts 中注册路由 | `server/routes.ts` | ✅ 已完成 |
| 2.3 | 添加 API 文档 | `server/lib/complete-api-docs.ts` | 待做 |
| 2.4 | 添加请求/响应类型定义 | `shared/types/cross-device.ts` | 待做 |

**验收标准**：
- [ ] `POST /api/cross-device/chat` 接口可用
- [ ] `GET /api/cross-device/devices` 接口可用
- [ ] `POST /api/cross-device/execute` 接口可用
- [ ] API 文档与代码一致

---

### 【阶段三】手机端 Agent

**目标**：让 Android 手机能接收服务器指令并执行

**任务清单**：

| 序号 | 任务 | 文件路径 | 状态 |
|------|------|----------|------|
| 3.1 | 添加 Intent 执行服务 | `mobile/android/.../IntentExecutor.kt` | 待做 |
| 3.2 | 添加程序列表扫描 | `mobile/android/.../AppScanner.kt` | 待做 |
| 3.3 | 添加设备注册到 CloudHub | `mobile/android/.../CloudHubClient.kt` | 待做 |
| 3.4 | 添加指令接收处理 | `mobile/android/.../CommandHandler.kt` | 待做 |
| 3.5 | 测试 Intent 调用 | - | 待做 |

**验收标准**：
- [ ] 手机能连接到 CloudHub
- [ ] 手机能上报程序列表
- [ ] 手机能接收并执行 Intent 调用
- [ ] 微信、钉钉等 Intent 能正确调用

---

### 【阶段四】电脑端 Agent

**目标**：实现电脑端 Agent，支持程序操作和屏幕控制

**任务清单**：

| 序号 | 任务 | 文件路径 | 状态 |
|------|------|----------|------|
| 4.1 | 创建 Electron 应用骨架 | `electron-app/` | 待做 |
| 4.2 | 实现程序发现服务 | `electron-app/src/services/ProgramDiscovery.ts` | 待做 |
| 4.3 | 实现 PC Executor 集成 | `electron-app/src/services/PCExecutor.ts` | 待做 |
| 4.4 | 实现 CloudHub 客户端 | `electron-app/src/services/CloudHubClient.ts` | 待做 |
| 4.5 | 实现指令路由和执行 | `electron-app/src/services/CommandRouter.ts` | 待做 |
| 4.6 | 实现程序调用能力（VSCode、Office等） | `electron-app/src/services/ProgramLauncher.ts` | 待做 |
| 4.7 | 测试程序发现和调用 | - | 待做 |

**验收标准**：
- [ ] Electron 应用能启动并连接到 CloudHub
- [ ] 能发现并上报已安装程序
- [ ] 能接收并执行程序调用指令
- [ ] VSCode、Office 等程序能正确启动

---

### 【阶段五】知识库与学习

**目标**：让小星能学习和记住程序能力

**任务清单**：

| 序号 | 任务 | 文件路径 | 状态 |
|------|------|----------|------|
| 5.1 | 完善程序数据库 - 添加更多程序 | `server/services/device/DeviceRegistry.ts` | 待做 |
| 5.2 | 添加程序能力学习接口 | `server/services/knowledge/ProgramLearner.ts` | 待做 |
| 5.3 | 实现未知程序自动查询 | `server/services/knowledge/ProgramDiscovery.ts` | 待做 |
| 5.4 | 完善扣子 AI 集成 | `server/lib/coze-api.ts` | 待做 |

**验收标准**：
- [ ] 预定义 30+ 常用程序
- [ ] 能查询未知程序的能力
- [ ] 扣子 AI 能正确调用

---

### 【阶段六】测试与验证

**目标**：确保核心功能可测试、可验证

**任务清单**：

| 序号 | 任务 | 路径 | 状态 |
|------|------|------|------|
| 6.1 | 核心服务单元测试 | `server/tests/services/` | 待做 |
| 6.2 | API 集成测试 | `server/tests/routes/` | 待做 |
| 6.3 | 端到端流程测试 | `server/tests/e2e/` | 待做 |
| 6.4 | 性能测试 | - | 待做 |

**验收标准**：
- [ ] 核心服务有单元测试覆盖
- [ ] API 接口有集成测试
- [ ] 跨设备流程能端到端跑通

---

## 四、技术架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层                                      │
│                         (手机 App / 电脑 App / 网页)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API 网关层 (Express)                               │
│                    server/routes/cross-device.ts                           │
│                                                                             │
│   POST /api/cross-device/chat        - 统一对话入口                         │
│   GET  /api/cross-device/devices    - 获取设备列表                         │
│   POST /api/cross-device/execute    - 执行操作                              │
│   PUT  /api/assistant/permissions  - 设置权限                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          服务层 (server/services/)                          │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│   │  CloudHub       │  │ DeviceRegistry  │  │ CrossDevice    │           │
│   │  设备注册/队列  │  │  程序数据库    │  │ Router         │           │
│   │                 │  │                 │  │  任务规划      │           │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│   │ Authorization   │  │ CrossDevice    │  │ CozeAPI        │           │
│   │ Manager         │  │ Assistant      │  │  扣子AI集成    │           │
│   │  授权管理      │  │  核心入口      │  │                 │           │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│   │ Autonomous      │  │ BrowserAgent   │  │ PCExecutor      │           │
│   │ Agent           │  │  浏览器自动化  │  │  电脑控制      │           │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│      📱 手机端          │ │      💻 电脑端          │ │       ☁️ 云端          │
│   (Android Native)      │ │   (Electron App)        │ │   (外部服务)            │
│                         │ │                         │ │                         │
│ • IntentExecutor       │ │ • ProgramDiscovery      │ │ • 扣子AI              │
│ • AppScanner           │ │ • ProgramLauncher      │ │ • 其他AI服务           │
│ • CloudHubClient       │ │ • CloudHubClient       │ │                         │
│ • CommandHandler       │ │ • PCExecutor           │ │                         │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

---

## 五、数据流

### 场景：用户在手机上让小星在电脑上打开 VSCode

```
用户(手机): "帮我打开电脑上的VSCode"
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ server/routes/cross-device.ts                              │
│ POST /api/cross-device/chat                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CrossDeviceAssistant.processRequest()                       │
│ 1. 理解意图 → 打开应用 (VSCode)                            │
│ 2. 检查授权 → 无需授权                                    │
│ 3. 路由到电脑端                                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CrossDeviceRouter.planTask()                               │
│ 选择电脑作为执行设备                                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CloudHub.sendToDevice()                                    │
│ 发送指令到电脑端 WebSocket                                 │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Electron App (电脑端)                                      │
│ CloudHubClient 接收指令                                    │
│ CommandRouter 路由到 ProgramLauncher                       │
│ 执行: code (启动VSCode)                                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
电脑: VSCode 启动
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Electron App                                               │
│ 返回执行结果到 CloudHub                                    │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
服务器 → 手机端: "✅ 已在电脑上打开 VSCode"
```

---

## 六、文件清单

### 新增文件

| 路径 | 说明 |
|------|------|
| `server/services/cloud/CloudHub.ts` | 云端协调中心 |
| `server/services/device/DeviceRegistry.ts` | 设备注册表 |
| `server/services/device/CrossDeviceRouter.ts` | 跨设备路由器 |
| `server/services/assistant/CrossDeviceAssistant.ts` | 核心助手 |
| `server/routes/cross-device.ts` | API 路由 |
| `server/lib/coze-api.ts` | 扣子AI集成 |
| `electron-app/` | 电脑端Agent目录 |
| `mobile/android/.../IntentExecutor.kt` | Android Intent执行器 |
| `mobile/android/.../AppScanner.kt` | Android 程序扫描器 |

### 修改文件

| 路径 | 修改内容 |
|------|----------|
| `server/routes.ts` | 注册跨设备路由 ✅ 已完成 |
| `server/services/assistant/index.ts` | 导出新服务 |
| `shared/types/` | 添加跨设备类型定义 |

---

## 七、验收检查清单

### 阶段一验收

- [ ] `server/services/cloud/CloudHub.ts` 能获取已连接设备
- [ ] `server/services/device/DeviceRegistry.ts` 返回程序调用方式
- [ ] `server/services/device/CrossDeviceRouter.ts` 正确路由任务
- [ ] `server/services/assistant/AuthorizationManager.ts` 授权持久化
- [ ] `server/services/assistant/CrossDeviceAssistant.ts` 整合所有服务

### 阶段二验收

- [ ] `POST /api/cross-device/chat` 接口返回正确响应
- [ ] `GET /api/cross-device/devices` 返回设备列表
- [ ] `POST /api/cross-device/execute` 能执行操作

### 阶段三验收

- [ ] Android App 能连接到服务器
- [ ] 能上报程序列表
- [ ] Intent 调用能正确执行

### 阶段四验收

- [ ] Electron 应用能启动
- [ ] 能发现已安装程序
- [ ] 能接收并执行指令
- [ ] VSCode 能正确启动

### 阶段五验收

- [ ] 程序数据库包含 30+ 程序
- [ ] 未知程序能查询
- [ ] 扣子AI能调用

### 阶段六验收

- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 端到端流程可用

---

## 八、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Android Intent 调用受限 | 可能无法调用某些应用 | 降级为引导用户手动操作 |
| 微信电脑版 API 封闭 | 无法程序化发送消息 | 使用剪贴板+自动粘贴方式 |
| Electron 打包复杂 | 构建失败 | 使用 electron-builder 模板 |
| 扣子 API 配置复杂 | 集成失败 | 提供模拟模式 |

---

## 九、里程碑

| 里程碑 | 目标日期 | 验收条件 |
|---------|----------|----------|
| M1: 核心服务就绪 | 2026-04-20 | API 接口可用 |
| M2: 手机端就绪 | 2026-04-21 | Intent 调用成功 |
| M3: 电脑端就绪 | 2026-04-22 | 程序启动成功 |
| M4: 知识库就绪 | 2026-04-23 | 程序数据库完整 |
| M5: 测试通过 | 2026-04-24 | 端到端可用 |

---

**计划编制**：AI Agent  
**计划版本**：1.0.0  
**下次更新**：完成阶段一后
