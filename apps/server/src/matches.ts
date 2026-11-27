/**
 * Authoritative match lifecycle: ready check → host (rules) → results, ratings,
 * XP and persistence. Clients only ever send intents.
 */
import { randomBytes } from 'node:crypto';
import {
  applyResult,
  currentSeason,
  ERROR_CODES,
  GrammarRaceHost,
  matchShards,
  matchXp,
  newRatingState,
  rankFromRating,
  realClock,
  SentenceDuelHost,
  WordBattleHost,
  type AbilityId,
  type AnswerPayload,
  type Bracket,
  type Clock,
  type MatchHost,
  type MatchOutcome,
  type OnlineModeId,
  type PublicPlayer,
  type RatingChange,
  type ServerMessage,
} from '@lingua/shared';
import type { Hub } from './hub';
import type { ServerStore, ServerLearningEvent } from './store/types';
import { questionSource } from './content/sources';

export type MatchQueue = 'ranked' | 'casual' | 'private';

interface LiveMatch {
  id: string;
  mode: OnlineModeId;
  queue: MatchQueue;
  bracket: Bracket;
  players: PublicPlayer[];
  state: 'ready-check' | 'live' | 'ended';
  ready: Set<string>;
  readyDeadline: number;
  readyTimer: ReturnType<typeof setTimeout> | null;
  host: MatchHost | null;
  rematch: Set<string>;
  endedAt: number | null;
  learning: ServerLearningEvent[];
  /** Rematches are always unranked to prevent rating farming between the same pair. */
  isRematch: boolean;
}

export interface MatchOptions {
  playerIds: string[];
  mode: OnlineModeId;
  queue: MatchQueue;
  bracket: Bracket;
  isRematch?: boolean;
}

export class MatchManager {
  private matches = new Map<string, LiveMatch>();
  private byPlayer = new Map<string, string>();

  constructor(
    private readonly hub: Hub,
    private readonly store: ServerStore,
    private readonly opts: { readyTimeoutMs: number; clock?: Clock },
  ) {}

  activeMatchOf(playerId: string): string | null {
    return this.byPlayer.get(playerId) ?? null;
  }

  isBusy(playerId: string): boolean {
    const id = this.byPlayer.get(playerId);
    if (!id) return false;
    const m = this.matches.get(id);
    return !!m && m.state !== 'ended';
  }

  async create(o: MatchOptions): Promise<string> {
    const id = `m_${randomBytes(9).toString('base64url')}`;
    const season = currentSeason().id;
    const players: PublicPlayer[] = [];
    for (const pid of o.playerIds) {
      let extra: Partial<PublicPlayer> = {};
      if (o.queue === 'ranked') {
        const st = (await this.store.getRating(pid, o.mode, o.bracket, season)) ?? newRatingState();
        const r = rankFromRating(st.rating);
        extra = st.games >= 5 ? { rankTier: r.tier, rankLabel: r.label } : { rankLabel: `Placement ${st.games}/5` };
      }
      players.push(this.hub.publicPlayer(pid, extra));
    }
    const m: LiveMatch = {
      id,
      mode: o.mode,
      queue: o.queue,
      bracket: o.bracket,
      players,
      state: 'ready-check',
      ready: new Set(),
      readyDeadline: Date.now() + this.opts.readyTimeoutMs,
      readyTimer: null,
      host: null,
      rematch: new Set(),
      endedAt: null,
      learning: [],
      isRematch: !!o.isRematch,
    };
    this.matches.set(id, m);
    for (const pid of o.playerIds) {
      const prev = this.byPlayer.get(pid);
      if (prev && prev !== id) this.cleanup(prev);
      this.byPlayer.set(pid, id);
    }
    m.readyTimer = setTimeout(() => this.readyTimeout(id), this.opts.readyTimeoutMs);
    this.broadcast(m, this.matchFound(m));
    return id;
  }

  private matchFound(m: LiveMatch): ServerMessage {
    return { type: 'MATCH_FOUND', matchId: m.id, mode: m.mode, queue: m.queue, bracket: m.bracket, players: m.players, readyDeadline: m.readyDeadline };
  }

  private broadcast(m: LiveMatch, msg: ServerMessage): void {
    for (const p of m.players) this.hub.send(p.playerId, msg);
  }

  private member(m: LiveMatch, playerId: string): boolean {
    return m.players.some((p) => p.playerId === playerId);
  }

  private get(playerId: string, matchId: string): LiveMatch | { error: string } {
    const m = this.matches.get(matchId);
    if (!m || !this.member(m, playerId)) return { error: ERROR_CODES.NOT_IN_MATCH };
    return m;
  }

  ready(playerId: string, matchId: string): string | null {
    const m = this.get(playerId, matchId);
    if ('error' in m) return m.error;
    if (m.state !== 'ready-check') return null; // idempotent
    m.ready.add(playerId);
    this.broadcast(m, { type: 'READY_STATE', matchId, ready: [...m.ready] });
    if (m.players.every((p) => m.ready.has(p.playerId))) this.startHost(m);
    return null;
  }

  private readyTimeout(matchId: string): void {
    const m = this.matches.get(matchId);
    if (!m || m.state !== 'ready-check') return;
    m.state = 'ended';
    this.broadcast(m, { type: 'MATCH_CANCELLED', matchId, reason: 'ready-timeout' });
    this.cleanup(matchId);
  }

  private startHost(m: LiveMatch): void {
    if (m.readyTimer) clearTimeout(m.readyTimer);
    m.readyTimer = null;
    m.state = 'live';
    const random = Math.random;
    const deps = {
      matchId: m.id,
      players: m.players,
      clock: this.opts.clock ?? realClock,
      questions: questionSource(m.mode, m.bracket, m.queue, random),
      random,
      emit: (to: string | null, msg: ServerMessage) => {
        if (to === null) this.broadcast(m, msg);
        else this.hub.send(to, msg);
      },
      onEnd: (o: MatchOutcome) => void this.finish(m, o),
      onRound: (log: { item: { id: string }; results: { playerId: string; correct: boolean; responseMs: number | null }[] }) => {
        for (const r of log.results) {
          m.learning.push({ playerId: r.playerId, itemId: log.item.id, mode: m.mode, correct: r.correct, responseMs: r.responseMs, matchId: m.id, occurredAt: Date.now() });
        }
      },
    };
    m.host = m.mode === 'grammar-race' ? new GrammarRaceHost(deps) : m.mode === 'sentence-master' ? new SentenceDuelHost(deps) : new WordBattleHost(deps);
    // Players who are offline at start count as disconnected.
    for (const p of m.players) if (!this.hub.isOnline(p.playerId)) m.host.setConnected(p.playerId, false);
    m.host.start();
  }

  private async finish(m: LiveMatch, o: MatchOutcome): Promise<void> {
    m.state = 'ended';
    m.endedAt = Date.now();
    const season = currentSeason().id;
    const ranked = m.queue === 'ranked' && !m.isRematch && o.reason !== 'cancelled';
    const changes = new Map<string, RatingChange>();
    const before = new Map<string, number>();
    if (ranked && m.players.length === 2) {
      const [a, b] = m.players.map((p) => p.playerId) as [string, string];
      const sa = (await this.store.getRating(a, m.mode, m.bracket, season)) ?? newRatingState();
      const sb = (await this.store.getRating(b, m.mode, m.bracket, season)) ?? newRatingState();
      const score = (pid: string) => {
        const r = o.outcomes.find((x) => x.playerId === pid)?.result;
        return r === 'win' ? 1 : r === 'draw' ? 0.5 : 0;
      };
      const ra = applyResult(sa, sb.rating, score(a) as 1 | 0.5 | 0);
      const rb = applyResult(sb, sa.rating, score(b) as 1 | 0.5 | 0);
      before.set(a, sa.rating);
      before.set(b, sb.rating);
      await this.store.setRating(a, m.mode, m.bracket, season, ra.next);
      await this.store.setRating(b, m.mode, m.bracket, season, rb.next);
      changes.set(a, ra.change);
      changes.set(b, rb.change);
    }
    const xp = new Map<string, number>();
    const shards = new Map<string, number>();
    const unlocked = new Map<string, string[]>();
    for (const p of m.players) {
      const stats = o.stats.find((s) => s.playerId === p.playerId)!;
      const result = o.outcomes.find((x) => x.playerId === p.playerId)!.result;
      const completed = o.reason !== 'cancelled';
      xp.set(p.playerId, matchXp(stats, result, completed));
      // A forfeiting player earns no shards; rewards are computed only here, server-side.
      shards.set(p.playerId, o.reason === 'forfeit' && result === 'loss' ? 0 : matchShards(stats, result, completed));
      const ids: string[] = [];
      if (result === 'win') ids.push('first-victory');
      if (result === 'win' && m.mode === 'grammar-race') ids.push('race-winner');
      if (stats.bestCombo >= 6) ids.push('combo-master');
      try {
        await this.store.addRewards(p.playerId, xp.get(p.playerId)!, shards.get(p.playerId)!);
        unlocked.set(p.playerId, await this.store.unlockAchievements(p.playerId, ids));
      } catch (e) {
        console.error('[matches] failed to persist rewards', p.playerId, e);
      }
    }
    for (const p of m.players) {
      this.hub.send(p.playerId, {
        type: 'MATCH_END',
        matchId: m.id,
        mode: m.mode,
        reason: o.reason,
        winnerId: o.winnerId,
        outcomes: o.outcomes,
        stats: o.stats,
        ratingChange: changes.get(p.playerId) ?? null,
        xpEarned: xp.get(p.playerId) ?? 0,
        shardsEarned: shards.get(p.playerId) ?? 0,
        achievements: unlocked.get(p.playerId) ?? [],
        ranked,
      });
    }
    try {
      await this.store.recordMatch({
        id: m.id,
        mode: m.mode,
        queue: m.queue,
        bracket: m.bracket,
        season,
        startedAt: o.startedAt,
        endedAt: o.endedAt,
        reason: o.reason,
        winnerId: o.winnerId,
        players: m.players.map((p) => ({
          playerId: p.playerId,
          result: o.outcomes.find((x) => x.playerId === p.playerId)!.result,
          stats: o.stats.find((s) => s.playerId === p.playerId)!,
          ratingBefore: before.get(p.playerId) ?? null,
          ratingAfter: changes.get(p.playerId)?.after ?? null,
        })),
      });
      await this.store.recordLearningEvents(m.learning);
    } catch (e) {
      console.error('[matches] failed to persist match', m.id, e);
    }
    // Keep the ended match briefly so rematch requests can find it.
    setTimeout(() => this.cleanup(m.id), 90_000);
  }

  answer(playerId: string, matchId: string, roundId: string, answer: AnswerPayload): { code: string; message: string } | null {
    const m = this.get(playerId, matchId);
    if ('error' in m) return { code: m.error, message: 'Not in this match' };
    if (!m.host || m.state !== 'live') return { code: ERROR_CODES.INVALID_STATE, message: 'Match is not live' };
    const r = m.host.submitAnswer(playerId, roundId, answer);
    return r.ok ? null : { code: r.code, message: r.message };
  }

  ability(playerId: string, matchId: string, ability: AbilityId): { code: string; message: string } | null {
    const m = this.get(playerId, matchId);
    if ('error' in m) return { code: m.error, message: 'Not in this match' };
    if (!m.host || m.state !== 'live') return { code: ERROR_CODES.INVALID_STATE, message: 'Match is not live' };
    const r = m.host.useAbility(playerId, ability);
    return r.ok ? null : { code: r.code, message: r.message };
  }

  leave(playerId: string, matchId: string): void {
    const m = this.matches.get(matchId);
    if (!m || !this.member(m, playerId)) return;
    if (m.state === 'ready-check') {
      m.state = 'ended';
      if (m.readyTimer) clearTimeout(m.readyTimer);
      this.broadcast(m, { type: 'MATCH_CANCELLED', matchId, reason: 'player-left' });
      this.cleanup(matchId);
    } else if (m.state === 'live') m.host?.forfeit(playerId);
  }

  async quickChat(playerId: string, matchId: string, phraseId: string): Promise<void> {
    const m = this.matches.get(matchId);
    if (!m || !this.member(m, playerId)) return;
    for (const p of m.players) {
      if (p.playerId !== playerId && (await this.store.isBlockedEitherWay(playerId, p.playerId))) continue;
      this.hub.send(p.playerId, { type: 'QUICK_CHAT', matchId, from: playerId, phraseId: phraseId as never });
    }
  }

  async rematch(playerId: string, matchId: string): Promise<string | null> {
    const m = this.matches.get(matchId);
    if (!m || !this.member(m, playerId)) return ERROR_CODES.NOT_IN_MATCH;
    if (m.state !== 'ended') return ERROR_CODES.INVALID_STATE;
    m.rematch.add(playerId);
    this.broadcast(m, { type: 'REMATCH_STATE', matchId, requestedBy: [...m.rematch] });
    if (m.players.every((p) => m.rematch.has(p.playerId) && this.hub.isOnline(p.playerId))) {
      const newId = await this.create({
        playerIds: m.players.map((p) => p.playerId),
        mode: m.mode,
        queue: m.queue === 'ranked' ? 'casual' : m.queue,
        bracket: m.bracket,
        isRematch: true,
      });
      this.broadcast(m, { type: 'REMATCH_STATE', matchId, requestedBy: [...m.rematch], newMatchId: newId });
    }
    return null;
  }

  onDisconnect(playerId: string): void {
    const id = this.byPlayer.get(playerId);
    const m = id ? this.matches.get(id) : undefined;
    if (!m) return;
    if (m.state === 'live') m.host?.setConnected(playerId, false);
  }

  /** Restores a reconnecting player's view of their active match. */
  onReconnect(playerId: string): void {
    const id = this.byPlayer.get(playerId);
    const m = id ? this.matches.get(id) : undefined;
    if (!m || m.state === 'ended') return;
    this.hub.send(playerId, this.matchFound(m));
    if (m.state === 'ready-check') {
      this.hub.send(playerId, { type: 'READY_STATE', matchId: m.id, ready: [...m.ready] });
      return;
    }
    m.host?.setConnected(playerId, true);
    this.hub.send(playerId, { type: 'READY_STATE', matchId: m.id, ready: m.players.map((p) => p.playerId) });
    for (const msg of m.host?.snapshot(playerId) ?? []) this.hub.send(playerId, msg);
  }

  private cleanup(matchId: string): void {
    const m = this.matches.get(matchId);
    if (!m) return;
    if (m.state === 'live') return; // never drop a live match
    m.host?.dispose();
    if (m.readyTimer) clearTimeout(m.readyTimer);
    for (const p of m.players) if (this.byPlayer.get(p.playerId) === matchId) this.byPlayer.delete(p.playerId);
    this.matches.delete(matchId);
  }

  /** In-process inspection for tests and bots only. Never exposed over the network. */
  peekRound(matchId: string, roundId: string) {
    return this.matches.get(matchId)?.host?.peekRound(roundId);
  }

  get liveCount(): number {
    return [...this.matches.values()].filter((m) => m.state === 'live').length;
  }

  disposeAll(): void {
    for (const m of this.matches.values()) {
      m.host?.dispose();
      if (m.readyTimer) clearTimeout(m.readyTimer);
    }
    this.matches.clear();
    this.byPlayer.clear();
  }
}
