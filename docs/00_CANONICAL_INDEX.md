# 生语助手权威文档索引

> 版本：2026-04-29 r2
> 状态：系统级文档基线（已补全当前真相层）

本目录从这一版开始，将项目文档收束为一套新的权威文档。旧文档、阶段报告、审计报告、升级计划仍可作为历史资料参考，但当它们与本套文档冲突时，以本索引列出的文档为准。

## 一句话定位

生语助手是一个“功能强大，但操作简单”的全能 AI 助手：她能倾听、记住、分辨、整理、探讨、执行、复盘、进化，并在主人授权下操作文件、照片、邮件、手机 App、电脑和团队蜂群，成为主人的副脑、守护者、执行者和组织协作中枢。

她不是一个堆满按钮的万能 App，而是一个能理解主人、调用资源、操作现有 App、完成任务的万能执行者。

## 权威阅读顺序

| 顺序 | 文档 | 用途 |
| --- | --- | --- |
| 1 | [01_PRODUCT_VISION.md](./01_PRODUCT_VISION.md) | 产品愿景、用户价值、四个主界面、核心闭环 |
| 2 | [02_SOVEREIGN_GUARDIAN_PROTOCOL.md](./02_SOVEREIGN_GUARDIAN_PROTOCOL.md) | 主权守护协议：忠诚、安全、隐私、预算、危机守护 |
| 3 | [03_INDIVIDUAL_AND_SWARM.md](./03_INDIVIDUAL_AND_SWARM.md) | 个体与蜂群的定义、边界、蜂王治理和协作契约 |
| 4 | [04_CORE_CAPABILITY_ARCHITECTURE.md](./04_CORE_CAPABILITY_ARCHITECTURE.md) | 核心能力架构：感知、记忆、推理、执行、工具、专家、梦境 |
| 5 | [05_MEMORY_KNOWLEDGE_ARCHITECTURE.md](./05_MEMORY_KNOWLEDGE_ARCHITECTURE.md) | 永久记忆、知识库、文件/照片/邮件读取、科学整理 |
| 6 | [06_EXECUTION_AND_APP_CONTROL.md](./06_EXECUTION_AND_APP_CONTROL.md) | 任务执行、手机/电脑/App 操作、循环任务和确认机制 |
| 7 | [07_MVP_ROADMAP.md](./07_MVP_ROADMAP.md) | 第一阶段落地路线：从聊天到项目、任务、梦境、蜂群 |
| 8 | [08_DOCUMENT_GOVERNANCE.md](./08_DOCUMENT_GOVERNANCE.md) | 文档治理规则：旧文档如何处理，新能力如何更新文档 |
| 9 | [09_OPEN_TECH_STRATEGY.md](./09_OPEN_TECH_STRATEGY.md) | 开放技术战略：模型、工具、App 和新技术如何持续接入 |
| 10 | [10_CONVERSATION_UNDERSTANDING.md](./10_CONVERSATION_UNDERSTANDING.md) | 自然语言对话与理解：模式路由、语气、结构化和执行闭环 |
| 11 | [11_IDENTITY_AWAKENING.md](./11_IDENTITY_AWAKENING.md) | 身份觉醒与个性化：名字、关系、人格、声音、授权和蜂群身份 |
| 12 | [12_PERCEPTION_DEVICE_AND_CONVERSATION_STRATEGY.md](./12_PERCEPTION_DEVICE_AND_CONVERSATION_STRATEGY.md) | 感知、外设与 Conversation 战略：Omi 借鉴、小智/ESP32 外设、手机端觉醒、Conversation 原始事实层 |

## 技术实现基线

技术规范从 [technical/00_TECH_INDEX.md](./technical/00_TECH_INDEX.md) 开始阅读。新代码的架构、目录、语言、API、数据、模型路由、安全、执行、移动端、测试和部署均以 `docs/technical/` 为准。

## UI/UX 设计基线

体验设计从 [design/00_DESIGN_INDEX.md](./design/00_DESIGN_INDEX.md) 开始阅读。新界面的信息架构、对话 UI、觉醒 UI、记忆 UI、任务 UI、蜂群 UI、声音头像、移动端、桌面端、可访问性和信任设计均以 `docs/design/` 为准。

## 产品交付基线

用户故事、功能清单、MVP 范围、验收标准和发布计划从 [product/00_PRODUCT_INDEX.md](./product/00_PRODUCT_INDEX.md) 开始阅读。后续排期和验收以 `docs/product/` 为准。

## 当前系统真相（先读这两份）

> **在读任何规范文档之前，先读这两份。它们描述今天代码的实际状态，不是愿景。**

| 文档 | 用途 |
| --- | --- |
| [../CURRENT_STATE.md](../CURRENT_STATE.md) | MVP 闭环进度、API 状态、已知技术债务、下一步优先级 |
| [technical/19_CURRENT_CODE_HEALTH.md](./technical/19_CURRENT_CODE_HEALTH.md) | TypeScript、测试、架构边界、安全、数据库的实测指标 |

---

## 工业化补强基线

以下文档用于把权威愿景落成可协作、可审计、可度量、可运营的工程体系：

| 文档 | 用途 |
| --- | --- |
| [PRODUCT_METRICS.md](./PRODUCT_METRICS.md) | 北极星指标、信任指标、AI 质量指标和事件采集 |
| [PRIVACY_AND_DATA_GOVERNANCE.md](./PRIVACY_AND_DATA_GOVERNANCE.md) | 数据分类、授权、记忆生命周期、外传、删除和蜂群边界 |
| [design/12_DESIGN_TOKENS_AND_COMPONENT_STATES.md](./design/12_DESIGN_TOKENS_AND_COMPONENT_STATES.md) | 设计 token、关键组件状态、空/加载/错误/确认规格 |
| [technical/12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md](./technical/12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md) | 日志、审计、指标、告警、降级和事故响应 |
| [technical/13_ENGINEERING_CONSISTENCY.md](./technical/13_ENGINEERING_CONSISTENCY.md) | 数据库、API、配置、错误、日志和服务初始化一致性 |
| [technical/14_CAPABILITY_AND_AUTHORIZATION_MATRIX.md](./technical/14_CAPABILITY_AND_AUTHORIZATION_MATRIX.md) | 资源、能力、动作、范围、风险和预设授权包 |
| [technical/15_DEVICE_AND_APP_CONTROL_SPEC.md](./technical/15_DEVICE_AND_APP_CONTROL_SPEC.md) | 跨设备、远程控制、App 操作、证据和降级规格 |
| [technical/16_API_LIVE_CONTRACT.md](./technical/16_API_LIVE_CONTRACT.md) | 当前 API 合约治理、状态标记和变更纪律 |
| [AI_GOVERNANCE_STANDARDS_MAPPING.md](./AI_GOVERNANCE_STANDARDS_MAPPING.md) | NIST AI RMF、OWASP LLM、WCAG、OpenTelemetry 标准映射 |
| [technical/17_LLM_SECURITY_AND_RED_TEAMING.md](./technical/17_LLM_SECURITY_AND_RED_TEAMING.md) | LLM 安全威胁模型、提示注入防护和红队测试 |
| [technical/18_EVALUATION_PROTOCOL.md](./technical/18_EVALUATION_PROTOCOL.md) | 对话、记忆、安全、执行和蜂群能力评测协议 |
| [product/06_RELEASE_ACCEPTANCE_SCORECARD.md](./product/06_RELEASE_ACCEPTANCE_SCORECARD.md) | Release 绿/黄/红灯验收和一票否决项 |
| [design/13_ACCESSIBILITY_PERFORMANCE_BASELINE.md](./design/13_ACCESSIBILITY_PERFORMANCE_BASELINE.md) | WCAG、ARIA、移动性能、实时状态和权限引导基线 |
| [adr/README.md](./adr/README.md) | 架构决策记录（含 ADR 模板和 6 个已有决策） |

## 新文档原则

1. 少写幻想，多写可落地的系统规则。
2. 所有能力都必须服务“强大但简单”的体验。
3. 所有读取、记忆、执行和外传都必须受主权守护协议约束。
4. 个人主权空间与蜂群组织空间必须在模型层、数据层、权限层都分开。
5. 新功能如果不能进入“输入 -> 理解 -> 整理 -> 执行 -> 回流 -> 进化”的闭环，就先不作为核心能力。
6. 技术实现不闭门造车；模型、工具、App、协议和外部能力都必须可插拔、可替换、可审计。
7. 自然语言入口先判断气氛，再处理事情；严肃任务结构化，闲聊陪伴生命化。
8. 每个个体都应通过觉醒问询形成独立身份、关系契约、人格、声音、记忆边界和执行边界。
9. 技术实现必须遵守 `docs/technical/` 的新基线，旧技术文档仅作历史和细节参考。
10. UI/UX 必须遵守 `docs/design/` 的体验基线：主入口是对话，强能力轻呈现，高风险清楚确认，记忆和蜂群边界可见。
11. 产品排期和验收必须遵守 `docs/product/` 的用户故事、功能清单、MVP 范围和验收标准。
12. 产品成熟度必须可度量：每个核心闭环都要能回答成功率、误执行率、信任风险和成本。
13. 隐私和数据治理必须覆盖完整生命周期：授权、读取、解析、索引、记忆、召回、外传、删除和蜂群共享。
14. 高风险能力上线前必须具备日志、审计、降级和事故响应路径。
15. 设备和 App 控制必须先有能力登记、权限检查、风险确认、证据回传和降级策略。
16. API 文档必须区分 Available、Experimental、Planned、Legacy 和 Deprecated，不得把规划能力写成已上线。
17. AI 治理必须能映射到外部可信 AI、安全、可访问性和可观测性标准。
18. LLM 能力上线前必须经过提示注入、敏感泄露、越权工具调用和过度自主红队测试。
19. 核心 AI 能力必须有评测集、指标、阈值和 release gate。

## 当前代码对应入口

| 产品区域 | 当前代码入口 |
| --- | --- |
| 聊天/对话 | `client/src/pages/chat.tsx`、`client/src/pages/desktop/Chat.tsx`、语音/对话相关 routes |
| 商务舱 | `client/src/pages/mobile/BusinessHub.tsx` |
| 聆听洞察 | `client/src/pages/mobile/InsightChamber.tsx`、`server/routes/insight-listener.ts` |
| 专家中心 | `client/src/pages/mobile/ExpertCenter.tsx`、`server/routes/business.routes.ts` |
| 项目中心 | `client/src/pages/mobile/ProjectManager.tsx`、`server/routes/projects/` |
| 记忆/保险库 | `client/src/pages/mobile/DigitalVault.tsx`、`server/routes/vault.ts` |
| 任务中心 | `client/src/pages/mobile/TaskCenter.tsx`、`server/routes/tasks.ts` |
| Navigator-X | `client/src/pages/mobile/NavigatorCommand.tsx`、`server/routes/navigator-core.ts` |
| 远程/App 执行 | `client/src/pages/mobile/RemotePCConsole.tsx`、`server/routes/remote-control.ts`、PC Agent 相关 routes |

## PR 纪律

每次 PR 必须通过 `.github/PULL_REQUEST_TEMPLATE.md` 中的文档同步检查。  
任何导致 API、权限、架构边界、MVP 闭环状态变化的 PR，必须同步更新对应文档。

---

## 旧文档归档状态

部分旧文档已于 2026-04-29 归档至 `docs/archive/`，分类如下：

- `docs/archive/audits/` — 架构审计报告
- `docs/archive/phase-reports/` — 阶段进度报告
- `docs/archive/old-roadmaps/` — 旧改进计划和升级路线图
- `docs/archive/deployment-history/` — 旧安装和部署文档

归档文档可追溯，但不再作为当前系统真相。冲突时以本索引列出文档和 `CURRENT_STATE.md` 为准。

`docs/` 内部旧文档（`PHASE*.md`、`WEEK*.md`、`*_PLAN.md`、`*_REPORT.md` 等）待下一轮整理后归入 `docs/archive/`。
