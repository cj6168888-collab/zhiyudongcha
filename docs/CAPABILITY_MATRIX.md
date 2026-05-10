# 能力字典与授权矩阵（v0）

> 本文件定义 **产品可授权能力** 与代码中 **Navigator 核心枚举** 的对照，供注册默认包、后台按用户授权、以及后续 `grants` 表设计使用。  
> **权威来源**：`server/services/navigator-core.ts` 中的 `ResourceType`、`Capability`、`ActionType`、`PermissionScope`。若代码变更，须同步更新本文件。

**版本**：0.1.0 **日期**：2026-04-19

---

## 1. 为何需要两层：资源 vs 能力

| 概念 | 含义 | 类比 |
|------|------|------|
| **ResourceType** | 受保护的 **数据域 / 功能域**（对谁可见、可改哪类对象） | 「保险库」「舰队」 |
| **Capability** | 可执行的 **动作型能力**（常映射到 AI 或工作流） | 「文档分析」「草案生成」 |
| **ActionType** | 在该资源上的 **CRUD/执行/管理** | `READ` / `WRITE` / … |

**宪法要求**：对用户可见的「开通某功能」应能落到 **Resource + Action（+ Scope）** 或明确的 **Capability** 清单，见 [CONSTITUTION.md](./CONSTITUTION.md) 第二条。

---

## 2. ResourceType（资源类型）

| 代码值 | 中文名（建议） | 典型含义 | 个人轨 | 组织轨 |
|--------|----------------|----------|:------:|:------:|
| `CHAT` | 对话 | 多轮对话、上下文 | ✓ | ✓ |
| `KNOWLEDGE` | 知识库 | 检索、条目、向量域 | ✓ | ✓ |
| `CALENDAR` | 日历 | 日程、提醒 | ✓ | ✓ |
| `CONTACTS` | 联系人 | 人脉、关系网络 | ✓ | ✓ |
| `DOCUMENTS` | 文档 | 上传、版本、协同编辑 | ✓ | ✓ |
| `INSIGHT` | 智语洞察 | 洞察生成、查看与策略 | ✓ | ✓ |
| `CONTRACTS` | 合同 | 起草、审阅、归档 | ✓ | ✓ |
| `MCTS` | 博弈推演 | 蒙特卡洛 / 场景推演 | ✓ | ✓ |
| `VAULT` | 保险库 | 高敏存证、保险库条目 | ✓ | 视策略 |
| `SETTINGS` | 设置 | 账户与 Agent 偏好 | ✓ | 管理员 |
| `FLEET` | 舰队 | 节点、令牌、舰队画像 | — | ✓ |
| `REPORTS` | 汇报 | 日报/战备/组织汇报 | 只读可 | ✓ |
| `TASKS` | 任务管理 | 编排、分配、执行 | ✓ | ✓ |

**说明**：「个人轨 / 组织轨」为 **默认建议**；实际以 **Scope**（见 §4）与租户策略为准。

---

## 3. Capability（能力标签）

用于 **路由 AI 工具、专家席、或节点能力**；与 Resource 多对多，不必一一对应。

| 代码值 | 中文名（建议） | 常见依赖资源 |
|--------|----------------|--------------|
| `VOICE_INTERACTION` | 语音交互 | `CHAT`, `SETTINGS` |
| `TEXT_CHAT` | 文字聊天 | `CHAT` |
| `DOCUMENT_ANALYSIS` | 文档分析 | `DOCUMENTS`, `KNOWLEDGE` |
| `CALENDAR_MANAGE` | 日历管理 | `CALENDAR` |
| `CONTACT_LOOKUP` | 联系人查询 | `CONTACTS` |
| `REMINDER_SET` | 设置提醒 | `CALENDAR`, `SETTINGS` |
| `INSIGHT_VIEW` | 查看洞察 | `INSIGHT` |
| `INSIGHT_CONTROL` | 控制洞察 | `INSIGHT` |
| `CONTRACT_DRAFT` | 起草合同 | `CONTRACTS` |
| `MCTS_SIMULATE` | 博弈推演 | `MCTS` |
| `KNOWLEDGE_QUERY` | 知识查询 | `KNOWLEDGE` |
| `KNOWLEDGE_ADD` | 添加知识 | `KNOWLEDGE` |
| `DRAFT_GENERATION` | 草案生成 | `DOCUMENTS`, `REPORTS` |
| `AUTHENTICITY_AUDIT` | 真实性审计 | `DOCUMENTS`, `VAULT` |
| `PREFERENCE_ADAPT` | 偏好自适应 | `SETTINGS` |

---

## 4. ActionType 与 PermissionScope

### 4.1 ActionType

| 值 | 用途 |
|----|------|
| `READ` | 读 |
| `WRITE` | 写 |
| `DELETE` | 删 |
| `EXECUTE` | 执行（任务、推演、广播等） |
| `ADMIN` | 管理级（成员、策略、令牌） |

### 4.2 PermissionScope

| 值 | 用途 |
|----|------|
| `OWN` | 仅本人数据 |
| `FLEET` | 当前舰队 / 组织范围内 |
| `ALL` | 全局（慎用，多限系统角色） |
| `RESTRICTED` | 条件约束（配合 `PermissionCondition`） |

---

## 5. 默认包（示例，非强制）

用于 **Onboarding**：根据「职业模板」生成 **初始 grants**。以下为 **产品可改** 的示例，实施前需产品确认。

### 5.1 包：通用个人（`preset_personal_default`）

- 资源：`CHAT, KNOWLEDGE, CALENDAR, VAULT, SETTINGS` → `READ/WRITE` on `OWN`；`INSIGHT` → `READ` on `OWN`。
- 能力：`TEXT_CHAT, KNOWLEDGE_QUERY, REMINDER_SET, INSIGHT_VIEW, PREFERENCE_ADAPT`。

### 5.2 包：管理向（`preset_manager`）

- 在 5.1 基础上增加：`TASKS, REPORTS, DOCUMENTS`；`INSIGHT` 增加 `WRITE`；能力增加 `DOCUMENT_ANALYSIS, DRAFT_GENERATION`。

### 5.3 包：组织协作者（`preset_org_member`）

- 资源：`CHAT, TASKS, REPORTS, DOCUMENTS` 在 `FLEET` 上 `READ`；`WRITE` 按角色细分（后续迭代）。
- 能力：不含 `ADMIN` 级舰队操作 unless 角色为 Owner/Admin。

### 5.4 包：舰队管理（`preset_fleet_admin`）

- 资源：`FLEET, TASKS, REPORTS`；`ActionType` 含 `ADMIN` / `EXECUTE`；Scope `FLEET`。

---

## 6. 与「职业 / Agent 维度」的映射关系（逻辑）

| 用户选择 | 建议落点 |
|----------|----------|
| **职业** | 选用 §5 中某一 **预设包** 作为初始 grants；可在后台覆盖。 |
| **Agent 能力** | 映射为 **Capability** 子集；缺 grant 时不得仅依赖模型提示词「假装开通」。 |
| **性格** | 主要影响 **提示词与 UI**，**不单独**作为权限依据（宪法第二条）。 |
| **工作场景** | 可影响默认打开的 **Resource**（如偏重 `CALENDAR` vs `DOCUMENTS`），仍落到具体 grant。 |

---

## 7. 实现状态与后续

| 项 | 状态 |
|----|------|
| 枚举定义 | ✅ 已在 `navigator-core.ts` |
| 持久化 `authz_grants`（会话主体） | ✅ 表与迁移 `004_authz_grants.sql`；见 [adr/0001-authorization-model.md](./adr/0001-authorization-model.md) |
| 中间件与调试 API | ✅ `attachAuthzContext`、`GET /api/authz/effective`；保险库路由已挂 `requireResourceGrant` 示例 |
| 用户级主体 | ✅ `principal_kind=USER` + `session.userId` 合并加载；绑定 API 已提供 |
| 管理端 HTTP API | ✅ `GET/POST/DELETE /api/authz/grants`（需 MASTER） |
| 管理端 UI | ⏳ 见 [PRODUCT_EPICS.md](./PRODUCT_EPICS.md) US‑A‑02 |

---

## 8. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-04-19 | 初版：资源/能力/作用域与示例预设包 |
