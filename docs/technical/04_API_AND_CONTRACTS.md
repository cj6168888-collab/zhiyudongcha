# API 与契约规范

## 统一响应

新 API 应使用统一响应结构：

```ts
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
};
```

兼容旧接口时可以保留旧字段，但新接口应优先使用 `data`。

## 输入校验

所有非简单 GET 接口必须使用 zod 或等价 schema 校验。

校验失败返回：

```ts
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid request",
    details: [...]
  }
}
```

## 错误码

错误码应稳定，可供前端和测试判断。

常见错误：

- `VALIDATION_ERROR`
- `AUTH_REQUIRED`
- `PERMISSION_DENIED`
- `RISK_CONFIRMATION_REQUIRED`
- `RESOURCE_NOT_FOUND`
- `PROVIDER_UNAVAILABLE`
- `BUDGET_EXCEEDED`
- `EXECUTION_FAILED`
- `INTERNAL_ERROR`

## 权限声明

新接口必须明确：

- 是否需要登录。
- 需要什么 role 或 grant。
- 访问哪类 Resource。
- 执行哪类 Action。
- Scope 是 OWN、FLEET 还是 ALL。

## 风险等级

所有会读取敏感数据或影响外部世界的接口必须声明风险等级：

- L0 观察。
- L1 整理。
- L2 草拟。
- L3 外部影响。
- L4 高风险。
- L5 禁止或交给主人。

## 审计字段

高风险接口至少记录：

- actor。
- action。
- targetType。
- targetId。
- riskLevel。
- dataSensitivity。
- result。
- requestId。
- timestamp。

## Swagger / OpenAPI

对外或关键内部 API 应更新 Swagger。

最低要求：

- method。
- path。
- request schema。
- response schema。
- error schema。
- auth requirement。

## 测试

新 API 至少应覆盖：

- 成功路径。
- 校验失败。
- 未授权。
- 权限不足。
- 关键服务失败。

涉及敏感数据外传和外部影响动作的接口必须有确认/拦截测试。
