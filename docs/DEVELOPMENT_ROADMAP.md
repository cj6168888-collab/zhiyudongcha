# 小智系统开发路线图 v2.0

> 基于架构审计和升级路线图的科学开发计划

---

## 一、开发原则

### 1.1 核心原则金字塔
```
                              ▲
                             /稳\
                            /定性\
                           /优先 \
                          /───────\
                         / 测试驱动 \
                        /─────────────\
                       /  渐进式重构    \
                      /─────────────────\
                     /   向后兼容保证     \
                    /─────────────────────\
                   /    文档与代码同步更新   \
                  /───────────────────────────\
```

### 1.2 开发节奏
| 周期 | 活动 |
|------|------|
| 每日 | 代码提交、单元测试、日志review |
| 每周 | Sprint回顾、代码review、集成测试 |
| 每两周 | Sprint完成、Demo演示、下Sprint规划 |
| 每Phase | 里程碑验收、全量回归测试、文档发布 |

### 1.3 质量门禁
| 检查项 | 阈值 | 阻断级别 |
|--------|------|----------|
| 单元测试覆盖率 | ≥60% | Sprint完成 |
| ESLint错误 | 0 | 代码合并 |
| TypeScript any | <10个 | Phase完成 |
| API响应时间P95 | <500ms | 发布 |

---

## 二、Phase 13 详细路线 (8周)

### 总体目标
```
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 13: 架构重构 + 推理增强                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ 清理P0技术债务                                                   │
│     └─ misc.ts 4059行 → 10+文件 (<400行/文件)                        │
│     └─ storage.ts 2070行 → Repository模式                            │
│     └─ 199个Map缓存 → LRU CacheManager                               │
│                                                                      │
│  ✅ 建立代码规范基础设施                                             │
│     └─ 统一API响应格式                                               │
│     └─ API版本化 /api/v1/                                            │
│     └─ 依赖注入容器                                                   │
│                                                                      │
│  ✅ 引入高级推理能力                                                 │
│     └─ 思维链推理 (Chain-of-Thought)                                 │
│     └─ 深度思考模式 (Test-Time Compute)                              │
│     └─ 幻觉检测器                                                     │
│                                                                      │
│  ✅ 测试覆盖率达60%                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Sprint 13.0: 准备阶段 (3天)

**目标**: 建立开发基础设施

| 日 | 任务 | 产出 | 负责 |
|----|------|------|------|
| D1 | 测试框架配置 | Jest/Vitest配置文件 | 后端 |
| D1 | CI检查规则 | ESLint严格模式配置 | 后端 |
| D2 | 性能基准测试 | API响应时间基准数据 | 测试 |
| D2 | 系统备份 | 数据库快照、代码Tag | 运维 |
| D3 | 团队培训 | DI/Repository模式培训文档 | 全员 |

**检查点**:
- [ ] `npm test` 可正常运行
- [ ] ESLint规则生效
- [ ] 基准数据已记录到文档

---

### Sprint 13.1: 基础架构修复 (Week 1-2)

#### Week 1: misc.ts拆分

**目标**: misc.ts从4059行降至<500行

| 日 | 上午(4h) | 下午(4h) | 产出 |
|----|----------|----------|------|
| Mon | 为misc.ts编写端点测试 | 继续编写测试 | 测试覆盖率>80% |
| Tue | 创建路由注册器模式 | 提取reminder.routes.ts | 2个新文件 |
| Wed | 提取evolution.routes.ts | 提取hp.routes.ts | 2个新文件 |
| Thu | 提取vault.routes.ts | 提取queue.routes.ts | 2个新文件 |
| Fri | 提取device.routes.ts | 提取integration.routes.ts | 2个新文件 |

**产出文件**:
```
server/routes/
├── reminder.routes.ts      (~200行, ~15个端点)
├── evolution.routes.ts     (~180行, ~12个端点)
├── hp.routes.ts           (~150行, ~8个端点)
├── vault.routes.ts        (~200行, ~10个端点)
├── queue.routes.ts        (~150行, ~8个端点)
├── device.routes.ts       (~250行, ~12个端点)
└── integration.routes.ts  (~300行, ~15个端点)
```

#### Week 2: misc.ts拆分(续) + 基础设施

| 日 | 上午(4h) | 下午(4h) | 产出 |
|----|----------|----------|------|
| Mon | 提取email.routes.ts | 提取expense.routes.ts | 2个新文件 |
| Tue | 提取expert.routes.ts | 整理misc-legacy.routes.ts | 拆分完成 |
| Wed | 实现CacheManager | 测试CacheManager | cache-manager.ts |
| Thu | 实现SchedulerManager | 替换现有setInterval | scheduler-manager.ts |
| Fri | 实现HttpClient | 替换无超时HTTP调用 | http-client.ts |

**产出文件**:
```
server/routes/
├── email.routes.ts        (~350行, ~20个端点)
├── expense.routes.ts      (~250行, ~12个端点)
├── expert.routes.ts       (~200行, ~10个端点)
└── misc-legacy.routes.ts  (<500行, ~14个端点)

server/lib/
├── cache-manager.ts       (~150行)
├── scheduler-manager.ts   (~100行)
└── http-client.ts         (~120行)
```

**Sprint 13.1 检查点**:
| 指标 | 目标 | 验证命令 |
|------|------|----------|
| misc.ts行数 | <500 | `wc -l server/routes/misc.ts` |
| 端点测试通过 | 100% | `npm test routes` |
| 缓存替换数 | >50 | grep统计 |
| setInterval配对 | 19/19 | grep统计 |

---

### Sprint 13.2: Repository重构 + API规范 (Week 3-4)

#### Week 3: storage.ts重构

**目标**: storage.ts从2070行降至<500行

| 日 | 任务 | 产出 |
|----|------|------|
| Mon | 创建BaseRepository基类 | base.repository.ts |
| Tue | 提取PersonRepository | person.repository.ts |
| Wed | 提取ProjectRepository | project.repository.ts |
| Thu | 提取VaultRepository + MemoryRepository | 2个Repository |
| Fri | 提取CalendarRepository + ReminderRepository | 2个Repository |

**BaseRepository设计**:
```typescript
// server/repositories/base.repository.ts
export abstract class BaseRepository<T, InsertT> {
  constructor(protected db: Database) {}
  
  async findById(id: string | number): Promise<T | null>;
  async findAll(options?: FindOptions): Promise<T[]>;
  async create(data: InsertT): Promise<T>;
  async update(id: string | number, data: Partial<InsertT>): Promise<T>;
  async delete(id: string | number): Promise<boolean>;
  async count(where?: SQL): Promise<number>;
}
```

#### Week 4: storage.ts重构(续) + API规范化

| 日 | 任务 | 产出 |
|----|------|------|
| Mon | 提取剩余Repository(4个) | storage.ts降至<500行 |
| Tue | 实现ResponseHelper | api-response.ts |
| Wed | 实现错误码体系 | error-codes.ts |
| Thu | 添加API版本路由/api/v1/ | 路由更新 |
| Fri | 添加Zod输入验证中间件 | validation.ts |

**产出文件**:
```
server/repositories/
├── base.repository.ts       (~150行)
├── person.repository.ts     (~200行)
├── project.repository.ts    (~180行)
├── vault.repository.ts      (~150行)
├── memory.repository.ts     (~180行)
├── calendar.repository.ts   (~150行)
├── reminder.repository.ts   (~120行)
├── contract.repository.ts   (~180行)
├── insight.repository.ts    (~150行)
├── device.repository.ts     (~120行)
└── index.ts                 (~50行)

server/lib/
├── api-response.ts         (~100行)
├── error-codes.ts          (~80行)
└── validation.ts           (~60行)
```

**Sprint 13.2 检查点**:
| 指标 | 目标 | 验证 |
|------|------|------|
| storage.ts行数 | <500 | wc -l |
| Repository测试 | 100%通过 | npm test |
| API响应格式 | 统一 | API测试 |
| 输入验证 | 全覆盖 | Zod测试 |

---

### Sprint 13.3: 依赖注入 (Week 5-6)

#### Week 5: DI容器实现

| 日 | 任务 | 产出 |
|----|------|------|
| Mon | 安装配置tsyringe | 依赖+配置 |
| Tue | 定义服务接口(10个) | interfaces/*.ts |
| Wed | 重构核心服务(5个) | 使用@injectable |
| Thu | 重构领域服务(10个) | 使用@inject |
| Fri | 实现LifecycleManager | lifecycle-manager.ts |

**DI容器设计**:
```typescript
// server/container.ts
import { container } from 'tsyringe';

// 基础设施
container.register('Logger', { useValue: createServiceLogger('App') });
container.register('CacheManager', { useClass: CacheManager });
container.register('HttpClient', { useClass: HttpClient });

// Repository
container.register('PersonRepository', { useClass: PersonRepository });
container.register('ProjectRepository', { useClass: ProjectRepository });

// 服务
container.register('PersonService', { useClass: PersonService });
container.register('AIService', { useClass: AIService });
```

#### Week 6: AI服务抽象

| 日 | 任务 | 产出 |
|----|------|------|
| Mon | 创建AIProvider接口 | ai-interfaces.ts |
| Tue | 重构DashScope适配器 | dashscope.provider.ts |
| Wed | 重构DeepSeek/DouBao适配器 | 2个provider |
| Thu | 实现AIService故障转移 | ai-service.ts |
| Fri | 清理any类型使用 | 类型修复 |

**产出文件**:
```
server/infra/ai/
├── interfaces.ts            (~80行)
├── ai-service.ts           (~150行)
├── providers/
│   ├── dashscope.provider.ts (~200行)
│   ├── deepseek.provider.ts  (~150行)
│   └── doubao.provider.ts    (~150行)
└── index.ts

server/
├── container.ts             (~200行)
├── interfaces/
│   ├── ai-service.interface.ts
│   ├── cache.interface.ts
│   └── repository.interface.ts
└── lib/
    └── lifecycle-manager.ts  (~100行)
```

**Sprint 13.3 检查点**:
| 指标 | 目标 | 验证 |
|------|------|------|
| DI注入服务数 | ≥30 | grep @injectable |
| AI故障转移 | 正常 | 集成测试 |
| any类型数 | <10 | TypeScript检查 |

---

### Sprint 13.4: 推理引擎 (Week 7-8)

#### Week 7: 思维链 + 深度思考

| 日 | 任务 | 产出 |
|----|------|------|
| Mon | 设计ThoughtStep数据结构 | 类型定义 |
| Tue | 实现CoT推理核心 | chain-of-thought.ts |
| Wed | 添加置信度计算器 | confidence-scorer.ts |
| Thu | 实现DeepThinking迭代 | deep-thinking.ts |
| Fri | 超时和循环检测 | 防护机制 |

**思维链服务设计**:
```typescript
// server/services/reasoning/chain-of-thought.ts
export interface ThoughtStep {
  step: number;
  thought: string;
  action?: string;
  observation?: string;
  confidence: number;
}

export interface ReasoningResult {
  query: string;
  steps: ThoughtStep[];
  finalAnswer: string;
  confidence: number;
  processingTime: number;
}

@injectable()
export class ChainOfThoughtService {
  async reason(query: string, context?: string): Promise<ReasoningResult>;
}
```

#### Week 8: 幻觉检测 + 集成

| 日 | 任务 | 产出 |
|----|------|------|
| Mon | 实现幻觉检测器 | hallucination-detector.ts |
| Tue | 实现工作记忆栈 | working-memory.ts |
| Wed | 集成到对话API | API更新 |
| Thu | 全量回归测试 | 测试报告 |
| Fri | 文档更新+Phase评审 | 发布准备 |

**产出文件**:
```
server/services/reasoning/
├── chain-of-thought.ts      (~300行)
├── deep-thinking.ts         (~250行)
├── confidence-scorer.ts     (~150行)
├── hallucination-detector.ts (~250行)
├── working-memory.ts        (~200行)
├── reasoning-service.ts     (~200行)
└── index.ts
```

**Sprint 13.4 检查点**:
| 指标 | 目标 | 验证 |
|------|------|------|
| 推理功能 | 全部可用 | 功能测试 |
| 置信度准确率 | >80% | 测试用例 |
| 幻觉检测率 | >70% | 测试用例 |
| 测试覆盖率 | ≥60% | coverage |

---

### Phase 13 总验收

| 指标 | 起始值 | 目标值 | 验证方法 |
|------|--------|--------|----------|
| 最大文件行数 | 4,059 | <500 | `find . -name "*.ts" \| xargs wc -l` |
| 测试覆盖率 | ~30% | ≥60% | coverage报告 |
| any类型 | 37 | <10 | TypeScript检查 |
| 内存泄漏 | 10+ | 0 | 压力测试 |
| API响应P95 | 未知 | <500ms | 性能测试 |
| 推理准确率 | - | ≥90% | 测试用例 |

---

## 三、Phase 14 详细路线 (10周)

### 总体目标
```
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 14: 多模态 + 多Agent                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ 多模态理解能力                                                   │
│     └─ 图像理解服务                                                  │
│     └─ 文档OCR + 结构化解析                                          │
│     └─ 视频分析(基础)                                                │
│                                                                      │
│  ✅ Agent编排框架                                                    │
│     └─ Agent基类定义                                                 │
│     └─ 法律/财务/研究Agent                                           │
│     └─ Agent编排器 + A2A协议                                         │
│                                                                      │
│  ✅ 情绪感知能力                                                     │
│     └─ 情感分析服务                                                  │
│     └─ 意图检测                                                       │
│                                                                      │
│  ✅ 测试覆盖率达70%                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Sprint规划概览

| Sprint | 周 | 核心任务 | 产出 |
|--------|-----|---------|------|
| 14.1 | 1-2 | 图像理解服务 | image-understanding.ts |
| 14.2 | 3-4 | 文档OCR + 解析 | document-ocr.ts |
| 14.3 | 5-6 | Agent基础框架 | base-agent.ts + 3个Agent |
| 14.4 | 7-8 | Agent编排器 | agent-orchestrator.ts |
| 14.5 | 9-10 | 情绪分析 + 集成 | emotion/*.ts |

---

## 四、Phase 15 详细路线 (12周)

### 总体目标
```
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 15: 自主化 + 物理AI                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ 高度自主执行                                                     │
│     └─ 目标分解引擎                                                  │
│     └─ 弹性执行框架                                                  │
│     └─ 长周期任务管理                                                │
│                                                                      │
│  ✅ 物理世界交互                                                     │
│     └─ IoT设备集成                                                   │
│     └─ 智能家居控制                                                  │
│     └─ 车载系统对接                                                  │
│                                                                      │
│  ✅ 多系统协作                                                       │
│     └─ A2A协议完善                                                   │
│     └─ 外部AI系统对接                                                │
│                                                                      │
│  ✅ 测试覆盖率达80%                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Sprint规划概览

| Sprint | 周 | 核心任务 |
|--------|-----|---------|
| 15.1 | 1-2 | 目标分解引擎 |
| 15.2 | 3-4 | 弹性执行框架 |
| 15.3 | 5-6 | 长周期任务管理 |
| 15.4 | 7-8 | IoT设备集成 |
| 15.5 | 9-10 | 智能家居控制 |
| 15.6 | 11-12 | 全面测试 + 发布 |

---

## 五、风险缓解计划

### 5.1 技术风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 | 应急预案 |
|------|------|------|----------|----------|
| 重构导致回归 | 中 | 高 | 每次提交运行测试 | 回滚到最近稳定版 |
| 推理性能不足 | 中 | 中 | 设置超时，快速模式 | 降级到简单回答 |
| AI API变更 | 高 | 中 | 抽象层隔离 | 切换备用Provider |
| 数据迁移失败 | 低 | 高 | 提前备份，分步迁移 | 恢复备份 |
| 团队学习曲线 | 中 | 中 | 培训+结对编程 | 延长Sprint |

### 5.2 应急响应流程

```
问题发现 → 严重程度评估 → 响应动作
    │           │              │
    │           ├─ P0(阻塞)  → 立即停止新开发，全力修复
    │           ├─ P1(严重)  → 24小时内修复
    │           └─ P2(一般)  → 本Sprint内修复
    │
    └─ 问题记录 → 根因分析 → 预防措施 → 知识库更新
```

---

## 六、质量保证流程

### 6.1 代码提交流程

```
开发完成
    │
    ▼
本地测试 ─────────────── 失败 → 修复
    │ 通过
    ▼
代码提交
    │
    ▼
CI检查 ─────────────────── 失败 → 修复
    │ 通过
    ▼
代码审查(≥1人) ────────── 拒绝 → 修改
    │ 通过
    ▼
合并主分支
    │
    ▼
自动部署测试环境
```

### 6.2 测试策略

```
测试金字塔

         ▲
        /E2E\              10% - Playwright端到端
       /─────\
      /集成测试\           30% - API+服务集成
     /──────────\
    /  单元测试  \         60% - 函数+类单元测试
   /──────────────\
```

### 6.3 发布检查清单

- [ ] 所有测试通过 (npm test)
- [ ] 代码覆盖率达标 (≥60%/70%/80%)
- [ ] ESLint无错误
- [ ] TypeScript无any警告超标
- [ ] API文档已更新
- [ ] replit.md已同步
- [ ] 性能指标达标
- [ ] 回滚方案已准备

---

## 七、监控与度量

### 7.1 开发效率指标

| 指标 | 目标 | 数据来源 |
|------|------|----------|
| Sprint完成率 | ≥90% | 任务管理 |
| Bug修复时间(P0) | <4h | Issue跟踪 |
| Bug修复时间(P1) | <24h | Issue跟踪 |
| 代码审查时间 | <4h | PR统计 |

### 7.2 系统健康指标

| 指标 | 正常 | 警告 | 严重 |
|------|------|------|------|
| API响应P95 | <500ms | <1s | >2s |
| 错误率 | <1% | <3% | >5% |
| 内存使用 | <70% | <85% | >90% |
| AI可用性 | >99% | >95% | <90% |

---

## 八、时间线总览

```
2026年
┌─────────────────────────────────────────────────────────────────────────┐
│ Jan      Feb       Mar       Apr       May       Jun       Jul         │
│  │        │         │         │         │         │         │          │
│  ▼        ▼         ▼         ▼         ▼         ▼         ▼          │
│                                                                          │
│ ├──────────────────┤                                                    │
│   Phase 13 (8周)                                                        │
│   架构重构+推理增强                                                      │
│                                                                          │
│                     ├────────────────────────┤                          │
│                       Phase 14 (10周)                                   │
│                       多模态+多Agent                                     │
│                                                                          │
│                                              ├────────────────────────┤ │
│                                                Phase 15 (12周)          │
│                                                自主化+物理AI             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

关键里程碑：
├─ 1月底: Phase 13 Sprint 13.2 完成 (架构重构)
├─ 2月底: Phase 13 完成 (推理引擎)
├─ 4月中: Phase 14 完成 (多Agent)
└─ 6月底: Phase 15 完成 (自主AI)
```

---

## 九、文档同步要求

### 每Sprint更新
- [ ] replit.md - 架构变更
- [ ] 相关API文档 - 接口变更

### 每Phase更新
- [ ] PROJECT_BLUEPRINT.md - 完成状态
- [ ] REFACTORING_PLAN.md - 技术债务状态
- [ ] API_REFERENCE.md - 完整API列表
- [ ] ARCHITECTURE.md - 架构图更新

---

## 十、团队协作规范

### 10.1 分支策略

```
main (生产稳定)
  │
  ├── develop (开发主线)
  │     │
  │     ├── feature/13.1-misc-split
  │     ├── feature/13.2-repository
  │     ├── feature/13.3-di-container
  │     └── fix/bug-xxx
  │
  └── release/v13.0 (发布分支)
```

### 10.2 提交信息规范

```
<type>(<scope>): <subject>

type:
  feat     新功能
  fix      Bug修复
  refactor 重构
  docs     文档
  test     测试
  chore    构建/工具

示例:
feat(reasoning): add chain-of-thought service
fix(api): correct response format for /persons
refactor(storage): extract PersonRepository
```

---

*文档版本: 2.0*
*最后更新: 2026-01-28*
*下次评审: Phase 13 Sprint 1完成后*
