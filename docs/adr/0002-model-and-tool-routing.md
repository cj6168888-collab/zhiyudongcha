# ADR 0002: ModelRouter 与 ToolRegistry

## Status

Accepted

## Context

生语助手需要接入不同模型、工具、App、MCP、本地命令和外部服务。若模型和工具调用散落在页面或单一路由里，会造成供应商锁定、权限绕过、成本失控和审计缺失。

## Decision

所有新模型调用逐步收束到 `ModelRouter`。所有新工具调用逐步收束到 `ToolRegistry`。

路由决策必须考虑：

- taskType。
- privacyLevel。
- riskLevel。
- latencyRequirement。
- costBudget。
- requiredCapabilities。
- fallbackPolicy。

工具注册必须声明：

- inputSchema。
- outputSchema。
- requiredGrants。
- riskLevel。
- dataSensitivity。
- auditConfig。
- rollbackPolicy。

## Consequences

- 前端不得直接调用模型供应商。
- 路由层不得绕过权限和审计直接执行工具。
- Provider 差异由 adapter 隔离。
- 高风险工具在审计不可用时不得执行。

