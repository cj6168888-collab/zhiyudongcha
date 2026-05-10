# 小智系统重构开发计划

> 基于架构审计报告和升级路线图的详细执行计划

---

## 一、重构原则

### 1.1 核心原则
1. **渐进式重构** - 小步快跑，每次提交可测试可回滚
2. **测试先行** - 重构前先补充测试，确保行为不变
3. **向后兼容** - API变更提供过渡期，避免破坏性变更
4. **文档同步** - 代码变更同步更新文档

### 1.2 重构优先级
```
P0 (阻塞性问题) → P1 (高影响问题) → P2 (改进型优化)
```

---

## 二、Phase 13 详细任务分解

### Sprint 13.1: 核心架构修复 (2周)

#### Task 13.1.1: misc.ts 巨型文件拆分
**问题**: 4,059行代码，136个API端点集中在一个文件

**拆分方案**:
```
server/routes/misc.ts (当前)
       │
       ▼ 拆分为
server/routes/
├── reminder.routes.ts      ← 提醒相关 (~15个端点)
├── evolution.routes.ts     ← 进化系统 (~12个端点)
├── hp.routes.ts           ← HP经济 (~8个端点)
├── vault.routes.ts        ← 密室保险 (~10个端点)
├── queue.routes.ts        ← 任务队列 (~8个端点)
├── device.routes.ts       ← 设备管理 (~12个端点)
├── integration.routes.ts  ← 集成管理 (~15个端点)
├── email.routes.ts        ← 邮件服务 (~20个端点)
├── expense.routes.ts      ← 费用管理 (~12个端点)
├── expert.routes.ts       ← 专家系统 (~10个端点)
└── misc-legacy.routes.ts  ← 剩余杂项 (<14个端点)
```

**执行步骤**:
1. 为misc.ts编写集成测试覆盖所有端点
2. 创建路由注册器模式
3. 逐个领域提取，每次提取后运行测试
4. 删除原文件，更新routes.ts

**验收标准**:
- [ ] 每个新路由文件 <400行
- [ ] 所有端点测试通过
- [ ] API行为完全一致

---

#### Task 13.1.2: storage.ts Repository模式重构
**问题**: 2,070行，219个CRUD方法，违反单一职责

**重构方案**:
```
server/storage.ts (当前)
       │
       ▼ 重构为
server/repositories/
├── base.repository.ts          ← 通用CRUD基类
├── person.repository.ts        ← 人脉管理
├── project.repository.ts       ← 项目管理
├── vault.repository.ts         ← 密室保险
├── memory.repository.ts        ← 记忆系统
├── calendar.repository.ts      ← 日历事件
├── reminder.repository.ts      ← 提醒规则
├── contract.repository.ts      ← 合同管理
├── insight.repository.ts       ← 洞察会话
├── device.repository.ts        ← 设备管理
├── email.repository.ts         ← 邮件管理
├── user.repository.ts          ← 用户设置
└── index.ts                    ← 统一导出
```

**基类设计**:
```typescript
// server/repositories/base.repository.ts
export abstract class BaseRepository<T, InsertT> {
  protected abstract table: PgTable;
  protected abstract idColumn: Column;
  
  async findById(id: string | number): Promise<T | null> { ... }
  async findAll(options?: FindOptions): Promise<T[]> { ... }
  async create(data: InsertT): Promise<T> { ... }
  async update(id: string | number, data: Partial<InsertT>): Promise<T> { ... }
  async delete(id: string | number): Promise<boolean> { ... }
  async count(where?: SQL): Promise<number> { ... }
}
```

**执行步骤**:
1. 创建BaseRepository基类
2. 按领域提取Repository类
3. 更新所有服务使用新Repository
4. 删除原storage.ts

**验收标准**:
- [ ] 每个Repository <300行
- [ ] 所有CRUD操作测试通过
- [ ] 服务层无直接db操作

---

#### Task 13.1.3: 内存泄漏修复

**问题清单**:
| 类型 | 数量 | 修复方案 |
|------|------|----------|
| 无过期Map缓存 | 199个 | LRU缓存管理器 |
| setInterval未clear | 10个 | 统一定时任务管理 |
| EventEmitter未remove | 16个 | 事件管理器 |

**LRU缓存管理器设计**:
```typescript
// server/lib/cache-manager.ts
export class CacheManager {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  
  createCache<T>(name: string, options: CacheOptions): LRUCache<string, T> {
    const cache = new LRU<string, T>({
      max: options.maxSize || 1000,
      ttl: options.ttlMs || 5 * 60 * 1000,
      updateAgeOnGet: true,
      dispose: (value, key) => {
        logger.debug({ cache: name, key }, 'Cache entry disposed');
      }
    });
    this.caches.set(name, cache);
    return cache;
  }
  
  clearAll(): void { ... }
  getStats(): CacheStats[] { ... }
}

export const cacheManager = new CacheManager();
```

**定时任务管理器设计**:
```typescript
// server/lib/scheduler-manager.ts
export class SchedulerManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  
  setInterval(name: string, callback: () => void, ms: number): void {
    this.clearInterval(name);
    const id = setInterval(callback, ms);
    this.intervals.set(name, id);
  }
  
  clearInterval(name: string): void {
    const id = this.intervals.get(name);
    if (id) {
      clearInterval(id);
      this.intervals.delete(name);
    }
  }
  
  clearAll(): void {
    this.intervals.forEach((id) => clearInterval(id));
    this.timeouts.forEach((id) => clearTimeout(id));
    this.intervals.clear();
    this.timeouts.clear();
  }
}

export const schedulerManager = new SchedulerManager();
```

**执行步骤**:
1. 创建CacheManager和SchedulerManager
2. 全局搜索替换new Map()为cacheManager.createCache()
3. 全局搜索替换setInterval为schedulerManager.setInterval()
4. 添加shutdown hook清理资源

---

#### Task 13.1.4: HTTP超时封装

**问题**: 79个外部HTTP调用无超时

**解决方案**:
```typescript
// server/lib/http-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class HttpClient {
  private client: AxiosInstance;
  
  constructor(config: HttpClientConfig = {}) {
    this.client = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        'User-Agent': 'XiaoZhi-Avatar/1.0',
        ...config.headers,
      },
    });
    
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNABORTED') {
          throw new TimeoutError(`Request timeout after ${config.timeout}ms`);
        }
        throw error;
      }
    );
  }
  
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> { ... }
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> { ... }
}

// 预配置的客户端
export const dashscopeClient = new HttpClient({ 
  timeout: 60000,
  baseURL: 'https://dashscope.aliyuncs.com',
});

export const defaultClient = new HttpClient({ timeout: 30000 });
```

---

### Sprint 13.2: API规范化 (2周)

#### Task 13.2.1: 统一API响应格式

**当前问题**:
```typescript
// 不一致的响应格式
{ success: true, data: {...} }
{ result: {...} }
{ message: "...", items: [...] }
{ error: "..." }
```

**统一格式**:
```typescript
// server/lib/api-response.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    timestamp: string;
  };
}

export class ResponseHelper {
  static success<T>(data: T, meta?: Partial<ApiResponse['meta']>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), ...meta },
    };
  }
  
  static error(code: string, message: string, details?: any): ApiResponse<never> {
    return {
      success: false,
      error: { code, message, details },
      meta: { timestamp: new Date().toISOString() },
    };
  }
  
  static paginated<T>(items: T[], page: number, pageSize: number, total: number): ApiResponse<T[]> {
    return {
      success: true,
      data: items,
      meta: { page, pageSize, total, timestamp: new Date().toISOString() },
    };
  }
}
```

**错误码规范**:
```typescript
// server/lib/error-codes.ts
export const ErrorCodes = {
  // 通用错误 (1xxx)
  INTERNAL_ERROR: 'E1000',
  VALIDATION_ERROR: 'E1001',
  NOT_FOUND: 'E1002',
  UNAUTHORIZED: 'E1003',
  FORBIDDEN: 'E1004',
  TIMEOUT: 'E1005',
  
  // AI服务错误 (2xxx)
  AI_SERVICE_UNAVAILABLE: 'E2000',
  AI_QUOTA_EXCEEDED: 'E2001',
  AI_RESPONSE_INVALID: 'E2002',
  
  // 业务错误 (3xxx)
  PERSON_NOT_FOUND: 'E3001',
  PROJECT_NOT_FOUND: 'E3002',
  CONTRACT_INVALID: 'E3003',
  // ...
};
```

---

#### Task 13.2.2: API版本化

**方案**: 路径前缀版本化

```typescript
// server/routes.ts
export function registerRoutes(app: Express) {
  const v1Router = Router();
  
  // 注册v1版本路由
  registerPersonRoutes(v1Router);
  registerProjectRoutes(v1Router);
  // ...
  
  app.use('/api/v1', v1Router);
  
  // 兼容性: 旧路径重定向到v1
  app.use('/api', (req, res, next) => {
    if (!req.path.startsWith('/v1')) {
      // 记录警告，提醒客户端升级
      logger.warn({ path: req.path }, 'Deprecated API path, please use /api/v1');
    }
    next();
  });
}
```

---

#### Task 13.2.3: 输入验证强化

**使用Zod统一验证**:
```typescript
// server/lib/validation.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    if (!result.success) {
      return res.status(400).json(
        ResponseHelper.error('E1001', 'Validation failed', result.error.format())
      );
    }
    
    req.validated = result.data;
    next();
  };
}

// 使用示例
const createPersonSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
});

app.post('/api/v1/persons', validate(createPersonSchema), async (req, res) => {
  const { body } = req.validated;
  // ...
});
```

---

### Sprint 13.3: 依赖注入 (2周)

#### Task 13.3.1: 引入DI容器

**选型**: tsyringe (微软出品，轻量级)

```typescript
// server/container.ts
import { container, injectable, inject } from 'tsyringe';

// 注册服务
container.register('Logger', { useValue: createServiceLogger('App') });
container.register('CacheManager', { useClass: CacheManager });
container.register('HttpClient', { useClass: HttpClient });

// 服务使用依赖注入
@injectable()
export class PersonService {
  constructor(
    @inject('PersonRepository') private personRepo: PersonRepository,
    @inject('CacheManager') private cache: CacheManager,
    @inject('Logger') private logger: Logger,
  ) {}
  
  async findPerson(id: string): Promise<Person | null> {
    const cached = this.cache.get(`person:${id}`);
    if (cached) return cached;
    
    const person = await this.personRepo.findById(id);
    if (person) {
      this.cache.set(`person:${id}`, person);
    }
    return person;
  }
}

// 注册服务
container.register('PersonService', { useClass: PersonService });

// 使用
const personService = container.resolve<PersonService>('PersonService');
```

---

#### Task 13.3.2: 服务生命周期管理

```typescript
// server/lib/lifecycle.ts
export interface Startable {
  start(): Promise<void>;
}

export interface Stoppable {
  stop(): Promise<void>;
}

export class LifecycleManager {
  private services: Array<Startable & Partial<Stoppable>> = [];
  
  register(service: Startable & Partial<Stoppable>): void {
    this.services.push(service);
  }
  
  async startAll(): Promise<void> {
    for (const service of this.services) {
      await service.start();
    }
  }
  
  async stopAll(): Promise<void> {
    for (const service of this.services.reverse()) {
      if (service.stop) {
        await service.stop();
      }
    }
  }
}
```

---

### Sprint 13.4: 推理引擎增强 (2周)

#### Task 13.4.1: 思维链推理服务

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
  private readonly COT_PROMPT = `
你是一个严谨的推理助手。请按以下格式逐步思考：

思考步骤1: [分析问题的关键要素]
思考步骤2: [回顾相关知识或信息]
思考步骤3: [逻辑推导]
思考步骤4: [验证结论合理性]
最终答案: [简洁明确的答案]

问题: {query}
`;

  async reason(query: string, context?: string): Promise<ReasoningResult> {
    const startTime = Date.now();
    
    // 构建提示词
    const prompt = this.buildPrompt(query, context);
    
    // 调用AI获取推理过程
    const response = await this.aiService.chat(prompt, {
      temperature: 0.3, // 低温度确保逻辑一致性
      maxTokens: 2000,
    });
    
    // 解析推理步骤
    const steps = this.parseSteps(response);
    const finalAnswer = this.extractFinalAnswer(response);
    const confidence = this.calculateConfidence(steps);
    
    return {
      query,
      steps,
      finalAnswer,
      confidence,
      processingTime: Date.now() - startTime,
    };
  }
  
  private calculateConfidence(steps: ThoughtStep[]): number {
    // 基于步骤质量计算置信度
    const avgStepConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    const hasAllSteps = steps.length >= 3;
    const hasVerification = steps.some(s => s.thought.includes('验证'));
    
    let confidence = avgStepConfidence;
    if (!hasAllSteps) confidence *= 0.8;
    if (!hasVerification) confidence *= 0.9;
    
    return Math.min(confidence, 0.95);
  }
}
```

---

#### Task 13.4.2: 测试时推理(深度思考模式)

```typescript
// server/services/reasoning/deep-thinking.ts
export interface DeepThinkingConfig {
  maxIterations: number;
  confidenceThreshold: number;
  timeoutMs: number;
}

@injectable()
export class DeepThinkingService {
  private readonly DEFAULT_CONFIG: DeepThinkingConfig = {
    maxIterations: 5,
    confidenceThreshold: 0.85,
    timeoutMs: 30000,
  };
  
  async think(query: string, config?: Partial<DeepThinkingConfig>): Promise<DeepThinkingResult> {
    const cfg = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    
    let iterations: ThinkingIteration[] = [];
    let currentAnswer: string | null = null;
    let currentConfidence = 0;
    
    for (let i = 0; i < cfg.maxIterations; i++) {
      // 检查超时
      if (Date.now() - startTime > cfg.timeoutMs) {
        break;
      }
      
      // 执行一轮推理
      const iteration = await this.executeIteration(query, iterations, currentAnswer);
      iterations.push(iteration);
      
      currentAnswer = iteration.answer;
      currentConfidence = iteration.confidence;
      
      // 达到置信度阈值则停止
      if (currentConfidence >= cfg.confidenceThreshold) {
        break;
      }
      
      // 检测是否陷入循环
      if (this.detectLoop(iterations)) {
        break;
      }
    }
    
    return {
      query,
      iterations,
      finalAnswer: currentAnswer || '无法得出可靠结论',
      confidence: currentConfidence,
      processingTime: Date.now() - startTime,
      iterationCount: iterations.length,
    };
  }
  
  private async executeIteration(
    query: string, 
    previousIterations: ThinkingIteration[],
    previousAnswer: string | null
  ): Promise<ThinkingIteration> {
    // 构建反思提示词
    const reflectionPrompt = previousAnswer 
      ? `之前的答案是: "${previousAnswer}"。请重新审视这个问题，检查是否有遗漏或错误:`
      : '';
    
    // 执行推理
    const result = await this.cotService.reason(query, reflectionPrompt);
    
    // 自我评估
    const selfEval = await this.selfEvaluate(query, result.finalAnswer);
    
    return {
      iterationNumber: previousIterations.length + 1,
      reasoning: result,
      selfEvaluation: selfEval,
      answer: result.finalAnswer,
      confidence: selfEval.confidence,
    };
  }
}
```

---

#### Task 13.4.3: 幻觉检测器

```typescript
// server/services/reasoning/hallucination-detector.ts
export interface HallucinationCheck {
  hasHallucination: boolean;
  confidence: number;
  issues: HallucinationIssue[];
  suggestions: string[];
}

export interface HallucinationIssue {
  type: 'UNSUPPORTED_CLAIM' | 'CONTRADICTION' | 'FABRICATION' | 'OUTDATED_INFO';
  content: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

@injectable()
export class HallucinationDetector {
  async check(response: string, context?: string, sources?: string[]): Promise<HallucinationCheck> {
    const issues: HallucinationIssue[] = [];
    
    // 1. 检查无支撑的声明
    const unsupportedClaims = await this.findUnsupportedClaims(response, sources);
    issues.push(...unsupportedClaims);
    
    // 2. 检查内部矛盾
    const contradictions = this.findContradictions(response);
    issues.push(...contradictions);
    
    // 3. 检查虚构实体
    const fabrications = await this.findFabrications(response, context);
    issues.push(...fabrications);
    
    // 4. 检查过时信息
    const outdatedInfo = this.findOutdatedInfo(response);
    issues.push(...outdatedInfo);
    
    const hasHallucination = issues.length > 0;
    const confidence = this.calculateConfidence(issues);
    const suggestions = this.generateSuggestions(issues);
    
    return { hasHallucination, confidence, issues, suggestions };
  }
  
  private async findUnsupportedClaims(response: string, sources?: string[]): Promise<HallucinationIssue[]> {
    if (!sources || sources.length === 0) return [];
    
    // 提取响应中的事实性声明
    const claims = this.extractClaims(response);
    
    // 检查每个声明是否有源支持
    const unsupported: HallucinationIssue[] = [];
    for (const claim of claims) {
      const isSupported = await this.verifyClaimAgainstSources(claim, sources);
      if (!isSupported) {
        unsupported.push({
          type: 'UNSUPPORTED_CLAIM',
          content: claim,
          severity: 'MEDIUM',
        });
      }
    }
    
    return unsupported;
  }
}
```

---

## 三、Phase 14 详细任务分解

### Sprint 14.1: 多模态能力 (4周)

#### Task 14.1.1: 图像理解服务
```typescript
// server/services/multimodal/image-understanding.ts
export interface ImageAnalysisResult {
  description: string;
  objects: DetectedObject[];
  text?: ExtractedText[];
  faces?: DetectedFace[];
  documentType?: DocumentType;
  confidence: number;
}

@injectable()
export class ImageUnderstandingService {
  async analyze(imageUrl: string, options?: AnalysisOptions): Promise<ImageAnalysisResult> { ... }
  async extractText(imageUrl: string): Promise<ExtractedText[]> { ... }
  async detectFaces(imageUrl: string): Promise<DetectedFace[]> { ... }
  async classifyDocument(imageUrl: string): Promise<DocumentClassification> { ... }
}
```

#### Task 14.1.2: 文档OCR服务
```typescript
// server/services/multimodal/document-ocr.ts
export interface DocumentParseResult {
  type: 'CONTRACT' | 'INVOICE' | 'RECEIPT' | 'BUSINESS_CARD' | 'UNKNOWN';
  content: string;
  structuredData: Record<string, any>;
  confidence: number;
}
```

### Sprint 14.2: Agent编排框架 (4周)

#### Task 14.2.1: Agent基类
```typescript
// server/agents/base-agent.ts
export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly capabilities: string[];
  
  abstract canHandle(task: Task): boolean;
  abstract execute(task: Task, context: AgentContext): Promise<AgentResult>;
  abstract estimateEffort(task: Task): number;
}
```

#### Task 14.2.2: Agent编排器
```typescript
// server/services/orchestration/agent-orchestrator.ts
export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  
  registerAgent(agent: BaseAgent): void { ... }
  
  async orchestrate(goal: string, context: OrchestrationContext): Promise<OrchestrationResult> {
    // 1. 分解目标为任务
    const tasks = await this.decomposeGoal(goal);
    
    // 2. 为每个任务分配最佳Agent
    const assignments = this.assignAgents(tasks);
    
    // 3. 执行任务图
    const results = await this.executeTaskGraph(assignments);
    
    // 4. 聚合结果
    return this.aggregateResults(results);
  }
}
```

---

## 四、Phase 15 详细任务分解

### Sprint 15.1: 自主执行增强 (4周)

#### Task 15.1.1: 目标分解引擎
#### Task 15.1.2: 自我修复机制
#### Task 15.1.3: 长周期任务管理

### Sprint 15.2: 物理AI (4周)

#### Task 15.2.1: IoT设备集成
#### Task 15.2.2: 智能家居控制
#### Task 15.2.3: 车载系统对接

---

## 五、测试策略

### 5.1 测试金字塔
```
         ▲
        /E2E\           10% - 端到端测试
       /─────\
      /集成测试\        30% - API/服务集成测试
     /──────────\
    /  单元测试  \      60% - 服务/工具函数单元测试
   /──────────────\
```

### 5.2 测试覆盖要求
| Phase | 覆盖率要求 | 重点区域 |
|-------|-----------|---------|
| 13 | 60% | Repository层、API响应 |
| 14 | 70% | Agent执行、多模态处理 |
| 15 | 80% | 自主执行、安全控制 |

---

## 六、文档更新计划

| 文档 | 更新内容 | 负责Phase |
|------|----------|-----------|
| replit.md | 架构更新、新服务说明 | 每Phase |
| API_REFERENCE.md | API规范、版本说明 | 13 |
| ARCHITECTURE.md | 系统架构图、模块说明 | 13 |
| AGENT_GUIDE.md | Agent开发指南 | 14 |
| DEPLOYMENT.md | 部署与运维指南 | 15 |

---

## 七、风险控制检查点

### 每Sprint结束检查
- [ ] 所有新代码有测试覆盖
- [ ] 无新增内存泄漏
- [ ] API响应时间无明显退化
- [ ] 文档已同步更新
- [ ] 无破坏性API变更(或已提供兼容层)

### 每Phase结束检查
- [ ] 技术债务减少符合预期
- [ ] KPI指标达成
- [ ] 用户故事验收通过
- [ ] 回归测试全部通过

---

*文档版本: 1.0*
*最后更新: 2026-01-28*
