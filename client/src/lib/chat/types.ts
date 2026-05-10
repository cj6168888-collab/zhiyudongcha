export type ModelMode = 'SINGLE' | 'ENSEMBLE' | 'AUTO';

export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'UNSTABLE';

export type ModelType = 'local' | 'cloud' | 'ensemble';

export type TaskType = 'CHAT' | 'CODE' | 'ANALYSIS' | 'VISION' | 'CREATIVE';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  syncStatus: SyncStatus;
  localOnly: boolean;
  modelUsed?: string;
  error?: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  contextLength?: number;
  temperature?: number;
  tokensUsed?: number;
  latencyMs?: number;
  provider?: string;
}

export interface ChatConfig {
  mode: ModelMode;
  primaryModel: string;
  fallbackModels: string[];
  preferOffline: boolean;
  privacyMode: boolean;
  maxContextLength: number;
  temperature: number;
  maxTokens: number;
}

export interface ChatEngineOptions {
  userId: string;
  sessionId: string;
  config?: Partial<ChatConfig>;
}

export interface FallbackResult {
  success: boolean;
  content: string;
  provider: 'LOCAL' | 'CLOUD' | 'FALLBACK_CACHE' | 'ENSEMBLE';
  latencyMs: number;
  error?: string;
}

export interface FallbackConfig {
  preferLocal: boolean;
  privacyMode: boolean;
  cloudTimeout: number;
  localRetries: number;
  cacheOfflineResponses: boolean;
  maxCacheSize: number;
}

export interface QueuedMessage {
  id: string;
  type: 'CHAT' | 'SYNC' | 'CONFIG' | 'FEEDBACK' | 'ARTIFACT';
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  metadata?: Record<string, unknown>;
}

export interface SelectedModel {
  type: ModelType;
  name: string;
  confidence: number;
  reason: string;
}

export interface ModelCapability {
  type: 'local' | 'cloud';
  maxTokens: number;
  contextLength: number;
  strengths: TaskType[];
  weaknesses: TaskType[];
  speed: 'slow' | 'medium' | 'fast';
  quality: 'low' | 'medium' | 'high';
  offlineCapable: boolean;
  apiEndpoint?: string;
  apiKeyRequired?: boolean;
}

export interface SyncItem {
  id: string;
  type: 'MESSAGE' | 'CONFIG' | 'STATE' | 'ARTIFACT';
  localData: any;
  serverData?: any;
  timestamp: number;
  conflictResolution: 'LOCAL_WINS' | 'SERVER_WINS' | 'MERGE' | 'ASK_USER';
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

export interface SyncConflict {
  localData: any;
  serverData: any;
  localTimestamp: number;
  serverTimestamp: number;
  resolution?: 'LOCAL' | 'SERVER' | 'MERGE';
  mergedData?: any;
}

export interface LocalModelInfo {
  name: string;
  size: string;
  downloadUrl: string;
  sha256: string;
  quantization: string;
  description?: string;
}

export const SUPPORTED_LOCAL_MODELS: LocalModelInfo[] = [
  {
    name: 'Qwen2.5-3B-Instruct-Q4_K_M',
    size: '1.9GB',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    sha256: 'a94a27b7d8c8d7c6e7f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3',
    quantization: 'Q4_K_M',
    description: '通义千问2.5 3B - 平衡性能与质量',
  },
  {
    name: 'Phi-3-mini-4k-instruct-Q4_K_M',
    size: '2.2GB',
    downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    sha256: 'b5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
    quantization: 'Q4_K_M',
    description: '微软 Phi-3 Mini - 轻量高效',
  },
  {
    name: 'Llama-3-8B-Instruct-Q4_K_M',
    size: '4.1GB',
    downloadUrl: 'https://huggingface.co/meta-llama/Llama-3-8B-Instruct-GGUF/resolve/main/llama-3-8b-instruct-q4_k_m.gguf',
    sha256: 'c6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
    quantization: 'Q4_K_M',
    description: 'Meta Llama 3 8B - 通用能力强',
  },
];

export const DEFAULT_CHAT_CONFIG: Readonly<ChatConfig> = {
  mode: 'AUTO',
  primaryModel: 'qwen-max',
  fallbackModels: ['deepseek-chat', 'local-ollama'],
  preferOffline: false,
  privacyMode: false,
  maxContextLength: 4096,
  temperature: 0.7,
  maxTokens: 2048,
} as const;

export const DEFAULT_FALLBACK_CONFIG: Readonly<FallbackConfig> = {
  preferLocal: false,
  privacyMode: false,
  cloudTimeout: 30000,
  localRetries: 2,
  cacheOfflineResponses: true,
  maxCacheSize: 50,
} as const;
