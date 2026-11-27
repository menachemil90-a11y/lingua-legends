/** Matchmaking queues and private rooms. */
import { randomInt } from 'node:crypto';
import { currentSeason, matchmakingWindow, newRatingState, randomCode, type Bracket, type OnlineModeId } from '@lingua/shared';
import type { Hub } from './hub';
import type { MatchManager } from './matches';
import type { ServerStore } from './store/types';

interface QueueEntry {
  playerId: string;
  mode: OnlineModeId;
  queue: 'ranked' | 'casual';
  bracket: Bracket;
  rating: number;
  joinedAt: number;
}

const cryptoRandom = () => randomInt(0, 2 ** 31) / 2 ** 31;

export class Matchmaker {
  private entries = new Map<string, QueueEntry>();
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly hub: Hub,
    private readonly matches: MatchManager,
    private readonly store: ServerStore,
    tickMs = 1000,
  ) {
    this.timer = setInterval(() => void this.tick(), tickMs);
  }

  async join(playerId: string, mode: OnlineModeId, queue: 'ranked' | 'casual', bracket: Bracket): Promise<void> {
    const st = (await this.store.getRating(playerId, mode, bracket, currentSeason().id)) ?? newRatingState();
    this.entries.set(playerId, { playerId, mode, queue, bracket, rating: st.rating, joinedAt: Date.now() });
    this.sendState(playerId);
  }

  leave(playerId: string): void {
    if (this.entries.delete(playerId)) this.hub.send(playerId, { type: 'QUEUE_STATE', status: 'idle' });
  }

  has(playerId: string): boolean {
    return this.entries.has(playerId);
  }

  private keyOf(e: QueueEntry): string {
    return `${e.mode}:${e.queue}:${e.bracket}`;
  }

  private sendState(playerId: string): void {
    const e = this.entries.get(playerId);
    if (!e) return;
    const searching = [...this.entries.values()].filter((x) => this.keyOf(x) === this.keyOf(e)).length;
    this.hub.send(playerId, { type: 'QUEUE_STATE', status: 'searching', mode: e.mode, queue: e.queue, bracket: e.bracket, elapsedMs: Date.now() - e.joinedAt, searching });
  }

  async tick(): Promise<void> {
    const now = Date.now();
    // Drop offline players.
    for (const id of [...this.entries.keys()]) if (!this.hub.isOnline(id)) this.entries.delete(id);
    const groups = new Map<string, QueueEntry[]>();
    for (const e of this.entries.values()) {
      const k = this.keyOf(e);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.joinedAt - b.joinedAt);
      const used = new Set<string>();
      for (const a of list) {
        if (used.has(a.playerId)) continue;
        let best: QueueEntry | null = null;
        for (const b of list) {
          if (b === a || used.has(b.playerId)) continue;
          const window = matchmakingWindow(now - Math.max(a.joinedAt, b.joinedAt), a.queue === 'ranked');
          const diff = Math.abs(a.rating - b.rating);
          if (diff > window) continue;
          if (await this.store.isBlockedEitherWay(a.playerId, b.playerId)) continue;
          if (!best || diff < Math.abs(a.rating - best.rating)) best = b;
        }
        if (best) {
          used.add(a.playerId);
          used.add(best.playerId);
          this.entries.delete(a.playerId);
          this.entries.delete(best.playerId);
          await this.matches.create({ playerIds: [a.playerId, best.playerId], mode: a.mode, queue: a.queue, bracket: a.bracket });
        }
      }
    }
    for (const id of this.entries.keys()) this.sendState(id);
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}

interface Room {
  code: string;
  mode: OnlineModeId;
  bracket: Bracket;
  hostId: string;
  members: string[];
  status: 'open' | 'in-match' | 'closed';
  expiresAt: number;
}

export function roomCapacity(mode: OnlineModeId): number {
  return mode === 'grammar-race' || mode === 'english-conquest' ? 4 : 2;
}

export class Rooms {
  private rooms = new Map<string, Room>();
  private byPlayer = new Map<string, string>();
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly hub: Hub,
    private readonly matches: MatchManager,
    private readonly store: ServerStore,
    private readonly ttlMs: number,
  ) {
    this.timer = setInterval(() => this.sweep(), 30_000);
  }

  create(playerId: string, mode: OnlineModeId, bracket: Bracket): Room {
    this.leave(playerId);
    let code = randomCode(6, cryptoRandom);
    while (this.rooms.has(code)) code = randomCode(6, cryptoRandom);
    const room: Room = { code, mode, bracket, hostId: playerId, members: [playerId], status: 'open', expiresAt: Date.now() + this.ttlMs };
    this.rooms.set(code, room);
    this.byPlayer.set(playerId, code);
    this.broadcast(room);
    return room;
  }

  async join(playerId: string, code: string): Promise<string | null> {
    const room = this.rooms.get(code);
    if (!room || room.status === 'closed' || room.expiresAt < Date.now()) return 'ROOM_NOT_FOUND';
    if (room.members.includes(playerId)) {
      this.broadcast(room);
      return null;
    }
    if (room.members.length >= roomCapacity(room.mode) || room.status !== 'open') return 'ROOM_FULL';
    if (await this.store.isBlockedEitherWay(playerId, room.hostId)) return 'ROOM_NOT_FOUND';
    this.leave(playerId);
    room.members.push(playerId);
    this.byPlayer.set(playerId, code);
    this.broadcast(room);
    if (room.members.length >= roomCapacity(room.mode)) await this.launch(room);
    return null;
  }

  /** Host may start once at least two players are present. */
  async start(playerId: string): Promise<string | null> {
    const code = this.byPlayer.get(playerId);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) return 'ROOM_NOT_FOUND';
    if (room.hostId !== playerId) return 'FORBIDDEN';
    if (room.members.length < 2) return 'INVALID_STATE';
    await this.launch(room);
    return null;
  }

  private async launch(room: Room): Promise<void> {
    if (room.status !== 'open') return;
    room.status = 'in-match';
    this.broadcast(room);
    const members = room.members.slice();
    this.close(room);
    await this.matches.create({ playerIds: members, mode: room.mode, queue: 'private', bracket: room.bracket });
  }

  leave(playerId: string): void {
    const code = this.byPlayer.get(playerId);
    if (!code) return;
    this.byPlayer.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return;
    room.members = room.members.filter((m) => m !== playerId);
    this.hub.send(playerId, this.state(room, 'closed'));
    if (room.members.length === 0 || room.hostId === playerId) this.close(room);
    else this.broadcast(room);
  }

  private close(room: Room): void {
    room.status = 'closed';
    for (const m of room.members) this.byPlayer.delete(m);
    this.rooms.delete(room.code);
  }

  private state(room: Room, status = room.status) {
    return {
      type: 'ROOM_STATE' as const,
      code: room.code,
      mode: room.mode,
      bracket: room.bracket,
      hostId: room.hostId,
      members: room.members.map((m) => this.hub.publicPlayer(m)),
      status,
      capacity: roomCapacity(room.mode),
      expiresAt: room.expiresAt,
    };
  }

  private broadcast(room: Room): void {
    for (const m of room.members) this.hub.send(m, this.state(room));
  }

  private sweep(): void {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (room.expiresAt < now) {
        for (const m of room.members) this.hub.send(m, this.state(room, 'closed'));
        this.close(room);
      }
    }
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}
