# 当前 API 合约治理

## 目的

项目历史文档中存在大量 API 说明，其中一部分是已挂载能力，一部分是规划或旧接口。为避免文档冒充上线能力，本文件定义 API 合约治理规则。

旧参考：

- [../API_REFERENCE_V2.md](../API_REFERENCE_V2.md)
- [../TECHNICAL_MANUAL.md](../TECHNICAL_MANUAL.md)
- [../../README.md](../../README.md)

## 真相来源

当前可运行 API 以代码为准：

1. `server/index.ts`
2. `server/routes.ts`
3. `server/routes/`
4. Swagger 输出：`/swagger.json`
5. API 测试和 smoke 测试

任何没有在运行入口挂载的路由，都不得标为 Available。

## API 状态

| 状态 | 含义 |
| --- | --- |
| `Available` | 已挂载、可运行、有基本验证 |
| `Experimental` | 已挂载但合约可能变化 |
| `Planned` | 文档规划，未挂载或未验证 |
| `Legacy` | 旧接口，仅兼容，不建议新增依赖 |
| `Deprecated` | 准备下线 |

## 新 API 准入

新增 API 必须包含：

- method。
- path。
- request schema。
- response schema。
- error schema。
- auth requirement。
- permission requirement。
- riskLevel。
- dataSensitivity。
- audit behavior。
- tests。

## 合约格式

新 API 统一响应：

```ts
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
};
```

## 当前主线 API 区域

以下区域是当前主线，需要持续保持 API 文档和测试：

- `/api/auth`
- `/api/authz`
- `/api/models`
- `/api/projects`
- `/api/vault`
- `/api/tasks`
- `/api/remote`
- `/api/business`
- `/api/alerts`
- `/api/knowledge`
- `/api/coze`
- `/api/pc-agent`
- `/api/navigator`
- `/api/report`
- `/api/health`

## Assistant Mobile Queue Contracts

The mobile conversation home depends on these mounted assistant endpoints.
Status is `Experimental` because the response envelope still follows the
existing route shape instead of the canonical `ApiResponse<T>` wrapper.

### `GET /api/assistant/pending`

- Status: `Experimental`
- Auth: current request user when available; falls back to `default` in local/dev contexts
- Permission: user-scoped read of active pending actions and drafts
- Risk level: `L0 observation`
- Data sensitivity: action titles, draft labels, action parameters
- Audit behavior: none; read-only recovery endpoint
- Tests: `server/tests/unit/routes/hybrid-assistant-flow.test.ts`

Response:

```ts
type AssistantPendingSummary = {
  success: true;
  count: number;
  pending: Array<{
    id: string;
    entryType: 'pending';
    action: string;
    actionParams?: Record<string, unknown>;
    expiresAt: string | Date;
    createdAt: string | Date;
  }>;
  draft: Array<{
    id: string;
    entryType: 'draft';
    action: null;
    items: Array<{
      action: string;
      label?: string;
      actionParams: Record<string, unknown>;
    }>;
    expiresAt: string | Date;
    createdAt: string | Date;
  }>;
};
```

Behavior:

- Merges active in-memory queue entries with persisted `pending_actions` rows.
- De-duplicates by `id`, with DB rows overriding the in-memory snapshot for the same id.
- Sorts merged rows by `createdAt` ascending before splitting `pending` and `draft`.
- Returns an empty successful summary when the DB table is unavailable.

### `POST /api/assistant/pending/discard`

- Status: `Experimental`
- Auth: current request user when available; falls back to `default`
- Permission: user-scoped discard of one active pending action or draft
- Risk level: `L1 organize`
- Data sensitivity: response id only
- Audit behavior: none; discard removes unexecuted temporary work
- Tests: `server/tests/unit/routes/hybrid-assistant-flow.test.ts`

Request:

```ts
type DiscardPendingRequest = {
  responseId: string;
};
```

Response:

```ts
type DiscardPendingResponse = {
  success: true;
  discarded: boolean;
};
```

Errors:

- `400` when `responseId` is missing.
- `500` when discard handling fails unexpectedly.

### `POST /api/assistant/draft/update`

- Status: `Experimental`
- Auth: current request user when available; falls back to `default`
- Permission: user-scoped update of one active draft
- Risk level: `L2 draft`
- Data sensitivity: draft action labels and action parameters
- Audit behavior: none until the draft is confirmed and executed
- Tests: `server/tests/unit/routes/hybrid-assistant-flow.test.ts`

Request:

```ts
type UpdateDraftRequest = {
  responseId: string;
  items: Array<{
    action: string;
    label?: string;
    actionParams: Record<string, unknown>;
  }>;
};
```

Response:

```ts
type UpdateDraftResponse = {
  success: true;
  draft: {
    id: string;
    entryType: 'draft';
    action: null;
    items: UpdateDraftRequest['items'];
    expiresAt: string | Date;
    createdAt: string | Date;
  };
};
```

Errors:

- `400` when `responseId` is missing.
- `400` when `items` is missing, empty, or not an array.
- `404` when the draft does not exist, expired, or belongs to another user.
- `500` when draft persistence fails unexpectedly.

### `POST /api/assistant/draft/confirm`

- Status: `Experimental`
- Auth: current request user when available; falls back to `default`
- Permission: user-scoped execution of one active draft
- Risk level: depends on draft item actions; current supported actions create projects, tasks, memories, and persons, or search vault
- Data sensitivity: draft action parameters and execution results
- Audit behavior: successful executions are recorded through `ConversationExecutionEventRecorder`
- Tests: `server/tests/unit/routes/hybrid-assistant-flow.test.ts`

Request:

```ts
type ConfirmDraftRequest = {
  responseId: string;
};
```

Response:

```ts
type ConfirmDraftResponse = {
  success: true;
  executions: Array<{
    success: boolean;
    action: string;
    entityType?: 'project' | 'task' | 'memory';
    entityId?: string;
    entityData?: Record<string, unknown>;
    errorMessage?: string;
  }>;
};
```

Errors:

- `400` when `responseId` is missing.
- `404` when the draft does not exist, expired, or belongs to another user.
- `500` when draft execution fails unexpectedly.

## WebSocket 合约

WebSocket 端点必须文档化：

- 路径。
- 认证方式。
- 消息类型。
- 心跳。
- 重连策略。
- 错误消息。
- 是否影响外部世界。

当前主线：

- `/ws/z3`
- `/ws/asr`
- `/ws/realtime-voice`
- `/ws/remote-control`

## 变更纪律

破坏性变更必须：

1. 新增版本或兼容层。
2. 更新 Swagger/API 文档。
3. 更新测试。
4. 更新 CHANGELOG。
5. 标记旧接口 Deprecated。

