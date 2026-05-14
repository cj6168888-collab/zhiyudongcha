import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'http';
import { WebSocket } from 'ws';
import { createPathWebSocketServer } from '../../../lib/websocket-path';

const openServers: Server[] = [];
const openClients: WebSocket[] = [];

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Unable to allocate test port');
      }
      resolve(address.port);
    });
  });
}

function readFirstMessage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    openClients.push(ws);
    ws.once('message', (message) => resolve(message.toString()));
    ws.once('error', reject);
  });
}

afterEach(async () => {
  for (const client of openClients.splice(0)) {
    client.close();
  }

  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

describe('createPathWebSocketServer', () => {
  it('routes upgrade requests to the matching WebSocket path only', async () => {
    const httpServer = createServer();
    openServers.push(httpServer);

    const z3 = createPathWebSocketServer(httpServer, '/ws/z3');
    const voice = createPathWebSocketServer(httpServer, '/ws/realtime-voice');
    let z3Connections = 0;
    let voiceConnections = 0;

    z3.on('connection', (ws, request) => {
      z3Connections += 1;
      ws.send(`z3:${request.url}`);
    });
    voice.on('connection', (ws, request) => {
      voiceConnections += 1;
      ws.send(`voice:${request.url}`);
    });

    const port = await listen(httpServer);

    await expect(readFirstMessage(`ws://127.0.0.1:${port}/ws/z3?token=abc`)).resolves.toBe(
      'z3:/ws/z3?token=abc'
    );
    await expect(readFirstMessage(`ws://127.0.0.1:${port}/ws/realtime-voice`)).resolves.toBe(
      'voice:/ws/realtime-voice'
    );

    expect(z3Connections).toBe(1);
    expect(voiceConnections).toBe(1);
  });
});
