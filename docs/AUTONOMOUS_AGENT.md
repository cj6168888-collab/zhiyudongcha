# 自主 Agent 系统文档

## 概述

这是一个基于 AI 的自主 Agent 系统，能够自动执行各种任务，包括：
- 浏览器自动化操作
- 政府网站表单填写与申报
- 网站后台监控与通知
- 邮箱与短信监控
- 定时周期性任务执行
- 多渠道汇报

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    自主 Agent 核心                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ BrowserAgent │    │ GovFormSvc   │    │ WebMonitor   │ │
│  │ 浏览器自动化  │    │ 政府网站表单  │    │ 网站监控    │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                              │                    │          │
│                              ▼                    ▼          │
│                     ┌──────────────────────────────┐        │
│                     │   AutonomousAgentOrchestrator │        │
│                     │       自主Agent编排器         │        │
│                     │  - ReAct 循环                │        │
│                     │  - 自我反思                  │        │
│                     │  - 模型自动升级              │        │
│                     └──────────────────────────────┘        │
│                              │                               │
│                              ▼                               │
│                     ┌──────────────────────────────┐        │
│                     │     AI Provider Chain        │        │
│                     │   通义千问 / DeepSeek / 豆包  │        │
│                     └──────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 核心服务

### 1. BrowserAgent (浏览器自动化)

基于 Playwright 实现，提供完整的浏览器控制能力。

**功能**：
- 多浏览器 Profile 管理
- 智能表单填写
- 网页内容提取
- 截图与视觉分析
- Cookie/会话保持

**API**：
```
POST   /api/agent/browser/profile        创建浏览器配置
POST   /api/agent/browser/execute        执行浏览器操作
GET    /api/agent/browser/snapshot       获取页面快照
DELETE /api/agent/browser/profile/:id    删除配置
```

### 2. GovernmentFormService (政府网站表单)

用于自动化政府网站的注册、登录、表单填写和申报。

**功能**：
- 注册政府网站配置
- 管理公司信息
- 自动填写表单
- 提交申报材料
- 监控申报状态

**API**：
```
POST   /api/agent/gov/register          注册政府网站
POST   /api/agent/gov/credential       设置登录凭证
POST   /api/agent/gov/company          设置公司信息
POST   /api/agent/gov/apply            执行申报流程
GET    /api/agent/gov/websites         获取网站列表
```

### 3. WebsiteMonitorService (网站后台监控)

定时监控网站变化，自动检测新回复和通知。

**功能**：
- 定时检查网站更新
- 检测新回复/通知
- 智能提取关键信息
- 多渠道自动告警

**API**：
```
POST   /api/agent/monitor               创建监控任务
POST   /api/agent/monitor/check         手动触发检查
GET    /api/agent/monitor/:id          获取监控状态
DELETE /api/agent/monitor/:id          删除监控
```

### 4. AutonomousAgentOrchestrator (自主Agent编排)

核心编排器，实现 ReAct (Reasoning + Acting) 循环。

**功能**：
- 任务分解与执行
- 自我反思与修正
- 能力不足时自动升级模型
- 多渠道汇报

**步骤类型**：
- `browser` - 浏览器操作
- `email` - 邮件操作
- `sms` - 短信操作
- `search` - 网络搜索
- `ai_analyze` - AI 分析
- `ai_decide` - AI 决策
- `report` - 汇报

**API**：
```
POST   /api/agent/tasks                 创建任务
GET    /api/agent/tasks                获取任务列表
GET    /api/agent/tasks/:id            获取任务详情
POST   /api/agent/tasks/:id/execute    执行任务
DELETE /api/agent/tasks/:id            删除任务
GET    /api/agent/stats                 获取统计信息
```

## 使用示例

### 1. 创建科技局申报监控任务

```typescript
const taskId = await autonomousAgent.createTask({
  name: '科技局申报监控系统',
  description: '自动监控科技局网站申报状态',
  type: 'scheduled',
  schedule: '0 */4 * * *',  // 每4小时执行
  
  context: {
    websiteId: 'sci-tech-gov',
    profileId: 'my-profile',
  },
  
  steps: [
    {
      id: 'login',
      name: '登录科技局网站',
      type: 'browser',
      config: {
        actions: [
          { type: 'navigate', value: 'https://kjj.xxx.gov.cn' },
          { type: 'type', selector: '#username', value: '{{credentials.username}}' },
          { type: 'type', selector: '#password', value: '{{credentials.password}}' },
          { type: 'click', selector: '#loginBtn' },
        ]
      },
      onSuccess: 'check-applications',
    },
    {
      id: 'check-applications',
      name: '检查申报状态',
      type: 'ai_analyze',
      config: {
        prompt: '分析页面内容，提取申报项目状态',
      },
      onSuccess: 'report-user',
    },
    {
      id: 'report-user',
      name: '汇报给用户',
      type: 'report',
      config: {
        channels: ['app', 'email'],
      },
    },
  ],
  
  createdBy: 'user-id',
});
```

### 2. 通过 API 创建监控任务

```bash
# 创建浏览器配置
curl -X POST http://localhost:3001/api/agent/browser/profile \
  -H "Content-Type: application/json" \
  -d '{"name": "科技局网站"}'

# 设置网站凭证
curl -X POST http://localhost:3001/api/agent/gov/credential \
  -H "Content-Type: application/json" \
  -d '{"websiteId": "sci-tech", "username": "xxx", "password": "xxx"}'

# 创建监控任务
curl -X POST http://localhost:3001/api/agent/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sci-tech-monitor",
    "name": "科技局申报监控",
    "websiteId": "sci-tech",
    "profileId": "xxx",
    "checkInterval": "0 */4 * * *",
    "enabled": true,
    "patterns": [
      {
        "id": "new-reply",
        "name": "新回复",
        "selector": ".reply-list .new",
        "type": "new"
      }
    ],
    "notifyOnMatch": true,
    "notifyChannels": ["app", "email"]
  }'

# 手动触发检查
curl -X POST http://localhost:3001/api/agent/monitor/check \
  -H "Content-Type: application/json" \
  -d '{"configId": "sci-tech-monitor"}'
```

### 3. 通过 API 创建 Agent 任务

```bash
curl -X POST http://localhost:3001/api/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "日报摘要生成",
    "description": "每天自动生成工作日报摘要",
    "type": "scheduled",
    "schedule": "0 18 * * *",
    "context": {},
    "steps": [
      {
        "id": "check-emails",
        "name": "检查今日邮件",
        "type": "email",
        "config": {"action": "check_new"},
        "onSuccess": "generate-summary"
      },
      {
        "id": "generate-summary",
        "name": "生成摘要",
        "type": "ai_analyze",
        "config": {
          "prompt": "根据以下邮件生成工作日报摘要：{{emails}}"
        },
        "onSuccess": "report"
      },
      {
        "id": "report",
        "name": "汇报",
        "type": "report",
        "config": {"channels": ["app"]}
      }
    ]
  }'

# 执行任务
curl -X POST http://localhost:3001/api/agent/tasks/<task-id>/execute
```

## 配置说明

### 环境变量

```env
# AI Provider 配置
DASHSCOPE_API_KEY=your-key
DEEPSEEK_API_KEY=your-key
DOUBAO_API_KEY=your-key

# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# 浏览器
BROWSER_HEADLESS=true
```

### 模型升级链

当任务执行失败时，系统会自动尝试升级模型：

1. `gpt-4o-mini` (通义千问)
2. `gpt-4o` (通义千问)
3. `claude-3-5-sonnet`
4. `claude-3-5-opus`

## 状态检查

```bash
# 查看系统状态
curl http://localhost:3001/api/agent/stats
```

响应示例：
```json
{
  "success": true,
  "stats": {
    "browser": {
      "activeProfiles": 2,
      "totalContexts": 2
    },
    "tasks": {
      "total": 5,
      "scheduled": 3,
      "running": 1
    },
    "monitors": {
      "total": 3,
      "active": 2
    }
  }
}
```

## 安全注意事项

1. **凭证管理**：登录凭证应加密存储，不要明文写在代码中
2. **权限控制**：确保 API 访问有适当的认证
3. **频率限制**：避免过于频繁的请求触发网站防护
4. **错误处理**：做好容错，防止任务失败影响后续执行

## 故障排除

### 浏览器无法启动

```bash
# 重新安装浏览器
npx playwright install chromium
```

### 网站登录失败

1. 检查凭证是否正确
2. 确认网站是否需要验证码
3. 检查是否有 IP 限制

### 任务执行超时

调整步骤的 `timeout` 配置：
```typescript
{
  id: 'slow-step',
  type: 'browser',
  config: { actions: [...] },
  timeout: 60000  // 60秒
}
```
