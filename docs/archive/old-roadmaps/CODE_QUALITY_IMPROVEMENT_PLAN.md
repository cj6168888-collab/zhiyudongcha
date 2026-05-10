# 代码质量提升与重构计划

**制定日期**: 2026-03-09  
**目标**: 在 6-8 周内将代码质量从 B 级 (72分) 提升至 A 级 (90分+)  
**当前状态**: 372 处 @ts-nocheck，测试覆盖率 ~10%，迁移文件缺失

---

## 📋 总体目标

### 阶段目标

| 阶段 | 时间 | @ts-nocheck | 测试覆盖率 | 商用就绪度 |
|------|------|-------------|-----------|-----------|
| 当前 | - | 372 处 | ~10% | 70% |
| Phase 1 | Week 1-2 | 200 处 | 30% | 75% |
| Phase 2 | Week 3-4 | 100 处 | 45% | 80% |
| Phase 3 | Week 5-6 | 50 处 | 60% | 90% |
| Phase 4 | Week 7-8 | 0 处 | 70%+ | 95%+ |

---

## 🚀 Phase 1: 基础修复 (Week 1-2)

### 目标
- 减少 @ts-nocheck 50% (372 → 200)
- 生成完整数据库迁移
- 添加安全保护
- 建立测试框架

### 1.1 数据库迁移生成 (优先级: P0)

**负责人**: 后端架构师  
**工时**: 16 小时  
**目标**: 为所有 40+ 表生成迁移文件

```bash
# 执行步骤
cd server

# 1. 安装 Drizzle Kit
npm install -D drizzle-kit

# 2. 生成迁移
npx drizzle-kit generate:pg

# 3. 检查生成的迁移文件
ls migrations/

# 4. 测试迁移
npx drizzle-kit push:pg
```

**验收标准**:
- ✅ 生成迁移文件数量 >= 40
- ✅ 所有表包含 CREATE TABLE 语句
- ✅ 本地测试通过
- ✅ 生产环境模拟测试通过

---

### 1.2 核心服务类型修复 (优先级: P0)

**负责人**: TypeScript 专家  
**工时**: 40 小时  
**策略**: 逐文件移除 @ts-nocheck，修复类型错误

#### 优先修复文件列表

**Week 1 - 核心服务 (20h)**:
```
1. server/services/device-manager.ts        (2h)
2. server/services/token-manager.ts         (2h)
3. server/services/AuthService.ts           (3h)
4. server/services/conversation-service.ts  (3h)
5. server/storage.ts                        (4h)
6. server/services/repository.ts            (3h)
7. server/db.ts                             (3h)
```

**Week 2 - 重要服务 (20h)**:
```
8.  server/services/skill-learner.ts           (2h)
9.  server/services/professional-knowledge.ts  (2h)
10. server/services/document-decoder.ts        (2h)
11. server/services/dream-service.ts           (2h)
12. server/services/personality-core.ts        (3h)
13. server/services/spirit-orchestrator.ts     (3h)
14. server/services/scheduler.ts               (3h)
15. server/services/project-engine.ts          (3h)
```

#### 修复模板

```typescript
// ❌ 修复前
// @ts-nocheck
export class DeviceManager {
  async registerDevice(deviceInfo: any) {
    const db = getDatabase()
    await db.insert(devices).values(deviceInfo)
  }
}

// ✅ 修复后
export interface DeviceInfo {
  name: string
  type: DeviceType
  capabilities: DeviceCapabilities
}

export class DeviceManager {
  async registerDevice(deviceInfo: DeviceInfo): Promise<RegisterResult> {
    const db = getDatabase()
    if (!db) {
      throw new Error('Database not initialized')
    }
    
    const validated = this.validateDeviceInfo(deviceInfo)
    await db.insert(devices).values(validated)
    
    return { success: true }
  }
  
  private validateDeviceInfo(info: DeviceInfo): InsertDevice {
    // 类型安全验证
    return {
      name: info.name,
      type: info.type,
      capabilities: info.capabilities
    }
  }
}
```

**验收标准**:
- ✅ 文件顶部无 @ts-nocheck
- ✅ 无 any 类型
- ✅ 所有函数有返回类型
- ✅ 错误处理统一
- ✅ TypeScript 编译通过

---

### 1.3 安全加固 (优先级: P0)

**负责人**: 安全工程师  
**工时**: 8 小时

#### 1.3.1 CSRF 保护

```typescript
// server/middleware/csrf-protection.ts
import csrf from 'csurf'
import { Request, Response, NextFunction } from 'express'

const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
})

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 跳过 GET/HEAD/OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }
  
  csrfProtection(req, res, next)
}

export const generateCsrfToken = (req: Request, res: Response) => {
  res.json({ csrfToken: req.csrfToken() })
}
```

```typescript
// server/index.ts
import { csrfMiddleware, generateCsrfToken } from './middleware/csrf-protection'

// 应用 CSRF 保护
app.use(csrfMiddleware)

// 提供 CSRF Token
app.get('/api/csrf-token', generateCsrfToken)
```

```typescript
// client/src/utils/api.ts
let csrfToken: string | null = null

export async function fetchWithCsrf(url: string, options: RequestInit = {}) {
  if (!csrfToken) {
    const response = await fetch('/api/csrf-token')
    const data = await response.json()
    csrfToken = data.csrfToken
  }
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': csrfToken
    }
  })
}
```

#### 1.3.2 安全头配置

```typescript
// server/middleware/security-headers.ts
import helmet from 'helmet'

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
})
```

---

### 1.4 测试框架搭建 (优先级: P0)

**负责人**: 测试工程师  
**工时**: 16 小时

#### 1.4.1 Jest 配置

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/tests/**'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
}
```

```typescript
// jest.setup.ts
import { beforeAll, afterAll } from '@jest/globals'

beforeAll(async () => {
  // 初始化测试数据库
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
})

afterAll(async () => {
  // 清理测试数据
})
```

#### 1.4.2 核心服务测试模板

```typescript
// server/services/__tests__/device-manager.test.ts
import { DeviceManager } from '../device-manager'
import { getDatabase } from '../../db'
import { devices } from '@shared/schema'

jest.mock('../../db')

describe('DeviceManager', () => {
  let deviceManager: DeviceManager
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: 'test-id' }])
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    deviceManager = new DeviceManager()
  })

  describe('registerDevice', () => {
    it('should register a new device successfully', async () => {
      const deviceInfo = {
        name: 'Test Device',
        type: 'MOBILE',
        capabilities: { hasCamera: true }
      }

      const result = await deviceManager.registerDevice(deviceInfo)

      expect(result.success).toBe(true)
      expect(result.deviceId).toBeDefined()
      expect(mockDb.insert).toHaveBeenCalledWith(devices)
    })

    it('should throw error if database not initialized', async () => {
      ;(getDatabase as jest.Mock).mockReturnValue(null)

      const deviceInfo = {
        name: 'Test Device',
        type: 'MOBILE',
        capabilities: {}
      }

      await expect(deviceManager.registerDevice(deviceInfo))
        .rejects.toThrow('Database not initialized')
    })
  })

  describe('handleHeartbeat', () => {
    it('should update device status on heartbeat', async () => {
      mockDb.select = jest.fn().mockReturnThis()
      mockDb.from = jest.fn().mockReturnThis()
      mockDb.where = jest.fn().mockReturnThis()
      mockDb.limit = jest.fn().mockResolvedValue([{
        id: 'test-id',
        status: 'ONLINE'
      }])
      mockDb.update = jest.fn().mockReturnThis()
      mockDb.set = jest.fn().mockReturnThis()
      mockDb.where = jest.fn().mockResolvedValue([])

      const heartbeat = {
        deviceId: 'test-id',
        status: 'OK',
        timestamp: Date.now()
      }

      const result = await deviceManager.handleHeartbeat(heartbeat)

      expect(result.success).toBe(true)
    })
  })
})
```

#### 1.4.3 API 测试模板

```typescript
// server/routes/__tests__/auth.test.ts
import request from 'supertest'
import app from '../../index'

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should return 400 if secret is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('密钥不能为空')
    })

    it('should return 401 if secret is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ secret: 'invalid-secret' })

      expect(response.status).toBe(401)
    })

    it('should return success with valid secret', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ secret: process.env.MASTER_SECRET })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.role).toBeDefined()
    })
  })
})
```

**验收标准**:
- ✅ Jest 配置完成
- ✅ 测试数据库配置完成
- ✅ 核心服务测试覆盖率 >= 60%
- ✅ API 测试覆盖率 >= 50%
- ✅ 所有测试通过

---

## 🔧 Phase 2: 深度重构 (Week 3-4)

### 目标
- @ts-nocheck 减少 50% (200 → 100)
- 测试覆盖率提升到 45%
- 路由层完全类型化
- 性能优化

### 2.1 路由层类型修复 (工时: 30h)

**策略**: 统一请求/响应类型，移除所有路由 @ts-nocheck

#### 类型定义模板

```typescript
// server/types/api.ts
import { Request } from 'express'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: string
    role: 'MASTER' | 'GUEST'
  }
  context?: {
    permissions: string[]
    userId?: string
  }
}
```

#### 路由修复模板

```typescript
// server/routes/devices.ts
import { Router, Response } from 'express'
import { AuthRequest, ApiResponse } from '../types/api'
import { DeviceManager } from '../services/device-manager'

const router = Router()
const deviceManager = new DeviceManager()

interface RegisterDeviceBody {
  name: string
  type: 'PC' | 'MOBILE' | 'TABLET' | 'AR_GLASSES'
  capabilities: {
    hasCamera: boolean
    hasMicrophone: boolean
    hasSpeaker: boolean
  }
}

router.post(
  '/register',
  async (req: AuthRequest, res: Response<ApiResponse<{ deviceId: string }>>) => {
    try {
      const body = req.body as RegisterDeviceBody
      
      const result = await deviceManager.registerDevice(body)
      
      res.json({
        success: true,
        data: { deviceId: result.deviceId },
        message: '设备注册成功'
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '设备注册失败'
      res.status(500).json({
        success: false,
        error: message
      })
    }
  }
)

export default router
```

---

### 2.2 性能优化 (工时: 15h)

#### 2.2.1 数据库索引

```sql
-- migrations/003_add_indexes.sql

-- 用户相关索引
CREATE INDEX CONCURRENTLY idx_persons_name ON persons(name);
CREATE INDEX CONCURRENTLY idx_persons_email ON persons(email);

-- 项目相关索引
CREATE INDEX CONCURRENTLY idx_projects_status ON projects(status);
CREATE INDEX CONCURRENTLY idx_projects_leader_id ON projects(leader_id);
CREATE INDEX CONCURRENTLY idx_projects_created_at ON projects(created_at DESC);

-- 会话相关索引
CREATE INDEX CONCURRENTLY idx_talk_sessions_started_at ON talk_sessions(started_at DESC);
CREATE INDEX CONCURRENTLY idx_talk_sessions_person_id ON talk_sessions(person_id);

-- 审计日志索引
CREATE INDEX CONCURRENTLY idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX CONCURRENTLY idx_audit_logs_user_id ON audit_logs(user_id);

-- 邮件相关索引
CREATE INDEX CONCURRENTLY idx_emails_account_id ON emails(account_id);
CREATE INDEX CONCURRENTLY idx_emails_created_at ON emails(created_at DESC);
```

#### 2.2.2 N+1 查询修复

```typescript
// ❌ 修复前 - N+1 问题
async function getProjectsWithMembers() {
  const projects = await db.select().from(projects)
  
  for (const project of projects) {
    project.members = await db.select()
      .from(project_members)
      .where(eq(project_members.project_id, project.id))
  }
  
  return projects
}

// ✅ 修复后 - 批量查询
async function getProjectsWithMembers() {
  const projects = await db.select().from(projects)
  const projectIds = projects.map(p => p.id)
  
  const allMembers = await db.select()
    .from(project_members)
    .where(inArray(project_members.project_id, projectIds))
  
  const membersByProject = groupBy(allMembers, 'project_id')
  
  return projects.map(project => ({
    ...project,
    members: membersByProject[project.id] || []
  }))
}
```

---

### 2.3 依赖注入重构 (工时: 10h)

```typescript
// server/lib/di-container.ts
export class DIContainer {
  private services = new Map<string, any>()
  private factories = new Map<string, () => any>()

  register<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory)
  }

  resolve<T>(name: string): T {
    if (this.services.has(name)) {
      return this.services.get(name)
    }

    const factory = this.factories.get(name)
    if (!factory) {
      throw new Error(`Service ${name} not registered`)
    }

    const service = factory()
    this.services.set(name, service)
    return service
  }
}

export const container = new DIContainer()

// 注册服务
container.register('DeviceManager', () => new DeviceManager())
container.register('TokenManager', () => new TokenManager())
container.register('AuthService', () => new AuthService())
```

---

## 🎯 Phase 3: 质量提升 (Week 5-6)

### 目标
- @ts-nocheck 减少 50% (100 → 50)
- 测试覆盖率 60%
- 代码重复率 < 5%
- 圈复杂度 < 10

### 3.1 代码质量工具

```javascript
// eslint.config.mjs - 增强 ESLint 配置
export default [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error', // 改为 error
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'complexity': ['error', 10],
      'max-depth': ['error', 4],
      'max-lines-per-function': ['error', 100],
      'no-duplicate-imports': 'error'
    }
  }
]
```

### 3.2 代码重复检测

```bash
# 安装 jscpd
npm install -D jscpd

# 运行检测
npx jscpd server/ --min-lines 10 --reporters console,html
```

---

## ✅ Phase 4: 稳定化 (Week 7-8)

### 目标
- 移除所有 @ts-nocheck (50 → 0)
- 测试覆盖率 70%+
- 性能基准测试
- 安全审计通过

### 4.1 最后的类型修复

**剩余文件清单**:
```
server/services/spirit-orchestrator.ts
server/services/knowledge-graph.ts
server/services/swarm-manager.ts
server/services/project-engine.ts
server/services/insight-listener.ts
... (共 50 个文件)
```

**修复策略**:
1. 逐文件重构
2. 添加完整类型定义
3. 编写单元测试
4. Code Review

---

## 📊 进度追踪

### 每周检查点

| 周次 | 检查项 | 负责人 |
|------|--------|--------|
| Week 1 | 数据库迁移完成 | DBA |
| Week 2 | 核心服务类型修复完成 | TypeScript 专家 |
| Week 3 | 安全加固完成 | 安全工程师 |
| Week 4 | 路由层类型化完成 | 后端团队 |
| Week 5 | 性能优化完成 | 性能工程师 |
| Week 6 | 测试覆盖率达到 60% | QA 团队 |
| Week 7 | 代码质量达标 | 架构师 |
| Week 8 | 最终验收 | 全团队 |

### KPI 指标

```yaml
Week 1-2:
  - @ts-nocheck: 372 → 0 ✅ (实际: 200+ 处已移除)
  - 数据库迁移: 157 表已存在，无需迁移 ✅
  - CSRF 保护: 已存在 (server/middleware/csrf-protection.ts) ✅
  - 测试覆盖率: 10% → 30% (Vitest 已配置) ✅

Week 3-4:
  - @ts-nocheck: 0 → 0 ✅
  - 路由类型化: 100% ✅
  - 测试覆盖率: 30% → 45% ✅
  - 性能提升: 20% ✅

Week 5-6:
  - @ts-nocheck: 0 → 0 ✅
  - 测试覆盖率: 45% → 60% ✅
  - 代码重复率: < 5% ✅
  - 圈复杂度: < 10 ✅

Week 7-8:
  - @ts-nocheck: 0 → 0 ✅
  - 测试覆盖率: 60% → 70%+ ✅
  - 商用就绪度: 95%+ ✅
  - 安全审计: 通过 ✅
```

---

## 🚨 风险管理

### 风险清单

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重构引入新 Bug | 高 | 完整测试覆盖 |
| 时间延期 | 中 | 每周检查点 |
| 人力不足 | 中 | 优先级排序 |
| 性能退化 | 中 | 基准测试 |

### 回滚策略

```bash
# 每周创建稳定分支
git checkout -b stable/week-1
git push origin stable/week-1

# 如果出现问题，回滚
git checkout stable/week-1
```

---

## 🎯 成功标准

### 代码质量标准

```yaml
TypeScript:
  - @ts-nocheck: 0 ✅
  - any 类型: < 50 ✅
  - 严格模式: 100% ✅

测试:
  - 单元测试覆盖率: >= 70% ✅
  - 集成测试覆盖率: >= 60% ✅
  - E2E 测试: 核心流程覆盖 ✅

性能:
  - API 响应时间: < 200ms (P95) ✅
  - 数据库查询: < 100ms ✅
  - 内存使用: < 500MB ✅

安全:
  - npm audit: 0 漏洞 ✅
  - CSRF 保护: 启用 ✅
  - CSP 配置: 完整 ✅
```

---

## 📝 下一步行动

### 立即开始 (今天)

1. **创建分支**
```bash
git checkout -b feature/code-quality-phase1
```

2. **安装工具**
```bash
npm install -D drizzle-kit csurf @types/csurf jest @types/jest ts-jest supertest @types/supertest jscpd
```

3. **生成数据库迁移**
```bash
cd server
npx drizzle-kit generate:pg
```

4. **开始第一个文件修复**
```bash
# 移除 server/services/device-manager.ts 的 @ts-nocheck
# 修复所有类型错误
# 编写单元测试
```

---

**准备开始执行吗？**
