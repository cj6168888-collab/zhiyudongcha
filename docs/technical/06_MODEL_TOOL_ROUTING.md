# 模型与工具路由

## 原则

模型和工具都是外部能力，不是系统主人。

不能在页面或业务路由中写死模型供应商。所有模型调用应逐步收束到 `ModelRouter`，所有工具调用应逐步收束到 `ToolRegistry`。

## ModelRouter

负责根据任务选择模型。

输入：

- taskType。
- privacyLevel。
- riskLevel。
- latencyRequirement。
- costBudget。
- requiredCapabilities。
- fallbackPolicy。

输出：

- provider。
- model。
- maxTokens。
- timeout。
- privacyPolicy。
- fallbackChain。

## ProviderAdapter

每个模型供应商实现 adapter：

- OpenAI。
- DeepSeek。
- DashScope / Qwen。
- Claude。
- 本地模型。
- 专用 ASR/TTS/OCR/Vision/Embedding。

adapter 负责供应商协议差异，不把差异泄露给业务服务。

## ToolRegistry

工具注册必须包含：

- name。
- description。
- inputSchema。
- outputSchema。
- requiredGrants。
- riskLevel。
- dataSensitivity。
- costEstimate。
- auditConfig。
- timeout。
- rollbackPolicy。

## 路由依据

| 维度 | 说明 |
| --- | --- |
| 任务类型 | 聊天、摘要、推理、代码、法务、财务、视觉、语音 |
| 隐私等级 | 本地优先、可云端、禁止外传 |
| 成本预算 | 优先低成本，必要时升级 |
| 延迟要求 | 实时任务优先低延迟 |
| 可靠性 | 失败自动降级或切换 |
| 专业性 | 专家任务走专业模型或提示链 |

## 成本预算

每次任务应有预算：

- token。
- 金额。
- 时间。
- 工具调用次数。
- 重试次数。

预算耗尽前应回报给主人或降级。

## 禁止事项

1. 禁止直接把敏感资料发给外部模型而不走隐私策略。
2. 禁止在前端直接调用模型供应商密钥。
3. 禁止绕过审计执行工具。
4. 禁止无上限重试。
5. 禁止把某模型输出当成权限依据。
