# 文档治理规则

## 目的

项目历史文档很多，包含旧愿景、阶段报告、实验设计、迁移计划和审计记录。它们有价值，但已经产生杂音。

从 2026-04-29 起，新的权威文档以 [00_CANONICAL_INDEX.md](./00_CANONICAL_INDEX.md) 为入口。

## 文档分级

### L1 权威文档

当前产品、架构、权限、安全和路线的最高依据。

- `00_CANONICAL_INDEX.md`
- `01_PRODUCT_VISION.md`
- `02_SOVEREIGN_GUARDIAN_PROTOCOL.md`
- `03_INDIVIDUAL_AND_SWARM.md`
- `04_CORE_CAPABILITY_ARCHITECTURE.md`
- `05_MEMORY_KNOWLEDGE_ARCHITECTURE.md`
- `06_EXECUTION_AND_APP_CONTROL.md`
- `07_MVP_ROADMAP.md`
- `08_DOCUMENT_GOVERNANCE.md`
- `09_OPEN_TECH_STRATEGY.md`
- `10_CONVERSATION_UNDERSTANDING.md`
- `11_IDENTITY_AWAKENING.md`

### L2 技术执行文档

记录当前代码入口、API、部署、运行方式、测试方法。

新的技术实现基线位于 [technical/00_TECH_INDEX.md](./technical/00_TECH_INDEX.md)。

新的 UI/UX 设计基线位于 [design/00_DESIGN_INDEX.md](./design/00_DESIGN_INDEX.md)。

新的产品交付基线位于 [product/00_PRODUCT_INDEX.md](./product/00_PRODUCT_INDEX.md)。

可保留：

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `TECHNICAL_MANUAL.md`
- `API_REFERENCE*.md`
- `DEPLOYMENT_GUIDE.md`
- `OPERATIONS_RUNBOOK.md`
- `PRODUCT_METRICS.md`
- `PRIVACY_AND_DATA_GOVERNANCE.md`
- `AI_GOVERNANCE_STANDARDS_MAPPING.md`
- `docs/adr/`
- `docs/archive/README.md`

后续需要逐步按新权威文档更新。

### L3 历史资料

旧阶段总结、升级计划、审计报告、旧架构设计。

示例：

- `PHASE*.md`
- `WEEK*.md`
- `*_REPORT.md`
- `*_PLAN.md`
- 旧 UX 审计和迁移文档。

这些文档不再作为当前产品真相，但可用于追溯。

## 冲突处理

当文档冲突时：

1. 先以 L1 权威文档为准。
2. 技术细节以当前可运行代码为准。
3. 如果 L1 与当前代码冲突，说明代码需要调整或 L1 需要修订。
4. 旧文档不得覆盖新权威文档。

## 新能力文档要求

新增能力时，至少回答：

- 它服务哪个产品闭环？
- 它读取什么数据？
- 它会不会外传敏感信息？
- 它是否会影响外部世界？
- 它需要什么权限？
- 它的风险等级是什么？
- 它如何审计？
- 它的结果如何回流到记忆、项目、任务或蜂群？
- 它如何度量成功、失败、误执行和成本？
- 它的数据如何授权、外传、删除和撤回？
- 它失败时如何降级、告警和事故响应？
- 它是否引入 LLM 安全风险，例如提示注入、敏感泄露、RAG 污染或越权工具调用？
- 它是否有评测样例、通过阈值和 release gate？

## 旧文档归档策略

后续可以逐步建立：

```text
docs/archive/
  phase-reports/
  audits/
  legacy-architecture/
  old-roadmaps/
  ux-history/
  deployment-history/
```

迁移旧文档前，不要删除内容，只移动位置并保留引用。归档后若旧文档内部相对链接失效，优先在归档说明中标注历史上下文；只有仍被当前入口引用的链接才必须立即修复。

## README 更新策略

`README.md` 应保持短而实用：

- 项目是什么。
- 怎么运行。
- 怎么部署。
- 当前主要入口。
- 去哪里读权威文档。

产品愿景不要塞进 README，统一放在本套权威文档中。

## 文档维护节奏

- 每完成一个核心闭环，更新 `07_MVP_ROADMAP.md`。
- 每新增高风险能力，更新 `02_SOVEREIGN_GUARDIAN_PROTOCOL.md`。
- 每新增蜂群治理能力，更新 `03_INDIVIDUAL_AND_SWARM.md`。
- 每新增文件/照片/邮件/知识库能力，更新 `05_MEMORY_KNOWLEDGE_ARCHITECTURE.md`。
- 每新增 App 操作能力，更新 `06_EXECUTION_AND_APP_CONTROL.md`。
- 每接入新模型、新 Agent 框架、新工具协议或新外部能力，更新 `09_OPEN_TECH_STRATEGY.md`。
- 每新增对话模式、语气策略、结构化理解字段或高风险意图类型，更新 `10_CONVERSATION_UNDERSTANDING.md`。
- 每新增身份、人格、声音、关系契约、记忆授权或蜂群身份配置，更新 `11_IDENTITY_AWAKENING.md`。
- 每新增架构、API、数据模型、模型路由、工具、执行引擎、移动端能力、测试或部署规范，更新 `docs/technical/`。
- 每新增主导航、对话 UI、觉醒 UI、记忆 UI、任务 UI、蜂群 UI、声音头像、移动端/桌面端设计或信任确认模式，更新 `docs/design/`。
- 每新增用户故事、功能优先级、MVP 范围、验收标准或发布计划，更新 `docs/product/`。
- 每新增核心产品闭环、AI 质量目标或信任指标，更新 `PRODUCT_METRICS.md`。
- 每新增数据源、长期记忆类型、外传路径、删除策略或蜂群共享范围，更新 `PRIVACY_AND_DATA_GOVERNANCE.md`。
- 每新增关键架构决策，更新 `docs/adr/`。
- 每新增高风险执行路径、审计字段、告警或降级策略，更新 `docs/technical/12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md`。
- 每修复数据库、API、配置、错误处理、日志或服务初始化漂移，更新 `docs/technical/13_ENGINEERING_CONSISTENCY.md`。
- 每新增资源、能力、授权包、动作类型或权限范围，更新 `docs/technical/14_CAPABILITY_AND_AUTHORIZATION_MATRIX.md`。
- 每新增设备控制、App 操作、远程控制、Intent、DeepLink 或 PC Agent 能力，更新 `docs/technical/15_DEVICE_AND_APP_CONTROL_SPEC.md`。
- 每新增、废弃或改变 API 合约，更新 `docs/technical/16_API_LIVE_CONTRACT.md`。
- 每个 release 前，使用 `docs/product/06_RELEASE_ACCEPTANCE_SCORECARD.md` 做绿/黄/红灯验收。
- 每新增外部治理标准或标准条款映射，更新 `AI_GOVERNANCE_STANDARDS_MAPPING.md`。
- 每新增模型、RAG、工具调用、外部内容读取或 Agent 自主执行能力，更新 `docs/technical/17_LLM_SECURITY_AND_RED_TEAMING.md`。
- 每新增对话模式、记忆能力、安全策略、工具能力或蜂群边界，更新 `docs/technical/18_EVALUATION_PROTOCOL.md`。
