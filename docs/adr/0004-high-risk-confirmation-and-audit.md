# ADR 0004: 高风险确认与审计

## Status

Accepted

## Context

系统会发送、上传、删除、共享、操作 App、修改权限和调度蜂群。仅靠“用户说了”不足以证明动作安全。

## Decision

所有 L3/L4 动作必须经过确认。所有 L3/L4/S2-S4 相关动作必须审计。

确认必须说明：

- 动作。
- 数据范围。
- 目标对象。
- 影响。
- 是否可撤回。
- 替代方案。

审计必须记录：

- actor。
- action。
- target。
- riskLevel。
- dataSensitivity。
- result。
- requestId。

## Consequences

- 审计系统不可用时禁止高风险动作。
- 前端确认 UI 不能只写“确定吗”。
- 自动执行只能覆盖低风险动作。
- 失败时必须标记失败，不得伪装成功。

