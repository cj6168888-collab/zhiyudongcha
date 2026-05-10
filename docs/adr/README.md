# 架构决策记录（ADR）

本目录用于存放 **Architecture Decision Record**：当产品或工程做出难以从代码直接看出的重大选择时，在此用简短文件记录 **背景、决策、后果**。

## 命名约定

`NNNN-short-title.md`，例如 `0001-use-workspace-model.md`。

新 ADR 请从 [TEMPLATE.md](./TEMPLATE.md) 复制，**不允许省略"考虑过的方案"和"触发重新决定的条件"两节**。

## 何时写 ADR

- 影响长期架构边界。
- 影响权限、隐私、审计或高风险执行。
- 引入新的模型、工具、供应商或执行适配层。
- 改变记忆、蜂群、任务状态机或数据生命周期。
- 改变能力与授权矩阵。
- 改变设备控制或 App 控制的安全边界。
- 一旦上线后回滚成本较高。
- 引入新的租户/权限模型或改变双轨定义。
- 更换核心依赖或部署形态。
- 与安全、隐私承诺相关的行为变更。

与 [../02_SOVEREIGN_GUARDIAN_PROTOCOL.md](../02_SOVEREIGN_GUARDIAN_PROTOCOL.md) 冲突的决策**无效**，须先修订协议再记 ADR。

## 已有记录

| 编号 | 标题 | 状态 |
| --- | --- | --- |
| [0001-authorization-model.md](./0001-authorization-model.md) | 授权模型（会话主体 + `authz_grants`） | 已接受 |
| [0002-model-and-tool-routing.md](./0002-model-and-tool-routing.md) | ModelRouter 与 ToolRegistry | 已接受 |
| [0003-memory-data-governance.md](./0003-memory-data-governance.md) | 记忆与数据治理 | 已接受 |
| [0004-high-risk-confirmation-and-audit.md](./0004-high-risk-confirmation-and-audit.md) | 高风险确认与审计 | 已接受 |
| [0005-dual-routes-architecture.md](./0005-dual-routes-architecture.md) | 双路由入口的现状与收敛策略 | 已接受（过渡） |
| [0006-storage-god-interface.md](./0006-storage-god-interface.md) | storage.ts God Interface 渐进分解 | 已接受（过渡） |

## ADR 状态说明

| 状态 | 含义 |
| --- | --- |
| 提议 | 正在讨论，未最终决定 |
| 已接受 | 当前有效决策 |
| 已接受（过渡） | 临时决策，有明确的升级触发条件 |
| 已废弃 | 不再适用，原因已记录 |
| 已替代 | 被另一 ADR 替代，链接已注明 |
