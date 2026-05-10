# 感知、外设与 Conversation 技术实施规格

> 版本：2026-04-30 v1
> 状态：技术实施基线
> 对应产品文档：`docs/12_PERCEPTION_DEVICE_AND_CONVERSATION_STRATEGY.md`

## 目标

本规格把 Omi 借鉴、小智/ESP32 外设、手机端意识觉醒、Conversation 原始事实层落成可实现的后端、前端、数据、协议和测试要求。

核心目标：

1. 建立 `Conversation` 为所有感知输入的第一等事实实体。
2. 建立 `PerceptionGateway`，统一接入手机、桌面、ESP32 外设、Omi、浏览器、文件和手动输入。
3. 建立 `NavigatorDeviceRuntime`，让 ESP32 成为可选外设身体。
4. 建立 `OmiProvider`，把 Omi 当作可拔插上游感知源。
5. 所有记忆、任务、事件、项目更新必须能回跳到原始事实。
6. 所有高风险动作必须经过主权守护、确认和审计。

## 范围

### P0 范围

- Conversation 数据模型。
- Conversation CRUD API。
- TranscriptSegment 数据模型。
- Conversation Inbox API。
- 基础后处理流水线。
- Chat/Voice 输入生成 Conversation。
- MemoryCandidate、TaskCandidate、EventCandidate。
- 来源追溯。

### P1 范围

- 手机端身份觉醒状态检查。
- 设备绑定模型。
- 设备状态 API。
- 设备权限策略。
- 外设绑定前不能获得人格配置。

### P2 范围

- XiaoZhiBridge WebSocket。
- 设备事件协议。
- 设备命令协议。
- 闲聊、快速记事、明确记录、任务请求四种模式。
- 离线/错误状态。

### P3 范围

- Omi 批量导入。
- Omi remote id mapping。
- Omi import cursor。
- Omi 原始 payload 保存。

## 数据模型

### conversations

建议新增表：

```ts
conversations {
  id: uuid primary key
  ownerId: uuid not null
  source: text not null
  sourceDeviceId: text null
  externalSourceId: text null
  mode: text null
  status: text not null
  language: text null
  title: text null
  summary: text null
  keyPoints: jsonb not null default '[]'
  rawPayloadRef: text null
  hash: text null
  startedAt: timestamp not null
  endedAt: timestamp null
  importedAt: timestamp null
  createdAt: timestamp not null
  updatedAt: timestamp not null
}
```

约束：

- `source` 允许：`mobile`、`desktop`、`xiaozhi_device`、`omi`、`browser`、`file`、`manual`、`import`。
- `status` 允许：`in_progress`、`processing`、`review_pending`、`completed`、`failed`、`discarded`。
- `externalSourceId + source` 应唯一，避免重复导入。

### conversation_segments

```ts
conversation_segments {
  id: uuid primary key
  conversationId: uuid not null
  sequence: integer not null
  segmentType: text not null
  text: text null
  speaker: text null
  speakerType: text null
  personId: uuid null
  startMs: integer null
  endMs: integer null
  confidence: numeric null
  mediaRef: text null
  rawPayloadRef: text null
  source: text not null
  createdAt: timestamp not null
}
```

`segmentType` 允许：`transcript`、`audio`、`screen`、`image`、`file`、`system`、`import_note`。

### conversation_candidates

统一保存后处理候选，避免一开始污染长期实体。

```ts
conversation_candidates {
  id: uuid primary key
  conversationId: uuid not null
  candidateType: text not null
  status: text not null
  content: jsonb not null
  confidence: numeric null
  riskLevel: text null
  linkedEntityId: uuid null
  linkedEntityType: text null
  reviewedBy: uuid null
  reviewedAt: timestamp null
  createdAt: timestamp not null
  updatedAt: timestamp not null
}
```

`candidateType` 允许：`memory`、`task`、`event`、`project_update`、`person_update`、`risk`、`insight`。

`status` 允许：`pending`、`accepted`、`edited`、`rejected`、`applied`。

### device_bindings

```ts
device_bindings {
  id: uuid primary key
  ownerId: uuid not null
  identityId: uuid not null
  deviceId: text not null unique
  deviceType: text not null
  provider: text not null
  displayName: text null
  status: text not null
  capabilities: jsonb not null default '{}'
  allowedModes: jsonb not null default '[]'
  riskPolicy: jsonb not null default '{}'
  lastSeenAt: timestamp null
  boundAt: timestamp not null
  revokedAt: timestamp null
}
```

`deviceType` 允许：`mobile`、`desktop`、`esp32_voice`、`omi`、`browser`。

### provider_sync_states

```ts
provider_sync_states {
  id: uuid primary key
  ownerId: uuid not null
  provider: text not null
  accountRef: text null
  cursor: text null
  lastSyncedAt: timestamp null
  status: text not null
  errorMessage: text null
  config: jsonb not null default '{}'
  createdAt: timestamp not null
  updatedAt: timestamp not null
}
```

## 后端服务

### PerceptionGateway

路径建议：

```text
server/services/perception/PerceptionGateway.ts
```

职责：

- 接收所有感知事件。
- 校验 owner、device、provider、权限。
- 创建或追加 Conversation。
- 写入原始 payload 引用。
- 触发后处理任务。
- 写入审计事件。

核心接口：

```ts
interface PerceptionGateway {
  ingest(event: PerceptionEvent): Promise<IngestResult>;
  startConversation(input: StartConversationInput): Promise<ConversationRecord>;
  appendSegment(input: AppendSegmentInput): Promise<ConversationSegmentRecord>;
  finishConversation(input: FinishConversationInput): Promise<ConversationRecord>;
}
```

### ConversationService

路径建议：

```text
server/services/conversation/ConversationService.ts
```

职责：

- Conversation CRUD。
- Segment 管理。
- 候选项管理。
- Inbox 查询。
- 接受、编辑、拒绝候选项。
- 回跳来源。

### ConversationProcessor

路径建议：

```text
server/services/conversation/ConversationProcessor.ts
```

职责：

- 对 Conversation 执行摘要。
- 提取任务候选。
- 提取记忆候选。
- 提取事件候选。
- 实体链接到项目、人物、任务、保险库。
- 风险分类。
- 生成审计事件。

处理流程：

```text
load conversation
  -> assemble transcript/context
  -> classify mode
  -> summarize
  -> extract candidates
  -> link entities
  -> classify risk
  -> persist candidates
  -> mark review_pending/completed
```

### DeviceBindingService

职责：

- 设备绑定码。
- 设备绑定确认。
- 设备撤销。
- 设备权限策略。
- 身份觉醒状态检查。

规则：

- 未完成身份觉醒，不允许外设绑定人格配置。
- 外设绑定必须属于某个 owner 和 identity。
- 设备撤销后，所有会话连接必须失效。

### NavigatorDeviceRuntime

职责：

- 管理 ESP32 外设连接。
- 接收 device event。
- 发送 device command。
- 维护在线状态、心跳、电量、模式。
- 把语音和文本事件交给 `PerceptionGateway`。

### OmiProvider

职责：

- 与 Omi API 或导出文件交互。
- 批量导入 conversations。
- 批量导入 memories。
- 批量导入 action items。
- 保存 cursor。
- 生成本地 Conversation 和 Candidate。

规则：

- Omi 数据必须进入候选态。
- 不允许直接写长期记忆。
- 不允许把 Omi remote id 当主键。
- 导入必须幂等。

## API 设计

### Conversation API

```text
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id
POST   /api/conversations/:id/segments
POST   /api/conversations/:id/finish
POST   /api/conversations/:id/process
DELETE /api/conversations/:id
```

### Inbox API

```text
GET   /api/conversation-inbox
GET   /api/conversation-inbox/counts
POST  /api/conversation-candidates/:id/accept
POST  /api/conversation-candidates/:id/edit
POST  /api/conversation-candidates/:id/reject
POST  /api/conversation-candidates/:id/apply
```

### Device API

```text
POST   /api/devices/bind-code
POST   /api/devices/bind
GET    /api/devices
GET    /api/devices/:id
PATCH  /api/devices/:id
POST   /api/devices/:id/revoke
GET    /api/devices/:id/status
```

### Provider API

```text
POST  /api/providers/omi/connect
POST  /api/providers/omi/import
GET   /api/providers/omi/status
POST  /api/providers/omi/disconnect
```

## WebSocket 设计

### ESP32 外设 WebSocket

建议路径：

```text
/ws/devices/esp32
```

连接参数：

- `deviceId`
- `bindingToken`
- `firmwareVersion`
- `protocolVersion`

连接后必须先发送：

```json
{
  "type": "hello",
  "deviceId": "nav-dev-001",
  "protocolVersion": "1.0",
  "capabilities": {
    "audioInput": true,
    "audioOutput": true,
    "display": "oled",
    "light": "rgb",
    "opus": true,
    "mcp": true
  }
}
```

服务端返回：

```json
{
  "type": "hello_ack",
  "sessionId": "sess-001",
  "identity": {
    "name": "小语",
    "wakeWord": "小语小语",
    "voiceId": "voice-default",
    "tone": "warm"
  },
  "allowedModes": ["casual_chat", "record_note", "conversation_record", "task_request"],
  "riskPolicyVersion": "2026-04-30"
}
```

如果未绑定：

```json
{
  "type": "binding_required",
  "displayCode": "482913",
  "expiresInSec": 600
}
```

### 音频事件

```json
{
  "type": "audio_segment",
  "sessionId": "sess-001",
  "mode": "record_note",
  "sequence": 12,
  "codec": "opus",
  "sampleRate": 16000,
  "durationMs": 2400,
  "payloadRef": "binary-frame:12"
}
```

### 文本事件

```json
{
  "type": "text_intent",
  "sessionId": "sess-001",
  "mode": "task_request",
  "text": "明天上午提醒我给王总发方案",
  "confidence": 0.94
}
```

### 状态命令

```json
{
  "type": "set_state",
  "state": "needs_confirmation",
  "displayText": "请在手机确认",
  "light": "amber_pulse"
}
```

## 安全与权限

### 设备绑定

1. 设备首次启动只能进入 `binding_required`。
2. 手机端生成绑定码或扫描二维码。
3. 服务端确认 owner、identity、device capabilities。
4. 绑定后发放短期 session token。
5. 长期 credential 必须可撤销。

### 高风险动作

外设请求以下动作时只能生成候选或确认请求：

- 发送。
- 删除。
- 外传。
- 付款。
- 授权。
- 修改账号。
- 分享隐私数据。
- 蜂群广播。
- 法律、医疗、财务高影响动作。

### 审计

必须审计：

- 设备绑定。
- 设备撤销。
- Provider 连接。
- Provider 导入。
- Conversation 创建。
- Candidate 接受、拒绝、应用。
- 高风险确认。
- 外设离线缓存同步。

## 前端页面

### Mobile Awakening

现有页面可承接：

```text
client/src/pages/mobile/Awakening.tsx
```

需要补齐：

- 是否完成觉醒的状态。
- identityId。
- 关系、名字、声音、性格、边界配置。
- 下一步绑定设备入口。

### Conversation Inbox

建议新增：

```text
client/src/pages/mobile/ConversationInbox.tsx
client/src/pages/desktop/ConversationInbox.tsx
```

核心视图：

- 今日。
- 待确认。
- 记忆候选。
- 任务候选。
- 风险片段。
- 已归档。

### Device Binding

建议新增：

```text
client/src/pages/mobile/DeviceBinding.tsx
client/src/pages/mobile/DeviceStatus.tsx
```

核心能力：

- 生成绑定码。
- 扫描或输入设备码。
- 查看设备状态。
- 设置允许模式。
- 撤销设备。

## 测试要求

### Unit

- `ConversationService` 创建、追加、完成、删除。
- `ConversationProcessor` 生成候选项。
- `DeviceBindingService` 未觉醒拒绝绑定。
- `OmiProvider` 幂等导入。
- `PerceptionGateway` 不同来源事件归一化。

### API

- `/api/conversations` CRUD。
- `/api/conversation-inbox` 查询。
- candidate accept/edit/reject/apply。
- device bind/revoke/status。
- Omi import/status。

### E2E

最小路径：

```text
手机端完成觉醒
  -> 生成设备绑定码
  -> 模拟 ESP32 绑定
  -> 发送 record_note 文本事件
  -> 生成 Conversation
  -> 生成 TaskCandidate
  -> 用户接受候选
  -> 任务落地
  -> 任务可回跳 Conversation
```

### Red Team

必须覆盖：

- 未绑定设备伪造事件。
- 被撤销设备继续发事件。
- 外设请求删除、发送、外传。
- Omi 导入 payload 注入提示。
- 记忆候选包含密钥、密码、验证码。
- 离线缓存重复同步。

## 迁移与兼容

现有 `/api/assistant` 已能直接执行 `create_project`、`create_task`、`save_memory`。

新增 Conversation 层后，建议渐进迁移：

1. 保留现有 assistant 执行能力。
2. assistant 每次执行前后写入或关联 Conversation。
3. `save_memory` 先生成 MemoryCandidate，再按策略落地。
4. 高风险 execute 继续走现有 risk guard。
5. 后续再把 chat、voice、device、Omi 输入统一迁到 `PerceptionGateway`。

## 发布门槛

P0 发布前必须满足：

- Conversation 能创建、查询、追加 segment。
- 候选项能接受、拒绝、应用。
- 已应用任务和记忆能回跳 Conversation。
- 删除 Conversation 不会孤立长期实体，必须标记来源缺失或阻止删除。
- API 测试覆盖成功和失败路径。

P2 发布前必须满足：

- 未绑定设备无法发送有效事件。
- 设备撤销后 WebSocket 断开。
- 外设高风险请求不能直接执行。
- 断网或重连不会重复创建任务。

P3 发布前必须满足：

- Omi 导入幂等。
- Omi 不可用不影响主系统。
- Omi 数据进入候选态。
- 原始 payload 可审计。

