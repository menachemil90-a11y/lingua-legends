import WebSocket from 'ws';
import { randomBytes } from 'node:crypto';
import type { ClientIntent, ServerMessage } from '@lingua/shared';
import { loadConfig } from '../src/config';
import { startServer, type RunningServer } from '../src/app';
import { MemoryStore } from '../src/store/memoryStore';

export async function testServer(): Promise<RunningServer> {
  const cfg = loadConfig({ NODE_ENV: 'test', SERVER_SECRET: 'test-secret-'.padEnd(48, 'x'), ALLOWED_ORIGINS: 'http://localhost:5173', READY_TIMEOUT_MS: '4000', HOST: '127.0.0.1', MAX_CONNECTIONS_PER_IP: '200', GUEST_TOKENS_PER_MINUTE: '600' } as NodeJS.ProcessEnv);
  return startServer(cfg, new MemoryStore(null), 0);
}

export async function guestToken(port: number, nickname: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/guest`, { method: 'POST', body: JSON.stringify({ nickname }), headers: { 'content-type': 'application/json' } });
  const body = (await res.json()) as { token: string };
  return body.token;
}

export class TestClient {
  ws!: WebSocket;
  messages: ServerMessage[] = [];
  playerId = '';
  friendCode = '';
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];

  constructor(
    private readonly port: number,
    public readonly token: string,
  ) {}

  async connect(): Promise<this> {
    this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws`, { headers: { origin: 'http://localhost:5173' } });
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      this.messages.push(msg);
      for (const w of this.waiters.slice()) {
        if (w.pred(msg)) {
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.resolve(msg);
        }
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
    this.sendRaw({ type: 'HELLO', msgId: this.id(), token: this.token, protocol: 1, cosmetics: { characterId: 'kael', vehicleId: 'viper' } });
    const welcome = await Promise.race([
      this.waitFor('WELCOME'),
      this.waitFor('ERROR', (e) => e.code === 'UNAUTHENTICATED').then((e) => Promise.reject(new Error(e.message))),
    ]);
    this.playerId = welcome.playerId;
    this.friendCode = welcome.friendCode;
    return this;
  }

  id(): string {
    return randomBytes(9).toString('base64url');
  }

  send(intent: ClientIntent): string {
    const msgId = this.id();
    this.sendRaw({ ...intent, msgId });
    return msgId;
  }

  sendRaw(obj: unknown): void {
    this.ws.send(JSON.stringify(obj));
  }

  waitFor<T extends ServerMessage['type']>(type: T, pred: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true, timeoutMs = 8000): Promise<Extract<ServerMessage, { type: T }>> {
    const existing = this.messages.find((m) => m.type === type && pred(m as Extract<ServerMessage, { type: T }>));
    if (existing) {
      this.messages.splice(this.messages.indexOf(existing), 1);
      return Promise.resolve(existing as Extract<ServerMessage, { type: T }>);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
      this.waiters.push({
        pred: (m) => m.type === type && pred(m as Extract<ServerMessage, { type: T }>),
        resolve: (m) => {
          clearTimeout(timer);
          this.messages.splice(this.messages.indexOf(m), 1);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  drain(): void {
    this.messages = [];
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) return resolve();
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }
}
