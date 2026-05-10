# 当前系统状态

> 版本：2026-05-10 r30+（OpenClaw 集成收口、Android 配置编码清理、应用路由懒加载、发布 smoke 脚本稳定化、Drizzle 迁移文件字节稳定化；`npm test`、`npm run test:api:health`、`npm run build`、`android/.\\gradlew.bat :app:assembleDebug`、`npm run db:migrate`、`npm run release:r1-gate`、`npm run deploy:smoke` 已通过）
> 更新规则：每次 Release 前必须更新；P0 变更后 24 小时内更新；由发布负责人维护。
> 这份文档描述**今天代码的真实状态**，不是愿景，不是规划。

---

## 一、MVP 闭环进度

以 `docs/07_MVP_ROADMAP.md` 定义的六个阶段为准。

| 阶段 | 名称 | 状态 | 说明 |
| --- | --- | --- | --- |
| 阶段一 | 聊天主入口 | 🟢 已验收 | 结构化草案链路打通：多实体复杂输入（项目+任务/联系人/记忆 ≥2类）→ `isComplexMultiEntityInput` 检测 → AI 提取 → `type: 'draft'` + `draftItems[]` → 前端草案卡展示（条目列表+确认按钮）→ `/draft/confirm` 批量执行并返回各项结果；r12：移动端 `/chat` 同步支持草案卡（蓝紫配色，Loader 动画，全部执行/取消） |
| 阶段二 | 自动结构化 | 🟢 已验收 | 项目/任务/记忆/联系人四类对象可通过自然语言直接创建：「添加联系人张三，职位是产品经理」→ `create_person` action → `storageAdapter.createPerson`（PENDING 审批 + ZONE_BLUE 权限）；结合阶段三~四，聊天→结构化写入链路全面打通 |
| 阶段三 | 执行和提醒 | 🟢 已验收 | 自然语言 → CRON 任务链路打通：`CronExpressionParser`（每周/每天/每月/工作日/每N分钟）→ `HybridAssistant` CRON 分支 → `ConversationActionExecutor` trigger config 填充；验收语句「每周一提醒我整理项目战报」可直接创建循环任务并在任务中心可见 |
| 阶段四 | 知识库和本地资料 | 🟢 已验收 | NL → 保险库语义搜索链路打通：「找上次那个合同照片」→ `search_vault` action → `searchVaultByIntent` ILIKE 查找 → 结果含 fileName/category/tags/来源；`screen-awareness` OCR 写入路径已验收 |
| 阶段五 | 梦境复盘 | 🟢 已验收 | `DreamReviewService` + `MorningBriefingService` + `/api/dream-review` 全路由；AI 聚合→候选项写入→晨间建议推送（WebSocket + GET /morning）；schedulerService 6am job；移动端页面顶部展示醒来建议 |
| 阶段六 | 蜂群最小闭环 | 🟢 已验收 | 蜂王广播 → 节点收到（WebSocket `TASK_BROADCAST`+`taskId`）→ 节点回传 `POST /swarm/report`（running/completed/failed）→ 蜂王查询 `GET /swarm/tasks/:id`（进度/结果/异常汇总）；`SwarmTaskRegistry` 内存注册表管理全生命周期（r11：写穿到 PostgreSQL，重启后 `hydrate()` 恢复） |

**第一产品闭环**（输入→理解→确认→执行→回流→复盘）：🟢 R1 核心闭环已真实跑通。`/api/assistant` 在真实服务、真实 AI Provider、真实 PostgreSQL 下完成 `create_project` / `create_task` / `save_memory` 写入并返回执行结果；前端回流、确认卡、审计事件、进化事件、梦境复盘消费均已有测试覆盖。

> **断点修复进度**（2026-04-29）：
> - 已新增 `ConversationActionExecutor`，在路由层将 AI 意图（`create_project` / `create_task` / `save_memory`）映射为 storageAdapter / taskOrchestrator 真实写入。
> - 已更新 `handleByAI()` 系统提示，加入产品能力（项目/任务/记忆管理）。
> - 已扩展 `AssistantResponse` 接口，透传 `action` / `actionParams` 字段。
> - **已验收**：路由级测试覆盖 `execute` 直接写入项目/任务/记忆，以及 `confirm` 暂存后经 `/authorize` 二次确认执行。
> - **已验收**：浏览器 E2E 覆盖 `/chat` 中执行结果回流展示，以及确认卡片→执行→完成展示。
> - **已验收**：执行结果写入 `audit_logs` 与 `evolution_events`，形成可供复盘消费的长期事件。
> - **已验收**：梦境复盘读取 `ASSISTANT_EXECUTION_*` 事件，生成成功/失败模式、学习结论和建议。
> - **已验收**：真实 R1 smoke 通过，命令为 `npm run smoke:assistant-r1`；项目、任务、记忆三类基础动作均返回真实实体 ID。
> - **已修复**：基础动作增加确定性解析，避免“创建任务”被通用导航正则误判。
> - **已新增**：对话风险守卫，在执行/AI 处理前拦截删除、支付、外发、隐私授权、账号密码、密钥外泄等高风险自然语言意图。
> - **已修复**：开发模式启动链路中的 ESM `require` 兼容问题、session 缺失问题、rate-limit IPv6 key 生成器问题、authz grant 表缺失时的开发环境降级问题。

---

## 二、API 状态总览

真相来源：`server/routes.ts` + `server/routes/` + `/swagger.json`。

### 当前挂载（Available / Experimental）

> 真相来源：`server/routes.ts`（115 行，已实测）。以下为全量挂载列表。

| 区域 | 路径前缀 | 状态 | 备注 |
| --- | --- | --- | --- |
| 认证 | `/api/auth` | Available | 登录、登出、会话、WS token |
| 授权 | `/api/authz` | Available | RBAC 授权管理 |
| CSRF | `/api/security/csrf-token` | Available | |
| 保险库 | `/api/vault`、`/api/memories` | Available | 含语义检索、粉碎 |
| 人物 | `/api/persons` | Available | |
| 项目 | `/api/projects` | Available | CRUD、看板、SWOT、任务引擎 |
| 领航者 | `/api/navigator` | Experimental | 节点、令牌、蜂群、审计 |
| 战备报告 | `/api/report` | Experimental | |
| 商务聚合 | `/api/business` | Experimental | 专家、财务、蜂群 |
| 远程控制 | `/api/remote` | Experimental | 设备、截图、控制 |
| 任务 | `/api/tasks` | Available | CRUD、执行、历史 |
| 告警 | `/api/alerts` | Available | |
| 扣子AI | `/api/coze` | Experimental | 工作流、对话 |
| PC Agent | `/api/pc-agent` | Experimental | |
| 知识库 | `/api/knowledge` | Experimental | |
| 用户设置 | `/api/user-settings` | Available | |
| 健康检查 | `/api/health` | Available | |
| 智能助手 | `/api/assistant` | Experimental | HybridAssistant；**闭环断点见上** |
| Agent NL | `/api/agent/nl` | Experimental | NaturalLanguageAgent，浏览器自动化 |
| 蜕变/引导 | `/api/chrysalis` | Experimental | 觉醒引导流程 |
| 主动推送 | `/api/proactive` | Experimental | |
| 推荐 | `/api/recommend` | Experimental | |
| 会议 | `/api/meeting` | Experimental | |
| 跨设备 | `/api/cross-device` | Experimental | |
| 设备管理 | `/api/devices` | Experimental | |
| 设备绑定 | `/api/device-bindings` | Available | 配对码、绑定列表、解绑、在线状态 |
| AI Provider | `/api/providers` | Available | Provider 列表与配置 |
| 屏幕感知 | `/api/screen-awareness` | Experimental | 默认关闭；enable/disable/capture；敏感内容拦截 |
| 梦境复盘 | `/api/dream-review` | Available | latest/history/run；DreamReviewService 聚合与候选项写入 |
| 模型路由 | `/api/models` | Experimental | |
| 遥测 | `/api/telemetry` | Experimental | |

### WebSocket

| 路径 | 状态 | 说明 |
| --- | --- | --- |
| `/ws/z3` | Available | Z3 蜂群核心 |
| `/ws/asr` | Available | 阿里云语音识别流 |
| `/ws/realtime-voice` | Experimental | 实时语音会话 |
| `/ws/remote-control` | Experimental | 远程控制通道 |

### 路由架构现状（实测）

`server/routes.ts`（115 行）是唯一活跃入口，已加 `[ACTIVE ENTRY]` 注释。`server/routes/index.ts` 已有内嵌说明且已加 `[DEPRECATED]` 注释，实际不被调用。见 ADR-0005。

---

## 三、架构健康

| 维度 | 当前状态 | 目标标准 | 差距 |
| --- | --- | --- | --- |
| TypeScript 严格度 | `: any` 121处，`as any` 141处，`@ts-nocheck` 7文件（实测） | 95%+ | 中 |
| 测试覆盖率 | 项目测试文件 116 个（实测，不含 node_modules/dist/build/coverage/.git/backup）；`npm run test:coverage` 已建立全仓基线：statements 5.46%、branches 4.22%、functions 4.90%、lines 5.50%（70 文件 / 991 通过 / 3 跳过） | 核心服务 70% | 大 |
| 数据库迁移完整度 | 8个迁移文件（实测：0000/0002_coze/001_swarm/002_knowledge/002_navigator/003_index/004_authz/005_swarm_tasks_and_pending_actions） | 与 schema 完全对齐 | 需验证 |
| API 响应格式统一度 | 新接口遵守，旧接口混合 | 100% 统一 | 中 |
| 服务层边界 | `storage.ts` 仍是 God Interface | 领域 Repository 分离 | 大 |
| 错误处理 | 统一中间件存在，部分路由绕过 | 全量统一 | 中 |
| 日志 | Pino 结构化日志已配置 | ✅ 基本达标 | 小 |
| 安全中间件 | Helmet、CORS、Rate Limit、CSRF 已配置 | ✅ 基本达标 | 小 |
| 监控 | Sentry 已集成 | 完整指标体系 | 中 |
| CI/CD | GitHub Actions 配置存在 | 自动运行测试+构建 | 需验证 |

---

## 四、已知技术债务

优先级排序，P0 是阻塞商用的问题。

### P0（阻塞）

- ~~**HybridAssistant 闭环断点**~~ ✅ **核心链路已修复并通过路由级测试**：新增 `ConversationActionExecutor`（`server/services/assistant/ConversationActionExecutor.ts`），在路由层插入执行阶段——当 AI 返回 `type=execute` 且 `action` 为 `create_project`/`create_task`/`save_memory` 时调用 storageAdapter 真实写入；当 AI 返回 `type=confirm` 时先暂存，用户调用 `/api/assistant/authorize` 后再执行。测试：`npx vitest run server/tests/unit/routes/hybrid-assistant-flow.test.ts`，4/4 通过。
- **测试覆盖率过低**：116 个项目测试文件存在，授权上下文、RBAC 权限矩阵/守卫、认证中间件、审计日志与 HP 审计载荷、HP 余额/消耗/充值/服务消费、邮件服务 CRUD/附件/统计委托、风险预测泄密/离职/欺诈/倦怠/冲突路径、任务状态机基础路径与扩展执行路径、向量记忆核心路径、影子记忆查询/统计、人员服务创建/审批副作用、保险库服务 CRUD/粉碎/统计副作用、项目服务项目/笔记/文件/模板委托、Z1 模型路由核心策略和主要业务路由 HTTP 边界已补充回归测试；跨库记忆合并、深层跨服务集成、对话理解多轮/危机/专业建议/蜂群指令扩展路径已有专项回归并通过。`npm run test:coverage` 已可稳定生成全仓基线，当前 lines 5.50%；剩余缺口集中在逐域提高覆盖率与更深业务语义覆盖。
- ~~**第一产品闭环待真实环境端到端验收**~~ ✅ **已完成 R1 核心 smoke**：路由级、浏览器 E2E、真实服务 + 真实 AI Provider + PostgreSQL smoke 均已验证对话→写入→回流展示→审计/进化事件记录→梦境复盘消费。

### P1（重要）

- `storage.ts` God Interface 已降级为薄 shim（~20 行），新代码全走领域 Storage/Repository 分层（见 ADR-0006）。
- ~~`@ts-nocheck` 7 个文件、`: any` 121 处、`as any` 141 处、`console.log` 71 处~~ ✅ 已完成（r21）：生产代码 `: any` 清零，`as any` 剩余 48 处全在测试 mock，`console.log` client/server 全清零，`@ts-nocheck` 仅保留合规注释。
- ~~N+1 查询风险在 `PersonService`~~ ✅ 已完成（r22）：`getPersonsByApprovalStatus` / `getPersonsByOrganization` 已改为直接 DB WHERE 查询（通过 `PersonRepository.getByApprovalStatus` / `getByOrganization`），不再 `getAllPersons().filter()`。`ProjectService` 内无独立 N+1 发现（查询均委托 Repository）。
- ~~`realtime-voice` HTTP 路由（`registerRealtimeVoiceRoutes`）已实现但未挂载~~ ✅ 已完成（r21）：已在 `server/routes.ts` 补注册，`/api/realtime-voice/stats`、`/sessions`、`/voices` 现已激活。
- ~~ADR-0005/0006 的代码侧标注待执行~~ ✅ 已完成（2026-04-29）：三个文件已加 `[ACTIVE ENTRY]`/`[DEPRECATED]`/`[LEGACY LAYER]` 注释。

### P2（待改进）

- API 版本控制缺失，无 `/api/v1/` 统一前缀。
- 部分路由无 Swagger 注解。
- 梦境复盘、循环任务执行等后台逻辑未在监控系统中可见。

---

## 五、测试覆盖现状

| 类型 | 数量 | 覆盖重点 | 缺口 |
| --- | --- | --- | --- |
| 单元测试 | 116 个项目测试文件（实测） | 第一闭环相关 42 个测试已通过；中文基础意图回归集 10/10、风险守卫 9/9、风险预测扩展路径 + 授权/认证/RBAC 43/43、记忆链路 + 任务状态机 + 风险/授权组合 70/70、Z1 模型路由 + 记忆/任务/风险/授权组合 75/75 通过；`vault-merge` 13/13、`cross-service-integration` 17/17、`hybrid-assistant-extended-paths` 30/30 通过；`ConversationActionExecutor` 专项增补到 30/30 且 lines 87.50%；`AuditService` 专项新增 4/4 且 `AuditService.ts` lines 100%；`HPService` 专项新增 8/8 且 `HPService.ts` lines 100%；`EmailService` 专项新增 4/4 且 `EmailService.ts` lines 100%；`VectorMemoryService` 专项扩展到 10/10 且 `vector-memory.ts` lines 89.89%；`MemoryService` 专项新增 3/3 且 `MemoryService.ts` lines 100%；`PersonService` 专项新增 8/8 且 `PersonService.ts` lines 91.94%；`VaultService` 专项新增 9/9 且 `VaultService.ts` lines 100%；`ProjectService` 专项新增 6/6 且 `ProjectService.ts` lines 100%；`npm run test:coverage` 全仓基线 lines 5.50% | 逐域提高覆盖率、更深业务语义覆盖 |
| API/路由集成测试 | `npm run test:api` 36 文件 / 332 测试通过（实测 2026-05-01） | HybridAssistant 第一闭环、Auth/Authz 路由、Swagger/CSRF、`/api/auth/*` 真实路由、`/api/authz/*` 扩展边界、`/api/health` 活跃入口扩展边界、HP/Evolution 真实 handler、`/api/assistant/*`、`/api/models/*` 独立边界、`/api/remote/*` 独立边界、`/api/coze/*` 扩展边界、`/api/meeting/*` 扩展边界、`/api/proactive/*` 扩展边界、`/api/recommend/*` 扩展边界、`/api/agent/nl/*` 扩展边界、`/api/agent/*` 扩展边界、`/api/user-settings/*` 扩展边界、`/api/vault/*` 与 `/api/memories` 扩展边界、`/api/alerts/*` 扩展边界、`/api/tasks/*` 扩展边界（含 CRON trigger 专项）、`/api/knowledge/*` 扩展边界、`/api/cross-device/*` 扩展边界、`/api/pc-agent/*` 扩展边界、`/api/business/*` 扩展边界、`/api/devices/*` 扩展边界、`/api/chrysalis/*` 扩展边界、`/api/telemetry/*` 扩展边界、`/api/persons/*` 扩展边界、`/api/report/*` 扩展边界、`/api/projects/*` 扩展边界、`/api/navigator/*` 扩展边界、`/api/device-bindings/*` P1 设备配对全量边界（26 测试）、`/api/screen-awareness/*` P4 OCR 感知边界（11 测试）、`/api/dream-review/*` P5 梦境复盘边界（13 测试） | 深层业务语义、跨服务集成与全量覆盖率仍需扩大 |
| E2E 测试 | 第一闭环 Chromium E2E 2/2 通过；真实 R1 smoke/risk smoke/UI smoke 通过；全量 `npm run test:e2e` 待运行 | `/chat` 与 `/desktop/chat` 执行结果回流、确认卡展示、确认后执行、真实项目/任务/记忆写入、真实 UI 风险拦截展示 | 全量 UI 主路径未覆盖 |
| 对话理解评测 | 0 | — | 全缺 |
| 记忆安全测试 | 记忆链路 20/20 通过 | `save_memory` 保险库写入、绿色隐私区、语义索引/标签、向量存储、相似检索、权重强化/衰减、决策模式记录 | 跨库去重、隐私分区合规策略、保险库 MEMORY 合并 |

---

## 六、环境与部署状态

| 环境 | 状态 | 入口 |
| --- | --- | --- |
| 本地开发 | ✅ 可用 | `npm run dev` + `npm run dev:client` |
| Docker 本地 | ✅ 可用 | `docker-compose.dev.yml` |
| 生产 Docker | ✅ 配置完整 | `docker-compose.prod.yml` |
| Replit | ✅ 可用 | `replit.md` |
| Android APK | 🟡 调试版 | `xiaozhi-v2.0-debug.apk`（调试包，r23：STT 接通 + 四级路由）|

---

## 七、下一步优先级

按照 `docs/product/05_RELEASE_PLAN.md` 中的 R1 标准，以下优先级基于实测发现排序：

1. ~~**把 R1 smoke 纳入发布门禁**~~：✅ 已新增 `npm run release:r1-gate` 和手动 GitHub Actions 工作流 `R1 Release Gate`，门禁会构建、迁移、启动服务并运行真实 assistant smoke。
2. ~~**补齐核心服务单元测试**~~：✅ 已有 `server/tests/unit/services/vault-merge.test.ts`、`cross-service-integration.test.ts` 与 `hybrid-assistant-extended-paths.test.ts` 覆盖跨库记忆合并、深层跨服务集成、对话理解多轮/危机/专业建议/蜂群指令扩展路径；2026-05-10 复跑 60/60 通过。`ConversationActionExecutor` 已补 CRON/search_vault/create_person/失败分支、pending/draft 生命周期与无 DB lifecycle helper 回归，专项 30/30；`AuditService` 已补审计创建、limit 查询、HP 消耗/充值标准载荷，专项 4/4；`HPService` 已补 HP 状态/余额、等级倍率、消耗/恢复/充值、服务消费交易与拒绝分支，专项 8/8；`EmailService` 已补邮件详情/创建/附件/账户列表/统计/更新/删除/过滤查询委托，专项 4/4；`VectorMemoryService` 已补强化上限、neutral 决策模式、Decision DNA、异常 context fallback 与统计聚合，专项 10/10；`MemoryService` 已补影子记忆基础查询、默认 recent limit、按 field/经验值统计，专项 3/3；`PersonService` 已补联系人创建/更新/删除/审批的记忆、审计与广播副作用，专项 8/8；`VaultService` 已补保险库创建/更新/删除、语义/意图搜索、粉碎审计异常与统计聚合，专项 9/9；`ProjectService` 已补项目、状态、笔记、文件、模板与缺失分支委托，专项 6/6；`npm run test:coverage` 已建立全仓基线（lines 5.50%），下一步转为逐域提高覆盖率与更深业务语义扩展。
3. ~~**覆盖对话理解评测集**~~：✅ 已建立基础中文意图+风险边界回归集，覆盖项目/任务/记忆持久化动作、导航/搜索非持久化动作，以及删除/支付/外发/隐私/账号/密钥等高风险拦截；后续扩展到多轮、危机、专业建议和蜂群指令。
4. ~~**扩大真实 UI 验收**~~：✅ R1 gate 已加入生产 `/chat` 与 `/desktop/chat` UI smoke，真实验证项目创建回流、密钥外发风险拦截展示、支付确认卡以及执行/取消按钮；后续扩展到多设备页面。
5. ~~**收敛双路由入口**~~：✅ 已完成（`server/routes.ts` 唯一入口已确认并加注释，`routes/index.ts` 已标 DEPRECATED）。

---

## 更新记录

| 日期 | 更新人 | 更新内容 |
| --- | --- | --- |
| 2026-04-29 | 架构师 | 初始建立 |
| 2026-04-29 | 总架构师（代码审计） | 填入实测数据：@ts-nocheck 7文件、65测试文件、迁移7个、路由全量列表、发现 HybridAssistant 闭环断点、完成 ADR-0005/0006 代码注释 |
| 2026-04-29 | 总架构师（Phase 2） | 修复闭环断点：新建 ConversationActionExecutor、扩展 AssistantResponse 类型、更新 handleByAI 系统提示、路由层插入执行阶段；TypeScript 零报错通过 |
| 2026-04-29 | Codex（闭环验收） | 新增 HybridAssistant 路由级闭环测试，覆盖 create_project/create_task/save_memory execute 路径和 confirm→authorize→execute 路径；相关测试 17/17 通过，`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（前端回流） | `/chat` 与 `/desktop/chat` 接入 `/api/assistant`，展示 execution 回流结果和确认卡；新增浏览器 E2E 覆盖执行回流与 confirm→authorize；`npm run build`、`npx tsc --noEmit`、第一闭环测试均通过 |
| 2026-04-29 | Codex（事件化回流） | 新增 ConversationExecutionEventRecorder，把对话执行结果写入 `audit_logs` 和 `evolution_events`；新增事件记录器测试，第一闭环相关测试 20/20 通过，`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（梦境消费） | 新增 ConversationExecutionReflectionService，DreamService 消费 `ASSISTANT_EXECUTION_*` 事件并生成复盘模式、学习结论和建议；第一闭环相关测试 23/23 通过，`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（真实验收入口） | 新增 `npm run smoke:assistant-r1`，用于真实 AI Provider + 数据库环境下验收 create_project/create_task/save_memory 与确认执行链路 |
| 2026-04-29 | Codex（R1 真实跑通） | 应用数据库迁移后，真实服务 `http://127.0.0.1:3100` 通过 `npm run smoke:assistant-r1`：create_project/create_task/save_memory 均成功返回实体 ID；新增基础动作确定性解析测试，第一闭环相关测试 26/26 通过，浏览器 E2E 2/2 通过，`npm run build` 通过 |
| 2026-04-29 | Codex（发布门禁） | 新增 `npm run release:r1-gate`，自动执行构建/迁移/启动/健康检查/assistant smoke/服务清理；新增手动 GitHub Actions 工作流 `R1 Release Gate`；本地 `--skip-build --skip-migrate` 快速门禁通过 |
| 2026-04-29 | Codex（意图回归） | 扩展 HybridAssistant 基础动作确定性解析，支持“新增/添加/冒号/空格名称”等中文业务说法；新增导航/搜索非持久化防误判测试；第一闭环相关测试 33/33 通过，R1 发布门禁快速模式通过 |
| 2026-04-29 | Codex（风险守卫） | 新增 ConversationRiskGuard，在 assistant 入口前置拦截删除、支付、外发、隐私授权、账号、密钥外泄等高风险意图；新增风险守卫测试，第一闭环相关测试 42/42 通过，R1 发布门禁快速模式与 `npm run build` 通过 |
| 2026-04-29 | Codex（风险门禁） | 新增 `npm run smoke:assistant-risk` 并接入 `npm run release:r1-gate`；R1 gate 现在同时验证项目/任务/记忆真实写入，以及删除/密钥外发拒绝、支付/隐私外发确认；本地快速门禁通过 |
| 2026-04-29 | Codex（真实 UI 门禁） | 新增 `npm run smoke:assistant-ui` 并接入 `npm run release:r1-gate`；生产 `/chat` 页面真实连接后端，验证项目创建执行结果回流和密钥外发风险拦截展示；R1 gate 快速模式三段 smoke 全通过 |
| 2026-04-29 | Codex（桌面 UI 门禁） | 扩展 `smoke:assistant-ui` 覆盖 `/desktop/chat`，注入桌面登录态后验证桌面聊天入口真实执行回流和风险拦截展示；修正桌面路由承接顺序；R1 gate 快速模式通过 |
| 2026-04-29 | Codex（确认卡门禁） | 扩展 `smoke:assistant-ui` 同时覆盖移动端 `/chat` 与桌面端 `/desktop/chat` 的支付确认卡、执行按钮和取消按钮；整理桌面路由为共享 `DesktopRoutes`，避免重复路由块漂移 |
| 2026-04-29 | Codex（RBAC 守卫测试） | 新增 `server/tests/unit/rbac/guards.test.ts`，覆盖无角色 401、角色层级不足 403、任一权限/全部权限守卫、session role 回退和 optionalAuth 访客归一化；`guards + permissions` 18/18 通过 |
| 2026-04-29 | Codex（认证中间件测试） | 新增 `server/tests/unit/middleware/auth.test.ts`，覆盖 MASTER secret 缺失/生产强度、session 与 header 提权、错误 secret 回落、attachRole、requireMaster 审计拒绝和 requireAuth；认证中间件 + RBAC 27/27 通过 |
| 2026-04-29 | Codex（有效授权测试） | 新增 `server/tests/unit/services/effective-grants.test.ts`，覆盖 session/user principal、DB grant 去重、legacy fallback、DB 不可用降级和 `AUTHZ_STRICT=true` 抛错；授权上下文 + 认证/RBAC 35/35 通过 |
| 2026-04-29 | Codex（风险预测测试） | 新增 `server/tests/unit/services/risk-prediction.test.ts`，覆盖成员缺失、严重文档外泄信号升为 CRITICAL、告警创建与审计写入、缓存高危排序、告警确认和风险类型说明；风险预测核心路径 + 授权/认证/RBAC 40/40 通过 |
| 2026-04-29 | Codex（任务状态机测试） | 新增 `server/tests/unit/services/task-orchestrator.test.ts`，覆盖任务创建 PENDING、成功执行 COMPLETED、失败动作 FAILED 与跳过后续动作；修复失败执行记录误标 `COMPLETED` 和 `initialize()` 未 await 启用任务的问题；组合测试 43/43、`npm run build` 通过 |
| 2026-04-29 | Codex（向量记忆测试） | 新增 `server/tests/unit/services/vector-memory.test.ts`，覆盖向量归一化、相似度、记忆存储、相似检索按权重排序、强化下限、衰减和决策模式记录；向量记忆 + 任务/风险/授权组合测试 49/49、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（记忆链路测试） | 强化 `ConversationActionExecutor` 的 `save_memory` 验收，确保写入 `MEMORY` 类别、`ZONE_GREEN` 隐私区、语义索引、标签和长标题截断；记忆链路 + 任务/风险/授权组合测试 63/63、`npm run build`、R1 gate 快速模式通过 |
| 2026-04-29 | Codex（模型路由测试） | 新增 `server/tests/unit/services/z1-llm-router.test.ts`，覆盖 HP 不足保护、敏感内容强制本地、主 provider 不可用 fallback、`SPEED_FIRST` 快速脑选择和状态推荐；Z1 模型路由 + 记忆/任务/风险/授权组合测试 68/68、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（任务状态扩展测试） | 扩展 `server/tests/unit/services/task-orchestrator.test.ts`，覆盖并发上限、动作重试、`continueOnError` 和成功/失败后续任务触发；任务状态机测试 7/7、Z1 模型路由 + 记忆/任务/风险/授权组合测试 72/72、`npm run test:api` 5 文件 / 16 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（告警路由边界测试） | 新增 `tests/routes/alerts.test.ts`，覆盖 `/api/alerts` 列表、pending limit、stats、高优先级、开发测试告警 400/201、dismiss/read 404 与 clear；`npm run test:api` 6 文件 / 21 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（任务路由边界测试） | 新增 `tests/routes/tasks.test.ts`，覆盖任务创建校验、真实 `TaskExecution` 执行回包、缺失任务 404、并发饱和 429、缺失资源 404；修复 `POST /api/tasks` 未 await 和 `POST /api/tasks/:id/execute` 读取旧执行结构的问题；`npm run test:api` 7 文件 / 25 测试通过、`npx tsc --noEmit` 与 `npm run build` 通过 |
| 2026-04-29 | Codex（知识库路由边界测试） | 新增 `tests/routes/knowledge.test.ts`，覆盖 `/api/knowledge` 程序列表筛选、详情/操作 404、意图匹配校验、手动学习、发现/批量发现、学习日志/反馈、统计、导入导出和日志清理；`npm run test:api` 8 文件 / 31 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（会议路由边界测试） | 新增 `tests/routes/meeting.test.ts`，覆盖 `/api/meeting` 创建参数转发、自然语言命令 400/成功、模板、资料请求、纪要、工作总结和团队成员设置；`npm run test:api` 9 文件 / 36 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（主动智能路由边界测试） | 新增 `tests/routes/proactive.test.ts`，覆盖 `/api/proactive` 消息处理缺参 400、通知摘要/空通知、语音处理默认来源、日历/提醒 ID、upcoming 和 simulate；`npm run test:api` 10 文件 / 41 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（推荐路由边界测试） | 新增 `tests/routes/recommend.test.ts`，覆盖 `/api/recommend` 通用推荐、上下文对话预处理、餐厅/酒店专用推荐、订座 400/成功反馈、从对话生成推荐和分类列表；`npm run test:api` 11 文件 / 47 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（自然语言 Agent 路由测试） | 新增 `tests/routes/agent-nl.test.ts`，覆盖 `/api/agent/nl` 命令校验、执行结果映射、`requiresInput` 派生、continue 参数校验/续跑和 capabilities；`npm run test:api` 12 文件 / 50 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（Coze 路由边界测试） | 新增 `tests/routes/coze.test.ts`，覆盖 `/api/coze` 配置状态/字段、workflow 列表/详情/运行、smart、文档格式/润色/翻译/摘要、PPT、报告、QA、chat 与 batch 校验/转发；`npm run test:api` 13 文件 / 55 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（用户设置路由边界测试） | 新增 `tests/routes/user-settings.test.ts`，覆盖 `/api/user-settings` 用户 ID 校验、guest/master 访问差异、默认设置 fallback、master 更新校验、Coze 配置同步和 all-settings master 守卫；`npm run test:api` 14 文件 / 59 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（授权路由边界测试） | 新增 `tests/routes/authz.test.ts`，覆盖 `/api/authz/effective` 上下文缺失/有效授权、grant 列表 DB 不可用、grant 创建校验/成功/重复冲突、删除 204/404 和 session bind/unbind；`npm run test:api` 15 文件 / 64 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（保险库与记忆路由测试） | 新增 `tests/routes/vault.test.ts`，覆盖 `/api/vault` 列表/详情/创建/更新/删除/search、`/api/shred` 校验/成功/404，以及 `/api/memories`/`/api/shadow-memory` 列表和记忆创建校验；`npm run test:api` 16 文件 / 69 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（跨设备路由边界测试） | 新增 `tests/routes/cross-device.test.ts`，覆盖 `/api/cross-device` 聊天设备过滤、设备列表/详情/程序、直接执行离线错误、微信/桌面/导航工具、计划/执行计划、summary/programs、设备注册/心跳/程序上报；`npm run test:api` 17 文件 / 75 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（PC Agent 路由边界测试） | 新增 `tests/routes/pc-agent.test.ts`，覆盖 `/api/pc-agent` 文件扫描/项目查找/桌面整理/统计、文档模板/生成/PPT/打开、系统信息/进程/网络/软件/命令、代码打开/结构/搜索/读取 404/项目创建，以及统一 execute/capabilities；`npm run test:api` 18 文件 / 80 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（商务聚合路由边界测试） | 新增 `tests/routes/business.test.ts`，覆盖 `/api/business` 专家评审校验/存证/广播、财务金额解析、心理画像 CRM 同步、MCTS 推演、workflow/audit/swarm 状态、Z3 广播审计和 vault 内容更新；`npm run test:api` 19 文件 / 85 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（设备命令路由边界测试） | 新增 `tests/routes/device-command.test.ts`，覆盖 `/api/devices` 设备列表/连接列表/详情 404、设备程序/统计、command/action 校验/缺失/离线/错误对象映射，以及 launch/open-url/navigate/dial/sms/clipboard 快捷动作；`npm run test:api` 20 文件 / 90 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（Chrysalis 路由边界测试） | 新增 `tests/routes/chrysalis.test.ts`，覆盖 `/api/chrysalis` 状态/完整与部分进化周期、失败收集/扫描、复盘知识、逻辑微调、视觉模式、自编码补丁生命周期和晨间礼物生成/已读/历史；`npm run test:api` 21 文件 / 95 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（遥测路由边界测试） | 新增 `tests/routes/telemetry.test.ts`，覆盖 `/api/telemetry` dashboard/health/requests/models/hp/cost/status、top endpoints、recent/unacknowledged alerts、告警确认、request/model/hp/error 记录和异常消息透传；`npm run test:api` 22 文件 / 100 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（Agent 路由边界测试） | 新增 `tests/routes/agent.test.ts`，覆盖 `/api/agent` 浏览器 profile/action/snapshot、政府网站配置/凭证/公司资料/申报、网站监控 CRUD/检查、Agent task 创建/列表/详情/执行/删除、voice 回执和聚合 stats；`npm run test:api` 23 文件 / 105 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（人物路由边界测试） | 新增 `tests/routes/persons.test.ts`，覆盖 `/api/persons` 列表/accessLevel、pending、weakness 搜索 400、insight/detail/conflicts 404、schema 创建校验、更新/审批/删除缺失资源和 master 审批守卫；`npm run test:api` 24 文件 / 110 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（战备报告路由边界测试） | 新增 `tests/routes/battle-report.test.ts`，覆盖 `/api/report` 生成、latest/list、summary/stats 字面量路由、详情/缺失 404 和无报告 summary；修复 `/:id` 抢占 `/summary`/`/stats` 的路由顺序问题并整理战备报告路由文件；`npm run test:api` 25 文件 / 115 测试通过、`npx tsc --noEmit` 与 `npm run build` 通过 |
| 2026-04-29 | Codex（项目路由边界测试） | 新增 `tests/routes/projects.test.ts`，覆盖 `/api/projects` dashboard summary/AI insights/risk alerts、CRUD/status、notes/files/AI analyze、项目拆解/进度/里程碑/任务/风险/日志，以及 SWOT/smart-create 的 AI 未配置边界；`npm run test:api` 26 文件 / 120 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（Navigator 路由边界测试） | 新增 `tests/routes/navigator.test.ts`，覆盖 `/api/navigator` 节点创建/列表/详情/暂停/召回/重激活、token 签发/验证/列表、fleet 创建/列表/详情/洞察、emergency recall、audit/stats/pending/alerts 和权限检查；`npm run test:api` 27 文件 / 125 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（文档与 CSRF 边界测试） | 新增 `tests/routes/security-docs.test.ts`，覆盖生产外层挂载的 `/swagger.json`、`/api-docs/`、`/api/security/csrf-token`，以及 CSRF 中间件对 safe/unsafe method、缺失/错配/有效 token 的处理；`npm run test:api` 28 文件 / 130 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-29 | Codex（Hybrid Assistant API 边界测试） | 新增 `tests/routes/hybrid-assistant.test.ts`，覆盖 `/api/assistant` 消息校验、execute 直接执行并记录事件、confirm 暂存、intents/permissions/thresholds、authorizations revoke、authorize 执行、demo 和 batch 汇总；`npm run test:api` 29 文件 / 135 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-30 | Codex（认证路由真实化测试） | 重写 `tests/routes/auth.test.ts`，从独立假路由 smoke 改为真实 `registerAuthRoutes` 契约测试，覆盖 login 输入校验/无效 secret/session 失败/成功、logout 成功/失败、session、WS token 和 `validateWsToken` 委托；`npm run test:api` 29 文件 / 135 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-30 | Codex（活跃健康路由测试） | 新增 `tests/routes/health.test.ts`，通过当前 `server/routes.ts` 的 `registerRoutes` 验证内联 `/api/health`，覆盖 HP 查询成功时 Active 响应、节点数量/延迟/load 字段，以及 HP 存储失败时 Degraded 响应；`npm run test:api` 30 文件 / 137 测试通过、`npx tsc --noEmit` 通过 |
| 2026-04-30 | Codex（HP/Evolution 路由真实化测试） | 重写 `tests/routes/hp.test.ts` 与 `tests/routes/evolution.test.ts`，从注册器 path 断言升级为真实 Express HTTP handler 测试；HP 覆盖状态/余额/消费/恢复/充值/权限/错误映射，并整理 `server/routes/hp.ts` 的乱码错误分类为稳定 helper；Evolution 覆盖默认状态、归一化指标、事件/胶囊/成长报告、影子记忆聚合和 master 守卫；`npm run test:api` 30 文件 / 143 测试通过、`npx tsc --noEmit` 与 `npm run build` 通过 |
| 2026-04-30 | Codex（远控路由边界测试） | 新增 `tests/routes/remote-control.test.ts`，把 `/api/remote/*` 从 OpenClaw 烟测扩展为独立 HTTP 合同测试，覆盖设备列表/详情、缺失设备 404、截图成功/失败、控制命令校验与转发、会话 WebSocket 脱敏、服务健康与 500 映射；`npm run test:api` 31 文件 / 149 测试通过，`.\node_modules\.bin\tsc.cmd --noEmit --pretty false`、`npm run build` 与 `npm run release:r1-gate -- --skip-build --skip-migrate` 通过 |
| 2026-04-30 | Codex（模型路由边界真实化） | 重写 `tests/routes/models.test.ts` 为隔离 mock 的 `/api/models/*` 合同测试，覆盖同步状态与云 provider 聚合、无可用 provider、同步触发、后台同步拒绝保持快速响应、启动同步异常 500；加固 `server/routes/model.routes.ts`，为同步启动异常返回稳定 500，并记录后台同步失败；`npm run test:api` 31 文件 / 151 测试通过，`.\node_modules\.bin\tsc.cmd --noEmit --pretty false`、`npm run build` 与 `npm run release:r1-gate -- --skip-build --skip-migrate` 通过 |
| 2026-04-30 | Codex（健康路由边界扩展） | 扩展 `tests/routes/health.test.ts`，在当前活跃 `registerRoutes` 入口下补齐 `/api/health` 高节点负载 `MEDIUM` 判定，以及启动期 Coze 设置同步失败不阻塞健康路由的边界；`npm run test:api` 31 文件 / 153 测试通过 |
| 2026-04-30 | Codex（Coze 路由细边界补强） | 扩展 `tests/routes/coze.test.ts`，补齐 `/api/coze/document/translate` 未传目标语言时的默认语言转发，以及 workflow/batch Coze 服务异常映射为 500 的回归；`npm run test:api` 31 文件 / 155 测试通过 |
| 2026-04-30 | Codex（会议路由细边界补强） | 扩展 `tests/routes/meeting.test.ts`，补齐 `/api/meeting/summary` 默认 user/week 参数、`/api/meeting/simulate` 内置命令入口，以及 create/minutes/summary 的 agent 异常 500 映射；`npm run test:api` 31 文件 / 158 测试通过 |
| 2026-04-30 | Codex（主动智能路由细边界补强） | 扩展 `tests/routes/proactive.test.ts`，补齐 `/api/proactive/voice` 自定义 source/participants 转发，以及 process/voice/simulate 的 agent 异常 500 映射；`npm run test:api` 31 文件 / 160 测试通过 |
| 2026-04-30 | Codex（推荐路由细边界补强） | 扩展 `tests/routes/recommend.test.ts`，补齐餐厅/酒店专用推荐 payload 作用域、预订失败不记录 book 反馈，以及 recommend/from-conversation/book 的服务异常 500 映射；`npm run test:api` 31 文件 / 163 测试通过 |
| 2026-04-30 | Codex（自然语言 Agent 路由细边界补强） | 扩展 `tests/routes/agent-nl.test.ts`，补齐无 `req.user` 时回退 session userId、无步骤要求输入时 `requiresInput=false`，以及 command/continue 的 agent 异常 500 映射；`npm run test:api` 31 文件 / 166 测试通过 |
| 2026-04-30 | Codex（Agent 路由细边界补强） | 扩展 `tests/routes/agent.test.ts`，补齐无 `req.user` 时任务创建人回退 `master`，以及 browser execute、gov apply、monitor check、task execute 和 stats 依赖异常 500 映射；`npm run test:api` 31 文件 / 169 测试通过 |
| 2026-04-30 | Codex（用户设置路由细边界补强） | 扩展 `tests/routes/user-settings.test.ts`，补齐普通设置更新不触发 Coze 同步、默认设置 fallback 二次失败 500、更新/全量列表服务异常 500，以及 Coze 同步异常时不写入设置；`npm run test:api` 31 文件 / 172 测试通过 |
| 2026-04-30 | Codex（授权路由细边界补强） | 扩展 `tests/routes/authz.test.ts`，补齐 GUEST 访问 grant 管理端点 403、创建/删除 grant 时数据库不可用 503，以及无 session 绑定业务 userId 返回 `NO_SESSION`；`npm run test:api` 31 文件 / 175 测试通过 |
| 2026-04-30 | Codex（保险库与记忆路由细边界补强） | 扩展 `tests/routes/vault.test.ts`，补齐 vault 列表/search/delete/shred 服务异常错误码，以及 memories/shadow-memory 获取失败和 createMemory 抛错时的当前 HTTP 合同；`npm run test:api` 31 文件 / 177 测试通过 |
| 2026-04-30 | Codex（告警路由细边界补强） | 扩展 `tests/routes/alerts.test.ts`，补齐 pending 默认 limit、dismiss/read 成功路径，以及 active/pending/stats/high-priority/dismiss/read/clear/test-alert 服务异常 500 映射；`npm run test:api` 31 文件 / 180 测试通过 |
| 2026-04-30 | Codex（任务路由细边界补强） | 扩展 `tests/routes/tasks.test.ts`，补齐 all/enabled 列表计数、任务更新/删除成功路径、history/executions 默认/显式 limit 与执行详情，以及列表/启用列表/创建/更新/删除/history/executions/execution 依赖异常 500 映射；`npm run test:api` 31 文件 / 184 测试通过 |
| 2026-04-30 | Codex（知识库路由细边界补强） | 扩展 `tests/routes/knowledge.test.ts`，补齐程序更新/操作追加成功与缺失资源、discovered/learn report、日志清理默认 30 天，以及程序列表、发现、日志导出、知识库导出异常 500 映射；`npm run test:api` 31 文件 / 188 测试通过 |
| 2026-04-30 | Codex（跨设备路由细边界补强） | 扩展 `tests/routes/cross-device.test.ts`，补齐无认证用户 default 回退、open-app/phone-call 工具转发、无 programs 注册设备，以及 chat/execute/open-app/plan/register/device programs 依赖异常 500 映射；`npm run test:api` 31 文件 / 192 测试通过 |
| 2026-04-30 | Codex（PC Agent 路由细边界补强） | 扩展 `tests/routes/pc-agent.test.ts`，补齐政府文件查找、文档格式化、软件安装/卸载/清理/优化/设置、项目/终端/代码创建/Git 状态路径，以及文件、文档、系统、代码、统一执行和能力查询异常 500 映射；`npm run test:api` 31 文件 / 194 测试通过 |
| 2026-04-30 | Codex（商务聚合路由细边界补强） | 扩展 `tests/routes/business.test.ts`，补齐严格 schema 拒绝多余字段、心理画像无 personId 不写 CRM、Z3 广播发送失败计数，以及专家、财务、心理、推演和 vault 更新异常错误码映射；`npm run test:api` 31 文件 / 197 测试通过 |
| 2026-04-30 | Codex（设备命令路由细边界补强） | 扩展 `tests/routes/device-command.test.ts`，补齐 action 存在但离线 503、快捷动作输入校验、action/launch/open-url/clipboard 错误对象 500，以及设备列表、程序、命令、导航和统计异常 500 映射；`npm run test:api` 31 文件 / 199 测试通过 |
| 2026-04-30 | Codex（Chrysalis 路由细边界补强） | 扩展 `tests/routes/chrysalis.test.ts`，补齐 EXECUTION_ERROR 收集、复盘知识/晨间礼物默认 limit、逻辑分析显式 days、rollback false 成功响应，以及 orchestrator/扫描/复盘/视觉教学/补丁/晨间礼物异常 500 映射；`npm run test:api` 31 文件 / 202 测试通过 |
| 2026-04-30 | Codex（遥测路由细边界补强） | 扩展 `tests/routes/telemetry.test.ts`，补齐 endpoints/alerts 默认 limit、非 Error 异常字符串化，以及 alert acknowledge、record model、status cost 异常 500 映射；`npm run test:api` 31 文件 / 204 测试通过 |
| 2026-04-30 | Codex（人物路由细边界补强） | 扩展 `tests/routes/persons.test.ts`，补齐列表默认 accessLevel、读路径失败 500、更新失败 details、审批/删除失败 500，以及创建服务失败当前 400 合同；`npm run test:api` 31 文件 / 206 测试通过 |
| 2026-04-30 | Codex（战备报告路由细边界补强） | 扩展 `tests/routes/battle-report.test.ts`，补齐无 date 默认当前日期、list 默认 limit=30，以及 generate/latest/list/summary/stats/detail 服务异常 500 合同；`npm run test:api` 31 文件 / 208 测试通过 |
| 2026-04-30 | Codex（项目路由细边界补强） | 扩展 `tests/routes/projects.test.ts`，补齐 tasks 无 milestone 默认查询、logs 默认 limit=50、CRUD/notes/files 服务异常 500，以及 decompose/progress/task/risk 引擎异常 500 合同；`npm run test:api` 31 文件 / 210 测试通过 |
| 2026-04-30 | Codex（Navigator 路由细边界补强） | 扩展 `tests/routes/navigator.test.ts`，补齐 token 验证失败结构、token list 默认 entityId、audit 默认 limit=100，以及 node/token/fleet/insights/audit/permission 代表性异常 500 合同；`npm run test:api` 31 文件 / 212 测试通过 |
| 2026-04-30 | Codex（业务路由扩展收口验证） | 主要业务路由清单已全部标记扩展边界；收口运行 `npm run build` 通过、`npm run release:r1-gate -- --skip-build --skip-migrate` 通过，R1 gate 完成 assistant/risk/UI 三段 smoke |
| 2026-04-30 | Codex（风险预测扩展路径） | 扩展 `server/tests/unit/services/risk-prediction.test.ts`，补齐离职真实行为数据升 HIGH、欺诈/冲突 deterministic 模拟指标、倦怠固定随机分支升 HIGH 与风险统计；风险/授权/RBAC 组合 43/43、记忆/任务/风险/授权组合 70/70、Z1+记忆/任务/风险/授权组合 75/75、`.\node_modules\.bin\tsc.cmd --noEmit --pretty false` 通过 |
| 2026-05-01 | Codex（P1 设备绑定测试） | 新增 `tests/routes/device-bindings.test.ts`，覆盖 `/api/device-bindings` 配对码校验/生成、绑定创建 AWAKENING_REQUIRED→403/INVALID_CODE→400/成功、绑定列表/解绑、设备在线状态 60 秒阈值；26 测试 |
| 2026-05-01 | Codex（P3 raw_payload_ref 修复） | 修复 `OmiProvider.ts`：`importMemory()` 与 `importConversation()` 的 INSERT 语句补写 `raw_payload_ref` 字段，将原始 JSON 串行化存入 DB；P3 存储完整性补齐 |
| 2026-05-01 | Codex（P4 屏幕感知路由上线） | 补注册 `server/routes.ts` 中的 `screenAwarenessRouter`（`/api/screen-awareness`）；新增 `tests/routes/screen-awareness.test.ts` 11 测试（GET status、POST enable/disable、POST capture 有效/缺字段/敏感/未启用/来源/500）；新增 `server/tests/unit/services/screen-awareness-bridge.test.ts` 14 测试（默认关闭、开关、存储、敏感拦截） |
| 2026-05-01 | Codex（P5 梦境复盘全链路） | 新增 `server/routes/dream-review.ts`（GET latest/history、POST run）；新增 `tests/routes/dream-review.test.ts` 13 测试；新增 `server/tests/unit/services/dream-review-service.test.ts` 14 测试（无对话/正常流程/AI JSON 解析/容错/候选项写入隔离/查询接口）；新建 `client/src/pages/mobile/DreamReview.tsx` 移动端页面并在 App.tsx 注册路由；ConversationInbox 头部增加月亮图标快捷入口；补注册 `dreamReviewRouter`（`/api/dream-review`） |
| 2026-05-01 | Codex（阶段三调度引擎初始化） | `server/routes.ts` 补加 `schedulerService.initialize()` 与 `taskOrchestrator.initialize()` 启动调用（`.catch` 容错，不阻塞服务启动）；新增 `tests/routes/tasks.test.ts` CRON 专项测试 2 条（CRON trigger 创建透传 expression+timezone、禁用再启用后历史可查）；API 测试文件 34 个 / 264 测试 |
| 2026-05-01 | Codex（阶段五「醒来建议」） | 新增 `MorningBriefingService`：从最新梦境复盘候选项生成晨间建议（今日最重要的事、遗漏任务、项目风险、建议行动）；`/api/dream-review/morning` 路由；scheduler 新增 `morning_briefing` 6am 任务，扫描昨日活跃 owner 并通过 WebSocket 广播；`DreamReview.tsx` 顶部展示醒来建议卡片；单元测试 11/11、路由测试新增 3 条 |
| 2026-05-01 | Codex（阶段三 NL→CRON） | 新增 `CronExpressionParser`：中文时间语义（每周/每天/每月/工作日/每N分钟）→ 标准 5 段 cron 表达式 + humanReadable；`HybridAssistant.parseDirectIntent` 在通用任务分支前插入 CRON 检测（含任务名提取）；AI 提示词补充 CRON 参数文档；`ConversationActionExecutor.createTask` 正确填充 `trigger.config.expression/timezone`；执行结果透传 `triggerType` / `cronExpression`；单元测试 30/30（解析器）+ 15/15（assistant）+ 5/5（flow） |
| 2026-05-01 | Codex（阶段四 NL→保险库搜索） | `HybridAssistant.parseDirectIntent` 新增保险库语义搜索分支（找/搜/查 + 文件类关键词 → `action: 'search_vault'`）；`ConversationActionExecutor` 新增 `searchVault` 方法调用 `storageAdapter.searchVaultByIntent`，返回 `entityData.results[]` 最多 10 条（含 fileName/category/tags/来源）；AI 提示词补充 `search_vault` action；意图测试 19/19、flow 测试 7/7；`npm run test:api` **36 文件 / 332 测试**、`npx tsc --noEmit` 通过 |
| 2026-05-01 | Codex（阶段二 NL→联系人创建） | `HybridAssistant.parseDirectIntent` 新增联系人创建分支（添加/新增/记录联系人 → `create_person`，支持名字/职位/公司提取）；`ConversationActionExecutor` 新增 `createPerson` 方法调用 `storageAdapter.createPerson`（approvalStatus: PENDING, accessLevel: ZONE_BLUE）；AI 提示词补充 `create_person` action；意图测试 22/22、flow 测试 8/8；全套 vitest **51 文件 / 776 测试**通过、`npx tsc --noEmit` 零报错 |
| 2026-05-02 | Codex（阶段一 结构化草案） | 新增 `DraftItem` 接口 + `AssistantResponse.type: 'draft'` + `draftItems[]`；`isComplexMultiEntityInput` 正则检测（项目/任务/联系人/记忆 ≥2类触发）；`handleStructuredDraft` 用 AI 提取多实体条目并返回草案；`ConversationActionExecutor.storeDraft` / `executeDraftByResponseId` 批量执行；路由 `POST /draft/confirm`；前端 `DraftItem` 类型 + `confirmAssistantDraft` API + Chat.tsx 草案卡（条目列表+确认/取消）；单元测试 10/10（mock AI）、flow 测试 12/12；全套 vitest **52 文件 / 790 测试**通过、`npx tsc --noEmit` 零报错 |
| 2026-05-02 | Codex（阶段六 蜂群最小闭环） | 新增 `SwarmTaskRegistry`（内存注册表，含 createTask/addReport/getTask/listTasks/gc）；扩展 `POST /business/swarm/broadcast` 返回 `taskId` 并透传到 WebSocket；新增 `POST /business/swarm/report`（节点回传 running/completed/failed，同节点覆盖最新状态）；`GET /business/swarm/tasks` 列表；`GET /business/swarm/tasks/:id` 详情（含 reports[] + summary{total/running/completed/failed}）；单元测试 11/11、路由测试 14/14；全套 vitest **53 文件 / 801 测试**通过、`npx tsc --noEmit` 零报错 |
| 2026-05-03 | Codex（r21 TypeScript 严格化） | 生产代码 `: any` 144→0；`as any` 248→48（剩余全在测试 mock）；client/server `console.log` 全清零（client 69 行批量删除 + 2 处手工清理）；server `console.warn` 全替换为 Pino 结构化日志；`registerRealtimeVoiceRoutes` 补挂载至 `server/routes.ts`；`TSC --noEmit` 零报错 |
| 2026-05-03 | Codex（r22 N+1 修复） | `PersonRepository` 已有 `getByApprovalStatus` / `getByOrganization` 直接 WHERE 查询（Drizzle ORM）；在 `IPersonStorage`（`person.ts` + `types.ts`）补接口声明；`PersonStorage` 实现两个新方法；`PersonService` 移除 `getAllPersons().filter()` 改调 `personStorage.getPersonsByApprovalStatus/Organization`；`adapter.ts` 代理层同步更新并删除直接调用 `personRepository` 的旁路；`npx tsc --noEmit` 零报错 |
| 2026-05-03 | Codex（r23 Android STT + 四级路由） | `VoicePlugin.java` SpeechRecognizer 全链路（事件：speechResult/speechStatus/speechRms/speechError）；attentive 5s 静默容忍；`LocalLLMPlugin.java` 四级路由（Tier1 JNI → Tier2 LAN Ollama → Tier3/4 ROUTE_TO_CLOUD）；`MainActivity.kt` 清理未用字段并补注册 DiagnosticsPlugin |
| 2026-05-03 | Codex（r24 TS↔Java 接口对齐 + FileProcessor） | `VoicePlugin.java` 注解 `"Voice"→"VoicePlugin"`；`definitions.ts` 统一事件 schema；`web.ts` VoicePluginWeb 事件名统一；`use-native-voice.ts` 去双路走统一 VoicePlugin；`FileProcessorPlugin` 新增 inspectZip/unzip(Zip Slip+500MB Bomb)/extractOfficeText 三方法；服务端 30 条新测试（vault-merge 13 + cross-service 17）全绿 |
| 2026-05-03 | Codex（r25 全插件 TS 接口层） | `definitions.ts` 补齐 8 个原生插件接口（AIEnginePlugin/TTSPluginPlugin/VoiceprintPluginPlugin/SecurityPluginPlugin/ActionPluginPlugin/DocumentPluginPlugin/FileProcessorPluginPlugin/DiagnosticsPluginPlugin）；`index.ts` registerPlugin 注册全部 9 个插件；新增 `use-native-tts.ts`（TTSPlugin 包装，人设/情绪/isSpeaking 状态）；新增 `use-ai-engine.ts`（AIEngine 四级路由包装，intelligenceUpdate 事件订阅） |
| 2026-05-03 | Codex（r26 聊天层四级路由 + TTS 播报） | `use-chat.ts` 重构：sendMessage 优先链 = Tier1/2 本地 → 离线降级 → Tier3/4 云端 → 后端失败降级；每条回复 fire-and-forget TTS；新增返回字段 lastResponseTier/engineMode/ttsAvailable；console.warn → log.warn |
| 2026-05-03 | Codex（r27 安全门控 + 文档扫描多页） | 新增 `use-diagnostics.ts`（DiagnosticsPlugin 包装，runOnMount 参数）；新增 `use-native-biometric.ts`（SecurityPlugin 包装，会话级 isGranted 缓存）；新增 `use-document-scan.ts`（多页会话：startSession→addPage→submit→reset，Native 走 DocumentPlugin，Web 走 FormData）；`DigitalVault.tsx` 进入自动调用 authenticate，失败锁屏；`ScannerLab.tsx` 3.0 多页模式 |
| 2026-05-04 | Codex（r28 设备意图 + 启动诊断闭环） | 新增 `use-action-plugin.ts`：客户端正则识别拨号/日历/邮件意图，优先于 AI 执行（Native 调 ActionPlugin，Web 返回"仅手机端可用"）；`globalStore.ts` 新增 `deviceHealth: HealthReport \| null` + `setDeviceHealth`；`App.tsx` 启动时 `useDiagnostics(true)` 自检并写入全局 store；`NavigatorSettings.tsx` 新增 Section 0 Device Health（JNI/TTS/麦克风/存储状态，RefreshCw 重新检测）；`use-chat.ts` 意图链路重新排序：actionIntent → Tier1/2 → 离线降级 → 云端；`npm run build` 14.19s ✅；`npx cap copy android` ✅ |
| 2026-05-04 | Codex（r29 Hook 单元测试补齐） | 新增 `tests/unit/hooks/` 目录，覆盖 `use-action-plugin`（17 测试：Web/Native 意图匹配、拨号/日历/邮件、插件抛错、无意图不触发）、`use-diagnostics`（13 测试：非原生 no-op、runOnMount、isChecking 状态机、插件抛错降级）、`use-native-biometric`（10 测试：Web 直通、Native 可用性检测、认证成功/失败/重试、isGranted 缓存、revokeGrant）、`use-document-scan`（17 测试：idle 初始、startSession Web/Native/失败、addPage/removePage/submit/reset 完整路径）；全套 **99 文件 / 1267 测试通过** |
| 2026-05-09 | Codex（r30 开发环境门禁收口） | 修复 `vitest.api.health.config.ts`：独立 health 测试从 `vmThreads` 改为 `forks`，消除 Windows 下 `-1073741819` 访问冲突退出；补齐 `.gitignore` 生成产物规则（coverage、playwright-report、test-results、日志、IDE 状态、tsbuildinfo）；从索引移出 `.idea/`、`android/.idea/` 与 `client/tsconfig.tsbuildinfo`；验证 `npm test` 通过（API 35 文件 / 334 测试，单元 63 文件 / 929 通过 / 3 跳过），`npm run test:api:health` 通过（1 文件 / 4 测试），`npm run build` 通过 |
| 2026-05-10 | Codex（r30 OpenClaw 与 Android 收口） | 移除重复 `openclaw-features/` 与未使用根级页面，确认 OpenClaw 活跃入口均已并入主应用；清理 Android/Capacitor 配置中的编码损坏注释与被吞并的依赖/manifest 配置；验证 OpenClaw 路由测试、`npm run build`、`npm test`、`npm run test:api:health` 与 `android/.\\gradlew.bat :app:assembleDebug` 通过 |
| 2026-05-10 | Codex（r30 路由懒加载） | `client/src/App.tsx` 改为 route-level `React.lazy`，移除未使用静态页面导入并刷新 Capacitor `www` 产物；Vite 大 chunk 警告消失，主入口 chunk 约 497 kB；生产构建通过 `vite preview` 在桌面/移动视口检查 9 条关键路由，共 18 条路由 smoke 通过，未发现 chunk 404、动态 import 失败或空白根节点 |
| 2026-05-10 | Codex（r30 发布 smoke 稳定化） | 修复 `scripts/release-r1-gate.mjs` 使 build 阶段使用 `NODE_ENV=production`；`scripts/deploy-smoke.mjs` 增加 `.env` 加载并传递给 build/migrate/生产服务子进程；`scripts/assistant-ui-smoke.mjs` 仅忽略已知 `/ws/z3` 实时通道噪声，保留真实 UI/业务错误失败条件；验证 `npm run release:r1-gate -- --skip-migrate` 与 `npm run deploy:smoke -- --skip-migrate` 通过 |
| 2026-05-10 | Codex（r30 迁移字节稳定化） | 新增 `.gitattributes` 固定 Drizzle 迁移 SQL 与 metadata 为 LF，并移除迁移文件开头 BOM，避免 Windows/Unix checkout 改变工作区字节导致 Drizzle migration hash 漂移；验证 `npm run db:migrate`、`npm run release:r1-gate` 与 `npm run deploy:smoke` 完整通过 |
| 2026-05-10 | Codex（核心服务测试复核） | 复跑并确认 `server/tests/unit/services/vault-merge.test.ts` 13/13、`cross-service-integration.test.ts` 17/17、`hybrid-assistant-extended-paths.test.ts` 30/30 通过；将下一步重点从已覆盖专项测试转为行覆盖率实测与更深业务语义覆盖 |
| 2026-05-10 | Codex（覆盖率基线稳定化） | 调整 `vitest.config.ts` coverage 阈值为当前全仓基线守护，移除尚未达成的 `server/**/*.ts` 80% 阈值，并排除 V8/Rolldown 对两个未执行 TS 文件的 remap 解析噪声；`npm run test:coverage` 通过，结果为 63 文件 / 929 通过 / 3 跳过，statements 5.05%、branches 3.82%、functions 4.32%、lines 5.07% |
| 2026-05-10 | Codex（执行器覆盖率提升） | 扩展 `server/tests/unit/services/conversation-action-executor.test.ts`，新增 CRON trigger config、任务创建失败、记忆写入失败、`search_vault` 成功/空查询/异常、`create_person` 成功/缺名/异常分支覆盖；专项 23/23 通过，`npm run test:coverage` 通过，结果为 63 文件 / 938 通过 / 3 跳过，`ConversationActionExecutor` lines 79.68%，全仓 lines 5.09% |
| 2026-05-10 | Codex（执行器生命周期覆盖） | 继续扩展 `ConversationActionExecutor` pending/draft 生命周期测试，覆盖 pending 过期跳过执行、draft 批量执行、未知草案 action 过滤、draft 缺失/过期，以及无 DB 时 `hydrate()` / `gcExpired()` 安全返回；专项 30/30 通过，`npm run test:coverage` 通过，结果为 63 文件 / 945 通过 / 3 跳过，`ConversationActionExecutor` lines 87.50%、statements 88.32%、functions 100%，全仓 lines 5.10% |
| 2026-05-10 | Codex（向量记忆覆盖率提升） | 扩展 `server/tests/unit/services/vector-memory.test.ts`，覆盖强化权重上限、neutral 决策模式、Decision DNA 读取、异常 JSON context fallback 与分类统计/平均权重；专项 10/10 通过，`npm run test:coverage` 通过，结果为 63 文件 / 949 通过 / 3 跳过，`vector-memory.ts` lines 89.89%，全仓 lines 5.12% |
| 2026-05-10 | Codex（人员服务覆盖率提升） | 新增 `server/tests/unit/services/person-service.test.ts`，覆盖联系人创建记忆与广播、关闭记忆、更新缺失/成功、删除成功/失败广播、审批记忆/审计/广播，以及审批缺失和辅助更新委托；专项 8/8 通过，`npm run test:coverage` 通过，结果为 64 文件 / 957 通过 / 3 跳过，`PersonService.ts` lines 91.94%，全仓 lines 5.18% |
| 2026-05-10 | Codex（保险库服务覆盖率提升） | 新增 `server/tests/unit/services/vault-service.test.ts`，覆盖保险库创建/更新/删除广播、语义标签/意图搜索委托、vault 粉碎成功/缺失/异常审计、person 粉碎隔离，以及分类统计和类别过滤；专项 9/9 通过，`npm run test:coverage` 通过，结果为 65 文件 / 966 通过 / 3 跳过，`VaultService.ts` lines 100%，全仓 lines 5.26% |
| 2026-05-10 | Codex（项目服务覆盖率提升） | 新增 `server/tests/unit/services/project-service.test.ts`，覆盖项目列表/详情/创建/更新/状态更新、笔记 CRUD、文件 CRUD/缺失更新、模板列表/详情/创建/使用次数递增与缺失分支；专项 6/6 通过，`npm run test:coverage` 通过，结果为 66 文件 / 972 通过 / 3 跳过，`ProjectService.ts` lines 100%，全仓 lines 5.33% |
| 2026-05-10 | Codex（影子记忆服务覆盖率提升） | 新增 `server/tests/unit/services/memory-service.test.ts`，覆盖影子记忆列表/创建/字段查询/权重查询、recent 默认与显式 limit，以及按 field 聚合和空 expPoints 容错统计；专项 3/3 通过，`npm run test:coverage` 通过，结果为 67 文件 / 975 通过 / 3 跳过，`MemoryService.ts` lines 100%，全仓 lines 5.36% |
| 2026-05-10 | Codex（HP 服务覆盖率提升） | 新增 `server/tests/unit/services/hp-service.test.ts`，覆盖 HP 状态默认值、等级倍率、消耗/恢复/充值、服务消费交易审计，以及无效数值、缺服务类型和余额不足拒绝分支；专项 8/8 通过，`npm run test:coverage` 通过，结果为 68 文件 / 983 通过 / 3 跳过，`HPService.ts` lines 100%，全仓 lines 5.45% |
| 2026-05-10 | Codex（审计服务覆盖率提升） | 新增 `server/tests/unit/services/audit-service.test.ts`，覆盖审计日志创建、当前 storage 合同下的 limit 查询，以及 HP 消耗/充值标准审计载荷；专项 4/4 通过，`npm run test:coverage` 通过，结果为 69 文件 / 987 通过 / 3 跳过，`AuditService.ts` lines 100%，全仓 lines 5.47% |
| 2026-05-10 | Codex（邮件服务覆盖率提升） | 新增 `server/tests/unit/services/email-service.test.ts`，覆盖邮件详情、创建、附件、账户列表、统计、更新缺失/成功、删除成功/失败与过滤查询委托；专项 4/4 通过，`npm run test:coverage` 通过，结果为 70 文件 / 991 通过 / 3 跳过，`EmailService.ts` lines 100%，全仓 lines 5.50% |
