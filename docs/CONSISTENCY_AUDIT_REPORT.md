# 系统统一性检查报告 v1.0

生成时间: 2026-04-19

---

## 执行摘要

本次检查覆盖了系统的6个核心维度，发现了多个**信息孤岛**和**不一致性问题**。以下是问题汇总：

| 维度 | 状态 | 问题数量 | 严重程度 |
|------|------|---------|---------|
| 数据库 Schema | ⚠️ 有问题 | 12 | 高 |
| API 响应格式 | ❌ 需修复 | 15 | 高 |
| 配置管理 | ⚠️ 有问题 | 8 | 中 |
| 服务依赖注入 | ⚠️ 有问题 | 6 | 中 |
| 错误处理 | ❌ 需修复 | 7 | 高 |
| 日志记录 | ⚠️ 有问题 | 5 | 中 |

---

## 一、数据库 Schema 一致性

### 1.1 表命名不一致 (严重)

**问题**: 迁移文件中存在 PascalCase 和 snake_case 混用

| 问题 | 影响 |
|------|------|
| `migrations/001_swarm_tables.sql` 使用 snake_case (`swarm_entities`, `swarm_teams`) | 与002中的 ALTER TABLE 语句冲突 |
| `migrations/002_navigator_tables.sql` 使用 PascalCase (`swarmEntities`, `swarmTeams`) | 会导致 ALTER TABLE 失败 |

**建议**: 统一使用 snake_case

### 1.2 列命名不一致 (严重)

| Schema (TypeScript) | SQL (迁移文件) |
|---------------------|----------------|
| `userId` (camelCase) | `user_id` (snake_case) |
| `personId` | `person_id` |
| `hpBalance` | `hp_balance` |

**建议**: 这是已知模式，但应记录在文档中

### 1.3 索引引用不存在的列 (严重)

```sql
-- migrations/003_performance_indexes.sql
-- 这些索引引用了不存在的列:
-- persons.user_id (不存在，应该是 id)
-- talk_sessions.type (不存在，应该是 talk_type)
-- devices.type (不存在，应该是 device_type)
-- devices.last_active_at (不存在，应该是 last_seen)
```

### 1.4 类型定义不一致

| 问题 | 位置 | 说明 |
|------|------|------|
| Boolean 用 text 类型 | `schema.ts` | `voiceEnabled`, `autoAnalyze` 使用 `text()` |
| Boolean 用 integer 类型 | `schema.ts` | `isActive`, `sandboxRequired` 使用 `integer()` |

**建议**: 统一使用 `boolean()` 类型

### 1.5 外键约束问题

- Schema 定义没有外键，但 SQL 迁移文件有
- `hp_transactions.user_id` 引用 `persons(id)` 但 `persons` 表没有 `user_id` 列

---

## 二、API 响应格式一致性

### 2.1 标准格式定义

项目定义了标准响应格式在 `lib/api-response.ts`:

```typescript
// 成功
{ success: true, data: T, meta: { timestamp } }

// 错误
{ success: false, error: { code, message, details } }

// 分页
{ success: true, data: T[], pagination: { page, limit, total } }
```

### 2.2 不遵循标准的路由 (严重)

| 路由文件 | 问题 |
|---------|------|
| `routes/auth.ts` | 缺少 `success` 字段，直接返回 `{ role, message }` |
| `routes/user-settings.ts` | 直接返回原始数据，无包装 |
| `routes/vault.ts` | 直接返回数组/对象，无 `success` 字段 |
| `routes/conversation.ts` | 混合格式，部分缺少 `data` 包装 |
| `routes/expenses.ts` | 直接返回发票/报告数据 |
| `routes/email.ts` | 直接返回邮件数据 |
| `routes/coze.ts` | 直接传递服务层结果 |
| `routes/z3-devices.ts` | 直接返回设备对象 |

### 2.3 错误响应不一致

| 格式 | 使用的文件 |
|------|-----------|
| `{ success: false, error: {...} }` | 遵循标准的路由 |
| `{ error: "...", code: "..." }` | `auth.ts`, `vault.ts` |
| `{ error: "..." }` | `user-settings.ts`, `conversation.ts` |

---

## 三、配置管理一致性

### 3.1 配置访问模式

| 模式 | 使用情况 | 说明 |
|------|---------|------|
| `lib/config.ts` 的 `getConfig()` | 部分模块 | 验证过的配置 |
| 直接 `process.env` | 多数模块 | **未经验证** |
| `ConfigManager` 类 | 少数 | 带缓存的配置管理器 |
| `SecureConfigManager` | 无 | 应该使用但未使用 |

### 3.2 问题配置点

| 模块 | 问题 |
|------|------|
| `db.ts` | 直接访问 `process.env['DATABASE_URL']` |
| `index.ts` | 使用 `DB_HOST`, `DB_PORT` 而不是 `DATABASE_URL` |
| `dashscope.ts` | 直接访问 `DASHSCOPE_API_KEY` |
| `services/voice-config.ts` | 直接访问多个环境变量 |

### 3.3 加密密钥源不一致 (安全风险)

| 文件 | 密钥来源 | 备用 |
|------|---------|------|
| `secure-config-manager.ts` | `MASTER_SECRET` | 无 |
| `secure-config.ts` | `CONFIG_ENCRYPTION_KEY` | `SESSION_SECRET` |
| `production-security.ts` | `CONFIG_ENCRYPTION_KEY` | `SESSION_SECRET` → 硬编码默认值 |
| `secret-vault.ts` | `SECRET_VAULT_KEY` | `SESSION_SECRET` → 硬编码默认值 |

### 3.4 重复的 Zod Schema

配置验证 Schema 在多个地方定义:
- `lib/config.ts`
- `lib/secure-config.ts`
- `lib/production-security.ts`

这些 Schema 有细微差异，容易造成漂移。

---

## 四、服务依赖注入一致性

### 4.1 单例模式变体

**变体 A**: 延迟初始化 (懒加载)
```typescript
class BrowserAgent {
  private static instance: BrowserAgent | null = null;
  public static getInstance(): BrowserAgent {
    if (!BrowserAgent.instance) {
      BrowserAgent.instance = new BrowserAgent();
    }
    return BrowserAgent.instance;
  }
}
export const browserAgent = BrowserAgent.getInstance();
```

**变体 B**: 直接实例化 (立即初始化)
```typescript
export const emailService = new EmailService();
```

### 4.2 导出模式不一致

| 模式 | 示例 |
|------|------|
| 命名 + 默认导出 | `export const x; export default x;` |
| 仅命名导出 | `export const x;` |
| 对象工厂 | `export const x = { ... };` |

### 4.3 循环依赖问题

| 依赖链 | 影响 |
|--------|------|
| `CloudHub` ↔ `DeviceConnectionService` | 可能导致初始化顺序问题 |
| `CloudHub` ↔ `RemoteControlService` | 同上 |
| `DeviceRegistry` ↔ `CloudHub` | 同步导入可能失败 |

**缓解措施**: 使用动态 `import()` 和延迟 `require()`

---

## 五、错误处理一致性

### 5.1 重复的错误类定义

| 位置 | 问题 |
|------|------|
| `lib/errors.ts` | 38个错误码的完整定义 |
| `middleware/unified-error-handler.ts` | **重复定义**了 `AppError` 和 `ErrorCode` |

### 5.2 错误抛出模式不一致

| 模式 | 使用情况 |
|------|---------|
| `throw new BusinessError(...)` | 部分服务 |
| `throw new Error(...)` | **多数服务** (`navigator-core.ts`, `chrysalis-orchestrator.ts` 等) |

### 5.3 未使用的工具

| 工具 | 存在但未被使用 |
|------|----------------|
| `asyncHandler` 中间件 | 多数路由手动 try-catch |
| `safeAsync` / `safeSync` | 少数地方使用 |
| `Result<T, E>` 类型 | 很少使用 |

---

## 六、日志记录一致性

### 6.1 混合的日志 API

| 日志实现 | 使用情况 |
|---------|---------|
| `lib/logger.ts` (Pino) | 大多数服务 |
| `console.log/warn/error` | **SyncService**, 部分配置文件 |
| `lib/log-aggregator.ts` 的 `log` | 与主日志器 API 不同 |

### 6.2 错误日志模式不一致

```typescript
// 模式 A
logger.error({ err: error }, '消息');

// 模式 B
logger.error({ error: error.message, stack: error.stack }, '消息');

// 模式 C
logger.error('简单消息');
```

### 6.3 直接 console 使用

发现以下文件使用 `console` 而非 Pino:
- `lib/config.ts`
- `routes.ts`
- `services/sync/sync-service.ts`
- `routes/business.routes.ts`
- `services/pc-agent/ProgrammingAssistantAssistantService.ts`

---

## 七、修复优先级建议

### 紧急 (影响系统稳定)

1. **数据库迁移文件** - 统一表名大小写
2. **API 响应格式** - 修复 auth.ts, vault.ts, expenses.ts 等
3. **错误类统一** - 删除 `unified-error-handler.ts` 中的重复定义

### 高优先级 (影响开发效率)

4. **配置访问统一** - 所有模块使用 `getConfig()`
5. **日志 API 统一** - 替换所有 `console` 调用

### 中优先级 (长期维护)

6. **服务导出模式** - 统一单例初始化模式
7. **Schema 定义统一** - 单一配置验证入口
8. **错误处理工具** - 推广使用 `asyncHandler`

---

## 八、建议的统一规范

### 8.1 API 响应规范

```typescript
// 成功
res.json({
  success: true,
  data: payload,
  meta: { timestamp: new Date().toISOString() }
});

// 错误
res.status(code).json({
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: '用户友好的消息',
    details: optionalData
  }
});
```

### 8.2 配置访问规范

```typescript
// 首选: 使用 getConfig()
import { getConfig } from './lib/config';
const config = getConfig();

// 如果需要动态重载: 使用 ConfigManager
import { configManager } from './lib/config-manager';
const value = await configManager.get('KEY');
```

### 8.3 错误处理规范

```typescript
// 使用 BusinessError 或其子类
import { BusinessError, ErrorCode } from './lib/errors';
throw new BusinessError('操作失败', ErrorCode.VALIDATION_ERROR);

// 或使用 asyncHandler
import { asyncHandler } from './middleware/unified-error-handler';
app.get('/path', asyncHandler(async (req, res) => {
  // 自动错误捕获
}));
```

### 8.4 日志记录规范

```typescript
import { createServiceLogger } from './lib/logger';
const logger = createServiceLogger('ServiceName');

// 统一错误格式
logger.error({ err: error }, '操作失败');
logger.info({ userId, action }, '操作成功');
```

---

## 九、后续行动

| 任务 | 负责人 | 截止日期 | 状态 |
|------|--------|---------|------|
| 统一数据库表名命名 | TBD | TBD | 待办 |
| 修复 auth.ts 响应格式 | TBD | TBD | 待办 |
| 删除重复错误类 | TBD | TBD | 待办 |
| 统一配置访问模式 | TBD | TBD | 待办 |
| 替换 console 日志调用 | TBD | TBD | 待办 |

---

*报告生成: 2026-04-19*
*检查范围: server/ 目录下的所有 TypeScript 文件*
