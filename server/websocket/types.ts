import type { WebSocket } from 'ws';
import type { ChatMessage } from '../services/dashscope';
import type { ConnectedUser as RoutesConnectedUser } from '../routes/types';

export type ConnectedUser = RoutesConnectedUser;

export interface WebSocketContext {
  z3Clients: Set<WebSocket>;
  connectedUsers: Map<WebSocket, ConnectedUser>;
  chatHistories: Map<string, ChatMessage[]>;
  broadcastUserList: () => void;
  broadcastDataChange: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
}

export interface WebSocketManager {
  context: WebSocketContext;
  initialize: (httpServer: import('http').Server) => void;
  validateWsToken: (token: string) => 'MASTER' | 'GUEST' | null;
  broadcast(eventType: string, data: Record<string, unknown>): void;
}

// 标准事件类型（前端订阅时使用）
export type WsEventType =
  | 'CONNECTED'
  | 'USER_LIST_UPDATE'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'CHAT_MESSAGE'
  | 'DATA_CHANGE'
  | 'VISUAL_EFFECT'
  | 'GHOSTING_INIT'
  | 'GHOSTING_EVENT'
  | 'SYNC_STATE'
  | 'HP_UPDATED'
  | 'EVOLUTION_UPDATE'
  | 'alert';
