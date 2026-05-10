# 依赖注入与Repository模式培训文档

> Sprint 13.0 团队培训材料

---

## 一、为什么需要重构

### 1.1 当前问题

```typescript
// ❌ 当前代码风格 - 直接导入具体实现
import { storage } from '../storage';
import { dashscopeService } from '../services/dashscope';

export function createPerson(data: PersonData) {
  // 直接使用全局单例
  return storage.createPerson(data);
}
```

**问题**:
- 无法替换依赖进行测试
- 服务之间紧耦合
- 难以追踪依赖关系
- 无法实现故障转移

### 1.2 目标状态

```typescript
// ✅ 重构后代码风格 - 依赖注入
import { injectable, inject } from 'tsyringe';
import { IPersonRepository } from '../interfaces/repositories';
import { IAIService } from '../interfaces/services';

@injectable()
export class PersonService {
  constructor(
    @inject('PersonRepository') private personRepo: IPersonRepository,
    @inject('AIService') private aiService: IAIService
  ) {}

  async createPerson(data: PersonData) {
    return this.personRepo.create(data);
  }
}
```

---

## 二、依赖注入 (DI) 基础

### 2.1 核心概念

| 概念 | 说明 |
|------|------|
| IoC | 控制反转 - 由容器管理对象创建 |
| DI | 依赖注入 - 从外部注入依赖而非内部创建 |
| Container | 容器 - 管理对象生命周期和依赖关系 |
| Token | 标识符 - 用于查找依赖的唯一标识 |

### 2.2 tsyringe使用

```typescript
// 1. 定义接口
export interface ILogger {
  info(message: string): void;
  error(message: string, error?: Error): void;
}

// 2. 实现接口
@injectable()
export class PinoLogger implements ILogger {
  private logger = pino();
  
  info(message: string) {
    this.logger.info(message);
  }
  
  error(message: string, error?: Error) {
    this.logger.error({ error }, message);
  }
}

// 3. 注册到容器
import { container } from 'tsyringe';
container.register<ILogger>('Logger', { useClass: PinoLogger });

// 4. 使用依赖
@injectable()
export class UserService {
  constructor(@inject('Logger') private logger: ILogger) {}
  
  createUser(name: string) {
    this.logger.info(`Creating user: ${name}`);
    // ...
  }
}

// 5. 解析依赖
const userService = container.resolve(UserService);
userService.createUser('张三');
```

### 2.3 生命周期

| 生命周期 | 说明 | 用例 |
|----------|------|------|
| Transient | 每次resolve创建新实例 | 无状态服务 |
| Singleton | 全局唯一实例 | 配置、缓存 |
| Scoped | 请求范围内单例 | 数据库连接 |

```typescript
// Singleton示例
container.registerSingleton<ICacheManager>('CacheManager', CacheManager);

// Transient示例
container.register<IRequestHandler>('RequestHandler', { useClass: RequestHandler });
```

---

## 三、Repository模式

### 3.1 核心概念

Repository模式将数据访问逻辑与业务逻辑分离，提供统一的数据访问接口。

```
┌─────────────────────────────────────────────────────────────┐
│                     业务层 (Service)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PersonService     ProjectService     ReminderService       │
│       │                  │                  │                │
│       ▼                  ▼                  ▼                │
├─────────────────────────────────────────────────────────────┤
│                   Repository接口层                           │
├─────────────────────────────────────────────────────────────┤
│  IPersonRepository  IProjectRepository  IReminderRepository │
│       │                  │                  │                │
│       ▼                  ▼                  ▼                │
├─────────────────────────────────────────────────────────────┤
│                   Repository实现层                           │
├─────────────────────────────────────────────────────────────┤
│  PersonRepository   ProjectRepository   ReminderRepository  │
│       │                  │                  │                │
│       └──────────────────┼──────────────────┘                │
│                          ▼                                   │
│                     Drizzle ORM                              │
│                          │                                   │
│                          ▼                                   │
│                     PostgreSQL                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 接口定义

```typescript
// server/interfaces/repositories.ts

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface IBaseRepository<T, InsertT> {
  findById(id: number | string): Promise<T | null>;
  findAll(options?: FindOptions): Promise<T[]>;
  create(data: InsertT): Promise<T>;
  update(id: number | string, data: Partial<InsertT>): Promise<T | null>;
  delete(id: number | string): Promise<boolean>;
  count(where?: Record<string, unknown>): Promise<number>;
}

export interface IPersonRepository extends IBaseRepository<Person, InsertPerson> {
  findByName(name: string): Promise<Person[]>;
  findByOrganization(org: string): Promise<Person[]>;
  searchFuzzy(query: string): Promise<Person[]>;
  findWithRelationships(id: number): Promise<PersonWithRelationships | null>;
}

export interface IProjectRepository extends IBaseRepository<Project, InsertProject> {
  findByStatus(status: string): Promise<Project[]>;
  findWithMilestones(id: number): Promise<ProjectWithMilestones | null>;
  getActiveProjects(): Promise<Project[]>;
}
```

### 3.3 基类实现

```typescript
// server/repositories/base.repository.ts

import { injectable } from 'tsyringe';
import { db } from '../db';
import { eq, sql, desc, asc } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { FindOptions, IBaseRepository } from '../interfaces/repositories';

@injectable()
export abstract class BaseRepository<T, InsertT> implements IBaseRepository<T, InsertT> {
  protected abstract table: PgTable;
  protected abstract idField: string;

  async findById(id: number | string): Promise<T | null> {
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq((this.table as any)[this.idField], id))
      .limit(1);
    return (result as T) || null;
  }

  async findAll(options: FindOptions = {}): Promise<T[]> {
    const { limit = 100, offset = 0, orderBy, orderDir = 'desc' } = options;
    
    let query = db.select().from(this.table);
    
    if (orderBy && (this.table as any)[orderBy]) {
      const orderFn = orderDir === 'asc' ? asc : desc;
      query = query.orderBy(orderFn((this.table as any)[orderBy])) as any;
    }
    
    const results = await query.limit(limit).offset(offset);
    return results as T[];
  }

  async create(data: InsertT): Promise<T> {
    const [result] = await db
      .insert(this.table)
      .values(data as any)
      .returning();
    return result as T;
  }

  async update(id: number | string, data: Partial<InsertT>): Promise<T | null> {
    const [result] = await db
      .update(this.table)
      .set(data as any)
      .where(eq((this.table as any)[this.idField], id))
      .returning();
    return (result as T) || null;
  }

  async delete(id: number | string): Promise<boolean> {
    const result = await db
      .delete(this.table)
      .where(eq((this.table as any)[this.idField], id));
    return (result.rowCount ?? 0) > 0;
  }

  async count(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(this.table);
    return Number(result?.count ?? 0);
  }
}
```

### 3.4 具体实现

```typescript
// server/repositories/person.repository.ts

import { injectable } from 'tsyringe';
import { BaseRepository } from './base.repository';
import { persons } from '@shared/schema';
import { db } from '../db';
import { like, or, eq } from 'drizzle-orm';
import type { Person, InsertPerson } from '@shared/schema';
import type { IPersonRepository } from '../interfaces/repositories';

@injectable()
export class PersonRepository 
  extends BaseRepository<Person, InsertPerson> 
  implements IPersonRepository {
  
  protected table = persons;
  protected idField = 'id';

  async findByName(name: string): Promise<Person[]> {
    return db
      .select()
      .from(persons)
      .where(like(persons.name, `%${name}%`));
  }

  async findByOrganization(org: string): Promise<Person[]> {
    return db
      .select()
      .from(persons)
      .where(eq(persons.organization, org));
  }

  async searchFuzzy(query: string): Promise<Person[]> {
    const pattern = `%${query}%`;
    return db
      .select()
      .from(persons)
      .where(
        or(
          like(persons.name, pattern),
          like(persons.organization, pattern),
          like(persons.email, pattern)
        )
      );
  }

  async findWithRelationships(id: number): Promise<PersonWithRelationships | null> {
    // 实现关联查询
    const person = await this.findById(id);
    if (!person) return null;
    
    // TODO: 查询关联关系
    return { ...person, relationships: [] };
  }
}
```

---

## 四、重构步骤

### 4.1 从storage.ts提取Repository

```
Step 1: 识别实体
  └─ persons, projects, reminders, calendars, contracts...

Step 2: 为每个实体创建:
  └─ 接口定义 (interfaces/repositories.ts)
  └─ 具体实现 (repositories/xxx.repository.ts)

Step 3: 注册到容器
  └─ container.register('PersonRepository', { useClass: PersonRepository })

Step 4: 更新服务层
  └─ 将 storage.xxx 替换为 @inject('XxxRepository')

Step 5: 验证测试
  └─ 确保所有现有测试通过
```

### 4.2 测试替换

```typescript
// 测试中使用Mock

import { container } from 'tsyringe';
import { beforeEach, describe, it, expect, vi } from 'vitest';

describe('PersonService', () => {
  beforeEach(() => {
    container.clearInstances();
    
    // 注册Mock
    const mockPersonRepo = {
      findById: vi.fn().mockResolvedValue({ id: 1, name: '张三' }),
      create: vi.fn().mockResolvedValue({ id: 2, name: '李四' }),
    };
    
    container.register('PersonRepository', { useValue: mockPersonRepo });
  });

  it('should create person', async () => {
    const service = container.resolve(PersonService);
    const result = await service.createPerson({ name: '李四' });
    expect(result.name).toBe('李四');
  });
});
```

---

## 五、最佳实践

### 5.1 DO ✅

- 为每个服务定义接口
- 通过构造函数注入依赖
- 使用有意义的Token名称
- 保持Repository职责单一
- 编写单元测试覆盖核心逻辑

### 5.2 DON'T ❌

- 不要在Repository中包含业务逻辑
- 不要直接在业务代码中使用`container.resolve()`
- 不要循环依赖
- 不要在Repository中调用其他Repository（应在Service层组合）

---

## 六、检查清单

在开始Sprint 13.1之前，确认已理解：

- [ ] 什么是依赖注入，为什么需要它
- [ ] tsyringe的基本用法 (@injectable, @inject)
- [ ] Repository模式的目的和结构
- [ ] BaseRepository的设计思路
- [ ] 如何在测试中Mock依赖
- [ ] 如何从storage.ts逐步提取Repository

---

*文档版本: 1.0*
*最后更新: 2026-01-28*
