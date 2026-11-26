/** In-memory store with an optional debounced JSON snapshot (local development only). */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Bracket, OnlineModeId, RatingState } from '@lingua/shared';
import type { FriendRequest, PlayerRecord, ReportRecord, ServerLearningEvent, ServerStore, StoredMatch } from './types';

interface Snapshot {
  players: Record<string, PlayerRecord>;
  ratings: Record<string, RatingState>;
  matches: StoredMatch[];
  requests: Record<string, FriendRequest>;
  friendships: string[];
  blocks: string[];
  reports: ReportRecord[];
  learning: ServerLearningEvent[];
}

const empty = (): Snapshot => ({ players: {}, ratings: {}, matches: [], requests: {}, friendships: [], blocks: [], reports: [], learning: [] });
const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class MemoryStore implements ServerStore {
  private s: Snapshot;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly file: string | null;

  constructor(dataDir: string | null) {
    this.file = dataDir ? join(dataDir, 'dev-store.json') : null;
    this.s = empty();
    if (this.file && existsSync(this.file)) {
      try {
        this.s = { ...empty(), ...(JSON.parse(readFileSync(this.file, 'utf8')) as Snapshot) };
      } catch (e) {
        console.warn('[store] could not read snapshot, starting empty', e);
      }
    }
    if (dataDir) mkdirSync(dataDir, { recursive: true });
  }

  private dirty(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 1000);
  }

  async flush(): Promise<void> {
    if (!this.file) return;
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.s));
    renameSync(tmp, this.file);
  }

  async getPlayer(id: string) {
    return this.s.players[id] ?? null;
  }
  async upsertPlayer(p: PlayerRecord) {
    this.s.players[p.id] = p;
    this.dirty();
  }
  async findByFriendCode(code: string) {
    return Object.values(this.s.players).find((p) => p.friendCode === code) ?? null;
  }

  private rk(playerId: string, mode: string, bracket: string, season: string) {
    return `${season}|${mode}|${bracket}|${playerId}`;
  }
  async getRating(playerId: string, mode: OnlineModeId, bracket: Bracket, season: string) {
    return this.s.ratings[this.rk(playerId, mode, bracket, season)] ?? null;
  }
  async setRating(playerId: string, mode: OnlineModeId, bracket: Bracket, season: string, state: RatingState) {
    this.s.ratings[this.rk(playerId, mode, bracket, season)] = state;
    this.dirty();
  }
  async listRatings(playerId: string, season: string) {
    return Object.entries(this.s.ratings)
      .filter(([k]) => k.startsWith(`${season}|`) && k.endsWith(`|${playerId}`))
      .map(([k, state]) => {
        const [, mode, bracket] = k.split('|');
        return { mode: mode as OnlineModeId, bracket: bracket as Bracket, state };
      });
  }
  async leaderboard(mode: OnlineModeId, bracket: Bracket, season: string, limit: number) {
    const prefix = `${season}|${mode}|${bracket}|`;
    return Object.entries(this.s.ratings)
      .filter(([k, st]) => k.startsWith(prefix) && st.games > 0)
      .map(([k, state]) => {
        const playerId = k.slice(prefix.length);
        return { playerId, nickname: this.s.players[playerId]?.nickname ?? 'Player', state };
      })
      .sort((a, b) => b.state.rating - a.state.rating)
      .slice(0, limit);
  }

  async recordMatch(m: StoredMatch) {
    this.s.matches.push(m);
    if (this.s.matches.length > 5000) this.s.matches.splice(0, this.s.matches.length - 5000);
    this.dirty();
  }
  async listMatches(playerId: string, limit: number) {
    return this.s.matches
      .filter((m) => m.players.some((p) => p.playerId === playerId))
      .slice(-limit)
      .reverse();
  }
  async recordLearningEvents(events: ServerLearningEvent[]) {
    this.s.learning.push(...events);
    if (this.s.learning.length > 20000) this.s.learning.splice(0, this.s.learning.length - 20000);
    this.dirty();
  }

  async addFriendRequest(from: string, to: string) {
    const existing = Object.values(this.s.requests).find((r) => r.from === from && r.to === to);
    if (existing) return existing;
    const req: FriendRequest = { id: `fr_${randomBytes(8).toString('hex')}`, from, to, createdAt: Date.now() };
    this.s.requests[req.id] = req;
    this.dirty();
    return req;
  }
  async getFriendRequest(id: string) {
    return this.s.requests[id] ?? null;
  }
  async deleteFriendRequest(id: string) {
    delete this.s.requests[id];
    this.dirty();
  }
  async listFriendRequests(playerId: string) {
    const all = Object.values(this.s.requests);
    return { incoming: all.filter((r) => r.to === playerId), outgoing: all.filter((r) => r.from === playerId) };
  }
  async addFriendship(a: string, b: string) {
    const k = pair(a, b);
    if (!this.s.friendships.includes(k)) this.s.friendships.push(k);
    this.dirty();
  }
  async removeFriendship(a: string, b: string) {
    this.s.friendships = this.s.friendships.filter((k) => k !== pair(a, b));
    this.dirty();
  }
  async listFriends(playerId: string) {
    return this.s.friendships
      .map((k) => k.split('|'))
      .filter(([a, b]) => a === playerId || b === playerId)
      .map(([a, b]) => (a === playerId ? b! : a!));
  }
  async areFriends(a: string, b: string) {
    return this.s.friendships.includes(pair(a, b));
  }

  async block(blocker: string, blocked: string) {
    const k = `${blocker}>${blocked}`;
    if (!this.s.blocks.includes(k)) this.s.blocks.push(k);
    this.dirty();
  }
  async unblock(blocker: string, blocked: string) {
    this.s.blocks = this.s.blocks.filter((k) => k !== `${blocker}>${blocked}`);
    this.dirty();
  }
  async listBlocked(blocker: string) {
    return this.s.blocks.filter((k) => k.startsWith(`${blocker}>`)).map((k) => k.slice(blocker.length + 1));
  }
  async isBlockedEitherWay(a: string, b: string) {
    return this.s.blocks.includes(`${a}>${b}`) || this.s.blocks.includes(`${b}>${a}`);
  }

  async addReport(r: ReportRecord) {
    this.s.reports.push(r);
    this.dirty();
  }
}
