# 工程一致性整改基线

## 目的

本文件承接旧审计报告中的有效结论，作为后续代码整改和新代码准入的统一标准。

旧参考：

- [../CONSISTENCY_AUDIT_REPORT.md](../CONSISTENCY_AUDIT_REPORT.md)
- [../TECHNICAL_MANUAL.md](../TECHNICAL_MANUAL.md)

本文件优先解决六类漂移：

1. 数据库 schema 和迁移漂移。
2. API 响应格式漂移。
3. 配置访问漂移。
4. 错误处理漂移。
5. 日志格式漂移。
6. 服务初始化和依赖关系漂移。

## 总原则

新代码必须一致；旧代码触及时逐步收敛。不要为了追求一次性整洁，破坏当前可运行主链。

## 数据库一致性

### 命名

PostgreSQL 物理表和列建议统一使用 `snake_case`。

TypeScript 层可以使用 camelCase，但必须通过 Drizzle schema 明确映射，不允许迁移文件和 schema 各自猜测命名。

要求：

- 新表使用 `snake_case`。
- 新列使用 `snake_case`。
- 枚举值使用稳定英文常量。
- 迁移文件不得引用不存在的表或列。
- 手写迁移必须在临时库演练后进入主线。

### 迁移纪律

数据库迁移必须满足：

- 可重复执行或明确不可重复。
- 有回滚或补救说明。
- 涉及记忆、权限、审计、文件索引时必须先备份。
- 不直接删除重要字段，先废弃、迁移、验证，再删除。

## API 响应一致性

新 API 使用统一结构：

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

禁止新接口直接返回裸数组、裸对象或只返回 `{ error: string }`。

兼容旧接口时可以保留旧字段，但必须在文档中标记为 legacy。

## 错误码

错误码必须稳定，前端和测试可以依赖。

推荐基础错误码：

- `VALIDATION_ERROR`
- `AUTH_REQUIRED`
- `PERMISSION_DENIED`
- `RISK_CONFIRMATION_REQUIRED`
- `RESOURCE_NOT_FOUND`
- `PROVIDER_UNAVAILABLE`
- `BUDGET_EXCEEDED`
- `EXECUTION_FAILED`
- `AUDIT_UNAVAILABLE`
- `INTERNAL_ERROR`

## 配置访问

禁止新代码散落读取 `process.env`。

配置访问顺序：

1. `server/lib/config-validator` 或统一配置入口负责校验。
2. 服务层通过统一 config 对象读取。
3. 密钥类配置必须经过安全配置管理，不得有硬编码默认密钥。

生产环境要求：

- 禁止 `replace-with...` 占位符。
- 禁止本地默认密钥。
- 必需密钥缺失时启动失败。
- 密钥轮换必须有操作说明。

## 错误处理

路由层不得大面积重复 try/catch。

推荐：

- 使用统一错误类。
- 使用统一 async handler。
- 用户可见错误短而可行动。
- 开发日志记录错误栈和 requestId。
- 不把内部堆栈返回前端。

服务层可以抛领域错误，但必须能被统一错误处理中间件转换为稳定响应。

## 日志一致性

新代码使用统一 logger，不使用 `console.log` 作为业务日志。

日志建议格式：

```ts
logger.info({ requestId, userId, action, riskLevel }, "action completed");
logger.error({ requestId, err }, "action failed");
```

错误日志统一使用 `{ err }` 字段，避免 `error/message/stack` 多套格式。

禁止日志输出：

- 密钥。
- token。
- 验证码。
- 完整邮件正文。
- 完整聊天记录。
- 高敏文件原文。

## 服务初始化

服务导出建议统一：

- 无状态工具：命名函数导出。
- 有状态服务：工厂或单例，但同一领域保持一致。
- 依赖外部连接的服务：显式 `init()` 或延迟初始化。
- 避免模块加载时立即连接外部服务。

循环依赖处理：

- 抽出接口或端口层。
- 用依赖注入代替互相 import。
- 必要时延迟加载，但不得掩盖架构问题。

## 整改优先级

P0：

- 迁移引用不存在的表或列。
- 高风险接口不统一响应或不审计。
- 生产密钥存在默认值。
- 审计不可用但仍执行高风险动作。

P1：

- 配置访问散落。
- 重复错误类。
- `console` 业务日志。
- route 承载复杂业务编排。

P2：

- 服务导出模式不一致。
- legacy API 未标记。
- schema 命名历史包袱。

