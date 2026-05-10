# 功能清单

## 状态定义

| 状态 | 说明 |
| --- | --- |
| Planned | 规划中 |
| InProgress | 开发中 |
| Available | 已可用 |
| NeedsRefactor | 已有能力但需重构 |

## 优先级定义

| 优先级 | 说明 |
| --- | --- |
| P0 | MVP 必需 |
| P1 | 第一阶段增强 |
| P2 | 后续扩展 |

## 功能总表

| 模块 | 功能 | 优先级 | 状态 | 对应故事 |
| --- | --- | --- | --- | --- |
| 身份觉醒 | 首次觉醒问询 | P0 | Planned | US-01 |
| 身份觉醒 | 人格/关系配置 | P0 | Planned | US-01 |
| 声音 | 语音预设和试听 | P0 | Planned | US-02 |
| 声音 | 场景音色路由 | P1 | Planned | US-02 |
| 对话 | 文本主入口 | P0 | NeedsRefactor | US-03 |
| 对话 | 语音输入 | P0 | InProgress | US-03, US-05 |
| 对话 | 模式路由 | P0 | Planned | US-03, US-04 |
| 对话 | 结构化理解输出 | P0 | Planned | US-03 |
| 记忆 | 候选记忆收件箱 | P0 | Planned | US-06 |
| 记忆 | 记忆查看/修改/删除 | P0 | Planned | US-06 |
| 知识库 | 文件索引 | P1 | Planned | US-07 |
| 知识库 | 照片 OCR | P1 | Planned | US-07 |
| 知识库 | 邮件接入 | P1 | Planned | US-07 |
| 项目 | 从对话创建项目 | P0 | Planned | US-08 |
| 项目 | 项目摘要和风险 | P0 | InProgress | US-08 |
| 任务 | 即时任务 | P0 | InProgress | US-09 |
| 任务 | 定时任务 | P0 | Planned | US-09 |
| 任务 | 循环任务 | P1 | Planned | US-09 |
| 执行 | App/电脑操作适配 | P1 | InProgress | US-10 |
| 执行 | 高风险确认 | P0 | Planned | US-10, US-14 |
| 梦境 | 每日复盘 | P1 | Planned | US-11 |
| 梦境 | 醒来建议 | P1 | Planned | US-11 |
| 蜂群 | 创建蜂群 | P1 | InProgress | US-12 |
| 蜂群 | 节点加入 | P1 | Planned | US-12, US-13 |
| 蜂群 | 任务广播 | P1 | InProgress | US-12 |
| 蜂群 | 风险预警 | P1 | Planned | US-12 |
| 守护 | 风险分级 | P0 | Planned | US-14 |
| 守护 | 审计日志 | P0 | InProgress | US-14 |
| 守护 | 预算控制 | P1 | Planned | US-14 |
| 危机 | 危机识别 | P1 | Planned | US-15 |
| 模型工具 | ModelRouter | P0 | InProgress | US-03, US-14 |
| 模型工具 | ToolRegistry | P0 | Planned | US-10 |

## 第一阶段 P0 模块

MVP 必须优先完成：

- 觉醒问询。
- 基础声音选择。
- 自然语言主入口。
- 对话模式路由。
- 结构化理解输出。
- 候选记忆。
- 从对话创建项目。
- 即时任务。
- 定时任务。
- 高风险确认。
- 风险分级。
- ModelRouter。
- ToolRegistry 基础版。
