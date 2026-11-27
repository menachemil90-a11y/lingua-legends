/**
 * Friends' tournaments: single elimination for 3–8 players in a 1v1 mode (unranked).
 *
 * The server builds the bracket, starts each match automatically (a short pause after the
 * previous round lets players read their results), decides draws by the match statistics,
 * gives walkovers when someone leaves or misses a ready check, and awards the champion.
 */
import { randomInt } from 'node:crypto';
import {
  championOf,
  createBracket,
  decideTournamentWinner,
  findMatchOf,
  playableMatches,
  randomCode,
  recordResult,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_MIN_PLAYERS,
  type Bracket,
  type MatchOutcome,
  type QueueModeId,
  type ServerMessage,
  type TournamentBracket,
} from '@lingua/shared';
import type { Hub } from './hub';
import type { MatchManager } from './matches';
import type { ServerStore } from './store/types';

const cryptoRandom = () => randomInt(0, 2 ** 31) / 2 ** 31;

interface Tournament {
  code: string;
  mode: QueueModeId;
  bracket: Bracket;
  hostId: string;
  status: 'open' | 'running' | 'finished' | 'closed';
  members: string[];
  left: Set<string>;
  tree: TournamentBracket | null;
  byMatch: Map<string, { round: number; index: number }>;
  expiresAt: number;
  launchTimer: ReturnType<typeof setTimeout> | null;
}

export const TOURNAMENT_REWARDS = {
  champion: { xp: 60, shards: 30 },
  finalist: { xp: 30, shards: 15 },
};

export class Tournaments {
  private ts = new Map<string, Tournament>();
  private byPlayer = new Map<string, string>();
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly hub: Hub,
    private readonly matches: MatchManager,
    private readonly store: ServerStore,
    private readonly opts: { ttlMs: number; roundPauseMs: number },
  ) {
    matches.onMatchEnd((matchId, outcome) => this.onMatchEnd(matchId, outcome));
    matches.onMatchCancelled((matchId, readyIds) => this.onMatchCancelled(matchId, readyIds));
    this.timer = setInterval(() => this.sweep(), 30_000);
  }

  /** True while the player belongs to an open or running tournament (blocks queues/rooms). */
  isActive(playerId: string): boolean {
    const t = this.of(playerId);
    return !!t && (t.status === 'open' || t.status === 'running') && !t.left.has(playerId);
  }

  private of(playerId: string): Tournament | undefined {
    const code = this.byPlayer.get(playerId);
    return code ? this.ts.get(code) : undefined;
  }

  create(playerId: string, mode: QueueModeId, bracket: Bracket): string | null {
    if (this.isActive(playerId)) return 'INVALID_STATE';
    let code = randomCode(6, cryptoRandom);
    while (this.ts.has(code)) code = randomCode(6, cryptoRandom);
    const t: Tournament = { code, mode, bracket, hostId: playerId, status: 'open', members: [playerId], left: new Set(), tree: null, byMatch: new Map(), expiresAt: Date.now() + this.opts.ttlMs, launchTimer: null };
    this.ts.set(code, t);
    this.byPlayer.set(playerId, code);
    this.broadcast(t);
    return null;
  }

  async join(playerId: string, code: string): Promise<string | null> {
    const t = this.ts.get(code);
    if (!t || t.status !== 'open' || t.expiresAt < Date.now()) return 'ROOM_NOT_FOUND';
    if (t.members.includes(playerId)) {
      this.send(t, playerId);
      return null;
    }
    if (this.isActive(playerId)) return 'INVALID_STATE';
    if (t.members.length >= TOURNAMENT_MAX_PLAYERS) return 'ROOM_FULL';
    for (const m of t.members) if (await this.store.isBlockedEitherWay(playerId, m)) return 'ROOM_NOT_FOUND';
    t.members.push(playerId);
    this.byPlayer.set(playerId, code);
    this.broadcast(t);
    return null;
  }

  start(playerId: string): string | null {
    const t = this.of(playerId);
    if (!t || t.status !== 'open') return 'INVALID_STATE';
    if (t.hostId !== playerId) return 'FORBIDDEN';
    if (t.members.length < TOURNAMENT_MIN_PLAYERS) return 'INVALID_STATE';
    t.tree = createBracket(t.members, cryptoRandom);
    t.status = 'running';
    this.broadcast(t);
    this.scheduleLaunch(t, 1500);
    return null;
  }

  leave(playerId: string): void {
    const t = this.of(playerId);
    if (!t) return;
    if (t.status === 'open') {
      t.members = t.members.filter((m) => m !== playerId);
      this.byPlayer.delete(playerId);
      if (t.members.length === 0) return this.close(t);
      if (t.hostId === playerId) t.hostId = t.members[0]!;
      this.broadcast(t);
      this.hub.send(playerId, this.state(t, 'closed'));
      return;
    }
    if (t.status !== 'running' || !t.tree) {
      this.byPlayer.delete(playerId);
      return;
    }
    t.left.add(playerId);
    const cur = findMatchOf(t.tree, playerId);
    if (cur?.match.status === 'live' && cur.match.matchId) {
      // The live match ends as a forfeit, which records the result through onMatchEnd.
      this.matches.leave(playerId, cur.match.matchId);
    } else {
      this.resolveWalkovers(t);
    }
    this.broadcast(t);
    this.byPlayer.delete(playerId);
    this.checkFinished(t);
  }

  onReconnect(playerId: string): void {
    const t = this.of(playerId);
    if (t) this.send(t, playerId);
  }

  /** Disconnecting while a tournament is still open frees the seat (like rooms). */
  onDisconnect(playerId: string): void {
    const t = this.of(playerId);
    if (t?.status === 'open') this.leave(playerId);
  }

  private onMatchEnd(matchId: string, outcome: MatchOutcome): void {
    const t = this.findByMatch(matchId);
    if (!t?.tree) return;
    const pos = t.byMatch.get(matchId)!;
    const m = t.tree.rounds[pos.round]![pos.index]!;
    if (!m.a || !m.b) return;
    const winner = decideTournamentWinner(t.tree, m.a, m.b, { winnerId: outcome.winnerId, stats: outcome.stats });
    recordResult(t.tree, pos.round, pos.index, winner);
    t.byMatch.delete(matchId);
    this.afterResult(t);
  }

  private onMatchCancelled(matchId: string, readyIds: string[]): void {
    const t = this.findByMatch(matchId);
    if (!t?.tree) return;
    const pos = t.byMatch.get(matchId)!;
    const m = t.tree.rounds[pos.round]![pos.index]!;
    if (!m.a || !m.b) return;
    // Missing a ready check is a walkover for the player who was ready; otherwise the better seed.
    const readyA = readyIds.includes(m.a) && !t.left.has(m.a);
    const readyB = readyIds.includes(m.b) && !t.left.has(m.b);
    const winner = readyA && !readyB ? m.a : readyB && !readyA ? m.b : decideTournamentWinner(t.tree, m.a, m.b, { winnerId: null, stats: [] });
    recordResult(t.tree, pos.round, pos.index, winner);
    t.byMatch.delete(matchId);
    this.afterResult(t);
  }

  private afterResult(t: Tournament): void {
    this.resolveWalkovers(t);
    this.broadcast(t);
    if (!this.checkFinished(t)) this.scheduleLaunch(t, this.opts.roundPauseMs);
  }

  /** Players who left lose every remaining match without playing. */
  private resolveWalkovers(t: Tournament): void {
    if (!t.tree) return;
    let changed = true;
    while (changed) {
      changed = false;
      for (const { round, index, match } of playableMatches(t.tree)) {
        const aGone = t.left.has(match.a!);
        const bGone = t.left.has(match.b!);
        if (!aGone && !bGone) continue;
        const winner = aGone && !bGone ? match.b! : !aGone && bGone ? match.a! : decideTournamentWinner(t.tree, match.a!, match.b!, { winnerId: null, stats: [] });
        recordResult(t.tree, round, index, winner);
        changed = true;
      }
    }
  }

  private scheduleLaunch(t: Tournament, ms: number): void {
    if (t.launchTimer) clearTimeout(t.launchTimer);
    t.launchTimer = setTimeout(() => {
      t.launchTimer = null;
      void this.launch(t);
    }, ms);
  }

  private async launch(t: Tournament): Promise<void> {
    if (t.status !== 'running' || !t.tree) return;
    this.resolveWalkovers(t);
    for (const { round, index, match } of playableMatches(t.tree)) {
      match.status = 'live';
      const matchId = await this.matches.create({ playerIds: [match.a!, match.b!], mode: t.mode, queue: 'private', bracket: t.bracket });
      match.matchId = matchId;
      t.byMatch.set(matchId, { round, index });
    }
    this.broadcast(t);
    this.checkFinished(t);
  }

  private checkFinished(t: Tournament): boolean {
    if (!t.tree || t.status !== 'running') return t.status === 'finished';
    const champion = championOf(t.tree);
    if (!champion) return false;
    t.status = 'finished';
    this.broadcast(t);
    void this.reward(t, champion);
    setTimeout(() => this.close(t), 10 * 60_000).unref?.();
    return true;
  }

  private async reward(t: Tournament, champion: string): Promise<void> {
    const final = t.tree!.rounds[t.tree!.rounds.length - 1]![0]!;
    const finalist = final.a === champion ? final.b : final.a;
    try {
      await this.store.addRewards(champion, TOURNAMENT_REWARDS.champion.xp, TOURNAMENT_REWARDS.champion.shards);
      await this.store.unlockAchievements(champion, ['tournament-champion']);
      if (finalist && !t.left.has(finalist)) await this.store.addRewards(finalist, TOURNAMENT_REWARDS.finalist.xp, TOURNAMENT_REWARDS.finalist.shards);
    } catch (e) {
      console.error('[tournaments] failed to store rewards', e);
    }
  }

  private findByMatch(matchId: string): Tournament | undefined {
    for (const t of this.ts.values()) if (t.byMatch.has(matchId)) return t;
    return undefined;
  }

  private close(t: Tournament): void {
    if (t.launchTimer) clearTimeout(t.launchTimer);
    for (const m of t.members) if (this.byPlayer.get(m) === t.code) this.byPlayer.delete(m);
    if (t.status === 'open') for (const m of t.members) this.hub.send(m, this.state(t, 'closed'));
    this.ts.delete(t.code);
  }

  private sweep(): void {
    const now = Date.now();
    for (const t of this.ts.values()) if (t.status === 'open' && t.expiresAt < now) this.close(t);
  }

  private state(t: Tournament, status = t.status): ServerMessage {
    return {
      type: 'TOURNAMENT_STATE',
      code: t.code,
      mode: t.mode,
      bracket: t.bracket,
      hostId: t.hostId,
      status,
      players: t.members.map((m) => this.hub.publicPlayer(m)),
      left: [...t.left],
      rounds: t.tree ? t.tree.rounds.map((r) => r.map((m) => ({ a: m.a, b: m.b, winnerId: m.winnerId, status: m.status, ...(m.matchId ? { matchId: m.matchId } : {}) }))) : [],
      championId: t.tree ? championOf(t.tree) : null,
      maxPlayers: TOURNAMENT_MAX_PLAYERS,
      expiresAt: t.expiresAt,
    };
  }

  private send(t: Tournament, playerId: string): void {
    this.hub.send(playerId, this.state(t));
  }

  private broadcast(t: Tournament): void {
    const msg = this.state(t);
    for (const m of t.members) if (this.byPlayer.get(m) === t.code) this.hub.send(m, msg);
  }

  dispose(): void {
    clearInterval(this.timer);
    for (const t of this.ts.values()) if (t.launchTimer) clearTimeout(t.launchTimer);
  }
}
