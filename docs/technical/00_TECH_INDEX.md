# 技术文档索引

> 版本：2026-04-29
> 状态：技术实现权威基线

本目录定义生语助手的新技术实现规范。旧技术文档仍可作为历史资料和细节参考，但当旧文档与本目录冲突时，以本目录为准；实际运行入口以当前可运行代码为准。

## 技术原则

1. TypeScript 为主，前后端共享类型尽量进入 `shared/`。
2. 前端负责体验和交互，业务规则不写进页面。
3. 后端路由负责认证、校验、权限和调用服务，不承载复杂业务。
4. 服务层承载领域规则、编排、模型调用和工具调用。
5. 模型、工具、App、外部协议都必须可插拔，不写死在页面或单一路由里。
6. 所有读取、记忆、执行和外传必须接入主权守护协议。
7. 新能力必须可测试、可审计、可回滚。

## 阅读顺序

| 顺序 | 文档 | 用途 |
| --- | --- | --- |
| 1 | [01_SYSTEM_ARCHITECTURE.md](./01_SYSTEM_ARCHITECTURE.md) | 系统分层和代码映射 |
| 2 | [02_CODE_ORGANIZATION.md](./02_CODE_ORGANIZATION.md) | 目录职责和新代码放置规则 |
| 3 | [03_LANGUAGE_AND_STYLE.md](./03_LANGUAGE_AND_STYLE.md) | TypeScript、命名、编码、注释、文案规范 |
| 4 | [04_API_AND_CONTRACTS.md](./04_API_AND_CONTRACTS.md) | API 响应、错误、zod、审计、Swagger 规范 |
| 5 | [05_DATA_AND_MEMORY_SCHEMA.md](./05_DATA_AND_MEMORY_SCHEMA.md) | 数据、记忆、身份、声音、蜂群相关 schema 方向 |
| 6 | [06_MODEL_TOOL_ROUTING.md](./06_MODEL_TOOL_ROUTING.md) | 模型路由、工具注册、Provider Adapter、成本和降级 |
| 7 | [07_SECURITY_PRIVACY_AUTHZ.md](./07_SECURITY_PRIVACY_AUTHZ.md) | 安全、隐私、授权、敏感等级、确认和审计 |
| 8 | [08_EXECUTION_ENGINE.md](./08_EXECUTION_ENGINE.md) | 即时、定时、循环、条件、长链路任务状态机 |
| 9 | [09_MOBILE_AND_APP_CONTROL.md](./09_MOBILE_AND_APP_CONTROL.md) | Android、App 控制、文件照片邮件、语音与声纹 |
| 10 | [10_TESTING_AND_QUALITY.md](./10_TESTING_AND_QUALITY.md) | 单测、API、E2E、对话理解、记忆、安全测试 |
| 11 | [11_DEPLOYMENT_AND_OPERATIONS.md](./11_DEPLOYMENT_AND_OPERATIONS.md) | Docker、环境变量、密钥、日志、备份、健康检查 |
| 12 | [12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md](./12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md) | 日志、审计、指标、告警、降级和事故响应 |
| 13 | [13_ENGINEERING_CONSISTENCY.md](./13_ENGINEERING_CONSISTENCY.md) | 数据库、API、配置、错误、日志和服务初始化一致性 |
| 14 | [14_CAPABILITY_AND_AUTHORIZATION_MATRIX.md](./14_CAPABILITY_AND_AUTHORIZATION_MATRIX.md) | 资源、能力、动作、范围、风险和授权包 |
| 15 | [15_DEVICE_AND_APP_CONTROL_SPEC.md](./15_DEVICE_AND_APP_CONTROL_SPEC.md) | 设备、App、远程控制、证据和降级规格 |
| 16 | [16_API_LIVE_CONTRACT.md](./16_API_LIVE_CONTRACT.md) | 当前 API 合约状态、准入和变更纪律 |
| 17 | [17_LLM_SECURITY_AND_RED_TEAMING.md](./17_LLM_SECURITY_AND_RED_TEAMING.md) | LLM 安全威胁模型、提示注入防护和红队测试 |
| 18 | [18_EVALUATION_PROTOCOL.md](./18_EVALUATION_PROTOCOL.md) | AI 评测集、指标、阈值和 release gate |
| 19 | [19_CURRENT_CODE_HEALTH.md](./19_CURRENT_CODE_HEALTH.md) | 代码健康快照：TypeScript、测试、架构边界、安全、数据库的实测指标 |
| 20 | [20_PERCEPTION_DEVICE_IMPLEMENTATION_SPEC.md](./20_PERCEPTION_DEVICE_IMPLEMENTATION_SPEC.md) | 感知、外设与 Conversation 技术实施规格 |

## 与产品文档的关系

技术实现必须服务以下产品权威文档：

- [../01_PRODUCT_VISION.md](../01_PRODUCT_VISION.md)
- [../02_SOVEREIGN_GUARDIAN_PROTOCOL.md](../02_SOVEREIGN_GUARDIAN_PROTOCOL.md)
- [../04_CORE_CAPABILITY_ARCHITECTURE.md](../04_CORE_CAPABILITY_ARCHITECTURE.md)
- [../09_OPEN_TECH_STRATEGY.md](../09_OPEN_TECH_STRATEGY.md)
- [../10_CONVERSATION_UNDERSTANDING.md](../10_CONVERSATION_UNDERSTANDING.md)
- [../11_IDENTITY_AWAKENING.md](../11_IDENTITY_AWAKENING.md)
- [../12_PERCEPTION_DEVICE_AND_CONVERSATION_STRATEGY.md](../12_PERCEPTION_DEVICE_AND_CONVERSATION_STRATEGY.md)
- [../PRIVACY_AND_DATA_GOVERNANCE.md](../PRIVACY_AND_DATA_GOVERNANCE.md)
- [../PRODUCT_METRICS.md](../PRODUCT_METRICS.md)
- [../AI_GOVERNANCE_STANDARDS_MAPPING.md](../AI_GOVERNANCE_STANDARDS_MAPPING.md)

## 新能力技术准入清单

新增能力前必须回答：

- 它属于哪个产品闭环？
- 前端入口在哪里？
- 后端服务在哪里？
- 数据模型是什么？
- 需要哪些权限？
- 读取哪些敏感数据？
- 是否影响外部世界？
- 是否需要确认？
- 如何审计？
- 如何测试？
- 失败如何降级或恢复？
- 如何记录指标、日志和事故证据？
- 是否需要 ADR 记录架构决策？
- 是否符合工程一致性基线？
- 是否已登记资源、能力、权限、风险和数据敏感等级？
- 如果新增 API，是否标记 Available/Experimental/Planned/Legacy/Deprecated？
- 是否经过 LLM 安全红队？
- 是否有评测样例、阈值和失败回归策略？
