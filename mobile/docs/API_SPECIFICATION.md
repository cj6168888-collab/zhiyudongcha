# 小智移动端 API 规范

## 概述

本文档定义了小智原生移动应用（iOS/Android）与后端服务器之间的通信协议。

## 服务器配置

```
生产环境: https://your-domain.replit.app
开发环境: http://localhost:5000
WebSocket: wss://your-domain.replit.app/ws/mobile
```

## 认证机制

### 请求头
```
X-User-Role: MASTER | GUEST
X-Device-Id: <设备唯一标识>
X-App-Version: 1.0.0
X-Platform: iOS | Android
Authorization: Bearer <JWT_TOKEN>  (可选，用于高级功能)
```

---

## RESTful API 端点

### 1. 健康检查

#### GET /api/health/live
检查服务器存活状态
```json
// Response
{ "status": "alive", "timestamp": "2026-01-28T00:00:00Z" }
```

#### GET /api/health/ready
检查服务就绪状态
```json
// Response
{
  "status": "ready",
  "database": true,
  "ai_provider": "dashscope",
  "services": ["voice", "tts", "rag", "function_call"]
}
```

---

### 2. 智能对话 API

#### POST /api/conversation/chat
文本对话接口（支持 Function Calling）

```json
// Request
{
  "message": "帮我创建一个联系人张三，他是华为的AI总监",
  "sessionId": "optional-session-id",
  "context": {
    "location": "北京",
    "time": "2026-01-28T10:00:00Z"
  }
}

// Response
{
  "reply": "好的爸爸，我已经帮您创建了联系人张三。",
  "sessionId": "session-xxx",
  "toolCalls": [
    {
      "tool": "create_contact",
      "args": { "name": "张三", "company": "华为", "title": "AI总监" },
      "result": { "id": "person-xxx", "success": true }
    }
  ],
  "intent": "create_contact",
  "confidence": 0.95
}
```

#### POST /api/conversation/voice
语音对话接口（音频直传）

```json
// Request (multipart/form-data)
{
  "audio": <binary-audio-data>,
  "format": "wav",
  "sampleRate": 16000,
  "sessionId": "optional-session-id"
}

// Response
{
  "transcript": "帮我查一下明天的日程",
  "reply": "爸爸，您明天有3个日程安排...",
  "replyAudioUrl": "/api/tts/stream/xxx",
  "sessionId": "session-xxx"
}
```

---

### 3. 语音服务 API

#### POST /api/tts/synthesize
文本转语音

```json
// Request
{
  "text": "爸爸好，我是小智",
  "voice": "longhuhu_v3",
  "speed": 1.0,
  "pitch": 1.0
}

// Response
{
  "audioUrl": "/api/tts/audio/xxx.mp3",
  "duration": 2.5,
  "format": "mp3"
}
```

#### GET /api/tts/stream/:id
流式获取音频（支持边生成边播放）

---

### 4. 智语洞察 API

#### POST /api/talk-sessions
创建谈话会话

```json
// Request
{
  "type": "MEETING",
  "deviceId": "iphone-xxx"
}

// Response
{
  "id": "session-xxx",
  "status": "LISTENING",
  "startedAt": "2026-01-28T10:00:00Z"
}
```

#### POST /api/talk-sessions/:id/transcript
添加实时转录文本

```json
// Request
{
  "text": "张三说他们公司正在招人",
  "timestamp": "2026-01-28T10:05:00Z",
  "speaker": "OTHER",
  "confidence": 0.92
}

// Response
{ "success": true, "transcriptId": "trans-xxx" }
```

#### POST /api/talk-sessions/:id/analyze
分析谈话内容

```json
// Request
{
  "text": "完整的谈话文本..."
}

// Response
{
  "talkType": "NEGOTIATION",
  "entities": [
    { "type": "PERSON", "name": "张三", "company": "华为", "title": "总监" }
  ],
  "opportunities": [
    { "type": "BUSINESS", "description": "华为AI项目合作机会", "priority": "HIGH" }
  ],
  "sentiment": "POSITIVE",
  "keyPoints": ["招聘需求", "项目预算一亿", "Q2启动"]
}
```

---

### 5. 人脉管理 API

#### GET /api/persons
获取联系人列表

```json
// Query: ?search=张&category=BUSINESS&limit=20&offset=0

// Response
{
  "items": [
    {
      "id": "person-xxx",
      "name": "张三",
      "company": "华为",
      "title": "AI总监",
      "relationship": "BUSINESS",
      "intimacyScore": 75,
      "lastContactAt": "2026-01-27T15:00:00Z"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

#### POST /api/persons
创建联系人

```json
// Request
{
  "name": "张三",
  "phone": "13800138000",
  "email": "zhangsan@huawei.com",
  "company": "华为",
  "title": "AI总监",
  "category": "BUSINESS",
  "notes": "在AI大会上认识"
}

// Response
{
  "id": "person-xxx",
  "name": "张三",
  "createdAt": "2026-01-28T10:00:00Z"
}
```

---

### 6. 项目管理 API

#### GET /api/projects
获取项目列表

#### POST /api/projects
创建项目

#### GET /api/projects/:id/milestones
获取项目里程碑

---

### 7. 日程提醒 API

#### GET /api/calendar/events
获取日程事件

```json
// Query: ?start=2026-01-28&end=2026-01-31

// Response
{
  "events": [
    {
      "id": "event-xxx",
      "title": "与张三会面",
      "startTime": "2026-01-29T14:00:00Z",
      "endTime": "2026-01-29T15:00:00Z",
      "location": "华为总部",
      "reminder": 30
    }
  ]
}
```

#### POST /api/reminders
创建智能提醒

---

### 8. 设备同步 API

#### POST /api/offline/sync
离线数据同步

```json
// Request
{
  "deviceId": "iphone-xxx",
  "lastSyncAt": "2026-01-27T00:00:00Z",
  "changes": [
    { "entity": "persons", "action": "create", "data": {...} }
  ]
}

// Response
{
  "serverChanges": [...],
  "conflicts": [],
  "syncedAt": "2026-01-28T10:00:00Z"
}
```

---

## WebSocket 协议

### 连接地址
```
wss://your-domain.replit.app/ws/mobile
```

### 连接参数
```
?deviceId=xxx&role=MASTER&platform=iOS
```

### 消息格式

#### 客户端 → 服务器

```json
// 心跳
{ "type": "ping" }

// 语音数据流
{
  "type": "audio_chunk",
  "data": "<base64-encoded-audio>",
  "sequence": 1,
  "final": false
}

// 开始语音识别
{
  "type": "asr_start",
  "format": "pcm",
  "sampleRate": 16000
}

// 停止语音识别
{ "type": "asr_stop" }

// 订阅事件
{
  "type": "subscribe",
  "channels": ["reminders", "notifications", "sync"]
}
```

#### 服务器 → 客户端

```json
// 心跳响应
{ "type": "pong" }

// 实时转录结果
{
  "type": "asr_result",
  "text": "帮我查一下明天的日程",
  "isFinal": true,
  "confidence": 0.95
}

// 中间转录结果
{
  "type": "asr_interim",
  "text": "帮我查一下..."
}

// 提醒通知
{
  "type": "reminder",
  "data": {
    "id": "reminder-xxx",
    "title": "会议提醒",
    "body": "10分钟后与张三会面"
  }
}

// AI回复流
{
  "type": "ai_reply_chunk",
  "text": "爸爸，",
  "isFinal": false
}

// 数据同步通知
{
  "type": "sync_required",
  "entities": ["persons", "projects"]
}
```

---

## 错误处理

### 错误响应格式
```json
{
  "error": "错误描述",
  "code": "ERROR_CODE",
  "details": {}
}
```

### 错误码
| 代码 | 说明 |
|------|------|
| AUTH_REQUIRED | 需要认证 |
| PERMISSION_DENIED | 权限不足（GUEST访问MASTER功能） |
| INVALID_REQUEST | 请求参数错误 |
| NOT_FOUND | 资源不存在 |
| AI_SERVICE_ERROR | AI服务异常 |
| RATE_LIMITED | 请求频率超限 |

---

## 推送通知

### APNs (iOS)
```json
{
  "aps": {
    "alert": {
      "title": "小智提醒",
      "body": "爸爸，10分钟后您有一个会议"
    },
    "sound": "xiaozhi_notify.wav",
    "badge": 1
  },
  "data": {
    "type": "reminder",
    "id": "reminder-xxx"
  }
}
```

### FCM (Android)
```json
{
  "notification": {
    "title": "小智提醒",
    "body": "爸爸，10分钟后您有一个会议"
  },
  "data": {
    "type": "reminder",
    "id": "reminder-xxx"
  }
}
```

---

## 9. 语音指挥官 API

小智语音指挥官采用**规则优先 + AI智能推理**双引擎架构：
- 规则引擎：毫秒级响应，处理明确指令
- AI推理：复杂/模糊指令自动调用云端AI分析

#### POST /api/voice/command
自然语言指令执行（核心接口）

```json
// Request
{
  "text": "帮我创建一个联系人张三",
  "userId": "user-xxx",
  "useAI": true  // 可选，默认true，是否启用AI推理
}

// Response - 成功执行
{
  "success": true,
  "message": "好的爸爸，已创建联系人张三",
  "action": "create",
  "navigateTo": "/contacts",
  "data": { "id": "person-xxx", "name": "张三" },
  "continueListen": true,
  "aiUsed": false,  // 是否使用了AI推理
  "parsed": {
    "understood": true,
    "confidence": 0.95,  // 理解置信度
    "action": "create",
    "module": "人脉中心",
    "target": "张三"
  }
}

// Response - 导航类
{
  "success": true,
  "message": "好的爸爸，正在打开蜂群控制台",
  "action": "navigate",
  "navigateTo": "/swarm-console",
  "continueListen": true,
  "aiUsed": false,
  "parsed": {
    "understood": true,
    "confidence": 0.92,
    "action": "navigate",
    "module": "蜂群控制台"
  }
}

// Response - AI推理触发（置信度<0.7时自动调用）
{
  "success": true,
  "message": "该指令涉及天气查询，当前系统无天气服务模块",
  "continueListen": true,
  "aiUsed": true,
  "parsed": {
    "understood": false,
    "confidence": 0
  }
}

// Response - 需要确认
{
  "success": true,
  "message": "确定要删除联系人张三吗？",
  "requiresConfirm": true,
  "confirmMessage": "这个操作无法撤销哦",
  "continueListen": true
}
```

#### GET /api/voice/modules
获取所有可用功能模块

```json
// Response
{
  "modules": [
    {
      "id": "swarm",
      "name": "蜂群控制台",
      "aliases": ["分身管理", "分身", "蜂群"],
      "operations": ["navigate", "list", "create"],
      "route": "/swarm-console"
    },
    {
      "id": "insight",
      "name": "智语洞察",
      "aliases": ["监听", "洞察", "会议监听"],
      "operations": ["navigate", "start", "stop"],
      "route": "/insight"
    }
    // ... 更多模块
  ]
}
```

#### POST /api/voice/navigate
快速导航（仅导航功能）

```json
// Request
{ "target": "swarm" }

// Response
{
  "success": true,
  "route": "/swarm-console",
  "moduleName": "蜂群控制台"
}
```

### 支持的操作类型
| 操作 | 关键词 | 说明 |
|------|--------|------|
| navigate | 打开、去、进入、跳转、看看 | 页面导航 |
| create | 创建、新建、添加、记录 | 创建资源 |
| list | 查看、列出、显示、看下 | 查看列表 |
| search | 搜索、查找、找、查询 | 搜索资源 |
| delete | 删除、移除、取消 | 删除资源（需确认） |
| generate | 生成、总结、归纳 | 生成内容 |
| start | 开始、启动、运行 | 启动任务 |
| stop | 停止、结束、暂停 | 停止任务 |
| remind | 提醒、通知、记得 | 设置提醒 |
| analyze | 分析、评估、检查 | 分析数据 |

### 支持的功能模块（15+）
| 模块 | 别名 | 路由 |
|------|------|------|
| 人脉中心 | 联系人、通讯录、人脉 | /contacts |
| 项目中心 | 项目、工程、任务 | /projects |
| 智语洞察 | 会议监听、谈话监听、洞察 | /insight |
| 蜂群控制台 | 分身管理、蜂群、分身 | /swarm-console |
| 合同管理 | 合同、协议、契约 | /contracts |
| 日程安排 | 日历、日程、安排 | /calendar |
| 健康管理 | 健康、体检、身体 | /health |
| 财务管理 | 财务、账单、费用 | /finance |
| 秘境金库 | 金库、保险箱、机密 | /vault |
| 数据溯源 | 数据血缘、数据流 | /data-lineage |
| 战报中心 | 战报、日报、简报 | /battle-report |
| 邮件管理 | 邮件、邮箱、信件 | /email |
| 知识库 | 知识、文档、资料 | /knowledge |
| 系统设置 | 设置、配置、偏好 | /settings |
| 帮助中心 | 帮助、教程、使用说明 | /help |

### AI推理触发条件
当规则引擎置信度 < 0.7 时自动触发AI推理：
- 支持 DashScope / DeepSeek / DouBao 三provider链式降级
- 温度参数 0.3 确保稳定一致
- 8秒超时防止阻塞

---

## 本地小模型接口

### 模型要求
- iOS: Core ML 格式 (.mlmodel)
- Android: TensorFlow Lite 格式 (.tflite)

### 推荐模型
1. **意图识别**: 轻量级 BERT（<50MB）
2. **关键词提取**: 本地 NER 模型
3. **语音唤醒**: 小型唤醒词模型

### 本地优先策略
```
1. 语音唤醒词检测 → 本地
2. 简单指令识别 → 本地小模型
3. 复杂对话理解 → 云端大模型
4. 实体提取 → 混合（本地初筛 + 云端精确）
```

---

## 安全要求

1. **传输安全**: 所有通信使用 HTTPS/WSS
2. **设备认证**: 首次连接需要设备绑定
3. **敏感数据**: 本地存储需加密（Keychain/EncryptedSharedPreferences）
4. **生物认证**: 支持 Face ID / 指纹解锁
