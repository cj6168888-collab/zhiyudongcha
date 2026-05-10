# 领航者 (Navigator-X)

企业向 AI 助手后端与配套前端：Express API、会话与 CSRF、WebSocket 实时通道，以及 Vite + React 管理端。

本文档中的 **HTTP/WebSocket 路由** 以当前进程实际挂载为准：入口为 `server/index.ts`，业务路由由 **`server/routes.ts`** 中的 `registerRoutes` 注册（`import { registerRoutes } from './routes'` 在 Node/tsx 下解析为 **`server/routes.ts`**，与 `server/routes/index.ts` 中的 `registerAllRoutes` 不是同一套挂载）。

**文档基石（开发宪法、技术手册、史诗与 UI 规范）**：见 [docs/FOUNDATION_INDEX.md](docs/FOUNDATION_INDEX.md)。

---

## 技术栈（根目录 `package.json`）

| 类别 | 主要依赖 |
|------|-----------|
| 运行时 | Node.js（建议 ≥ 18）、TypeScript、`tsx` 开发启动 |
| 服务端 | Express、会话、`helmet`/`cors`/`compression`（见 `server/index.ts` 实际中间件链） |
| 数据 | `pg`、Drizzle ORM、Redis 相关配置见环境变量与 `server/lib/config-validator` |
| 前端 | Vite 5、React 19、Tailwind 4，源码在 `client/`，开发端口 **5001**（`npm run dev:client`） |
| 移动端封装 | Capacitor（`capacitor.config.ts`、`android/`、`ios/`） |

---

## 开发与构建

```bash
npm install
cp .env.example .env   # 按需填写数据库、Redis、密钥等

# 后端 API（默认端口见环境变量 PORT，常为 3000）
npm run dev

# 前端（Vite，5001）
npm run dev:client

# 生产构建：见 script/build.ts，启动 dist/index.cjs
npm run build
npm start
```

---

## 入口与路由注册顺序（`server/index.ts`）

1. `validateEnvConfig()` 校验环境变量。  
2. `createSecurityMiddleware()` 等安全相关中间件。  
3. **Swagger UI**：`docsRouter` → `GET /api-docs`，`GET /swagger.json`（见 `server/routes/docs.ts`）。  
4. 请求体解析、Request ID。  
5. CSRF：先 `attachCSRFToken`，挂载 `GET /api/security/csrf-token`（`server/routes/csrf.ts`），再对后续路由应用 `csrfProtection`。  
6. **`await registerRoutes(httpServer, app)`**（**`server/routes.ts`**）。

---

## `server/routes.ts`：HTTP 路由一览

全局会先执行 `attachRole`（`server/middleware/auth.ts`）。下列前缀由 `register*` 或 `app.use` 挂载。

### 认证 `/api/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录（密钥校验 + 会话） |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/session` | 当前会话信息 |
| POST | `/api/auth/ws-token` | 签发 WebSocket 用短期 token |

实现：`server/routes/auth.ts`。

### 保险库与记忆 `/api/vault`、`/api/memories`、`/api/shred`、`/api/shadow-memory`

包含保险库 CRUD、语义/意图检索、粉碎、记忆列表与影子记忆等。  
实现：`server/routes/vault.ts`。

### 人物档案 `/api/persons`

列表、待审、洞察、冲突、审批（主人权限）等。  
实现：`server/routes/persons.ts`。

### 项目 `/api/projects`

聚合注册于 `server/routes/projects/index.ts`，子模块包括：

- `crud.ts`：列表/详情/创建/更新/状态  
- `dashboard.ts`：看板摘要、AI 洞察、风险告警  
- `notes.ts`、`files.ts`：笔记与文件  
- `swot.ts`：SWOT 与智能创建  
- `engine.ts`：分解、里程碑、任务、风险、日志等  

统一前缀 **`/api/projects`**（及子路径如 `/api/projects/:id/...`）。

### 领航者协议 `/api/navigator`

节点、令牌、舰队、紧急召回、审计、统计等（详见 `server/routes/navigator-core.ts` 文件头注释）。  
前缀 **`/api/navigator`**。

### 战备报告 `/api/report`

生成日报、最新、列表、详情、摘要、统计等。  
前缀 **`/api/report`**。  
实现：`server/routes/battle-report.ts`。

### 商务与聚合能力 `/api/business`

`server/routes/business.routes.ts` 挂载在 **`/api/business`**，例如：

| 方法 | 路径 |
|------|------|
| POST | `/api/business/experts/review` |
| POST | `/api/business/finance/analysis` |
| POST | `/api/business/experts/psych-analysis` |
| POST | `/api/business/experts/reasoning` |
| GET | `/api/business/workflow/status` |
| GET | `/api/business/system/audit` |
| GET | `/api/business/swarm/status` |
| POST | `/api/business/swarm/broadcast` |
| PUT | `/api/business/vault/:id` |

### 远程控制 `/api/remote`

设备列表、截图、控制指令、会话与状态等（相对路径挂载在 **`/api/remote`**）。  
实现：`server/routes/remote-control.ts`（文件头有端点说明）。

### 任务编排 `/api/tasks`

任务 CRUD、执行、执行历史等。  
实现：`server/routes/tasks.ts`（文件头有端点说明）。

### 告警 `/api/alerts`

活跃告警、待处理、统计、已读/消除等。  
实现：`server/routes/alerts.ts`（文件头有端点说明）。

### 扣子AI `/api/coze`

Coze (扣子) AI 平台集成服务，提供文档处理、翻译、摘要、AI对话等功能。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/coze/status` | 检查配置状态 |
| GET | `/api/coze/config` | 获取配置详情 |
| POST | `/api/coze/config` | 更新配置 |
| GET | `/api/coze/workflows` | 获取工作流列表 |
| GET | `/api/coze/workflows/:id` | 获取单个工作流 |
| GET | `/api/coze/workflows/category/:category` | 按分类获取工作流 |
| POST | `/api/coze/chat` | AI 对话 |
| POST | `/api/coze/workflow/:id` | 执行工作流 |

实现：`server/routes/coze.ts`。

### PC Agent `/api/pc-agent`

电脑端智能助手，执行文件整理、文档生成、系统优化、编程辅助等任务。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/pc-agent/capabilities` | 获取能力列表 |
| POST | `/api/pc-agent/execute` | 执行任务 |
| GET | `/api/pc-agent/status` | 获取执行状态 |

实现：`server/routes/pc-agent.ts`。

### 知识库 `/api/knowledge`

程序能力知识库与学习系统。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge/programs` | 获取程序列表 |
| GET | `/api/knowledge/programs/:id` | 获取程序详情 |
| GET | `/api/knowledge/search` | 搜索程序 |
| GET | `/api/knowledge/categories` | 获取分类统计 |
| GET | `/api/knowledge/category/:name` | 按分类获取 |
| GET | `/api/knowledge/intent` | 意图匹配 |
| POST | `/api/knowledge/learn` | 记录学习数据 |
| GET | `/api/knowledge/stats` | 学习统计 |
| POST | `/api/knowledge/discover` | 自动发现程序 |

实现：`server/routes/knowledge.ts`。

### 用户设置 `/api/user-settings`

用户偏好设置管理，包括 Coze AI 配置。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user-settings/:userId` | 获取用户设置 |
| PATCH | `/api/user-settings/:userId` | 更新设置（master权限） |
| GET | `/api/user-settings` | 获取所有用户设置 |

实现：`server/routes/user-settings.ts`。

### 健康检查 `GET /api/health`

在 `server/routes.ts` 内联注册：返回 HP、在线节点数、负载等遥测 JSON。

---

## WebSocket（在同一 `http.Server` 上）

| 路径 | 说明 |
|------|------|
| `/ws/z3` | Z3 分身核心：用户列表、聊天、状态同步等（`server/websocket/manager.ts`，`upgrade` 分流） |
| `/ws/asr` | 语音识别流（阿里云 ASR，`handleASRConnection`） |
| `/ws/realtime-voice` | 实时语音会话（`initRealtimeVoiceWebSocket`，`server/routes/realtime-voice.ts`） |
| `/ws/remote-control` | 远程控制通道（`remoteControlService.initialize` → `server/services/remote-control`） |

说明：`server/routes/realtime-voice.ts` 中的 **`registerRealtimeVoiceRoutes`**（HTTP `/api/realtime-voice/*`）**未**在 `server/routes.ts` 中调用；当前仅 **`initRealtimeVoiceWebSocket`** 会挂载 **`/ws/realtime-voice`** WebSocket。

---

## 其他目录说明

| 路径 | 作用 |
|------|------|
| `client/` | Web 前端（Vite root） |
| `server/routes/` | 各模块路由实现文件；**聚合文件 `index.ts` 的 `registerAllRoutes` 不是当前默认入口** |
| `shared/` | 前后端共享代码 |
| `database/`、`migrations/` | 数据库与迁移 |
| `docker-compose*.yml` | 容器编排 |

---

## 许可证

MIT（见 `package.json` 的 `license` 字段）。
