# 🐍 毒舌架构师改进方案

## 📊 问题分析

### 当前状态
| 问题 | 现状 | 目标 | 难度 |
|------|------|------|------|
| 服务膨胀 | 142个服务文件 | 10个领域模块 | ⭐⭐⭐⭐ |
| 路由膨胀 | 108个路由文件 | 10个领域路由 | ⭐⭐⭐⭐ |
| any滥用 | 462 处 (server目录) | < 50处 | ⭐⭐⭐⭐⭐ |
| try-catch | ~500处 | 统一封装 | ⭐⭐⭐ |

### 核心问题根因
1. **架构与实现脱节** - 有 `architecture.ts` 但物理文件未整合
2. **快速迭代牺牲质量** - 先实现功能，类型后补
3. **错误处理各自为政** - 没有统一的错误封装

---

## ✅ 已完成改进 (阶段一)

### 1. 类型基础设施
| 文件 | 说明 |
|------|------|
| `server/lib/result.ts` | Result<T> 类型 + safeAsync 工具函数 |
| `server/types/express.d.ts` | Express 扩展类型声明 |
| `server/lib/api-response.ts` | 统一 API 响应辅助函数 |

### 2. 中间件类型改进
| 文件 | 改进 |
|------|------|
| `server/middleware/secure-auth.ts` | 移除 10+ 处 any，使用正确类型 |

### 3. 质量检查工具
| 文件 | 说明 |
|------|------|
| `scripts/analyze-code-quality.cjs` | 代码质量分析脚本 |

---

## 🎯 改进方案

### 阶段一：TypeScript 类型安全 (已完成 ✅)

#### 1.1 已创建的工具

**Result<T> 类型** (`server/lib/result.ts`):
```typescript
import { safeAsync, ok, fail, isOk, unwrapOr } from '../lib/result';
import { ErrorCode } from '../lib/errors';

// 使用示例
async function fetchUser(id: string) {
  const result = await safeAsync(
    () => db.users.findById(id),
    ErrorCode.DATABASE_ERROR
  );
  
  if (!result.ok) {
    console.error(result.error.message);
    return null;
  }
  
  return result.value;
}

// 或使用 ResultPromise
const result = await fromPromise(fetchUser(id))
  .then(user => user.name)
  .catch(err => 'anonymous');
```

**API 响应** (`server/lib/api-response.ts`):
```typescript
import { createSuccessResponse, createErrorResponse, calculatePagination } from '../lib/api-response';

// 成功响应
res.apiSuccess({ user: 'data' });

// 分页响应
const pagination = calculatePagination(page, limit, total);
res.apiPaginated(items, pagination);

// 错误响应
res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid input'));
```

---

### 阶段二：TypeScript 类型安全 (优先级: 🔴 高)

#### 1.1 创建 Express 类型兼容层
```typescript
// server/types/express.d.ts
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      context?: RequestContext;
      correlationId?: string;
    }
    interface Response {
      apiSuccess<T>(data: T, meta?: ResponseMeta): Response;
      apiError(error: AppError): Response;
    }
  }
}

interface UserPayload {
  id: string;
  role: 'admin' | 'user' | 'guest';
  permissions: string[];
}

interface RequestContext {
  source: 'web' | 'mobile' | 'voice' | 'device';
  sessionId?: string;
}
```

#### 1.2 替换 any 的优先级清单
| 优先级 | 场景 | 替换类型 | 影响文件数 |
|--------|------|----------|------------|
| P0 | Express req/res/next | 声明全局类型 | ~20 |
| P1 | 数据库查询结果 | `Repository<T>` 泛型 | ~15 |
| P1 | API 响应数据 | `ApiResponse<T>` | ~10 |
| P2 | 第三方API响应 | 各provider接口 | ~8 |
| P3 | 内部工具函数 | 具体类型 | ~5 |

#### 1.3 渐进式迁移脚本
```bash
# 检测剩余 any 数量
npx tsc --noEmit 2>&1 | grep "any" | wc -l

# 生成类型缺失报告
npx tsc --noEmit --pretty false > type-errors.txt
```

---

### 阶段二：服务/路由整合 (优先级: 🔴 高)

#### 2.1 物理整合策略
```
当前: server/services/xxx.ts (142个)
     server/routes/xxx.ts (108个)

目标: server/domains/
       ├── ai/
       │   ├── services/
       │   │   ├── conversation.ts    # 合并 conversation + smart-filter
       │   │   ├── intent-classifier.ts
       │   │   └── index.ts           # 统一导出
       │   └── routes/
       │       ├── index.ts
       │       └── handlers.ts
       ├── memory/
       ├── voice/
       └── ...
```

#### 2.2 自动整合脚本
```typescript
// scripts/consolidate.ts
import { glob } from 'glob';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, basename } from 'path';

interface ConsolidationRule {
  domain: string;
  patterns: string[];
  outputDir: string;
}

const RULES: ConsolidationRule[] = [
  {
    domain: 'ai',
    patterns: ['*conversation*', '*smart-filter*', '*intent*', '*empathic*'],
    outputDir: 'server/domains/ai'
  },
  {
    domain: 'memory',
    patterns: ['*emotional*', '*dream*', '*insight*', '*spirit*'],
    outputDir: 'server/domains/memory'
  },
  // ... 10个领域
];

async function consolidate() {
  for (const rule of RULES) {
    const files = await glob(`server/services/**/${rule.patterns.join('|')}.ts`);
    // 1. 读取所有文件
    // 2. 提取公共类型和函数
    // 3. 生成合并后的 index.ts
    // 4. 生成重定向文件 (保持向后兼容)
  }
}
```

#### 2.3 向后兼容策略
```typescript
// server/services/legacy-redirects.ts
// 旧文件名 -> 新模块的映射
export const SERVICE_REDIRECTS: Record<string, string> = {
  'ai-conversation-service': 'domains/ai/conversation',
  'smart-conversation': 'domains/ai/conversation',
  'emotional-memory': 'domains/memory/emotional',
  // ... 全部142个
};

// 动态加载，保持向后兼容
export function getService(name: string) {
  const module = SERVICE_REDIRECTS[name];
  return module ? require(module).default : null;
}
```

---

### 阶段三：错误处理标准化 (优先级: 🟡 中)

#### 3.1 统一错误类
```typescript
// server/lib/errors.ts

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export type Result<T, E = AppError> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// 工具函数，替代 try-catch
async function safeAsync<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode = ErrorCode.EXTERNAL_API_ERROR
): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { 
      ok: false, 
      error: new AppError(errorCode, (e as Error).message) 
    };
  }
}
```

#### 3.2 中间件统一处理
```typescript
// middleware/error-handler.ts
import { AppError } from '../lib/errors';

export function createErrorHandler() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        code: err.code,
        message: err.message,
        details: err.details
      });
    }
    
    // 未知错误
    console.error('[UNHANDLED]', err);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    });
  };
}
```

#### 3.3 服务层改造示例
```typescript
// 改造前 (1946处中的常见模式)
async function getUser(id: string) {
  try {
    return await db.users.findById(id);
  } catch (e) {
    console.error(e);
    return null;
  }
}

// 改造后
async function getUser(id: string): Promise<Result<User>> {
  return safeAsync(() => db.users.findById(id), ErrorCode.DATABASE_ERROR);
}
```

---

### 阶段四：自动化质量检查 (优先级: 🟡 中)

#### 4.1 lint-staged 配置
```json
// package.json
{
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "tsc --noEmit",
      "node scripts/check-any.js"
    ]
  }
}
```

#### 4.2 any 检测脚本
```javascript
// scripts/check-any.js
const { execSync } = require('child_process');
const output = execSync('npx tsc --noEmit --pretty false', { encoding: 'utf8' });
const anyMatches = output.match(/: any/g) || [];

if (anyMatches.length > 20) {
  console.error(`❌ 检测到 ${anyMatches.length} 处 any 类型 (目标: <20)`);
  process.exit(1);
}
console.log(`✅ any 类型数量: ${anyMatches.length}/20`);
```

#### 4.3 try-catch 检测
```javascript
// scripts/check-try-catch.js
const { execSync } = require('child_process');
const output = execSync('grep -r "catch (e)" server/ --include="*.ts" | wc -l');
const count = parseInt(output.trim());

if (count > 500) {
  console.error(`❌ 检测到 ${count} 处 try-catch (目标: <500)`);
  process.exit(1);
}
```

---

## 📈 实施路线图

```
月份        任务
─────────────────────────────────────────────────
第1周       创建 TypeScript 类型定义 (P0)
            - express.d.ts
            - 通用响应类型
            
第2周       错误处理标准化
            - AppError 类
            - safeAsync 工具
            - 错误中间件

第3-4周     渐进式 any 替换 (P1)
            - 20个核心文件
            - 数据库层类型

第5-8周     服务/路由整合
            - 按领域分组
            - 生成重定向
            - 向后兼容

第9-12周    质量检查自动化
            - CI/CD 集成
            - 监控告警
```

---

## ✅ 验收标准

| 指标 | 当前 | 目标 | 达成方式 |
|------|------|------|----------|
| any 数量 | 245+ | <20 | 渐进替换 + 类型定义 |
| try-catch | 1946 | <500 | safeAsync 封装 |
| 服务文件 | 142 | 10-20 | 领域整合 |
| 路由文件 | 108 | 10-20 | 领域整合 |
| 构建检查 | 无 | 必须通过 | CI/CD |

---

## 🔧 快速开始

```bash
# 1. 查看当前类型错误
npm run typecheck 2>&1 | head -50

# 2. 生成 any 使用报告
node scripts/analyze-code-quality.cjs

# 3. 运行质量检查
npm run quality:check
```

---

## 📝 后续任务 (待执行)

### 高优先级
1. **lib/resilience.ts** (24处 any) - 使用 Result<T> 重构
2. **services/swarm-manager.ts** (19处 any) - 添加类型定义
3. **api/app-controller.ts** (16处 any) - 使用 API 响应类型

### 中优先级
4. **lib/cache-middleware.ts** (15处 any) - 扩展 Express 类型
5. **services/repository.ts** (15处 any) - 完善泛型类型
6. **middleware/unified-error-handler.ts** (14处 any) - 统一错误处理

### 架构改进
- 逐步将服务文件整合到 `server/domains/` 目录
- 使用 `architecture.ts` 中定义的 10 领域分组

---

*Generated by 🐍 毒舌架构师改进方案生成器*
*最后更新: 2026-02-18*
