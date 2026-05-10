# 小智系统升级计划

> 基于系统评测报告，制定分阶段改进计划
> 目标：从"能跑"升级到"生产级"

---

## 执行原则

1. **先止血，后优化** - 先修复致命问题，再做架构优化
2. **小步快跑** - 每个改动可测试、可回滚
3. **优先级驱动** - 按影响面排序，核心功能优先
4. **测试先行** - 新代码必须有测试覆盖

---

## Phase A: 代码质量基础加固 (1-2周)

### A1. 消除 `any` 类型污染 [优先级: P0]

**现状**: 673处 `any` 类型  
**目标**: 降低到 <50处（部分第三方库交互允许保留）

**执行步骤**:
```bash
# 1. 添加严格类型检查
# tsconfig.json 添加
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

# 2. 分批修复（按服务模块）
# 优先修复: 核心服务 > 路由层 > 工具函数
```

**关键文件优先级**:
1. `server/services/dashscope*.ts` - AI核心
2. `server/routes/*.ts` - API层
3. `server/storage.ts` - 数据层

### A2. 统一日志系统 [优先级: P0]

**现状**: 1,384处 `console.log`  
**目标**: 结构化日志 + 日志级别控制

**实现方案**:
```typescript
// server/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' } 
    : undefined,
});

// 使用方式
logger.info({ service: 'MCTS', action: 'init' }, '博弈引擎已初始化');
logger.error({ err, context }, '服务调用失败');
```

**批量替换策略**:
```bash
# 第一阶段: 替换格式化日志
find server -name "*.ts" -exec sed -i 's/console.log(\[/logger.info({ module: /g' {} \;

# 第二阶段: 人工检查关键服务
```

### A3. 添加全局错误边界 [优先级: P0]

**现状**: 20+服务无try-catch  
**目标**: 统一错误处理 + 优雅降级

**实现方案**:
```typescript
// server/middleware/error-handler.ts
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, '请求处理失败');
  
  // 区分业务错误和系统错误
  if (err instanceof BusinessError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  
  // 系统错误不暴露细节
  res.status(500).json({ error: '服务暂时不可用', code: 'INTERNAL_ERROR' });
}
```

---

## Phase B: 测试覆盖建设 (2-3周)

### B1. 核心服务单元测试 [优先级: P0]

**现状**: 0个测试文件  
**目标**: 核心服务 >80% 覆盖率

**测试框架选型**:
```json
// package.json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "msw": "^2.0.0"  // Mock Service Worker
  }
}
```

**优先覆盖的服务** (按业务重要性):
1. `dashscope.ts` - AI对话核心
2. `z1-router.ts` - 智能路由
3. `mcts-engine.ts` - 博弈推演
4. `rag-service.ts` - 知识检索
5. `auth.ts` - 认证鉴权

**测试示例**:
```typescript
// server/services/__tests__/mcts-engine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MCTSEngine } from '../mcts-engine';

describe('MCTSEngine', () => {
  it('should complete negotiation simulation within timeout', async () => {
    const engine = new MCTSEngine();
    const result = await engine.runSimulation({
      scenario: 'contract_negotiation',
      iterations: 100,
      timeout: 5000
    });
    
    expect(result.bestMove).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should handle invalid scenario gracefully', async () => {
    const engine = new MCTSEngine();
    await expect(engine.runSimulation({ scenario: 'invalid' }))
      .rejects.toThrow('Unknown scenario');
  });
});
```

### B2. API集成测试 [优先级: P1]

**目标**: 关键API端点全覆盖

```typescript
// server/__tests__/api/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../index';

describe('Health API', () => {
  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// server/__tests__/api/avatar.test.ts
describe('Avatar Chat API', () => {
  it('POST /api/avatar/chat should respond', async () => {
    const res = await request(app)
      .post('/api/avatar/chat')
      .send({ message: '你好', sessionId: 'test' });
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});
```

### B3. E2E关键路径测试 [优先级: P1]

**关键用户旅程**:
1. 首页加载 → 对话页面 → 发送消息 → 收到回复
2. 人脉页面 → 添加联系人 → 查看详情
3. 项目页面 → 创建项目 → 查看进度

---

## Phase C: 架构瘦身 (2-4周)

### C1. 服务合并精简 [优先级: P1]

**现状**: 120个服务模块  
**目标**: 合并到 40-50个核心模块

**合并策略**:
```
# 按领域合并
guardian-angel + bio-guardian + proactive-care → health-guardian.ts
mcts-engine + strategy-brain → game-theory.ts  
tech-hunter + capability-indexer → tech-discovery.ts
screen-piercer + vllm-grounding → ui-automation.ts
data-lineage + telemetry → observability.ts

# 删除僵尸代码
- 检查每个服务的调用频率
- 未被调用的服务标记为deprecated
- 3个月后删除
```

### C2. 路由重构 [优先级: P1]

**现状**: routes.ts 535行 + 50个import  
**目标**: 领域驱动的路由组织

```
server/routes/
├── index.ts          # 路由注册入口 (<100行)
├── core/             # 核心功能
│   ├── auth.ts
│   ├── avatar.ts
│   └── health.ts
├── business/         # 业务功能
│   ├── persons.ts
│   ├── projects.ts
│   └── contracts.ts
├── ai/               # AI相关
│   ├── chat.ts
│   ├── rag.ts
│   └── mcts.ts
└── system/           # 系统管理
    ├── telemetry.ts
    └── admin.ts
```

### C3. 依赖清理 [优先级: P2]

**现状**: 112个依赖  
**目标**: <80个

```bash
# 1. 检测未使用依赖
npx depcheck

# 2. 合并功能重复的包
# 例: date-fns vs dayjs, lodash vs ramda

# 3. 审计安全漏洞
npm audit --production
```

---

## Phase D: UI/UX优化 (1-2周)

### D1. 功能收敛 [优先级: P1]

**现状**: 20+功能入口  
**目标**: 核心4个 + 扩展6个

**新导航结构**:
```
主导航 (底部常驻):
├── 首页 (Dashboard概览)
├── 对话 (AI助手核心)
├── 工作 (项目+任务+日程)
└── 我的 (设置+个人中心)

"我的"页面内:
├── 人脉管理
├── 智语洞察
├── 进化日志
├── 安全中心
└── 系统设置
```

### D2. 主题系统统一 [优先级: P2]

**目标**: CSS变量驱动，支持主题切换

```css
/* client/src/styles/theme.css */
:root {
  /* 核心色板 */
  --color-primary: hsl(199, 89%, 48%);      /* 青色 */
  --color-primary-dark: hsl(199, 89%, 38%);
  --color-accent: hsl(45, 93%, 47%);        /* 金色 */
  
  /* 背景层级 */
  --bg-base: hsl(222, 47%, 3%);             /* 深蓝黑 */
  --bg-surface: hsl(222, 30%, 8%);
  --bg-elevated: hsl(222, 25%, 12%);
  
  /* 文字层级 */
  --text-primary: hsl(0, 0%, 98%);
  --text-secondary: hsl(220, 9%, 65%);
  --text-muted: hsl(220, 9%, 45%);
}

/* 消除硬编码颜色 */
/* 替换: bg-[#030712] → bg-base */
/* 替换: text-cyan-400 → text-primary */
```

### D3. 响应式完善 [优先级: P2]

```typescript
// client/src/hooks/useBreakpoint.ts
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 640) setBreakpoint('mobile');
      else if (window.innerWidth < 1024) setBreakpoint('tablet');
      else setBreakpoint('desktop');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  
  return breakpoint;
}
```

---

## Phase E: 生产就绪 (1-2周)

### E1. 监控告警 [优先级: P0]

**实现方案**:
```typescript
// server/lib/metrics.ts
import { Counter, Histogram, Registry } from 'prom-client';

export const metrics = {
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),
  
  aiRequestTotal: new Counter({
    name: 'ai_request_total',
    help: 'AI API calls',
    labelNames: ['provider', 'model', 'success']
  }),
  
  aiRequestDuration: new Histogram({
    name: 'ai_request_duration_seconds',
    help: 'AI API latency',
    labelNames: ['provider'],
    buckets: [1, 2, 5, 10, 30]
  })
};

// GET /metrics 暴露给 Prometheus
```

### E2. 健康检查增强 [优先级: P0]

```typescript
// server/routes/health.ts
export async function detailedHealthCheck() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkAIService(),
  ]);
  
  return {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: checks[0].status === 'fulfilled' ? 'ok' : 'fail',
      redis: checks[1].status === 'fulfilled' ? 'ok' : 'fail', 
      ai: checks[2].status === 'fulfilled' ? 'ok' : 'fail',
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}
```

### E3. AI服务降级策略 [优先级: P1]

```typescript
// server/services/ai-fallback.ts
export class AIServiceWithFallback {
  private providers = ['dashscope', 'deepseek', 'doubao'];
  private currentIndex = 0;
  
  async chat(message: string): Promise<string> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[(this.currentIndex + i) % this.providers.length];
      try {
        const result = await this.callProvider(provider, message);
        return result;
      } catch (err) {
        logger.warn({ provider, err }, 'AI provider failed, trying fallback');
      }
    }
    
    // 所有提供商失败，返回兜底响应
    return '抱歉，AI服务暂时不可用，请稍后重试。';
  }
  
  private async callProvider(name: string, message: string) {
    const timeout = AbortSignal.timeout(30000);
    // 带超时的API调用
  }
}
```

---

## 执行时间线

```
Week 1-2:  Phase A (代码质量) ████████████████████
Week 2-4:  Phase B (测试建设) ████████████████████████████████
Week 4-6:  Phase C (架构瘦身) ████████████████████████████████
Week 6-7:  Phase D (UI优化)   ████████████████
Week 7-8:  Phase E (生产就绪) ████████████████
```

---

## 成功指标

| 指标 | 当前 | 目标 | 验收标准 |
|------|------|------|----------|
| `any` 类型 | 673 | <50 | `tsc --noImplicitAny` 通过 |
| console.log | 1384 | 0 | 全部迁移到logger |
| 测试覆盖率 | 0% | >60% | 核心服务>80% |
| 服务数量 | 120 | 50 | 无僵尸代码 |
| 依赖包数 | 112 | <80 | 无安全漏洞 |
| 启动时间 | ~5s | <3s | 冷启动测量 |
| 首屏加载 | 未测 | <2s | Lighthouse>80 |

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 重构引入新bug | 高 | 高 | 先写测试再改代码 |
| 服务合并影响现有功能 | 中 | 高 | 逐步合并+灰度 |
| 依赖升级不兼容 | 中 | 中 | 锁定版本+分批升级 |
| 团队不熟悉新架构 | 低 | 中 | 文档+代码评审 |

---

**执行建议**: 从 Phase A 的 A1 (消除any) 开始，这是投入产出比最高的改进点。
