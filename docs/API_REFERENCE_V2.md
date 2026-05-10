# 小智AI助手 API 参考文档 v2.0

---

## 概述

小智AI助手是一个企业级AI助手系统，提供跨设备智能服务能力。

### 技术架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   移动端    │     │   桌面端    │     │   Web端     │
│  (Capacitor)│     │ (Electron)  │     │   (Vite)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Express   │
                    │   Server   │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
│  AI Agent   │     │  Coze API   │     │  Database   │
│ (Cross-Device)│    │ (Workflow) │     │ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 认证方式

### 请求头

| 头信息 | 必需 | 说明 |
|--------|------|------|
| `Content-Type` | 是 | `application/json` |
| `X-Device-Id` | 部分 | 设备唯一标识 |
| `X-Role` | 部分 | `MASTER` 或 `GUEST` |

### 认证端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录（密钥校验 + 会话） |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/session` | 当前会话信息 |
| POST | `/api/auth/ws-token` | 签发 WebSocket Token |

---

## 统一响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-04-19T00:00:00Z",
    "requestId": "req_abcdef123456"
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "E1002",
    "message": "资源未找到"
  }
}
```

---

## Coze AI API `/api/coze`

扣子(Coze) AI平台集成服务，提供文档处理、翻译、摘要、AI对话等功能。

### 配置管理

#### 检查配置状态

```
GET /api/coze/status
```

**响应示例：**

```json
{
  "success": true,
  "configured": true,
  "workflowsConfigured": 6
}
```

#### 获取配置详情

```
GET /api/coze/config
```

**响应示例：**

```json
{
  "success": true,
  "configured": true,
  "workflowsConfigured": 6,
  "message": "扣子API已配置"
}
```

#### 更新配置

```
POST /api/coze/config
```

**请求体：**

```json
{
  "apiKey": "your-api-key",
  "workflowId": "workflow-id",
  "workflows": {
    "format": "workflow-id-for-format",
    "polish": "workflow-id-for-polish"
  }
}
```

### 工作流管理

#### 获取工作流列表

```
GET /api/coze/workflows
```

**响应示例：**

```json
{
  "success": true,
  "workflows": [
    {
      "id": "doc_format",
      "name": "文档排版",
      "description": "自动格式化文档",
      "category": "document",
      "parameters": {
        "content": { "type": "string", "required": true }
      }
    }
  ]
}
```

#### 按分类获取工作流

```
GET /api/coze/workflows/category/:category
```

**分类选项：** `document`, `business`, `code`, `image`, `analysis`

#### 执行工作流

```
POST /api/coze/workflow/:workflowId
```

**请求体：**

```json
{
  "parameters": {
    "content": "要处理的内容",
    "style": "formal"
  }
}
```

### AI 对话

#### 发送消息

```
POST /api/coze/chat
```

**请求体：**

```json
{
  "message": "你好，请帮我翻译这段话",
  "context": "可选的上下文信息"
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "response": "好的，这是翻译结果..."
  }
}
```

---

## PC Agent API `/api/pc-agent`

电脑端智能助手，执行文件整理、文档生成、系统优化、编程辅助等任务。

### 能力查询

#### 获取能力列表

```
GET /api/pc-agent/capabilities
```

**响应示例：**

```json
{
  "success": true,
  "capabilities": {
    "fileOrganize": [
      "scan_desktop",
      "organize_downloads",
      "group_by_type",
      "group_by_date",
      "create_archive",
      "clean_duplicates",
      "find_project"
    ],
    "documentGenerate": true,
    "systemOptimize": true,
    "programmingAssist": true,
    "programmingLanguages": [
      "javascript", "typescript", "python", "java",
      "cpp", "csharp", "go", "rust", "ruby"
    ]
  }
}
```

### 任务执行

#### 执行任务

```
POST /api/pc-agent/execute
```

**请求体：**

```json
{
  "type": "file_organize",
  "description": "整理桌面文件",
  "params": {
    "source": "desktop",
    "target": "organized"
  }
}
```

**任务类型：**

| 类型 | 说明 |
|------|------|
| `file_organize` | 文件整理 |
| `document_generate` | 文档生成 |
| `system_optimize` | 系统优化 |
| `programming_assist` | 编程辅助 |

**响应示例：**

```json
{
  "success": true,
  "taskId": "task_123",
  "message": "桌面文件整理完成",
  "result": {
    "processed": 25,
    "moved": 20,
    "errors": 0
  }
}
```

#### 获取执行状态

```
GET /api/pc-agent/status
```

---

## 知识库 API `/api/knowledge`

程序能力知识库与学习系统。

### 程序查询

#### 获取程序列表

```
GET /api/knowledge/programs
```

**响应示例：**

```json
{
  "success": true,
  "programs": [
    {
      "id": "wechat",
      "name": "微信",
      "packageNames": {
        "windows": "Tencent WeChat",
        "mac": "com.tencent.xinWeChat",
        "linux": "electronic-wechat"
      },
      "capabilities": ["send_message", "video_call", "file_transfer"],
      "category": "communication"
    }
  ],
  "total": 35
}
```

#### 搜索程序

```
GET /api/knowledge/search?q=微信
```

#### 按分类获取

```
GET /api/knowledge/category/:name
```

**分类：** `communication`, `browser`, `development`, `media`, `office`, `system`, `utilities`, `gaming`, `other`

### 意图匹配

#### 匹配操作意图

```
GET /api/knowledge/intent?q=发消息
```

**响应示例：**

```json
{
  "success": true,
  "matches": [
    {
      "programId": "wechat",
      "programName": "微信",
      "operation": "send_message",
      "confidence": 0.95
    },
    {
      "programId": "qq",
      "programName": "QQ",
      "operation": "send_message",
      "confidence": 0.85
    }
  ]
}
```

### 学习系统

#### 记录学习数据

```
POST /api/knowledge/learn
```

**请求体：**

```json
{
  "programId": "wechat",
  "operation": "send_message",
  "success": true,
  "duration": 1500,
  "context": "发送给张三"
}
```

#### 获取学习统计

```
GET /api/knowledge/stats
```

### 程序发现

#### 自动发现程序

```
POST /api/knowledge/discover
```

**请求体：**

```json
{
  "platform": "windows",
  "query": "截图软件"
}
```

---

## 用户设置 API `/api/user-settings`

用户偏好设置管理。

### 获取设置

```
GET /api/user-settings/:userId
```

**用户ID选项：** `master`, `guest`

### 更新设置

```
PATCH /api/user-settings/master
```

**请求体：**

```json
{
  "avatarName": "小智",
  "voiceEnabled": "true",
  "voiceSpeed": 1.0,
  "cozeEnabled": "true",
  "cozeApiKey": "your-api-key"
}
```

**Coze 配置字段：**

| 字段 | 说明 |
|------|------|
| `cozeEnabled` | 启用Coze AI |
| `cozeApiKey` | API密钥 |
| `cozeBotId` | Bot ID |
| `cozeWorkflowId` | 默认工作流ID |
| `cozeWorkflowDocFormat` | 文档格式化工作流 |
| `cozeWorkflowDocPolish` | 文章润色工作流 |
| `cozeWorkflowDocTranslate` | 翻译工作流 |
| `cozeWorkflowDocSummarize` | 摘要工作流 |
| `cozeWorkflowPpt` | PPT生成工作流 |
| `cozeWorkflowReport` | 报告生成工作流 |
| `cozeWorkflowCodeReview` | 代码审查工作流 |

---

## 远程控制 API `/api/remote`

跨设备控制能力。

### 设备管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/remote/devices` | 获取设备列表 |
| GET | `/api/remote/devices/:id` | 获取设备详情 |
| POST | `/api/remote/devices/:id/heartbeat` | 设备心跳 |

### 设备控制

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/remote/devices/:id/screenshot` | 获取截图 |
| POST | `/api/remote/devices/:id/control` | 发送控制指令 |
| GET | `/api/remote/devices/:id/status` | 获取设备状态 |

### WebSocket

```
ws://host/ws/remote-control
```

---

## 任务编排 API `/api/tasks`

后台任务管理。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 获取任务列表 |
| GET | `/api/tasks/:id` | 获取任务详情 |
| POST | `/api/tasks` | 创建任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |

---

## WebSocket 端点

| 路径 | 说明 |
|------|------|
| `/ws/z3` | Z3分身核心：用户列表、聊天、状态同步 |
| `/ws/asr` | 语音识别流（阿里云ASR） |
| `/ws/realtime-voice` | 实时语音会话 |
| `/ws/remote-control` | 远程控制通道 |

---

## 错误码

| 范围 | 类别 | 示例 |
|------|------|------|
| E1xxx | 通用错误 | E1000-内部错误, E1001-验证失败, E1002-未找到 |
| E2xxx | AI服务错误 | E2000-服务不可用, E2001-配额超限 |
| E3xxx | 业务错误 | E3001-运势未生成, E3002-支付失败 |
| E4xxx | 认证授权 | E4001-未认证, E4002-权限不足 |
| E5xxx | 外部服务 | E5001-微信支付回调错误 |

---

*文档版本: 2.0*
*最后更新: 2026-04-19*
