# 可观测性与事故响应

## 目的

生语助手会读取资料、生成记忆、执行任务、操作 App、进入蜂群。系统必须知道自己做了什么、为什么做、哪里失败、是否影响主人。

可观测性不是只看服务是否在线，而是让强能力可追溯、可诊断、可止损。

## 日志

所有服务端关键日志必须包含：

- `requestId`
- `actorId`
- `sessionId`
- `route` 或 `service`
- `action`
- `riskLevel`
- `dataSensitivity`
- `result`
- `durationMs`

禁止记录：

- 密钥。
- 密码。
- 验证码。
- 完整身份证、银行卡、医疗、法律原文。
- 未脱敏的邮件正文、聊天正文和联系人列表。

## 审计

审计与普通日志不同。审计记录用于回答“她是否越界”。

必须审计：

- 敏感数据读取。
- 敏感数据外传。
- 高风险确认。
- 删除。
- 共享。
- 权限变更。
- 蜂群广播。
- 节点异常。
- App 外部影响动作。

审计字段：

```ts
type AuditEvent = {
  id: string;
  requestId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  riskLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  dataSensitivity: "S0" | "S1" | "S2" | "S3" | "S4";
  scope: "OWN" | "FLEET" | "ALL";
  result: "allowed" | "blocked" | "confirmed" | "failed";
  summary: string;
  createdAt: string;
};
```

## 指标

服务指标：

- HTTP 2xx/4xx/5xx。
- API latency。
- WebSocket connection count。
- database latency。
- Redis availability。
- queue depth。

AI 指标：

- provider latency。
- provider error rate。
- token usage。
- cost estimate。
- fallback count。
- model route decision.

产品安全指标：

- high risk confirmations required。
- high risk confirmations approved。
- blocked L5 actions。
- sensitive export attempts。
- audit write failures。
- deleted memory recall violations。

## 追踪

长链路任务必须用同一个 correlation id 串联：

```text
conversation
  -> structured understanding
  -> memory candidate
  -> project/task creation
  -> risk confirmation
  -> execution
  -> audit
  -> result callback
```

## 告警分级

| 等级 | 示例 | 处理 |
| --- | --- | --- |
| P0 | 敏感数据误外传、越权删除、生产不可用 | 立即停止相关自动化 |
| P1 | 高风险确认失效、审计写入失败、数据库迁移失败 | 当日修复 |
| P2 | 模型 provider 大面积失败、成本异常、任务队列积压 | 观察并降级 |
| P3 | 单接口慢、单页面报错、非核心任务失败 | 排期修复 |

## 事故响应流程

1. 识别：确认事故类型、影响范围、涉及用户和数据等级。
2. 止血：暂停相关任务、工具、provider 或自动执行能力。
3. 保全：保存 requestId、审计、日志、任务状态和相关证据。
4. 通知：需要时通知主人、管理员或蜂王。
5. 修复：修补代码、配置、权限、文档和测试。
6. 恢复：灰度打开能力，观察指标。
7. 复盘：输出事故报告，更新守护协议和测试集。

## 降级策略

当依赖异常时：

- 模型不可用：切换 fallback 或只生成草稿。
- 工具不可用：标记任务 BLOCKED，给人工步骤。
- 审计不可用：禁止高风险动作。
- 数据库不可用：停止写入型任务。
- Redis 不可用：降级实时状态，不影响已持久化数据。
- App 控制不可用：停止点击输入，只保留说明。

## 发布监控

每次发布后至少观察：

- `/api/health`。
- 关键 API 错误率。
- 构建版本。
- 数据库迁移状态。
- 审计写入状态。
- 高风险确认链路。
- 任务执行成功率。

