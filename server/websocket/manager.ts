import { WebSocketServer, WebSocket, type Data } from 'ws';
import { IncomingMessage } from 'http';
import { createServiceLogger } from '../lib/logger';
import { sessionMiddleware } from '../index';
import { validateWsToken } from '../routes/auth';
import { handleASRConnection } from '../services/alibaba-asr';
import type { ChatMessage } from '../services/dashscope';
import type { ConnectedUser, WebSocketContext, WebSocketManager } from './types';

const logger = createServiceLogger('WebSocketManager');

export class WebSocketManagerImpl implements WebSocketManager {
  public context: WebSocketContext;

  private z3Clients: Set<WebSocket>;
  private connectedUsers: Map<WebSocket, ConnectedUser>;
  private chatHistories: Map<string, ChatMessage[]>;
  private broadcastUserList: () => void;
  private broadcastDataChange: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;

  private wss?: WebSocketServer;
  private asrWss?: WebSocketServer;

  constructor() {
    this.z3Clients = new Set();
    this.connectedUsers = new Map();
    this.chatHistories = new Map();

    this.broadcastUserList = () => {
      const userList = Array.from(this.connectedUsers.values()).map(u => ({
        userId: u.userId,
        username: u.username,
        role: u.role,
        deviceType: u.deviceType,
        connectedAt: u.connectedAt,
      }));

      const message = JSON.stringify({
        type: 'USER_LIST_UPDATE',
        users: userList,
        count: userList.length,
        timestamp: Date.now(),
      });

      this.z3Clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    };

    this.broadcastDataChange = (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => {
      const message = JSON.stringify({
        type: 'DATA_CHANGE',
        entity,
        action,
        data,
        timestamp: Date.now(),
      });

      this.z3Clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    };

    this.context = {
      z3Clients: this.z3Clients,
      connectedUsers: this.connectedUsers,
      chatHistories: this.chatHistories,
      broadcastUserList: this.broadcastUserList,
      broadcastDataChange: this.broadcastDataChange,
    };
  }

  initialize(httpServer: import('http').Server): void {
    this.setupWebSocketServers(httpServer);
  }

  private setupWebSocketServers(httpServer: import('http').Server): void {
    this.wss = new WebSocketServer({ noServer: true });
    const wsSessionMap = new WeakMap<WebSocket, { authenticated: boolean; role: 'MASTER' | 'GUEST'; sessionRole?: 'MASTER' | 'GUEST' }>();

    this.wss.on('connection', (ws, request: IncomingMessage & { session?: { userRole?: 'MASTER' | 'GUEST' }; wsAuthFromUrl?: 'MASTER' | null }) => {
      logger.info('[Z3] New WebSocket client connected');
      this.z3Clients.add(ws);

      const sessionRole = request.session?.userRole;
      const urlAuthRole = request.wsAuthFromUrl;
      const effectiveRole = urlAuthRole || sessionRole;
      const isAuthenticated = effectiveRole === 'MASTER';
      wsSessionMap.set(ws, { authenticated: isAuthenticated, role: isAuthenticated ? 'MASTER' : 'GUEST', sessionRole: effectiveRole });
      logger.info({ sessionRole, urlAuth: urlAuthRole, authenticated: isAuthenticated }, '[Z3] Session verified');

      ws.on('message', (message) => {
        this.handleZ3Message(ws, message, wsSessionMap);
      });

      ws.on('close', () => {
        this.handleZ3Close(ws, wsSessionMap);
      });

      ws.on('error', (error) => {
        this.handleZ3Error(ws, error, wsSessionMap);
      });

      ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Z3 Spirit Core WebSocket active',
        timestamp: Date.now(),
        onlineCount: this.z3Clients.size,
      }));
    });

    this.asrWss = new WebSocketServer({ noServer: true });
    this.asrWss.on('connection', (ws) => {
      logger.info('[ASR] New WebSocket client connected');
      handleASRConnection(ws);
    });

    httpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '/', `http://${request.headers.host}`);
      const pathname = url.pathname;

      const tokenParam = url.searchParams.get('token');
      const tokenRole = tokenParam ? validateWsToken(tokenParam) : null;

      (request as unknown as { wsAuthFromUrl: 'MASTER' | 'GUEST' | null }).wsAuthFromUrl = tokenRole;

      const mockRes = {
        setHeader: () => mockRes,
        end: () => {},
      };

      sessionMiddleware(request as Parameters<typeof sessionMiddleware>[0], mockRes as Parameters<typeof sessionMiddleware>[1], () => {
        if (pathname === '/ws/z3') {
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            this.wss!.emit('connection', ws, request);
          });
        } else if (pathname === '/ws/asr') {
          this.asrWss!.handleUpgrade(request, socket, head, (ws) => {
            this.asrWss!.emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      });
    });

    logger.info('WebSocket servers initialized');
  }

  private handleZ3Message(ws: WebSocket, message: Data, wsSessionMap: WeakMap<WebSocket, { authenticated: boolean; role: 'MASTER' | 'GUEST'; sessionRole?: 'MASTER' | 'GUEST' }>): void {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'USER_JOIN') {
        const wsSession = wsSessionMap.get(ws);
        const verifiedRole = (wsSession?.authenticated && wsSession?.sessionRole === 'MASTER' && data.role === 'MASTER') ? 'MASTER' : 'GUEST';

        const user: ConnectedUser = {
          ws,
          userId: data.userId || `user_${Date.now()}`,
          username: data.username || '匿名用户',
          deviceId: data.deviceId,
          role: verifiedRole,
          deviceType: data.deviceType || 'unknown',
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        };
        this.connectedUsers.set(ws, user);
        wsSessionMap.set(ws, { authenticated: wsSession?.authenticated || false, role: verifiedRole, sessionRole: wsSession?.sessionRole });
        logger.info({ username: user.username, role: user.role, sessionVerified: wsSession?.sessionRole }, '[Z3] User joined');

        this.z3Clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'USER_JOINED',
              user: { userId: user.userId, username: user.username, role: user.role, deviceType: user.deviceType },
              timestamp: Date.now(),
            }));
          }
        });

        this.broadcastUserList();
        return;
      }

      const currentUser = this.connectedUsers.get(ws);
      if (currentUser) {
        currentUser.lastActivity = Date.now();
      }

      const wsSession = wsSessionMap.get(ws);
      const isMasterVerified = wsSession?.sessionRole === 'MASTER' && wsSession?.authenticated;

      const MASTER_ONLY_ACTIONS = ['SYNC_STATE', 'VISUAL_EFFECT', 'GHOSTING_INIT'];
      if (MASTER_ONLY_ACTIONS.includes(data.type) && !isMasterVerified) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          error: 'UNAUTHORIZED',
          message: '此操作需要MASTER权限',
          requestedAction: data.type,
          timestamp: Date.now(),
        }));
        logger.warn({ action: data.type }, '[Z3] Rejected action from unauthenticated client');
        return;
      }

      if (data.type === 'SYNC_STATE' || data.type === 'VISUAL_EFFECT') {
        this.z3Clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify(data));
          }
        });
      }

      if (data.type === 'GHOSTING_INIT') {
        this.z3Clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'GHOSTING_EVENT',
              from: data.from,
              to: data.to,
              timestamp: Date.now(),
            }));
          }
        });
      }

      if (data.type === 'CHAT_MESSAGE') {
        const sender = this.connectedUsers.get(ws);
        this.z3Clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'CHAT_MESSAGE',
              userId: sender?.userId,
              username: sender?.username,
              message: data.message,
              timestamp: Date.now(),
            }));
          }
        });
      }
    } catch (e) {
      logger.error({ err: e }, '[Z3] WebSocket message error');
    }
  }

  private handleZ3Close(ws: WebSocket, wsSessionMap: WeakMap<WebSocket, { authenticated: boolean; role: 'MASTER' | 'GUEST'; sessionRole?: 'MASTER' | 'GUEST' }>): void {
    const user = this.connectedUsers.get(ws);
    if (user) {
      logger.info({ username: user.username }, '[Z3] User left');
      this.z3Clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'USER_LEFT',
            userId: user.userId,
            username: user.username,
            timestamp: Date.now(),
          }));
        }
      });
      this.connectedUsers.delete(ws);
    }
    this.z3Clients.delete(ws);
    wsSessionMap.delete(ws);
    this.broadcastUserList();
  }

  private handleZ3Error(ws: WebSocket, error: Error, wsSessionMap: WeakMap<WebSocket, { authenticated: boolean; role: 'MASTER' | 'GUEST'; sessionRole?: 'MASTER' | 'GUEST' }>): void {
    logger.error({ err: error }, '[Z3] WebSocket error');
    const user = this.connectedUsers.get(ws);
    if (user) {
      this.connectedUsers.delete(ws);
    }
    this.z3Clients.delete(ws);
    wsSessionMap.delete(ws);
    this.broadcastUserList();
  }

  broadcast(eventType: string, data: Record<string, unknown>): void {
    const message = JSON.stringify({ type: eventType, ...data, timestamp: Date.now() });
    this.z3Clients.forEach(client => {
      if (client.readyState === 1) client.send(message);
    });
  }

  validateWsToken(token: string): 'MASTER' | 'GUEST' | null {
    return validateWsToken(token);
  }
}

export const webSocketManager = new WebSocketManagerImpl();
