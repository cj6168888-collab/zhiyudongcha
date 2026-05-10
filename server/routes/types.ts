import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Types');

import type { Express, Request, Response } from "express";
import type { Server } from "http";
import type { WebSocket } from "ws";
import type { IStorage } from "../storage";

export interface ConnectedUser {
  ws: WebSocket;
  userId: string;
  username: string;
  deviceId?: string;
  role: 'MASTER' | 'GUEST';
  deviceType: string;
  connectedAt: number;
  lastActivity: number;
}

export interface RouteContext {
  z3Clients: Set<WebSocket>;
  connectedUsers: Map<WebSocket, ConnectedUser>;
  chatHistories: Map<string, import("../services/dashscope").ChatMessage[]>;
  broadcastUserList: () => void;
  broadcastDataChange: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
}

export type RegisterRouteFn = (
  app: Express,
  storage: IStorage,
  context: RouteContext
) => void;
