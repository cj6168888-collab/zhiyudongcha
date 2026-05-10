# 小智AI助手 - 开发者指南

## 📋 目录

- [项目概述](#项目概述)
- [快速开始](#快速开始)
- [架构设计](#架构设计)
- [开发环境](#开发环境)
- [API文档](#api文档)
- [测试指南](#测试指南)
- [部署指南](#部署指南)
- [贡献指南](#贡献指南)
- [故障排除](#故障排除)

## 项目概述

小智AI助手是一个基于Node.js和TypeScript构建的智能对话系统，支持多种AI服务提供商，具备实时语音交互、项目管理和生活助手等功能。

### 核心特性

- 🤖 **多AI服务支持**: 支持通义千问、DeepSeek、豆包等AI服务
- 🎤 **实时语音交互**: 支持语音识别和语音合成
- 📱 **多端同步**: 支持Web、移动端和桌面端
- 🛠️ **项目管理**: 内置任务管理、项目跟踪功能
- 🔒 **安全可靠**: 完善的认证授权和数据保护
- 📊 **性能监控**: 内置性能监控和健康检查

### 技术栈

- **后端**: Node.js + TypeScript + Express
- **数据库**: PostgreSQL + Drizzle ORM
- **前端**: React + TypeScript + Vite
- **实时通信**: WebSocket
- **测试**: Vitest + Playwright
- **部署**: Docker + Docker Compose

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 13
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-org/xiaozhi-assistant.git
   cd xiaozhi-assistant
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑.env文件，配置数据库连接和API密钥
   ```

4. **初始化数据库**
   ```bash
   npm run db:push
   ```

5. **启动开发服务器**
   ```bash
   npm run dev
   ```

6. **访问应用**
   - 前端: http://localhost:5173
   - 后端API: http://localhost:5000
   - API文档: http://localhost:5000/docs

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────┐
│                 小智架构                       │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐         │
│  │    前端     │    │   移动端    │         │
│  │  React+TS   │    │ React Native│         │
│  └─────┬───────┘    └─────┬───────┘         │
│        │                  │                 │
│        └────────┬─────────┘                 │
│                 ▼                           │
│  ┌─────────────────────────────────────┐     │
│  │           API Gateway              │     │
│  │      (Express + TypeScript)      │     │
│  └─────────────┬───────────────────┘     │
│                ▼                           │
│  ┌─────────────────────────────────────┐     │
│  │        Service Layer              │     │
│  │   ┌─────────────┐ ┌───────────┐   │     │
│  │   │ AI Service  │ │User Service│   │     │
│  │   │Project Svc  │ │File Service│   │     │
│  │   └─────────────┘ └───────────┘   │     │
│  └─────────────┬─────────────────────┘     │
│                ▼                           │
│  ┌─────────────────────────────────────┐     │
│  │        Data Layer                 │     │
│  │   ┌─────────────┐ ┌───────────┐   │     │
│  │   │ PostgreSQL  │ │    Redis   │   │     │
│  │   │   (主数据)   │ │   (缓存)    │   │     │
│  │   └─────────────┘ └───────────┘   │     │
│  └─────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 目录结构

```
xiaozhi-assistant/
├── client/                 # 前端代码
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── pages/         # 页面组件
│   │   ├── hooks/         # 自定义Hook
│   │   ├── services/      # API服务
│   │   └── utils/         # 工具函数
│   ├── public/            # 静态资源
│   └── package.json
├── server/                # 后端代码
│   ├── services/          # 业务服务
│   ├── routes/            # API路由
│   ├── middleware/        # 中间件
│   ├── lib/               # 工具库
│   ├── types/             # 类型定义
│   └── index.ts           # 入口文件
├── shared/                # 共享代码
│   ├── schema.ts          # 数据库Schema
│   └── types.ts           # 共享类型
├── tests/                 # 测试文件
├── docs/                  # 文档
└── scripts/               # 脚本文件
```

## 开发环境

### 环境变量配置

创建`.env`文件并配置以下变量：

```env
# 应用配置
NODE_ENV=development
PORT=5000

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/xiaozhi

# 会话安全
SESSION_SECRET=your-32-character-secret-key

# AI服务配置
DASHSCOPE_API_KEY=your-dashscope-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
DOUBAO_API_KEY=your-doubao-api-key

# 本地AI配置
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_ENDPOINT=http://localhost:11434
LOCAL_MODEL_NAME=qwen:7b
```

### 开发工具

#### ESLint配置

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

#### Prettier配置

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 调试配置

#### VSCode调试配置

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "tsx/cjs"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

## API文档

### 认证

大部分API需要认证，使用Bearer Token或Session：

```bash
# Bearer Token认证
curl -H "Authorization: Bearer your-token" https://api.example.com/users

# Session认证
curl -c cookies.txt https://api.example.com/login
curl -b cookies.txt https://api.example.com/users
```

### 核心端点

#### 用户管理

```bash
# 登录
POST /api/auth/login
Content-Type: application/json
{
  "email": "user@example.com",
  "password": "password"
}

# 获取用户信息
GET /api/users/profile
Authorization: Bearer token

# 更新用户信息
PUT /api/users/profile
Authorization: Bearer token
Content-Type: application/json
{
  "name": "New Name",
  "avatar": "https://example.com/avatar.jpg"
}
```

#### AI对话

```bash
# 发送消息
POST /api/conversation/chat
Authorization: Bearer token
Content-Type: application/json
{
  "message": "你好，小智",
  "provider": "dashscope",
  "model": "qwen-plus"
}

# 获取对话历史
GET /api/conversation/history?page=1&limit=20
Authorization: Bearer token
```

#### 项目管理

```bash
# 创建项目
POST /api/projects
Authorization: Bearer token
Content-Type: application/json
{
  "name": "新项目",
  "description": "项目描述",
  "priority": "high"
}

# 获取项目列表
GET /api/projects?page=1&limit=20&status=active
Authorization: Bearer token
```

### 响应格式

所有API响应遵循统一格式：

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 测试指南

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch

# 运行集成测试
npm run test:integration

# 运行E2E测试
npm run test:e2e
```

### 测试结构

```
tests/
├── unit/                  # 单元测试
│   ├── services/          # 服务测试
│   ├── utils/             # 工具函数测试
│   └── types/             # 类型测试
├── integration/           # 集成测试
│   ├── api/               # API集成测试
│   └── database/         # 数据库集成测试
├── e2e/                  # 端到端测试
│   ├── auth/              # 认证流程测试
│   └── conversation/      # 对话流程测试
└── fixtures/             # 测试数据
```

### 编写测试

#### 单元测试示例

```typescript
import { describe, it, expect, vi } from 'vitest';
import { UserService } from '../user.service';

describe('UserService', () => {
  it('should create user', async () => {
    const userService = new UserService();
    const userData = { name: 'Test', email: 'test@example.com' };
    
    const result = await userService.create(userData);
    
    expect(result).toHaveProperty('id');
    expect(result.name).toBe(userData.name);
  });
});
```

#### API测试示例

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('POST /api/users', () => {
  it('should create user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test', email: 'test@example.com' })
      .expect(201);
      
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Test');
  });
});
```

## 部署指南

### Docker部署

1. **构建镜像**
   ```bash
   docker build -t xiaozhi-assistant .
   ```

2. **运行容器**
   ```bash
   docker run -p 5000:5000 --env-file .env xiaozhi-assistant
   ```

### Docker Compose部署

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/xiaozhi
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=xiaozhi
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### 环境配置

#### 生产环境变量

```env
NODE_ENV=production
PORT=5000
SESSION_SECRET=production-secret-key
DATABASE_URL=postgresql://user:password@db:5432/xiaozhi
REDIS_URL=redis://redis:6379
LOG_LEVEL=info
```

#### 健康检查

```bash
# 检查应用健康状态
curl http://localhost:5000/api/health

# 检查就绪状态
curl http://localhost:5000/api/health/ready
```

## 贡献指南

### 开发流程

1. **Fork项目**
2. **创建功能分支**
   ```bash
   git checkout -b feature/new-feature
   ```

3. **开发功能**
4. **添加测试**
5. **运行测试**
   ```bash
   npm run test
   npm run lint
   ```

6. **提交代码**
   ```bash
   git commit -m "feat: add new feature"
   ```

7. **推送分支**
   ```bash
   git push origin feature/new-feature
   ```

8. **创建Pull Request**

### 代码规范

#### 提交信息规范

使用Conventional Commits格式：

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式化
refactor: 代码重构
test: 测试相关
chore: 构建工具或辅助工具的变动
```

#### 代码风格

- 使用TypeScript严格模式
- 遵循ESLint规则
- 使用Prettier格式化代码
- 函数和类必须有注释
- 添加类型注解

### Pull Request模板

```markdown
## 变更描述
简要描述这个PR的变更内容。

## 变更类型
- [ ] Bug修复
- [ ] 新功能
- [ ] 代码重构
- [ ] 文档更新
- [ ] 其他

## 测试
- [ ] 单元测试已添加
- [ ] 集成测试已通过
- [ ] 手动测试已完成

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 没有破坏性变更或已记录
```

## 故障排除

### 常见问题

#### 数据库连接问题

```bash
# 检查数据库连接
npm run db:check

# 重置数据库
npm run db:reset
```

#### 依赖问题

```bash
# 清理依赖
rm -rf node_modules package-lock.json
npm install

# 更新依赖
npm run update:deps
```

#### 性能问题

```bash
# 运行性能分析
npm run perf:analyze

# 检查内存使用
npm run memory:check
```

### 日志调试

```bash
# 查看应用日志
docker logs xiaozhi-assistant

# 查看特定模块日志
docker logs xiaozhi-assistant 2>&1 | grep "UserService"
```

### 监控指标

- **响应时间**: API响应时间应小于200ms
- **错误率**: 错误率应低于1%
- **内存使用**: 堆内存使用应不超过80%
- **CPU使用**: CPU使用率应低于70%

### 联系支持

- **GitHub Issues**: [项目Issues](https://github.com/your-org/xiaozhi-assistant/issues)
- **文档**: [项目文档](https://docs.xiaozhi.ai)
- **社区**: [开发者社区](https://community.xiaozhi.ai)

---

**小智AI助手** - 让AI触手可及 🚀