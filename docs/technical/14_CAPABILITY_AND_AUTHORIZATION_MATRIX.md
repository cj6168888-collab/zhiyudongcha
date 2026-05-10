# 能力与授权矩阵

## 目的

本文件把产品能力、资源、动作、范围和风险等级统一起来，作为授权中心、ToolRegistry、蜂群契约和高风险确认的共同依据。

旧参考：

- [../CAPABILITY_MATRIX.md](../CAPABILITY_MATRIX.md)
- [../adr/0001-authorization-model.md](../adr/0001-authorization-model.md)

## 四个核心概念

| 概念 | 含义 |
| --- | --- |
| ResourceType | 受保护的数据域或功能域 |
| Capability | 可执行的能力标签，常映射到 AI 工具、专家或工作流 |
| ActionType | 对资源执行的动作 |
| PermissionScope | 权限作用范围 |

## ResourceType

| 资源 | 中文名 | 默认空间 | 说明 |
| --- | --- | --- | --- |
| `CHAT` | 对话 | 个人/蜂群 | 多轮对话、上下文、语音转写 |
| `MEMORY` | 记忆 | 个人 | 长期记忆、候选记忆、来源 |
| `KNOWLEDGE` | 知识库 | 个人/蜂群 | 文件、邮件、网页、程序知识 |
| `CONTACTS` | 联系人 | 个人 | 人物、关系、通讯录 |
| `CALENDAR` | 日历 | 个人/组织 | 日程、提醒、循环任务 |
| `DOCUMENTS` | 文档 | 个人/组织 | 文件、合同、报告、草稿 |
| `VAULT` | 保险库 | 个人 | 高敏存证、私密资料 |
| `TASKS` | 任务 | 个人/蜂群 | 即时、定时、循环、条件任务 |
| `PROJECTS` | 项目 | 个人/组织 | 项目、风险、资料、进度 |
| `REPORTS` | 战报 | 个人/蜂群 | 日报、战报、审计摘要 |
| `DEVICES` | 设备 | 个人/组织 | 手机、电脑、节点、在线状态 |
| `REMOTE_CONTROL` | 远程控制 | 个人/组织 | 屏幕、点击、输入、文件传输 |
| `FLEET` | 蜂群/舰队 | 组织 | 节点、契约、广播、预警 |
| `SETTINGS` | 设置 | 个人/管理员 | 身份、声音、权限、密钥 |
| `AUDIT` | 审计 | 个人/管理员/蜂王 | 操作记录和证据链 |

## Capability

| 能力 | 说明 | 常见资源 |
| --- | --- | --- |
| `TEXT_CHAT` | 文字对话 | `CHAT` |
| `VOICE_INTERACTION` | 语音输入输出 | `CHAT`, `SETTINGS` |
| `CONVERSATION_UNDERSTANDING` | 对话模式和结构化理解 | `CHAT`, `MEMORY` |
| `MEMORY_CAPTURE` | 候选记忆提取 | `MEMORY` |
| `KNOWLEDGE_QUERY` | 知识检索 | `KNOWLEDGE` |
| `DOCUMENT_ANALYSIS` | 文档解析和摘要 | `DOCUMENTS`, `KNOWLEDGE` |
| `CONTRACT_REVIEW` | 合同风险识别 | `DOCUMENTS`, `VAULT` |
| `TASK_ORCHESTRATION` | 任务编排 | `TASKS`, `PROJECTS` |
| `APP_CONTROL` | App 操作 | `DEVICES`, `REMOTE_CONTROL` |
| `REMOTE_PC_CONTROL` | 远程电脑控制 | `REMOTE_CONTROL`, `DEVICES` |
| `SWARM_BROADCAST` | 蜂群广播 | `FLEET`, `REPORTS` |
| `AUTHENTICITY_AUDIT` | 真实性审计 | `DOCUMENTS`, `AUDIT` |
| `DREAM_REVIEW` | 梦境复盘 | `MEMORY`, `TASKS`, `PROJECTS` |
| `MODEL_ROUTING` | 模型路由 | `SETTINGS`, `AUDIT` |

## ActionType

| 动作 | 说明 | 默认风险 |
| --- | --- | --- |
| `READ` | 读取 | L0-L3，取决于敏感等级 |
| `WRITE` | 创建或更新 | L1-L3 |
| `DELETE` | 删除 | L4 |
| `EXECUTE` | 执行任务或工具 | L1-L4 |
| `SHARE` | 共享到外部或蜂群 | L3-L4 |
| `EXPORT` | 导出数据 | L3-L4 |
| `ADMIN` | 管理权限、成员、密钥 | L4 |

## PermissionScope

| 范围 | 说明 |
| --- | --- |
| `OWN` | 仅主人个人空间 |
| `FLEET` | 当前蜂群/组织空间 |
| `DEVICE` | 指定设备 |
| `PROJECT` | 指定项目 |
| `ALL` | 全局，默认只给系统或管理员 |
| `RESTRICTED` | 带条件限制，例如时间、金额、数据类型 |

## 授权判断公式

```text
actor
  + resourceType
  + actionType
  + scope
  + capability
  + dataSensitivity
  + riskLevel
  + swarmContract
  -> allow | confirm | deny
```

## 默认处理

| 条件 | 处理 |
| --- | --- |
| L0 + S0/S1 + 已授权 | 自动执行 |
| L1 + S0/S1 + 已授权 | 自动执行并记录 |
| L2 草拟 | 生成草稿，不外发 |
| L3 外部影响 | 确认后执行 |
| L4 高风险 | 强确认后执行 |
| L5 禁止 | 不代做，交给主人 |
| 审计不可用 + L3/L4 | 禁止执行 |

## 预设授权包

### `preset_personal_default`

- `CHAT`: `READ/WRITE` on `OWN`
- `MEMORY`: `READ/WRITE` on `OWN`
- `TASKS`: `READ/WRITE` on `OWN`
- `SETTINGS`: `READ/WRITE` on `OWN`
- 能力：`TEXT_CHAT`, `CONVERSATION_UNDERSTANDING`, `MEMORY_CAPTURE`

### `preset_work_assistant`

- 在个人默认包基础上增加：
- `PROJECTS`: `READ/WRITE` on `OWN`
- `DOCUMENTS`: `READ/WRITE` on `OWN`
- `CALENDAR`: `READ/WRITE` on `OWN`
- 能力：`DOCUMENT_ANALYSIS`, `TASK_ORCHESTRATION`, `KNOWLEDGE_QUERY`

### `preset_device_control`

- `DEVICES`: `READ` on `OWN`
- `REMOTE_CONTROL`: `EXECUTE` on `DEVICE`
- 能力：`APP_CONTROL`, `REMOTE_PC_CONTROL`
- 所有外部影响动作必须确认。

### `preset_fleet_member`

- `FLEET`: `READ` on `FLEET`
- `TASKS`: `READ/WRITE` on `FLEET`
- `REPORTS`: `WRITE` on `FLEET`
- 个人记忆默认不共享。

### `preset_fleet_admin`

- `FLEET`: `ADMIN` on `FLEET`
- `TASKS`: `EXECUTE` on `FLEET`
- `REPORTS`: `READ/WRITE` on `FLEET`
- `AUDIT`: `READ` on `FLEET`

## 新工具注册要求

任何工具进入 `ToolRegistry` 必须声明：

- `resourceType`
- `capability`
- `requiredActions`
- `scope`
- `riskLevel`
- `dataSensitivity`
- `requiresConfirmation`
- `auditConfig`
- `rollbackPolicy`

