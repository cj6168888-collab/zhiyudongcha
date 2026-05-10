# 技术手册（TECHNICAL MANUAL）

> 本手册是仓库的 **技术真值（Source of Truth）** 之一，与根目录 `README.md` 中的路由章节互补：`README` 偏快速执行，本手册偏 **边界、分层与演进约束**。

---

## 1. 技术栈（摘要）

| 层级 | 选型 | 备注 |
|------|------|------|
| 语言 | TypeScript | 服务端与前端统一 |
| 服务端 | Node.js + Express | 入口 `server/index.ts` |
| 数据库 | PostgreSQL + Drizzle ORM | 模式见 `shared/schema.ts`（体量大，改表需谨慎） |
| 缓存 | Redis | 配置经环境变量，见 `server/index.ts` / 校验逻辑 |
| 前端 | Vite 5 + React 19 + Tailwind 4 | 根目录 `client/`，别名 `@` → `client/src` |
| 组件 | shadcn/ui（new-york）+ Radix | `components.json` |
| 实时 | `ws`（WebSocket） | 路径见下文 |

---

## 2. 进程入口与路由真相

### 2.1 后端入口

- **主进程**：`server/index.ts`（`npm run dev` → `tsx server/index.ts`）。
- **路由注册函数**：`import { registerRoutes } from './routes'` 解析为 **`server/routes.ts`**（不是 `server/routes/index.ts`）。

### 2.2 `server/routes.ts` 挂载范围（HTTP）

全局中间件（在 `registerRoutes` 内、各业务路由之前）：

- `attachRole` → `req.userRole`
- `attachAuthzContext` → `req.authz`（见 `server/middleware/authorization.ts`、`server/services/authz/effective-grants.ts`）

包括但不限于：

- `registerAuthRoutes` → `/api/auth/*`
- `registerAuthzRoutes` → `GET /api/authz/effective`；管理端（均需 **MASTER**）：`GET/POST /api/authz/grants`、`DELETE /api/authz/grants/:id`、绑定会话用户 `POST/DELETE /api/authz/session/bind-user`
- `registerProjectRoutes` → `/api/projects/*`
- `registerVaultRoutes`、`registerPersonsRoutes`
- `registerNavigatorRoutes` → `/api/navigator/*`
- `registerBattleReportRoutes` → `/api/report/*`
- `app.use('/api/business', …)`、`/api/remote`、`/api/tasks`、`/api/alerts`
- `GET /api/health`（内联）

**未在 `routes.ts` 中调用的注册函数**（例如某些模块里仅导出而未挂载的 HTTP）**不得在技术文档中写为「已上线」**，除非已合并进 `routes.ts` 或另有入口。

### 2.3 全局中间件（摘要）

以 `server/index.ts` 实际顺序为准：安全中间件、Swagger（`/api-docs`、`/swagger.json`）、body 解析、CSRF（`/api/security/csrf-token` 等）、`registerRoutes`。

### 2.4 WebSocket（与 HTTP 同端口）

| 路径 | 职责 |
|------|------|
| `/ws/z3` | Z3 分身核心、广播与用户列表等（`server/websocket/manager.ts`） |
| `/ws/asr` | 语音识别流 |
| `/ws/realtime-voice` | 实时语音（`initRealtimeVoiceWebSocket`） |
| `/ws/remote-control` | 远程控制（`RemoteControlService`） |

---

## 3. 架构分层（约定）

```
client/src     → UI、路由、状态；通过 API 与 WS 与后端通信
server/routes  → HTTP 路由与校验薄层
server/services→ 业务规则、编排、外部 AI / 工具
shared/        → 共享类型与 schema；数据库表定义
```

**禁止**：在 React 组件内直接访问数据库；**禁止**：在未授权路径暴露管理员能力。

---

## 4. 与 Navigator‑X / 蜂群

- **核心服务**：`server/services/navigator-core.ts`（权限资源类型中含 `INSIGHT`「智语洞察」及舰队相关资源）。
- **能力枚举与授权矩阵（v0）**：见 [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md)。
- **产品叙事**：见 `docs/SYSTEM_DESIGN.md`；**工程约束**：见 [CONSTITUTION.md](./CONSTITUTION.md) 双轨与权限真值。

---

## 5. 前端构建

- 开发：`npm run dev:client`（Vite，默认 **5001**）。
- 构建产物：由 `script/build.ts` 与 `vite.config.ts` 约定（前端输出至 `dist/public` 等，以脚本为准）。

---

## 6. 配置与环境

- 模板：`.env.example`（若存在）。
- 启动前校验：`validateEnvConfig()`（见 `server/lib/config-validator`）。

---

## 7. 授权数据

- 表：`authz_grants`（见 `shared/schema.ts`），迁移文件 `migrations/004_authz_grants.sql`。
- 行为说明：[adr/0001-authorization-model.md](./adr/0001-authorization-model.md)。

## 8. 文档与代码漂移时的处理

1. 以 **可运行代码** 为准更新文档。  
2. 若产品需「先文档后实现」，须在 [PRODUCT_EPICS.md](./PRODUCT_EPICS.md) 标 **状态：规划中**，并在实现后回填本手册。

---

**版本**：1.0.0 **日期**：2026-04-19
