# AI 治理标准映射

## 目的

本文件把生语助手的新文档体系映射到主流可信 AI、安全、可访问性和可观测性框架，确保项目不是只凭主观愿景推进，而是能对照外部标准持续自查。

参考框架：

- NIST AI Risk Management Framework：AI 风险治理、映射、度量和管理。
- OWASP Top 10 for LLM Applications：大模型应用安全风险。
- WCAG 2.2：可访问性。
- OpenTelemetry：日志、指标、追踪和上下文传播。

## 映射总览

| 外部框架 | 本项目承接文档 |
| --- | --- |
| NIST AI RMF | `02_SOVEREIGN_GUARDIAN_PROTOCOL.md`、`PRODUCT_METRICS.md`、`PRIVACY_AND_DATA_GOVERNANCE.md`、`technical/18_EVALUATION_PROTOCOL.md` |
| OWASP LLM Top 10 | `technical/17_LLM_SECURITY_AND_RED_TEAMING.md`、`technical/14_CAPABILITY_AND_AUTHORIZATION_MATRIX.md`、`technical/15_DEVICE_AND_APP_CONTROL_SPEC.md` |
| WCAG 2.2 | `design/13_ACCESSIBILITY_PERFORMANCE_BASELINE.md`、`design/12_DESIGN_TOKENS_AND_COMPONENT_STATES.md` |
| OpenTelemetry | `technical/12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md` |

## NIST AI RMF 映射

### Govern

治理目标：明确谁负责、依据什么原则、如何处理风险。

本项目对应：

- 主权守护协议。
- 文档治理规则。
- Release 验收打分卡。
- ADR 决策记录。

最低要求：

- 每个高风险能力有 owner。
- 每个 release 有验收打分。
- 每个重大架构决策有 ADR。
- 事故后更新文档和测试。

### Map

映射目标：理解系统使用场景、用户、数据、风险和影响范围。

本项目对应：

- 产品愿景。
- 个体与蜂群。
- 隐私与数据治理。
- 能力与授权矩阵。
- 设备与 App 控制规格。

最低要求：

- 新能力必须说明数据源、权限、风险等级、作用范围。
- 蜂群能力必须说明个人空间和组织空间边界。
- 设备控制必须说明外部影响和降级方式。

### Measure

度量目标：用指标和评测证明系统质量。

本项目对应：

- 产品指标体系。
- 测试与质量。
- 评测协议。
- 可观测性与事故响应。

最低要求：

- 对话理解有评测集。
- 记忆召回有正负样本。
- 高风险拦截有回归测试。
- 误执行率、失败诚实率和审计覆盖率可度量。

### Manage

管理目标：依据评测和事故结果调整系统。

本项目对应：

- Release 验收打分卡。
- 事故响应流程。
- LLM 安全与红队。
- 文档维护节奏。

最低要求：

- Red 灯项不得发布。
- P0 事故必须停止相关自动化。
- 红队发现必须进入测试集。
- 高风险能力上线前必须有降级策略。

## OWASP LLM Top 10 映射

| 风险类别 | 本项目控制 |
| --- | --- |
| Prompt Injection | 对话理解、工具调用前权限检查、红队测试 |
| Sensitive Information Disclosure | 数据敏感等级、外传确认、日志脱敏 |
| Supply Chain | ProviderAdapter、ToolRegistry、ADR、依赖审计 |
| Data and Model Poisoning | 记忆来源、置信度、来源校验、候选记忆 |
| Improper Output Handling | API schema、工具输入校验、事实/推测/行动分离 |
| Excessive Agency | 风险等级、确认闸门、审计不可用即禁止 |
| System Prompt Leakage | 不把系统提示作为用户可见数据，日志脱敏 |
| Vector and Embedding Weaknesses | 记忆来源、删除后不召回、敏感内容召回限制 |
| Misinformation | 事实/推测/建议/行动分离，幻觉评测 |
| Unbounded Consumption | 预算、token、工具次数和重试上限 |

## WCAG 2.2 映射

| 要求 | 本项目控制 |
| --- | --- |
| 键盘可访问 | 可访问性与性能基线 |
| 焦点可见 | 设计 token 和组件状态 |
| 颜色对比 | 可访问性与性能基线 |
| 可读标签 | ARIA 基线、图标按钮标签 |
| 错误识别 | 错误状态、权限拒绝引导 |
| 减少动画 | prefers-reduced-motion |
| 触控目标 | 44px 最低触控目标 |

## OpenTelemetry 映射

| OTel 概念 | 本项目落点 |
| --- | --- |
| Trace | conversation -> task -> execution -> audit 的 correlation id |
| Span | 对话理解、模型调用、工具调用、数据库、审计写入 |
| Metric | API latency、provider latency、token usage、audit failures |
| Log | requestId、actorId、riskLevel、dataSensitivity、result |
| Context propagation | requestId/correlationId 在 HTTP、WS、任务队列中传递 |

## 缺口处理

如果外部标准新增要求：

1. 先记录到本文件。
2. 判断影响产品、技术、设计还是运维。
3. 更新对应权威文档。
4. 如涉及架构决策，新增 ADR。
5. 如涉及风险，新增评测和红队用例。

