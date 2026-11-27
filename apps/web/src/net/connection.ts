/**
 * WebSocket client for the authoritative multiplayer server.
 * Handles authentication, reconnection with backoff, idempotent message ids,
 * clock-offset estimation and shared social state (queue, room, friends, invites).
 */
import { create } from 'zustand';
import {
  PROTOCOL_VERSION,
  serverMessageSchema,
  type ClientIntent,
  type ServerMessage,
  type ServerMessageOf,
} from '@lingua/shared';
import { useSettings } from '../state/settings';
import { usePlayer } from '../state/player';
import { uid } from '../state/storage';
import { getAuthToken, invalidateGuestToken } from './api';

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unavailable';

interface ConnState {
  status: ConnStatus;
  playerId: string | null;
  friendCode: string | null;
  accountKind: 'guest' | 'registered' | null;
  latencyMs: number | null;
  offsetMs: number;
  lastError: string | null;
  queue: ServerMessageOf<'QUEUE_STATE'> | null;
  room: ServerMessageOf<'ROOM_STATE'> | null;
  tournament: ServerMessageOf<'TOURNAMENT_STATE'> | null;
  friends: ServerMessageOf<'FRIENDS_STATE'> | null;
  invites: ServerMessageOf<'INVITE'>[];
  pendingMatch: ServerMessageOf<'MATCH_FOUND'> | null;
  readyIds: string[];
}

export const useConnection = create<ConnState>(() => ({
  status: 'idle',
  playerId: null,
  friendCode: null,
  accountKind: null,
  latencyMs: null,
  offsetMs: 0,
  lastError: null,
  queue: null,
  room: null,
  tournament: null,
  friends: null,
  invites: [],
  pendingMatch: null,
  readyIds: [],
}));

type Listener = (msg: ServerMessage) => void;

class Connection {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private attempts = 0;
  private wanted = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private outbox: string[] = [];
  private authed = false;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  isConnected(): boolean {
    return this.authed && this.ws?.readyState === WebSocket.OPEN;
  }

  wsUrl(): string {
    const base = useSettings.getState().serverUrl.replace(/\/$/, '');
    return base.replace(/^http/, 'ws') + '/ws';
  }

  /** Connects (idempotent). Resolves true once authenticated. */
  async connect(): Promise<boolean> {
    this.wanted = true;
    if (this.isConnected()) return true;
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return this.waitForAuth();
    useConnection.setState({ status: this.attempts > 0 ? 'reconnecting' : 'connecting', lastError: null });
    let token: string;
    try {
      token = await getAuthToken();
    } catch (e) {
      useConnection.setState({ status: 'unavailable', lastError: (e as Error).message });
      this.scheduleReconnect();
      return false;
    }
    try {
      this.ws = new WebSocket(this.wsUrl());
    } catch (e) {
      useConnection.setState({ status: 'unavailable', lastError: (e as Error).message });
      return false;
    }
    const ws = this.ws;
    ws.onopen = () => {
      const p = usePlayer.getState();
      ws.send(
        JSON.stringify({
          type: 'HELLO',
          msgId: uid('m'),
          token,
          protocol: PROTOCOL_VERSION,
          cosmetics: {
            characterId: p.loadout.characterId,
            vehicleId: p.loadout.vehicleId,
            titleId: p.loadout.titleId,
            frameId: p.loadout.frameId,
          },
        }),
      );
    };
    ws.onmessage = (ev) => this.onRaw(String(ev.data));
    ws.onclose = () => {
      const wasAuthed = this.authed;
      this.authed = false;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.ws === ws) this.ws = null;
      useConnection.setState({ status: this.wanted ? 'reconnecting' : 'idle' });
      if (this.wanted) this.scheduleReconnect(wasAuthed);
    };
    ws.onerror = () => {
      useConnection.setState({ lastError: 'network' });
    };
    return this.waitForAuth();
  }

  private waitForAuth(): Promise<boolean> {
    return new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (this.authed) return resolve(true);
        if (Date.now() - started > 6000 || (!this.ws && !this.wanted)) return resolve(false);
        if (!this.ws) return resolve(false);
        setTimeout(check, 80);
      };
      check();
    });
  }

  private scheduleReconnect(fast = false): void {
    if (this.reconnectTimer) return;
    this.attempts++;
    const delay = fast && this.attempts <= 2 ? 400 : Math.min(15000, 600 * 2 ** Math.min(this.attempts, 5));
    if (this.attempts > 3 && !fast) useConnection.setState({ status: 'unavailable' });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wanted) void this.connect();
    }, delay);
  }

  disconnect(): void {
    this.wanted = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.authed = false;
    useConnection.setState({ status: 'idle' });
  }

  send(intent: ClientIntent): string {
    const msgId = uid('m');
    const raw = JSON.stringify({ ...intent, msgId });
    if (this.isConnected()) this.ws!.send(raw);
    else if (intent.type === 'ANSWER_SUBMIT' || intent.type === 'READY') this.outbox.push(raw);
    return msgId;
  }

  serverNow(): number {
    return Date.now() + useConnection.getState().offsetMs;
  }

  private onRaw(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const res = serverMessageSchema.safeParse(parsed);
    if (!res.success) {
      console.warn('Ignoring malformed server message', res.error.issues[0]);
      return;
    }
    const msg = res.data;
    this.updateState(msg);
    for (const l of this.listeners) l(msg);
  }

  private updateState(msg: ServerMessage): void {
    switch (msg.type) {
      case 'WELCOME': {
        this.authed = true;
        this.attempts = 0;
        useConnection.setState({
          status: 'connected',
          playerId: msg.playerId,
          friendCode: msg.friendCode,
          accountKind: msg.accountKind,
          offsetMs: msg.serverTime - Date.now(),
          lastError: null,
        });
        const pending = this.outbox.splice(0);
        for (const raw of pending) this.ws?.send(raw);
        this.ping();
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.ping(), 10_000);
        this.send({ type: 'FRIENDS_LIST' });
        break;
      }
      case 'PONG': {
        const rtt = Date.now() - msg.clientTime;
        useConnection.setState({ latencyMs: rtt, offsetMs: msg.serverTime + rtt / 2 - Date.now() });
        break;
      }
      case 'QUEUE_STATE':
        useConnection.setState({ queue: msg.status === 'idle' ? null : msg });
        break;
      case 'ROOM_STATE':
        useConnection.setState({ room: msg.status === 'closed' ? null : msg });
        break;
      case 'TOURNAMENT_STATE':
        useConnection.setState({ tournament: msg.status === 'closed' ? null : msg });
        break;
      case 'FRIENDS_STATE':
        useConnection.setState({ friends: msg });
        break;
      case 'INVITE':
        useConnection.setState((s) => ({ invites: [...s.invites.filter((i) => i.inviteId !== msg.inviteId), msg] }));
        break;
      case 'MATCH_FOUND':
        useConnection.setState({ pendingMatch: msg, queue: null, readyIds: [] });
        break;
      case 'READY_STATE':
        useConnection.setState({ readyIds: msg.ready });
        break;
      case 'MATCH_CANCELLED':
        useConnection.setState((s) => (s.pendingMatch?.matchId === msg.matchId ? { pendingMatch: null } : {}));
        break;
      case 'ERROR':
        useConnection.setState({ lastError: `${msg.code}: ${msg.message}` });
        if (msg.code === 'UNAUTHENTICATED') invalidateGuestToken();
        if (msg.code === 'SESSION_REPLACED') this.wanted = false;
        break;
      default:
        break;
    }
  }

  private ping(): void {
    this.send({ type: 'PING', clientTime: Date.now() });
  }

  dismissInvite(inviteId: string): void {
    useConnection.setState((s) => ({ invites: s.invites.filter((i) => i.inviteId !== inviteId) }));
  }

  clearPendingMatch(): void {
    useConnection.setState({ pendingMatch: null, readyIds: [] });
  }
}

export const connection = new Connection();
