# 设计文档索引

> 版本：2026-04-29
> 状态：UI/UX 权威基线

本目录定义生语助手的新体验设计规范。旧 UI/UX 审计、移动端计划、设计指南仍可作为历史参考，但当它们与本目录冲突时，以本目录为准。

## 体验目标

她很强，但用起来很轻；她懂主人，但不冒犯；她能做很多事，但不会让主人迷路。

## 阅读顺序

| 顺序 | 文档 | 用途 |
| --- | --- | --- |
| 1 | [01_EXPERIENCE_PRINCIPLES.md](./01_EXPERIENCE_PRINCIPLES.md) | 总体验原则 |
| 2 | [02_INFORMATION_ARCHITECTURE.md](./02_INFORMATION_ARCHITECTURE.md) | 信息架构和主导航 |
| 3 | [03_CONVERSATION_UI.md](./03_CONVERSATION_UI.md) | 对话主入口 UI |
| 4 | [04_IDENTITY_AWAKENING_UI.md](./04_IDENTITY_AWAKENING_UI.md) | 觉醒问询 UI |
| 5 | [05_MEMORY_AND_KNOWLEDGE_UI.md](./05_MEMORY_AND_KNOWLEDGE_UI.md) | 记忆和知识库 UI |
| 6 | [06_TASK_EXECUTION_UI.md](./06_TASK_EXECUTION_UI.md) | 任务执行和确认 UI |
| 7 | [07_SWARM_UI.md](./07_SWARM_UI.md) | 蜂群、蜂王、节点、战报 UI |
| 8 | [08_VOICE_AND_AVATAR_UI.md](./08_VOICE_AND_AVATAR_UI.md) | 声音、头像、人格呈现 |
| 9 | [09_MOBILE_DESIGN_SYSTEM.md](./09_MOBILE_DESIGN_SYSTEM.md) | 移动端设计系统 |
| 10 | [10_DESKTOP_DESIGN_SYSTEM.md](./10_DESKTOP_DESIGN_SYSTEM.md) | 桌面端设计系统 |
| 11 | [11_ACCESSIBILITY_AND_TRUST.md](./11_ACCESSIBILITY_AND_TRUST.md) | 可访问性、信任、风险确认 |
| 12 | [12_DESIGN_TOKENS_AND_COMPONENT_STATES.md](./12_DESIGN_TOKENS_AND_COMPONENT_STATES.md) | Design tokens、组件状态、空/加载/错误/确认规格 |
| 13 | [13_ACCESSIBILITY_PERFORMANCE_BASELINE.md](./13_ACCESSIBILITY_PERFORMANCE_BASELINE.md) | 可访问性、性能、实时状态和权限引导基线 |

## 与产品和技术文档关系

设计必须服务：

- [../01_PRODUCT_VISION.md](../01_PRODUCT_VISION.md)
- [../10_CONVERSATION_UNDERSTANDING.md](../10_CONVERSATION_UNDERSTANDING.md)
- [../11_IDENTITY_AWAKENING.md](../11_IDENTITY_AWAKENING.md)
- [../02_SOVEREIGN_GUARDIAN_PROTOCOL.md](../02_SOVEREIGN_GUARDIAN_PROTOCOL.md)
- [../technical/00_TECH_INDEX.md](../technical/00_TECH_INDEX.md)
- [../PRIVACY_AND_DATA_GOVERNANCE.md](../PRIVACY_AND_DATA_GOVERNANCE.md)
- [../PRODUCT_METRICS.md](../PRODUCT_METRICS.md)

## 设计验收清单

每个新界面必须回答：

- 主人来到这里要完成什么？
- 是否能从自然语言入口触发？
- 是否展示她理解了什么？
- 是否展示她准备做什么？
- 是否有必要确认？
- 是否能追溯结果和证据？
- 是否区分个人空间和蜂群空间？
- 是否避免无意义炫技和复杂按钮堆叠？
- 是否遵守 token、组件状态、空状态、加载状态和错误状态规格？
- 是否满足可访问性、性能和实时状态基线？
