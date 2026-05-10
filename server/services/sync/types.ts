export interface SyncMessage {
  id: string;
  userId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  syncStatus?: string;
  localOnly?: boolean;
  modelUsed?: string;
  metadata?: Record<string, unknown>;
}

export interface SyncConfig {
  userId: string;
  config: Record<string, unknown>;
  timestamp: number;
}

export interface SyncState {
  userId: string;
  state: Record<string, unknown>;
  timestamp: number;
}

export interface SyncResult<T> {
  success: boolean;
  data?: T;
  conflict?: {
    localData: T;
    serverData: T;
    localTimestamp: number;
    serverTimestamp: number;
  };
  error?: string;
}
