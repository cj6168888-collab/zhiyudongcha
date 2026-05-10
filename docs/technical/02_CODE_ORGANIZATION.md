# 代码组织规范

## 目录职责

```text
client/src/pages       页面级入口
client/src/components  可复用 UI 组件
client/src/hooks       前端 hooks
client/src/lib         前端工具、API 客户端、状态桥接
server/routes          HTTP 路由
server/services        业务服务、AI 编排、工具执行
server/repositories    数据访问
server/middleware      认证、授权、安全、错误处理
server/lib             基础设施工具
shared                 前后端共享类型和 schema
docs/technical         技术规范
```

## 新功能放置规则

### 页面

新页面只负责：

- 布局。
- 用户输入。
- 展示 API 数据。
- 触发动作。
- 展示确认和反馈。

页面不写复杂业务规则。

### 组件

组件应可复用，尽量无业务副作用。

业务型组件可以存在，但应通过 props 或 hooks 与服务交互，不直接硬编码流程。

### hooks

hooks 用于：

- API 调用封装。
- UI 状态。
- 订阅实时事件。
- 轻量组合逻辑。

hooks 不应承担后端业务规则。

### routes

每个 route 应包含：

- zod schema。
- 权限检查。
- 风险声明。
- 服务调用。
- 统一响应。
- 必要审计。

### services

复杂能力都进入服务层。

示例：

- `conversation-understanding`
- `memory`
- `model-router`
- `tool-registry`
- `execution-engine`
- `identity-awakening`
- `voice-router`
- `swarm-governance`

### shared

以下内容应进入 `shared/`：

- API DTO。
- 枚举。
- 数据 schema。
- 权限类型。
- 任务状态。
- 对话结构化输出类型。

## 禁止模式

1. 禁止在 React 页面直接写模型调用。
2. 禁止在前端硬编码敏感权限判断。
3. 禁止在路由里塞完整业务编排。
4. 禁止每个功能各自定义一套 API 响应格式。
5. 禁止重复创建同义枚举。
6. 禁止无审计地执行外部影响动作。
7. 禁止新增乱码中文注释或非 UTF-8 文件。

## 推荐命名

| 类型 | 规范 | 示例 |
| --- | --- | --- |
| 文件 | kebab-case 或现有局部风格 | `conversation-understanding.ts` |
| React 组件 | PascalCase | `IdentityAwakening.tsx` |
| service 类 | PascalCase + Service/Engine | `ExecutionEngine` |
| route 文件 | kebab-case | `identity-awakening.ts` |
| 类型 | PascalCase | `ConversationMode` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_TOKEN_BUDGET` |

## 迁移策略

旧代码不要求一次性重构。新功能必须按本规范写；旧功能在触及时逐步迁移。
