import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ChatConfig,
  ChatMessage,
} from '../lib/chat/types';
import { DEFAULT_CHAT_CONFIG as LIB_DEFAULT_CONFIG } from '../lib/chat/types';
import { useAIEngine } from './use-ai-engine';
import { useNativeTTS } from './use-native-tts';
import { useActionPlugin } from './use-action-plugin';
import { createServiceLogger } from '../lib/logger';
import type { AIMode } from '../plugins/definitions';

const log = createServiceLogger('useChat');
const STORAGE_KEY = 'xiaozhi_chat_config';

interface UseChatOptions {
  userId: string;
  sessionId: string;
  initialConfig?: Partial<ChatConfig>;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  networkStatus: 'ONLINE' | 'OFFLINE' | 'UNSTABLE';
  config: ChatConfig;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
  updateConfig: (config: Partial<ChatConfig>) => void;
  suggestedModels: string[];
  lastResponseTier: 1 | 2 | 3;
  engineMode: AIMode;
  ttsAvailable: boolean;
}

interface ConversationAPIResponse {
  success: boolean;
  response: string;
  action?: string;
  entity?: string;
  toolsCalled?: string[];
  thinking?: string;
  model?: string;
}

async function callConversationAPI(
  message: string,
  _history: { role: string; content: string }[]
): Promise<ConversationAPIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('/api/conversation/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, useHistory: true }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

async function simulateChatResponse(
  userMessage: string,
  _history: ChatMessage[],
  config: ChatConfig,
  networkStatus: 'ONLINE' | 'OFFLINE' | 'UNSTABLE'
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 500));

  const isCodeRequest    = /\b(code|function|class|def|import)\b/i.test(userMessage);
  const isAnalysisRequest = /\b(分析|比较|评估|研究)\b/i.test(userMessage);
  const isCreativeRequest = /\b(写诗|创作|故事|小说)\b/i.test(userMessage);

  if (isCodeRequest) {
    return `\`\`\`javascript
// 示例代码
function greet(name) {
  return \`你好, \${name}!\`;
}
\`\`\`

这是一个简单的 JavaScript 函数示例。如果您有具体的编程需求，请告诉我更多细节。`;
  }

  if (isAnalysisRequest) {
    return `分析结果：

基于您的问题，我进行了以下分析：

1. **核心问题识别**
   - 主要诉求：理解用户意图
   - 关键约束：需要进一步明确

2. **建议方案**
   - 方案A：提供更多信息以便精准分析
   - 方案B：参考类似场景的处理方式

3. **注意事项**
   - 建议补充具体的背景信息
   - 考虑实际应用场景的限制

如需更深入的分析，请提供更多上下文信息。`;
  }

  if (isCreativeRequest) {
    return `**春日漫步**

春风拂面柳丝长，
燕子归来衔泥忙。
桃花笑迎踏青客，
一盏清茶话夕阳。

希望这首诗能给您带来一些春天的气息！如果您有其他主题的创作需求，随时告诉我。`;
  }

  const greetingResponses = [
    '你好！我是小星，很高兴为你服务。有什么我可以帮助你的吗？',
    '嗨！今天有什么想聊的吗？我随时在这里帮助你。',
    '你好呀！有什么问题尽管问，我会尽力帮你解答。',
  ];

  const randomGreeting = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];

  return `${randomGreeting}

当前配置：
- 模式：${config.mode}
- 主要模型：${config.primaryModel}
- 网络状态：${networkStatus}

我可以帮你：
💬 回答问题
📝 写作辅助
💻 代码编写
🔍 分析研究
🎨 创意创作`;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { userId, sessionId, initialConfig, onMessage, onError } = options;

  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'ONLINE' | 'OFFLINE' | 'UNSTABLE'>('ONLINE');
  const [lastResponseTier, setLastResponseTier] = useState<1 | 2 | 3>(3);
  const [config, setConfig] = useState<ChatConfig>(() => ({
    ...LIB_DEFAULT_CONFIG,
    ...initialConfig,
  }));

  const suggestedModelsRef = useRef<string[]>([]);

  const { processQuery, engineMode } = useAIEngine();
  const { speak, isAvailable: ttsAvailable } = useNativeTTS();
  const { detectAndExecute } = useActionPlugin();

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch {
        log.warn('Failed to load saved chat config', { userId });
      }
    }
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(config));
  }, [config, userId]);

  useEffect(() => {
    const handleOnline  = () => setNetworkStatus('ONLINE');
    const handleOffline = () => setNetworkStatus('OFFLINE');

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkNetwork = async () => {
      if (!navigator.onLine) { setNetworkStatus('OFFLINE'); return; }

      try {
        const start      = Date.now();
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 5000);

        await fetch('/api/health', { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);

        setNetworkStatus(Date.now() - start > 3000 ? 'UNSTABLE' : 'ONLINE');
      } catch {
        setNetworkStatus(navigator.onLine ? 'UNSTABLE' : 'OFFLINE');
      }
    };

    const interval = setInterval(checkNetwork, 30000);
    checkNetwork();

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);

    try {
      const userMsg: ChatMessage = {
        id:          `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        role:        'user',
        content:     content.trim(),
        timestamp:   Date.now(),
        syncStatus:  networkStatus === 'OFFLINE' ? 'PENDING' : 'SYNCING',
        localOnly:   false,
      };

      setMessages(prev => [...prev, userMsg]);

      let response: string;
      let modelUsed = config.primaryModel;
      let responseTier: 1 | 2 | 3 = 3;

      // ── 设备动作意图（拨号/日历/邮件）优先于 AI ──────────────────────────
      const actionResult = await detectAndExecute(content.trim());
      if (actionResult.handled) {
        response     = actionResult.response;
        modelUsed    = `action-${actionResult.action ?? 'device'}`;
        responseTier = 1;
      } else {
        // ── Tier 1/2: 原生设备推理（LAN 或本地 GGUF）──────────────────────
        const engineResult = await processQuery(content.trim());
        if (engineResult.text) {
          response     = engineResult.text;
          modelUsed    = `local-${engineResult.tierName}`;
          responseTier = engineResult.tier;
          log.info('Answered by AIEngine', { tier: engineResult.tier, tierName: engineResult.tierName });
        } else if (networkStatus === 'OFFLINE') {
          // ── 离线且无本地模型：降级到静态回复 ──────────────────────────────
          response     = await simulateChatResponse(content.trim(), messages, config, networkStatus);
          modelUsed    = 'local-offline';
          responseTier = 3;
        } else {
          // ── Tier 3/4: 后端 HybridAssistant ────────────────────────────────
          try {
            const apiResponse = await callConversationAPI(
              content.trim(),
              messages.map(m => ({ role: m.role, content: m.content }))
            );
            response     = apiResponse.response;
            modelUsed    = apiResponse.model || config.primaryModel;
            responseTier = 3;
          } catch (apiError) {
            log.warn('Backend API failed, falling back to local simulate', { error: apiError });
            response     = await simulateChatResponse(content.trim(), messages, config, networkStatus);
            modelUsed    = 'fallback-local';
            responseTier = 3;
          }
        }
      }

      setLastResponseTier(responseTier);

      const assistantMsg: ChatMessage = {
        id:         `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        role:       'assistant',
        content:    response,
        timestamp:  Date.now(),
        syncStatus: networkStatus === 'OFFLINE' ? 'PENDING' : 'SYNCING',
        localOnly:  networkStatus === 'OFFLINE',
        modelUsed,
      };

      setMessages(prev => [...prev, assistantMsg]);
      onMessage?.(assistantMsg);

      // ── 原生 TTS 播报（fire-and-forget） ─────────────────────────────────
      if (ttsAvailable) {
        speak(response).catch((err) => log.warn('TTS speak failed', { err }));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, config, networkStatus, processQuery, speak, ttsAvailable, onMessage, onError]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(`chat_history_${sessionId}`);
  }, [sessionId]);

  const updateConfig = useCallback((newConfig: Partial<ChatConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return {
    messages,
    isLoading,
    networkStatus,
    config,
    sendMessage,
    clearHistory,
    updateConfig,
    suggestedModels: suggestedModelsRef.current,
    lastResponseTier,
    engineMode,
    ttsAvailable,
  };
}
