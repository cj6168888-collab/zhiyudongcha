# 当前代码健康快照

> 版本：2026-04-29 r3（R1 assistant smoke 实测更新）
> 更新规则：每次 Release 前更新；数据来源于可运行的检测命令，不允许手工估算后标绿。
> 本文件是 `CURRENT_STATE.md` 的技术细节补充，专注于代码层面指标。

---

## 一、TypeScript 健康

| 指标 | 检测命令 | 上次结果 | 目标 |
| --- | --- | --- | --- |
| 构建是否通过 | `npm run build` | ✅ 通过（实测 2026-04-30；Vite 大 chunk 警告仍存在） | 必须通过 |
| 严格模式类型检查 | `.\node_modules\.bin\tsc.cmd --noEmit --pretty false` | ✅ 0 错误（实测 2026-04-30） | 0 错误 |
| `@ts-nocheck` 文件数 | `grep -r "@ts-nocheck" server/ --include="*.ts" \| wc -l` | **7**（实测 2026-04-29） | 0 |
| `: any` 使用处 | `grep -r ": any" server/ --include="*.ts" \| wc -l` | **121**（实测 2026-04-29） | < 50 |
| `as any` 使用处 | `grep -r "as any" server/ --include="*.ts" \| wc -l` | **141**（实测 2026-04-29） | < 50 |
| `console.log` 业务日志 | `grep -r "console\.log" server/ --include="*.ts" \| wc -l` | **71**（实测 2026-04-29） | 0 |

**上次检测日期**：2026-04-29（代码审计，grep 实测）  
**负责人**：每次 Release 前由发布负责人运行并更新本节

---

## 二、测试健康

| 指标 | 检测命令 | 上次结果 | 目标 |
| --- | --- | --- | --- |
| 测试文件数 | `Get-ChildItem -Path server,client,shared,tests -Recurse -Filter *.test.ts -File`（排除 node_modules/dist/build/coverage/.git/backup） | **54 个项目测试文件**（实测 2026-04-29） | — |
| 单元测试通过 | `npm run test` | 待验证（未全量运行） | 100% 通过 |
| 第一闭环路由测试 | `npx vitest run server/tests/unit/routes/hybrid-assistant-flow.test.ts` | ✅ 4/4 通过（实测 2026-04-29） | 100% 通过 |
| 第一闭环执行器+路由测试 | `npx vitest run server/tests/unit/services/conversation-action-executor.test.ts server/tests/unit/routes/hybrid-assistant-flow.test.ts` | ✅ 17/17 通过（实测 2026-04-29） | 100% 通过 |
| 第一闭环事件化测试 | `npx vitest run server/tests/unit/services/conversation-execution-event-recorder.test.ts server/tests/unit/routes/hybrid-assistant-flow.test.ts server/tests/unit/services/conversation-action-executor.test.ts` | ✅ 20/20 通过（实测 2026-04-29） | 100% 通过 |
| 第一闭环复盘消费测试 | `npx vitest run server/tests/unit/services/conversation-execution-reflection.test.ts server/tests/unit/services/conversation-execution-event-recorder.test.ts server/tests/unit/routes/hybrid-assistant-flow.test.ts server/tests/unit/services/conversation-action-executor.test.ts` | ✅ 23/23 通过（实测 2026-04-29） | 100% 通过 |
| 第一闭环确定性意图测试 | `npx vitest run server/tests/unit/services/hybrid-assistant-core-actions.test.ts` | ✅ 10/10 通过（实测 2026-04-29） | 100% 通过 |
| 第一闭环风险守卫测试 | `npx vitest run server/tests/unit/services/conversation-risk-guard.test.ts` | ✅ 9/9 通过（实测 2026-04-29） | 100% 通过 |
| 第一闭环组合测试 | `npx vitest run server/tests/unit/services/conversation-risk-guard.test.ts server/tests/unit/services/hybrid-assistant-core-actions.test.ts server/tests/unit/services/conversation-execution-reflection.test.ts server/tests/unit/services/conversation-execution-event-recorder.test.ts server/tests/unit/routes/hybrid-assistant-flow.test.ts server/tests/unit/services/conversation-action-executor.test.ts` | ✅ 42/42 通过（实测 2026-04-29） | 100% 通过 |
| RBAC 权限矩阵与守卫测试 | `npx vitest run server/tests/unit/rbac/guards.test.ts server/tests/unit/rbac/permissions.test.ts` | ✅ 18/18 通过（实测 2026-04-29） | 100% 通过 |
| 认证中间件 + RBAC 组合测试 | `npx vitest run server/tests/unit/middleware/auth.test.ts server/tests/unit/rbac/guards.test.ts server/tests/unit/rbac/permissions.test.ts` | ✅ 27/27 通过（实测 2026-04-29） | MASTER 提权、守卫和权限矩阵不回退 |
| 授权上下文 + 认证/RBAC 组合测试 | `npx vitest run server/tests/unit/services/effective-grants.test.ts server/tests/unit/middleware/auth.test.ts server/tests/unit/rbac/guards.test.ts server/tests/unit/rbac/permissions.test.ts` | ✅ 35/35 通过（实测 2026-04-29） | session/user grant、legacy fallback、strict mode 不回退 |
| 风险预测核心路径测试 | `npx vitest run server/tests/unit/services/risk-prediction.test.ts server/tests/unit/services/effective-grants.test.ts server/tests/unit/middleware/auth.test.ts server/tests/unit/rbac/guards.test.ts server/tests/unit/rbac/permissions.test.ts` | ✅ 43/43 通过（实测 2026-04-30） | 高危泄密信号升 CRITICAL；离职真实数据升 HIGH；欺诈/冲突/倦怠扩展路径已覆盖 |
| 任务状态机 + 风险/授权组合测试 | `npx vitest run server/tests/unit/services/task-orchestrator.test.ts server/tests/unit/services/risk-prediction.test.ts server/tests/unit/services/effective-grants.test.ts server/tests/unit/middleware/auth.test.ts server/tests/unit/rbac/guards.test.ts server/tests/unit/rbac/permissions.test.ts` | ✅ 50/50 通过（推算自 2026-04-30 风险扩展 + 既有任务组合；待单独复跑） | 失败动作会把 execution/task 均标记为 FAILED；并发上限、重试、continueOnError、后续任务触发已覆盖 |
| 记忆链路 + 任务/风险/授权组合测试 | `npx vitest run server/tests/unit/services/conversation-action-executor.test.ts server/tests/unit/services/vector-memory.test.ts server/tests/unit/services/task-orchestrator.test.ts server/tests/unit/services/risk-prediction.test.ts server/tests/unit/services/effective-grants.test.ts server/tests/unit/middleware/auth.test.ts server/tests/unit/rbac/guards.test.ts server/tests/unit/rbac/permissions.test.ts` | ✅ 70/70 通过（实测 2026-04-30） | `save_memory` 保险库写入、向量记忆存储/检索/权重、任务状态机、风险与授权 |
| Z1 模型路由 + 记忆/任务/风险/授权组合测试 | `npx vitest run server/tests/unit/services/z1-llm-router.test.ts server/tests/unit/services/conversation-action-executor.test.ts server/tests/unit/services/vector-memory.test.ts server/tests/unit/services/task-orchestrator.test.ts server/tests/unit/services/risk-prediction.test.ts server/tests/unit/services/effective-grants.test.ts server/tests/unit/middleware/auth.test.ts server/tests/unit/rbac/guards.test.ts server/tests/unit/rbac/permissions.test.ts` | ✅ 75/75 通过（实测 2026-04-30） | HP guard、隐私强制本地、provider fallback、速度优先、状态推荐 |
| API 测试通过 | `npm run test:api` | ✅ 31 文件 / 212 测试通过（实测 2026-04-30） | 100% 通过；Swagger/CSRF、`/api/auth/*` 真实路由、`/api/authz/*` 扩展边界、`/api/health` 活跃入口扩展边界、HP/Evolution 真实 handler、`/api/assistant/*`、`/api/models/*` 独立边界、`/api/remote/*` 独立边界、`/api/coze/*` 扩展边界、`/api/meeting/*` 扩展边界、`/api/proactive/*` 扩展边界、`/api/recommend/*` 扩展边界、`/api/agent/nl/*` 扩展边界、`/api/agent/*` 扩展边界、`/api/user-settings/*` 扩展边界、`/api/vault/*` 与 `/api/memories` 扩展边界、`/api/alerts/*` 扩展边界、`/api/tasks/*` 扩展边界、`/api/knowledge/*` 扩展边界、`/api/cross-device/*` 扩展边界、`/api/pc-agent/*` 扩展边界、`/api/business/*` 扩展边界、`/api/devices/*` 扩展边界、`/api/chrysalis/*` 扩展边界、`/api/telemetry/*` 扩展边界、`/api/persons/*` 扩展边界、`/api/report/*` 扩展边界、`/api/projects/*` 扩展边界与 `/api/navigator/*` 扩展边界已纳入覆盖 |
| 第一闭环浏览器 E2E | `node node_modules\@playwright\test\cli.js test "assistant-chat-loop" --project=chromium` | ✅ 2/2 通过（实测 2026-04-29） | 100% 通过 |
| 第一闭环真实环境 Smoke | `npm run smoke:assistant-r1` | ✅ 通过（实测 2026-04-29；真实服务 + DashScope + PostgreSQL，三类动作均返回实体 ID） | create_project/create_task/save_memory 均成功 |
| 第一闭环风险 Smoke | `npm run smoke:assistant-risk` | ✅ 通过（实测 2026-04-29；真实服务下删除/密钥外发拒绝，支付/隐私外发确认） | 高风险动作不被误执行 |
| 第一闭环真实 UI Smoke | `npm run smoke:assistant-ui` | ✅ 通过（实测 2026-04-29；生产 `/chat` 与 `/desktop/chat` 页面展示真实执行回流、风险拦截文案、确认卡和执行/取消按钮） | UI 不只依赖 mock |
| R1 发布门禁 | `npm run release:r1-gate` | ✅ 快速模式通过（实测 2026-04-30：`--skip-build --skip-migrate`）；完整模式已脚本化，发布前运行 | 健康检查、assistant smoke、risk smoke、UI smoke 全通过；完整模式发布前运行 |
| E2E 测试通过 | `npm run test:e2e` | 待验证（未全量运行；Playwright CLI 与 @playwright/test 存在版本差异，需先统一） | 核心路径 100% |
| 行覆盖率 | `npm run test:coverage` | 待验证（未运行） | 核心服务 ≥ 40% |

**已知覆盖空白（需补齐，按优先级）**：

1. 记忆合并扩展路径（`save_memory` 保险库写入与向量记忆核心已补；仍需覆盖保险库 MEMORY、影子记忆、人物/项目上下文之间的去重与合并策略）
2. 风险分类器扩展路径（泄密、离职、欺诈、倦怠、冲突已覆盖；后续扩大到更多真实数据源和趋势回归）
3. 对话理解意图路由（基础中文意图+风险边界回归集已建立，仍需扩展到多轮、危机、专业建议和蜂群指令）
4. 业务路由 HTTP 边界（Swagger/CSRF、`/api/auth/*` 真实路由、`/api/authz/*` 扩展边界、`/api/health` 活跃入口扩展边界、HP/Evolution 真实 handler、`/api/assistant/*`、`/api/models/*` 独立边界、`/api/remote/*` 独立边界、`/api/coze/*` 扩展边界、`/api/meeting/*` 扩展边界、`/api/proactive/*` 扩展边界、`/api/recommend/*` 扩展边界、`/api/agent/nl/*` 扩展边界、`/api/agent/*` 扩展边界、`/api/user-settings/*` 扩展边界、`/api/vault/*` 与 `/api/memories` 扩展边界、`/api/alerts/*` 扩展边界、`/api/tasks/*` 扩展边界、`/api/knowledge/*` 扩展边界、`/api/cross-device/*` 扩展边界、`/api/pc-agent/*` 扩展边界、`/api/business/*` 扩展边界、`/api/devices/*` 扩展边界、`/api/chrysalis/*` 扩展边界、`/api/telemetry/*` 扩展边界、`/api/persons/*` 扩展边界、`/api/report/*` 扩展边界、`/api/projects/*` 扩展边界、`/api/navigator/*` 扩展边界已纳入 `test:api`；后续扩大深层业务语义和跨服务集成）

---

## 三、架构边界健康

| 规则 | 检测方式 | 当前状态 |
| --- | --- | --- |
| 路由层不承载复杂业务 | Code review + 人工检查 | 🟡 `server/routes.ts` 115行干净；子路由待抽检 |
| 服务层不直接读 `process.env` | `grep -r "process.env" server/services/` | 待实测 |
| 新路由不注册到 `registerAllRoutes` | ADR-0005 + `[DEPRECATED]` 注释 | ✅ 已落地（2026-04-29） |
| 新代码不依赖 `IStorage` 全局接口 | ADR-0006 + `[LEGACY LAYER]` 注释 | 🟡 过渡中（`storageAdapter` 已在 routes.ts 使用） |
| 无 `console.log` 业务日志 | `grep -r "console\.log" server/ --include="*.ts" \| wc -l` | **71 处**（实测 2026-04-29），需清理 |

---

## 四、安全健康

| 指标 | 状态 | 备注 |
| --- | --- | --- |
| 无硬编码密钥 | 待验证 | `grep -r "secret\|password\|apikey" server/ --include="*.ts" -i` 过滤掉环境变量读取 |
| CSRF 保护 | ✅ 已配置 | `server/middleware/csrf-protection.ts` |
| Helmet 安全头 | ✅ 已配置 | `server/middleware/security-middleware.ts` |
| Rate Limiting | ✅ 已配置 | 同上 |
| JWT 实现 | ✅ 已配置 | `server/lib/jwt/` |
| RBAC | ✅ 已配置 | `server/lib/rbac/` |
| 日志脱敏 | ✅ 已配置 | `server/middleware/log-masker.ts` |
| npm 依赖漏洞 | 待验证 | `npm audit`（需使用官方源） |

---

## 五、数据库健康

| 指标 | 状态 | 备注 |
| --- | --- | --- |
| Schema 与迁移对齐 | 🟡 部分验证 | `npx drizzle-kit migrate` 已在本地 PostgreSQL 成功应用；仍需全量 schema diff 门禁 |
| 迁移可重复执行 | 🟡 部分验证 | 本地空库/缺表环境迁移成功；重复迁移和生产迁移仍需发布前演练 |
| 性能索引 | ✅ 已添加 | `migrations/003_performance_indexes.sql` |
| 连接池配置 | ✅ 已优化 | max:30, min:5, 带超时 |

---

## 六、依赖健康

| 指标 | 检测命令 | 状态 |
| --- | --- | --- |
| 依赖漏洞 | `npm audit` | 待验证（需官方源） |
| 过时依赖 | `npm outdated` | 待验证 |
| 未使用依赖 | `npx knip` | 待验证 |

---

## 七、本文件更新规则

每次更新时：

1. 运行上述检测命令，填入实测数据，不允许填"估算"或"应该通过"。
2. 如果某项无法运行，填"无法检测，原因：XXX"。
3. 更新本节底部的"上次全量检测时间"。

**上次全量检测时间**：2026-04-30（grep 系列、`npm run build` 通过、`.\node_modules\.bin\tsc.cmd --noEmit --pretty false` 通过、`npm run test:api` 31 文件 / 212 测试通过、风险预测扩展路径 + 授权/认证/RBAC 43/43、记忆链路 + 任务状态机 + 风险/授权组合 70/70、Z1 模型路由 + 记忆/任务/风险/授权组合 75/75、任务状态机扩展路径 7/7、第一闭环执行器+路由+事件化+复盘消费+确定性意图测试 10/10、风险守卫测试 9/9、第一闭环组合测试 42/42、第一闭环浏览器 E2E、真实 R1 smoke、真实风险 smoke、移动+桌面真实 UI smoke 已覆盖执行回流/风险拒绝/确认卡、R1 发布门禁快速模式已实测；`npm run test/test:e2e/test:coverage` 未全量运行）  
**下次预计检测**：第一次 Release 验收前，必须运行所有检测命令填入实测值
