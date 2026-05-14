import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer } from 'ws';
import type { ServerOptions } from 'ws';

const HANDLED_UPGRADE = Symbol.for('navigator.websocket.handledUpgrade');

type UpgradeSocket = Duplex & {
  [HANDLED_UPGRADE]?: boolean;
};

type PathWebSocketOptions = Omit<ServerOptions, 'server' | 'port' | 'path' | 'noServer'>;

export function createPathWebSocketServer(
  server: Server,
  path: string,
  options: PathWebSocketOptions = {}
): WebSocketServer {
  const wss = new WebSocketServer({ ...options, noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const upgradeSocket = socket as UpgradeSocket;
    if (upgradeSocket[HANDLED_UPGRADE]) {
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname !== path) {
      return;
    }

    upgradeSocket[HANDLED_UPGRADE] = true;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  return wss;
}
