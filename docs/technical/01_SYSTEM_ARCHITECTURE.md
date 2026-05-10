# 系统架构

## 总体架构

生语助手采用开放吸收型 AI 操作系统架构。

```text
主权守护层
  权限、隐私、审计、预算、风险确认

主人世界模型层
  永久记忆、知识库、人物、项目、任务、偏好

智能路由层
  模型路由、专家路由、工具选择、成本控制

执行适配层
  API、MCP、手机 App、电脑、浏览器、文件、邮件、日历

外部能力生态层
  OpenAI、DeepSeek、通义千问、Claude、本地模型、开源工具、第三方 App
```

## 代码映射

| 层级 | 当前代码位置 | 职责 |
| --- | --- | --- |
| 前端体验 | `client/src/` | 页面、组件、交互、状态、API 调用 |
| 移动页面 | `client/src/pages/mobile/` | 移动端主体验 |
| 桌面页面 | `client/src/pages/desktop/` | 桌面端体验 |
| 后端入口 | `server/index.ts` | Express、全局中间件、WebSocket、静态资源 |
| 路由层 | `server/routes.ts`、`server/routes/` | HTTP 合约、校验、权限、调用服务 |
| 服务层 | `server/services/` | 领域规则、AI 编排、工具调用、执行逻辑 |
| 数据层 | `server/repositories/`、`server/storage.ts`、`shared/schema.ts` | 数据访问、schema、存储门面 |
| 共享类型 | `shared/` | 前后端共享类型、schema |
| Android | `android/`、`mobile/android/` | 手机端原生能力、权限、语音、App 控制 |
| 部署 | `docker-compose*.yml`、`server/Dockerfile`、`scripts/` | Docker、本地/生产启动、smoke |

## 核心边界

### 前端

前端不直接承载业务规则。前端可以：

- 展示状态。
- 收集输入。
- 引导确认。
- 调用 API。
- 维护轻量 UI 状态。

前端不应：

- 直接判断敏感权限。
- 直接访问数据库。
- 写死模型供应商。
- 绕过后端执行高风险动作。

### 路由层

路由层负责：

- 请求体校验。
- 身份和授权检查。
- 风险等级声明。
- 调用服务层。
- 返回统一响应。
- 记录必要审计。

路由层不应包含复杂业务编排。

### 服务层

服务层负责：

- 对话理解。
- 记忆整理。
- 项目和任务编排。
- 模型路由。
- 工具选择。
- 执行状态机。
- 蜂群调度。
- 梦境复盘。

### 数据层

数据层负责：

- 表定义。
- Repository。
- 事务。
- 查询。
- 数据迁移。

业务语义应尽量在服务层表达，数据层不做隐式业务判断。

## 实时通道

WebSocket 用于：

- Z3 蜂群同步。
- 实时语音。
- ASR。
- 远程控制。
- 节点状态。

涉及外部影响的实时指令仍需经过权限、风险和审计。

## 架构演进方向

近期应逐步抽出：

- `ConversationUnderstandingEngine`
- `MemoryService`
- `ModelRouter`
- `ToolRegistry`
- `PermissionGate`
- `RiskClassifier`
- `ExecutionEngine`
- `AuditTrail`
- `TechRadar`
- `VoiceRouter`
