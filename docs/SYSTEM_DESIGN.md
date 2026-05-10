# 圣愈助手 (Navigator-X) - 系统设计文档

> **项目名称**: Sheng-Yu-Zhu-Shou (圣愈助手)  
> **版本**: 2.0.0  
> **日期**: 2026-03-20  
> **作者**: 陈先生 (cj6168888@Gmail.com)  
> **状态**: Navigator-X 升级完成

---

## 一、系统概述

### 1.1 项目背景

圣愈助手（小智AI）是一款功能强大的桌面AI助手，基于 **Navigator-X 领航者系统** 架构，提供顶级统御级AI协同能力：

- 📱 **移动端主控** - 从手机端实时查看和控制舰队节点
- 🎯 **领航者系统** - 五大专家席位 + 语义血缘引擎 + 审批分派中枢
- ⚙️ **舰队协同** - 节点端自主执行 + 异常检测 + Plan B自我修复
- 💡 **灵感广播** - 毫秒级同步到全舰队

### 1.2 Navigator-X 四大核心效应

#### 1. 消除"沟通黑洞"：言出法随
- 主控端抓取语音/灵感后，AI根据**语义血缘**瞬间补全背景资料、执行逻辑、考核点
- 毫秒级推送到每个队员的节点端
- 结果：不存在"我忘了"、"我理解错了"。团队全员共享老板的瞬时带宽

#### 2. 永远的"Plan B"：自我修复
- 当节点端检测到异常（供应商断货、员工生病）时，系统自动激活预案
- 系统像水一样，堵住一个洞，瞬间从另一个方向流过去
- 结果：对手以为打中了软肋，其实已经完成毫秒级自我修复

#### 3. 精准把握异常：数字化"读心术"
- 通过分析节点端数据流（进度波动、沟通情绪、方案严密度）
- 主控端发送**红线预警**
- 结果：老板看的是"数据信号"，在危机爆发前完成人员调度或心理干预

#### 4. 灵感的全局传染：毫秒级同步
- 老板洗澡时的一个营销点子，系统扫描全局100份方案
- 1秒内将灵感转化为具体修改参数，应用到所有正在跑的任务
- 结果：全公司同步进化，对手只能望尘莫及

### 1.3 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              主权端 Sovereign Terminal                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  领航者指挥中心 (Navigator Command)                                   │   │
│  │  ├── 审批与分派中枢 (Command Center)                                  │   │
│  │  ├── 语义血缘引擎 (Semantic Bloodline)                               │   │
│  │  ├── 红线预警面板 (Red Alert Panel)                                 │   │
│  │  └── 五大专家席位 (High Council)                                     │   │
│  │      ├── 法务专家 (Claude Sonnet)                                   │   │
│  │      ├── 财务专家 (DeepSeek V3)                                     │   │
│  │      ├── 策划专家 (GPT-4o)                                          │   │
│  │      ├── 心理专家 (Claude Haiku)                                    │   │
│  │      └── 全能秘书 (GPT-4o Mini)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │ 灵感广播 / 任务分派 / 预警通知
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            舰队 Fleet                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │   节点端 Node A  │  │   节点端 Node B  │  │   节点端 Node N  │           │
│  │  - 草案生成      │  │  - 草案生成      │  │  - 草案生成      │           │
│  │  - 汇报提交      │  │  - 汇报提交      │  │  - 汇报提交      │           │
│  │  - 数据流上报    │  │  - 数据流上报    │  │  - 数据流上报    │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          系统核心 System Core                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  服务层 Services                                                              │
│  ├── navigator-core.ts        - 领航者核心引擎 (原SwarmManager)              │
│  ├── sovereign-terminal.ts    - 主权端机制 (原TransparentClone)              │
│  ├── expert-orchestrator.ts  - 专家编排器 + 多模型路由                      │
│  ├── semantic-bloodline.ts     - 语义血缘引擎                                │
│  ├── command-center.ts         - 审批与分派中枢                              │
│  ├── anomaly-detector.ts       - 异常检测引擎                                │
│  ├── contingency-engine.ts      - Plan B 预案引擎                             │
│  ├── inspiration-broadcast.ts   - 灵感广播服务                                │
│  └── compute-allocator.ts     - 算力配给服务                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  执行层 Execution                                                             │
│  ├── RemoteControlService    - 远程控制服务                                 │
│  ├── TaskOrchestrator        - 任务编排引擎                                  │
│  └── UnifiedExecutor         - 统一执行器                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、Navigator-X 功能模块

### 2.1 领航者指挥中心 (Navigator Command)

#### 2.1.1 功能特性

| 功能 | 描述 | 状态 |
|------|------|------|
| 身份状态 | 显示主权端身份与权限等级 | ✅ |
| 舰队遥测 | 实时显示所有节点端状态与进度 | ✅ |
| 灵感广播 | 一键广播灵感至全舰队 | ✅ |
| 快捷入口 | 快速访问专家席位、审批中枢 | ✅ |

#### 2.1.2 路由

```
/navigator-command  - 领航者指挥中心
/navigator-settings - 舰队统筹设置
```

---

### 2.2 五大专家席位 (High Council)

#### 2.2.1 专家列表

| 专家 | 模型 | 核心能力 |
|------|------|----------|
| 法务专家 | Claude Sonnet | 陷阱条款识别、谈判辩论策略、合同风险评分 |
| 财务专家 | DeepSeek V3 | 盈亏平衡分析、资金流预警、异常支出检测 |
| 策划专家 | GPT-4o | 商业闭环方案生成、行业数据分析 |
| 心理专家 | Claude Haiku | 团队士气曲线、员工状态预警 |
| 全能秘书 | GPT-4o Mini | 模糊口令执行、日程智能对冲、礼仪提醒 |

#### 2.2.2 多模型路由

```typescript
const EXPERT_MODEL_MAP = {
  LEGAL: { provider: 'claude', model: 'claude-3-5-sonnet' },
  FINANCE: { provider: 'deepseek', model: 'deepseek-v3' },
  STRATEGY: { provider: 'openai', model: 'gpt-4o' },
  PSYCHOLOGY: { provider: 'claude', model: 'claude-3-5-haiku' },
  PLANNING: { provider: 'deepseek', model: 'deepseek-v3' },
  SECRETARY: { provider: 'openai', model: 'gpt-4o-mini' },
};
```

---

### 2.3 审批与分派中枢 (Command Center)

#### 2.3.1 功能特性

| 功能 | 描述 | 状态 |
|------|------|------|
| 汇报汇总 | 接收节点端提交的汇报卡片 | ✅ |
| 准予立项 | 一键审批通过 | ✅ |
| 打回修正 | 要求节点重新提交 | ✅ |
| 即刻执行 | 立即拆解任务分派 | ✅ |
| 灵感捕捉 | 支持语音/文字输入 | ✅ |

#### 2.3.2 汇报卡片

```typescript
interface ReportCard {
  id: string;
  nodeId: string;           // 来源节点
  summary: string;         // AI压缩后的摘要
  authenticityScore: number; // 真实性评分
  submittedAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
}
```

---

### 2.4 语义血缘引擎 (Semantic Bloodline)

#### 2.4.1 核心功能

- **语义补全**：将老板的模糊意图自动补全为完整执行方案
- **KPI生成**：自动生成考核指标
- **上下文关联**：与历史数据关联，增强理解

#### 2.4.2 接口

```typescript
interface SemanticBloodline {
  enrichIntent(rawInput: string): EnrichedIntent;
  generateKPIs(intent: EnrichedIntent): KPI[];
  linkContext(intent: EnrichedIntent): ContextLink[];
}
```

---

### 2.5 异常检测与Plan B (Anomaly + Contingency)

#### 2.5.1 异常类型

| 类型 | 描述 | 严重程度 |
|------|------|----------|
| SUPPLY_BREAK | 供应链断裂 | HIGH |
| PERSON_ABSENT | 人员缺席 | MEDIUM |
| PROGRESS_DELAY | 进度延迟 | MEDIUM |
| QUALITY_DROP | 质量下降 | MEDIUM |
| MORALE_LOW | 士气低落 | LOW |

#### 2.5.2 红线预警

```typescript
interface RedAlert {
  id: string;
  nodeId: string;
  type: AnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  detectedAt: number;
  acknowledged: boolean;
}
```

#### 2.5.3 自我修复

```typescript
interface ContingencyPlan {
  id: string;
  name: string;
  triggerTypes: AnomalyType[];
  actions: ContingencyAction[];
  successRate: number;
}
```

---

### 2.6 灵感广播 (Inspiration Broadcast)

#### 2.6.1 功能流程

1. 捕捉灵感（语音/文字）
2. 语义血缘补全
3. 生成KPI和任务拆解
4. 毫秒级广播至所有节点

---

### 2.7 节点端 (Node Terminal)

#### 2.7.1 功能特性

| 功能 | 描述 | 状态 |
|------|------|------|
| 草案生成 | AI自动生成汇报草案 | ✅ |
| 偏好适应 | 根据领导偏好调整格式 | ✅ |
| 真实性审计 | 自动评估汇报真实性 | ✅ |
| 一键推送 | 快速提交汇报至主控端 | ✅ |
| 状态追踪 | 显示已发送/已读/已采纳 | ✅ |

---

### 2.8 远程控制PC (Remote Control)

#### 2.8.1 功能特性

| 功能 | 描述 | 状态 |
|------|------|------|
| 设备注册 | PC设备自动注册到服务器 | ✅ |
| 屏幕截图 | 获取PC屏幕截图 | ✅ |
| 鼠标控制 | 点击、拖拽、移动 | ✅ |
| 键盘控制 | 输入文字、快捷键 | ✅ |
| 实时流 | WebSocket实时屏幕流 | ✅ |
| 文件传输 | 浏览和传输PC文件 | ⏳ |

---

## 三、Navigator-X API

### 3.1 API端点总览

```
# 领航者核心
GET  /api/navigator/nodes              - 获取节点列表
POST /api/navigator/nodes              - 创建节点
GET  /api/navigator/nodes/:id         - 获取节点详情
POST /api/navigator/nodes/:id/suspend - 暂停节点
POST /api/navigator/nodes/:id/revoke   - 召回节点

# 令牌管理
POST /api/navigator/tokens             - 签发令牌
POST /api/navigator/tokens/validate    - 验证令牌
GET  /api/navigator/tokens            - 获取令牌列表

# 舰队管理
POST /api/navigator/fleets            - 创建舰队
GET  /api/navigator/fleets            - 获取舰队列表
POST /api/navigator/fleets/:id/insights - 生成舰队洞察

# 汇报与审批
GET  /api/navigator/pending-reports   - 待审批汇报
POST /api/navigator/reports           - 提交汇报
POST /api/navigator/reports/:id/approve - 准予立项
POST /api/navigator/reports/:id/reject  - 打回修正
POST /api/navigator/reports/:id/execute - 即刻执行

# 灵感广播
POST /api/navigator/inspiration/capture - 捕捉灵感
POST /api/navigator/inspiration/broadcast - 广播灵感
GET  /api/navigator/broadcasts        - 广播历史

# 红线预警
GET  /api/navigator/alerts            - 获取预警
POST /api/navigator/alerts/:id/ack    - 确认预警

# 自我修复
GET  /api/navigator/self-healing      - 自我修复日志

# 统计
GET  /api/navigator/stats             - 统计信息
GET  /api/navigator/audit            - 审计日志

# 紧急召回
POST /api/navigator/emergency-recall  - 紧急召回
```

### 3.2 节点类型

```typescript
type NodeType =
  | 'SOVEREIGN'    // 主权端（领导核心）
  | 'NODE'         // 节点端（执行成员）
  | 'AGENT'        // 代理（特定任务）
  | 'OBSERVER';    // 观察者（只读）
```

### 3.3 能力系统

```typescript
type Capability =
  | 'VOICE_INTERACTION'    // 语音交互
  | 'TEXT_CHAT'           // 文字聊天
  | 'DRAFT_GENERATION'    // 草案生成 (Navigator-X)
  | 'AUTHENTICITY_AUDIT'  // 真实性审计 (Navigator-X)
  | 'PREFERENCE_ADAPT';    // 偏好自适应 (Navigator-X)
```

---

## 四、文件结构

### 4.1 Navigator-X 服务 (server/services/)

```
server/
├── services/
│   ├── navigator-core.ts         # 领航者核心引擎 (原swarm-manager.ts)
│   ├── sovereign-terminal.ts     # 主权端机制 (原transparent-clone.ts)
│   ├── expert-orchestrator.ts   # 五大专家 + 多模型路由
│   ├── semantic-bloodline.ts     # 语义血缘引擎
│   ├── command-center.ts         # 审批与分派中枢
│   ├── anomaly-detector.ts       # 异常检测引擎
│   ├── contingency-engine.ts     # Plan B 预案引擎
│   ├── inspiration-broadcast.ts  # 灵感广播服务
│   └── compute-allocator.ts       # 算力配给服务
└── routes/
    └── navigator-core.ts          # 领航者API路由
```

### 4.2 Navigator-X 页面 (client/src/pages/)

```
client/
└── src/
    └── pages/
        ├── navigator-console.tsx    # 桌面端控制台
        └── pages/mobile/
            ├── NavigatorCommand.tsx    # 领航者指挥中心 (/navigator-command)
            ├── NavigatorSettings.tsx   # 舰队统筹 (/navigator-settings)
            ├── ExpertCenter.tsx       # 五大专家席位 (/experts)
            ├── CommandCenter.tsx      # 审批分派中枢 (/command)
            ├── RedAlertPanel.tsx      # 红线预警 (/red-alerts)
            ├── InspirationBroadcast.tsx # 灵感广播 (/inspiration)
            └── NodeTerminal.tsx        # 节点端 (/node-terminal)
```

---

## 五、品牌升级

### 5.1 术语对照

| 原术语 | 新术语 | 英文 |
|--------|--------|------|
| 蜂群 | 舰队 | Fleet |
| 主控端 | 主权端 | Sovereign Terminal |
| 分身端 | 节点端 | Node Terminal |
| 指挥部 | 领航者指挥中心 | Navigator Command |
| 专家系统 | 五大专家席位 | High Council |

### 5.2 向后兼容

| 原文件/路由 | 新文件/路由 | 状态 |
|-------------|-------------|------|
| swarm-manager.ts | navigator-core.ts | ✅ 别名 |
| transparent-clone.ts | sovereign-terminal.ts | ✅ 别名 |
| /api/swarm/* | /api/navigator/* | ✅ 别名 |
| /control | /navigator-command | ✅ 路由更新 |
| /swarm-settings | /navigator-settings | ✅ 路由更新 |

---

## 六、数据库

### 6.1 新增表

```sql
-- 汇报表
CREATE TABLE navigatorReports (
    id VARCHAR(255) PRIMARY KEY,
    node_id VARCHAR(255),
    summary TEXT,
    authenticity_score DECIMAL,
    status VARCHAR(20),
    submitted_at TIMESTAMP
);

-- 任务表
CREATE TABLE navigatorTasks (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255),
    assignee_node_id VARCHAR(255),
    priority VARCHAR(20),
    status VARCHAR(20)
);

-- 预警表
CREATE TABLE navigatorRedAlerts (
    id VARCHAR(255) PRIMARY KEY,
    node_id VARCHAR(255),
    type VARCHAR(50),
    severity VARCHAR(20),
    acknowledged BOOLEAN
);

-- 灵感广播表
CREATE TABLE navigatorInspirationBroadcast (
    id VARCHAR(255) PRIMARY KEY,
    raw_text TEXT,
    enriched_text TEXT,
    total_nodes INTEGER,
    delivered_nodes INTEGER
);
```

迁移脚本：`migrations/002_navigator_tables.sql`

---

## 七、安全

### 7.1 权限等级

| 等级 | 描述 | 可见功能 |
|------|------|----------|
| SOVEREIGN | 主权端 | 全部功能 |
| MEMBER | 成员端 | 基本功能 |
| GUEST | 访客端 | 只读功能 |

### 7.2 安全机制

- 主权端对API Key的更改即时影响所有节点端
- 紧急召回可瞬间回收所有节点
- 操作完整审计日志

---

## 八、部署指南

### 8.1 环境要求

| 组件 | 要求 |
|------|------|
| Node.js | >= 18.0.0 |
| npm | >= 9.0.0 |
| Python | >= 3.8 (PC控制) |
| OS | Windows/macOS/Linux |

### 8.2 安装步骤

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 3. 运行数据库迁移
npm run db:migrate

# 4. 启动开发服务器
npm run dev
```

### 8.3 生产部署

```bash
# 构建
npm run build

# 启动生产服务器
npm start
```

---

## 九、版本历史

| 版本 | 日期 | 描述 |
|------|------|------|
| 1.0.0 | 2026-03-13 | 初始版本 - 远程控制+任务系统 |
| 2.0.0 | 2026-03-20 | Navigator-X 升级 - 领航者系统 |

---

**文档结束**
