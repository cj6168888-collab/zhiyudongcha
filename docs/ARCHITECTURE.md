# 小智系统技术架构文档

> 系统架构设计与模块说明

---

## 一、系统架构总览

### 1.1 四层分布式架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           云端服务器层 (Cloud)                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DashScope  │  DeepSeek  │  DouBao  │  向量数据库  │  对象存储  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTPS/WSS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          应用服务器层 (Server)                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Express.js  │  WebSocket  │  PostgreSQL  │  RAG知识库  │  AI编排 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTPS/WSS/WebRTC
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│   电脑端 (Desktop)    │  │   手机端 (Mobile)     │  │   AR眼镜 (Glasses)    │
│  ┌─────────────────┐  │  │  ┌─────────────────┐  │  │  ┌─────────────────┐  │
│  │ Ollama本地推理  │  │  │  │ React Native   │  │  │  │ INMO Air2 SDK  │  │
│  │ 桌面精灵系统    │  │  │  │ 实时语音       │  │  │  │ AR界面渲染     │  │
│  │ 屏幕穿刺服务    │  │  │  │ 离线能力       │  │  │  │ 语音交互       │  │
│  └─────────────────┘  │  │  └─────────────────┘  │  │  └─────────────────┘  │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **领域驱动** | 按业务领域组织代码，而非技术层次 |
| **依赖倒置** | 高层模块不依赖低层模块，都依赖抽象 |
| **单一职责** | 每个模块/类只负责一个功能领域 |
| **接口隔离** | 客户端不应依赖它不需要的接口 |
| **开闭原则** | 对扩展开放，对修改关闭 |

---

## 二、领域模块架构

### 2.1 模块划分

```
server/
├── core/                    # 核心能力层
│   ├── persona/            # 人格与情感
│   ├── reasoning/          # 推理与决策
│   └── memory/             # 记忆与上下文
│
├── domain/                  # 业务领域层
│   ├── contacts/           # 人脉管理
│   ├── projects/           # 项目管理
│   ├── contracts/          # 合同管道
│   ├── insight/            # 智语洞察
│   ├── action/             # 自主执行
│   └── guardian/           # 健康守护
│
├── infra/                   # 基础设施层
│   ├── ai/                 # AI服务抽象
│   ├── comm/               # 通信服务
│   ├── security/           # 安全服务
│   └── storage/            # 存储服务
│
├── agents/                  # Agent层
│   ├── base-agent.ts       # Agent基类
│   ├── legal-agent.ts      # 法律Agent
│   ├── finance-agent.ts    # 财务Agent
│   └── research-agent.ts   # 研究Agent
│
└── orchestration/           # 编排层
    ├── agent-orchestrator.ts
    └── workflow-engine.ts
```

### 2.2 模块依赖规则

```
       ┌──────────────────────────┐
       │      Orchestration       │  ◀── 编排层可以调用所有层
       └──────────────────────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Agents  │ │   Core   │ │  Domain  │  ◀── Agent/Core/Domain互相隔离
└──────────┘ └──────────┘ └──────────┘
       │           │           │
       └───────────┼───────────┘
                   ▼
       ┌──────────────────────────┐
       │         Infra            │  ◀── 基础设施层被所有层依赖
       └──────────────────────────┘
```

**依赖规则**:
- ✅ 上层可以依赖下层
- ✅ 同层可以依赖抽象接口
- ❌ 下层不能依赖上层
- ❌ 同层不能直接依赖具体实现

---

## 三、核心服务架构

### 3.1 AI服务抽象层

```typescript
// infra/ai/interfaces.ts
export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  embed(text: string): Promise<number[]>;
}

// infra/ai/ai-service.ts
export class AIService {
  private providers: AIProvider[];
  private currentProvider: AIProvider;
  
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    // 自动故障转移
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        try {
          return await provider.chat(messages, options);
        } catch (error) {
          continue;
        }
      }
    }
    throw new AIServiceUnavailableError();
  }
}
```

### 3.2 推理引擎架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        推理引擎 (Reasoning Engine)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 思维链推理  │  │ 深度思考    │  │ 幻觉检测    │              │
│  │ (CoT)       │  │ (Deep Think)│  │ (Halluc.)   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│                  ┌───────────────┐                               │
│                  │ 置信度评估器  │                               │
│                  └───────────────┘                               │
│                          │                                       │
│         ┌────────────────┼────────────────┐                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 知识库检索  │  │ 专家系统    │  │ MCTS决策    │              │
│  │ (RAG)       │  │ (Expert)    │  │ (Game)      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 记忆系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        记忆系统 (Memory System)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   工作记忆 (Working Memory)              │    │
│  │  - 当前会话上下文                                        │    │
│  │  - 任务状态栈                                            │    │
│  │  - 短期注意力焦点                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   情景记忆 (Episodic Memory)             │    │
│  │  - 对话历史                                              │    │
│  │  - 事件记录                                              │    │
│  │  - 情感印记                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   语义记忆 (Semantic Memory)             │    │
│  │  - 人脉知识图谱                                          │    │
│  │  - 领域知识库                                            │    │
│  │  - 用户偏好模型                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、数据架构

### 4.1 数据库设计原则

| 原则 | 说明 |
|------|------|
| 规范化 | 第三范式，避免数据冗余 |
| 外键约束 | 保证引用完整性 |
| 索引策略 | 高频查询字段建立索引 |
| 软删除 | 关键数据使用软删除 |
| 审计日志 | 敏感操作记录审计日志 |

### 4.2 核心实体关系

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   persons   │──1:N──│ interactions│──N:1──│  projects   │
│  (人脉)     │      │  (交互)     │      │  (项目)     │
└─────────────┘      └─────────────┘      └─────────────┘
       │                                         │
       │                                         │
      1:N                                       1:N
       │                                         │
       ▼                                         ▼
┌─────────────┐                          ┌─────────────┐
│relationships│                          │   tasks     │
│  (关系)     │                          │  (任务)     │
└─────────────┘                          └─────────────┘
```

### 4.3 Repository模式

```typescript
// infra/storage/repositories/base.repository.ts
export abstract class BaseRepository<T, InsertT> {
  constructor(protected db: Database) {}
  
  abstract findById(id: string): Promise<T | null>;
  abstract findAll(options?: FindOptions): Promise<T[]>;
  abstract create(data: InsertT): Promise<T>;
  abstract update(id: string, data: Partial<InsertT>): Promise<T>;
  abstract delete(id: string): Promise<boolean>;
}

// infra/storage/repositories/person.repository.ts
@injectable()
export class PersonRepository extends BaseRepository<Person, InsertPerson> {
  async findByName(name: string): Promise<Person[]> { ... }
  async findByOrganization(org: string): Promise<Person[]> { ... }
  async searchFuzzy(query: string): Promise<Person[]> { ... }
}
```

---

## 五、通信架构

### 5.1 API层设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
├─────────────────────────────────────────────────────────────────┤
│  认证中间件 → 限流中间件 → 日志中间件 → 路由分发                │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│ REST Routes   │          │ WebSocket     │          │ GraphQL       │
│ /api/v1/*     │          │ /ws/*         │          │ /graphql      │
└───────────────┘          └───────────────┘          └───────────────┘
```

### 5.2 WebSocket连接管理

```typescript
// infra/comm/websocket-manager.ts
@injectable()
export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  
  addConnection(id: string, ws: WebSocket): void { ... }
  removeConnection(id: string): void { ... }
  joinRoom(connectionId: string, roomId: string): void { ... }
  broadcast(roomId: string, message: any): void { ... }
  sendTo(connectionId: string, message: any): void { ... }
}
```

---

## 六、安全架构

### 6.1 认证授权

```
┌─────────────────────────────────────────────────────────────────┐
│                        安全层 (Security Layer)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 角色认证    │  │ 生物识别    │  │ 设备认证    │              │
│  │ (MASTER/    │  │ (声纹/人脸) │  │ (设备绑定)  │              │
│  │  GUEST)     │  │             │  │             │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│                  ┌───────────────┐                               │
│                  │ 权限控制器    │                               │
│                  └───────────────┘                               │
│                          │                                       │
│                          ▼                                       │
│                  ┌───────────────┐                               │
│                  │ 审计日志      │                               │
│                  └───────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 数据安全

| 层面 | 措施 |
|------|------|
| 传输层 | HTTPS/WSS加密 |
| 存储层 | 敏感字段加密 |
| 应用层 | 输入验证、SQL注入防护 |
| 访问层 | 角色权限控制 |

---

## 七、监控与运维

### 7.1 健康检查

```typescript
// 存活探针 - 进程是否运行
GET /api/v1/health/live
→ { status: 'ok', uptime: 3600 }

// 就绪探针 - 是否可接受请求
GET /api/v1/health/ready
→ { status: 'ok', database: 'connected', ai: 'available' }

// AI服务状态
GET /api/v1/health/ai
→ { dashscope: 'ok', deepseek: 'ok', doubao: 'degraded' }
```

### 7.2 日志规范

```typescript
// 使用Pino结构化日志
logger.info({ 
  module: 'PersonService',
  action: 'create',
  personId: 'p123',
  duration: 45
}, 'Person created successfully');
```

---

## 八、扩展性设计

### 8.1 插件机制

```typescript
// 技术猎手插件接口
export interface TechPlugin {
  type: 'LLM' | 'TTS' | 'ASR' | 'OCR' | 'EMBEDDING';
  name: string;
  version: string;
  initialize(): Promise<void>;
  execute(input: any): Promise<any>;
  shutdown(): Promise<void>;
}
```

### 8.2 Agent扩展

```typescript
// 自定义Agent只需继承基类
export class CustomAgent extends BaseAgent {
  readonly name = 'CustomAgent';
  readonly capabilities = ['custom_task'];
  
  canHandle(task: Task): boolean {
    return task.type === 'custom_task';
  }
  
  async execute(task: Task, context: AgentContext): Promise<AgentResult> {
    // 实现具体逻辑
  }
}
```

---

*文档版本: 1.0*
*最后更新: 2026-01-28*
