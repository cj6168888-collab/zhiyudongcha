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

