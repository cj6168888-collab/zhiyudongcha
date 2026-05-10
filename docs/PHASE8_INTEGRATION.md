# Phase 8 集成指南

本文档说明如何在项目中使用离线优先架构的各个组件。

## 目录

- [useChat Hook](#usechat-hook)
- [useSyncStatus Hook](#usesyncstatus-hook)
- [离线消息队列](#离线消息队列)
- [智能模型路由](#智能模型路由)
- [本地 LLM 集成](#本地-llm-集成)

---

## useChat Hook

### 基本用法

```tsx
import { useChat } from '@/hooks/use-chat';

function ChatComponent() {
  const {
    messages,
    isLoading,
    networkStatus,
    sendMessage,
    clearHistory,
  } = useChat({
    userId: 'user-123',
    sessionId: 'session-456',
    initialConfig: {
      mode: 'AUTO',
      primaryModel: 'deepseek-chat',
    },
    onMessage: (message) => {
      console.log('New message:', message);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  const handleSend = async () => {
    await sendMessage('Hello!');
  };

  return (
    <div>
      <p>Network: {networkStatus}</p>
      <button onClick={handleSend} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}
```

### API

| 属性 | 类型 | 说明 |
|------|------|------|
| `messages` | `ChatMessage[]` | 消息列表 |
| `isLoading` | `boolean` | 是否正在加载 |
| `networkStatus` | `'ONLINE' \| 'OFFLINE' \| 'UNSTABLE'` | 网络状态 |
| `sendMessage(content)` | `(string) => Promise<void>` | 发送消息 |
| `clearHistory()` | `() => void` | 清空历史 |
| `updateConfig(config)` | `(Partial<ChatConfig>) => void` | 更新配置 |
| `config` | `ChatConfig` | 当前配置 |
| `suggestedModels` | `string[]` | 推荐模型列表 |

---

## useSyncStatus Hook

### 基本用法

```tsx
import { useSyncStatus } from '@/hooks/use-sync-status';

function SyncIndicator() {
  const {
    isOnline,
    networkStatus,
    pendingSyncCount,
    lastSyncTime,
    refreshStatus,
    clearSyncStorage,
  } = useSyncStatus('user-123');

  return (
    <div>
      <p>Online: {isOnline ? 'Yes' : 'No'}</p>
      <p>Status: {networkStatus}</p>
      <p>Pending: {pendingSyncCount}</p>
      <p>Last Sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}</p>
      <button onClick={refreshStatus}>Refresh</button>
      <button onClick={clearSyncStorage}>Clear</button>
    </div>
  );
}
```

---

## 离线消息队列

### 使用 MessageQueue

```tsx
import { MessageQueue } from '@/lib/chat/message-queue';

const queue = new MessageQueue({
  userId: 'user-123',
  sessionId: 'session-456',
  storageKey: 'chat_messages',
  maxMessages: 1000,
  autoSync: true,
  syncInterval: 5000,
});

// 添加消息到队列
await queue.enqueue({
  id: 'msg-1',
  role: 'user',
  content: 'Hello!',
  timestamp: Date.now(),
});

// 获取所有消息
const messages = await queue.getAll();

// 获取待同步消息
const pending = await queue.getPending();

// 标记为同步中
await queue.markSyncing('msg-1');

// 标记为已同步
await queue.markSynced('msg-1');

// 标记为失败
await queue.markFailed('msg-1', 'Network error');

// 清空队列
await queue.clear();
```

---

## 智能模型路由

### 使用 ModelRouter

```tsx
import { ModelRouter } from '@/lib/chat/model-router';

const router = new ModelRouter({
  mode: 'AUTO',
  preferredProvider: 'deepseek',
  fallbackOrder: ['deepseek-chat', 'qwen-max', 'doubao-pro'],
  localFirst: false,
  timeout: 30000,
  maxRetries: 2,
});

// 选择最佳模型
const selectedModel = await router.selectModel({
  taskType: 'CHAT',
  priority: 'balanced',
  requiresVision: false,
  requiresTools: true,
  maxContextLength: 64000,
  preferredLanguage: 'zh',
});

console.log('Selected model:', selectedModel);

// 获取建议的模型
const suggestions = router.getSuggestedModels({
  taskType: 'CODE',
  priority: 'speed',
});

console.log('Suggested models:', suggestions);
```

### 运行模式

| 模式 | 说明 |
|------|------|
| `SINGLE` | 使用单一指定模型 |
| `ENSEMBLE` | 多模型并行，返回组合结果 |
| `AUTO` | 根据任务类型自动选择（默认） |

---

## 本地 LLM 集成

### 使用 LocalLLMIntegration

```tsx
import { LocalLLMIntegration } from '@/lib/chat/local-llm-integration';

const localLLM = new LocalLLMIntegration({
  providers: ['ollama', 'webllm'],
  defaultProvider: 'ollama',
  autoSwitch: true,
  maxOfflineAttempts: 3,
});

// 检查可用性
const isAvailable = await localLLM.checkAvailability();
console.log('Local LLM available:', isAvailable);

// 列出可用模型
const models = await localLLM.listModels();
console.log('Available models:', models);

// 执行推理
const response = await localLLM.infer({
  prompt: '你好！',
  model: 'llama3',
  temperature: 0.7,
  maxTokens: 1000,
});

console.log('Response:', response.text);
```

---

## 冲突解决

### 冲突解决策略

```tsx
import { SyncController, ConflictResolution } from '@/lib/sync/sync-controller';

const syncController = new SyncController({
  userId: 'user-123',
  conflictResolution: 'MERGE',
  autoSync: true,
  syncInterval: 10000,
  maxRetries: 3,
  onConflict: async (local, server) => {
    // 自定义冲突处理
    return await mergeData(local, server);
  },
});
```

### 策略选项

| 策略 | 说明 |
|------|------|
| `LOCAL_WINS` | 本地数据优先 |
| `SERVER_WINS` | 服务器数据优先 |
| `MERGE` | 自动合并 |
| `ASK_USER` | 让用户选择 |

---

## 配置示例

### 完整配置

```tsx
import { useChat } from '@/hooks/use-chat';

function MyChat() {
  const chat = useChat({
    userId: 'user-123',
    sessionId: 'session-456',
    initialConfig: {
      mode: 'AUTO',
      primaryModel: 'deepseek-chat',
      enableLocalFallback: true,
      autoSync: true,
      syncInterval: 5000,
      conflictResolution: 'MERGE',
    },
  });

  return <ChatView chat={chat} />;
}
```

---

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sync/messages` | POST | 同步消息 |
| `/api/sync/messages` | GET | 获取消息 |
| `/api/sync/config` | POST | 同步配置 |
| `/api/sync/config/:userId` | GET | 获取配置 |
| `/api/sync/state` | POST | 同步状态 |
| `/api/sync/state/:userId` | GET | 获取状态 |
| `/api/sync/status/:userId` | GET | 同步状态 |
| `/api/sync/clear` | POST | 清空存储 |

---

## 消息状态

| 状态 | 说明 |
|------|------|
| `PENDING` | 待同步 |
| `SYNCING` | 同步中 |
| `SYNCED` | 已同步 |
| `FAILED` | 同步失败 |

---

## 下一步

1. 在实际页面中集成 `ChatDemo` 组件
2. 配置真实的后端 API
3. 添加 LLM 提供商密钥
4. 测试离线功能
5. 配置 PostgreSQL 持久化
