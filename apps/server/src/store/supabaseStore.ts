/**
 * Supabase-backed store (production persistence) using the SERVICE-ROLE key.
 *
 * STATUS: implemented against supabase/migrations, NOT yet verified against a live
 * Supabase project (none was configured during development). See HANDOFF.md.
 * The service-role key bypasses RLS and must only ever exist on this server.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Bracket, OnlineModeId, RatingState } from '@lingua/shared';
import type { FriendRequest, PlayerRecord, ReportRecord, ServerLearningEvent, ServerStore, StoredMatch } from './types';

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`[supabase] ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements ServerStore {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private toPlayer(r: { id: string; nickname: string; account_kind: string; friend_code: string; created_at: string; last_seen_at: string }): PlayerRecord {
    return {
      id: r.id,
      nickname: r.nickname,
      kind: r.account_kind === 'registered' ? 'registered' : 'guest',
      friendCode: r.friend_code,
      createdAt: Date.parse(r.created_at),
      lastSeenAt: Date.parse(r.last_seen_at),
    };
  }

  async getPlayer(id: string) {
    const data = check(await this.db.from('player_accounts').select('*').eq('id', id).maybeSingle());
    return data ? this.toPlayer(data) : null;
  }
  async upsertPlayer(p: PlayerRecord) {
    check(
      await this.db.from('player_accounts').upsert({
        id: p.id,
        nickname: p.nickname,
        account_kind: p.kind,
        auth_user_id: p.kind === 'registered' ? p.id : null,
        friend_code: p.friendCode,
        created_at: new Date(p.createdAt).toISOString(),
        last_seen_at: new Date(p.lastSeenAt).toISOString(),
      }),
    );
  }
  async findByFriendCode(code: string) {
    const data = check(await this.db.from('player_accounts').select('*').eq('friend_code', code).maybeSingle());
    return data ? this.toPlayer(data) : null;
  }

  private toRating(r: { rating: number; games: number; wins: number; losses: number; draws: number; peak: number }): RatingState {
    return { rating: r.rating, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws, peak: r.peak };
  }
  async getRating(playerId: string, mode: OnlineModeId, bracket: Bracket, season: string) {
    const data = check(await this.db.from('rank_profiles').select('*').match({ player_id: playerId, mode, bracket, season_id: season }).maybeSingle());
    return data ? this.toRating(data) : null;
  }
  async setRating(playerId: string, mode: OnlineModeId, bracket: Bracket, season: string, s: RatingState) {
    check(
      await this.db
        .from('rank_profiles')
        .upsert({ player_id: playerId, mode, bracket, season_id: season, rating: s.rating, games: s.games, wins: s.wins, losses: s.losses, draws: s.draws, peak: s.peak, updated_at: new Date().toISOString() }),
    );
  }
  async listRatings(playerId: string, season: string) {
    const data = check(await this.db.from('rank_profiles').select('*').match({ player_id: playerId, season_id: season }));
    return (data ?? []).map((r: { mode: OnlineModeId; bracket: Bracket } & Parameters<SupabaseStore['toRating']>[0]) => ({ mode: r.mode, bracket: r.bracket, state: this.toRating(r) }));
  }
  async leaderboard(mode: OnlineModeId, bracket: Bracket, season: string, limit: number) {
    const data = check(
      await this.db
        .from('rank_profiles')
        .select('*, player_accounts(nickname)')
        .match({ mode, bracket, season_id: season })
        .gt('games', 0)
        .order('rating', { ascending: false })
        .limit(limit),
    );
    return (data ?? []).map((r: { player_id: string; player_accounts: { nickname: string } | null } & Parameters<SupabaseStore['toRating']>[0]) => ({
      playerId: r.player_id,
      nickname: r.player_accounts?.nickname ?? 'Player',
      state: this.toRating(r),
    }));
  }

  async recordMatch(m: StoredMatch) {
    check(
      await this.db.from('matches').insert({
        id: m.id,
        mode: m.mode,
        queue: m.queue,
        bracket: m.bracket,
        season_id: m.season,
        started_at: new Date(m.startedAt).toISOString(),
        ended_at: new Date(m.endedAt).toISOString(),
        end_reason: m.reason,
        winner_id: m.winnerId,
      }),
    );
    check(
      await this.db.from('match_players').insert(
        m.players.map((p) => ({
          match_id: m.id,
          player_id: p.playerId,
          result: p.result,
          correct: p.stats.correct,
          incorrect: p.stats.incorrect,
          avg_response_ms: p.stats.avgResponseMs,
          best_combo: p.stats.bestCombo,
          rating_before: p.ratingBefore,
          rating_after: p.ratingAfter,
          stats: p.stats,
        })),
      ),
    );
  }
  async listMatches(playerId: string, limit: number) {
    const data = check(
      await this.db
        .from('match_players')
        .select('match_id, matches(*, match_players(*))')
        .eq('player_id', playerId)
        .order('match_id', { ascending: false })
        .limit(limit),
    );
    type Row = { matches: { id: string; mode: OnlineModeId; queue: StoredMatch['queue']; bracket: Bracket; season_id: string; started_at: string; ended_at: string; end_reason: string; winner_id: string | null; match_players: { player_id: string; result: 'win' | 'loss' | 'draw'; stats: StoredMatch['players'][number]['stats']; rating_before: number | null; rating_after: number | null }[] } | null };
    return ((data ?? []) as unknown as Row[])
      .filter((r) => r.matches)
      .map((r) => {
        const m = r.matches!;
        return {
          id: m.id,
          mode: m.mode,
          queue: m.queue,
          bracket: m.bracket,
          season: m.season_id,
          startedAt: Date.parse(m.started_at),
          endedAt: Date.parse(m.ended_at),
          reason: m.end_reason,
          winnerId: m.winner_id,
          players: m.match_players.map((p) => ({ playerId: p.player_id, result: p.result, stats: p.stats, ratingBefore: p.rating_before, ratingAfter: p.rating_after })),
        };
      });
  }
  async recordLearningEvents(events: ServerLearningEvent[]) {
    if (events.length === 0) return;
    // Only registered (auth.users) players have learning_events rows; guests are skipped by the FK filter.
    const registered = events.filter((e) => !e.playerId.startsWith('g_'));
    if (registered.length === 0) return;
    check(
      await this.db.from('learning_events').insert(
        registered.map((e) => ({
          player_id: e.playerId,
          content_item_id: e.itemId,
          game_mode: e.mode,
          correct: e.correct,
          response_ms: e.responseMs,
          match_id: e.matchId,
          source: 'server',
          occurred_at: new Date(e.occurredAt).toISOString(),
        })),
      ),
    );
  }

  async addFriendRequest(from: string, to: string) {
    const data = check(await this.db.from('friend_requests').upsert({ from_player: from, to_player: to }, { onConflict: 'from_player,to_player' }).select().single());
    return { id: data.id, from: data.from_player, to: data.to_player, createdAt: Date.parse(data.created_at) };
  }
  async getFriendRequest(id: string) {
    const data = check(await this.db.from('friend_requests').select('*').eq('id', id).maybeSingle());
    return data ? { id: data.id, from: data.from_player, to: data.to_player, createdAt: Date.parse(data.created_at) } : null;
  }
  async deleteFriendRequest(id: string) {
    check(await this.db.from('friend_requests').delete().eq('id', id));
  }
  async listFriendRequests(playerId: string) {
    const data = check(await this.db.from('friend_requests').select('*').or(`from_player.eq.${playerId},to_player.eq.${playerId}`));
    const all: FriendRequest[] = (data ?? []).map((d: { id: string; from_player: string; to_player: string; created_at: string }) => ({ id: d.id, from: d.from_player, to: d.to_player, createdAt: Date.parse(d.created_at) }));
    return { incoming: all.filter((r) => r.to === playerId), outgoing: all.filter((r) => r.from === playerId) };
  }
  async addFriendship(a: string, b: string) {
    const [x, y] = a < b ? [a, b] : [b, a];
    check(await this.db.from('friends').upsert({ player_a: x, player_b: y }));
  }
  async removeFriendship(a: string, b: string) {
    const [x, y] = a < b ? [a, b] : [b, a];
    check(await this.db.from('friends').delete().match({ player_a: x, player_b: y }));
  }
  async listFriends(playerId: string) {
    const data = check(await this.db.from('friends').select('*').or(`player_a.eq.${playerId},player_b.eq.${playerId}`));
    return (data ?? []).map((r: { player_a: string; player_b: string }) => (r.player_a === playerId ? r.player_b : r.player_a));
  }
  async areFriends(a: string, b: string) {
    const [x, y] = a < b ? [a, b] : [b, a];
    const data = check(await this.db.from('friends').select('player_a').match({ player_a: x, player_b: y }).maybeSingle());
    return !!data;
  }

  async block(blocker: string, blocked: string) {
    check(await this.db.from('blocked_users').upsert({ blocker_id: blocker, blocked_id: blocked }));
  }
  async unblock(blocker: string, blocked: string) {
    check(await this.db.from('blocked_users').delete().match({ blocker_id: blocker, blocked_id: blocked }));
  }
  async listBlocked(blocker: string) {
    const data = check(await this.db.from('blocked_users').select('blocked_id').eq('blocker_id', blocker));
    return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
  }
  async isBlockedEitherWay(a: string, b: string) {
    const data = check(
      await this.db.from('blocked_users').select('blocker_id').or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`).limit(1),
    );
    return (data ?? []).length > 0;
  }

  async addReport(r: ReportRecord) {
    check(
      await this.db.from('reports').insert({
        reporter_id: r.reporterId,
        reported_id: r.reportedId,
        reason: r.reason,
        match_id: r.matchId ?? null,
        details: r.details ?? null,
      }),
    );
  }

  async addRewards(playerId: string, xp: number, shards: number) {
    const cur = await this.getWallet(playerId);
    const next = { xp: cur.xp + Math.max(0, Math.round(xp)), shards: cur.shards + Math.max(0, Math.round(shards)) };
    check(await this.db.from('wallets').upsert({ player_id: playerId, xp: next.xp, shards: next.shards, updated_at: new Date().toISOString() }));
    return next;
  }
  async getWallet(playerId: string) {
    const data = check(await this.db.from('wallets').select('xp, shards').eq('player_id', playerId).maybeSingle());
    return { xp: data?.xp ?? 0, shards: data?.shards ?? 0 };
  }
  async unlockAchievements(playerId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const have = await this.listAchievements(playerId);
    const fresh = ids.filter((id) => !have.includes(id));
    if (fresh.length) check(await this.db.from('user_achievements').upsert(fresh.map((achievement_id) => ({ player_id: playerId, achievement_id }))));
    return fresh;
  }
  async listAchievements(playerId: string) {
    const data = check(await this.db.from('user_achievements').select('achievement_id').eq('player_id', playerId));
    return (data ?? []).map((r: { achievement_id: string }) => r.achievement_id);
  }

  async flush() {
    /* writes are immediate */
  }
}
