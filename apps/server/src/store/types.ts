import type { Bracket, OnlineModeId, PlayerMatchStats, RatingState } from '@lingua/shared';

export interface PlayerRecord {
  id: string;
  nickname: string;
  kind: 'guest' | 'registered';
  friendCode: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface StoredMatch {
  id: string;
  mode: OnlineModeId;
  queue: 'ranked' | 'casual' | 'private';
  bracket: Bracket;
  season: string;
  startedAt: number;
  endedAt: number;
  reason: string;
  winnerId: string | null;
  players: {
    playerId: string;
    result: 'win' | 'loss' | 'draw';
    stats: PlayerMatchStats;
    ratingBefore: number | null;
    ratingAfter: number | null;
  }[];
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  createdAt: number;
}

export interface ReportRecord {
  reporterId: string;
  reportedId: string;
  reason: string;
  matchId?: string;
  details?: string;
  createdAt: number;
}

export interface ServerLearningEvent {
  playerId: string;
  itemId: string;
  mode: OnlineModeId;
  correct: boolean;
  responseMs: number | null;
  matchId: string;
  occurredAt: number;
}

/**
 * Persistence for authoritative server state. Implementations:
 *  - MemoryStore: local development (optional JSON snapshot on disk).
 *  - SupabaseStore: production, using the service-role key (server-side only).
 */
export interface ServerStore {
  getPlayer(id: string): Promise<PlayerRecord | null>;
  upsertPlayer(p: PlayerRecord): Promise<void>;
  findByFriendCode(code: string): Promise<PlayerRecord | null>;

  getRating(playerId: string, mode: OnlineModeId, bracket: Bracket, season: string): Promise<RatingState | null>;
  setRating(playerId: string, mode: OnlineModeId, bracket: Bracket, season: string, state: RatingState): Promise<void>;
  listRatings(playerId: string, season: string): Promise<{ mode: OnlineModeId; bracket: Bracket; state: RatingState }[]>;
  leaderboard(mode: OnlineModeId, bracket: Bracket, season: string, limit: number): Promise<{ playerId: string; nickname: string; state: RatingState }[]>;

  recordMatch(m: StoredMatch): Promise<void>;
  listMatches(playerId: string, limit: number): Promise<StoredMatch[]>;
  recordLearningEvents(events: ServerLearningEvent[]): Promise<void>;

  addFriendRequest(from: string, to: string): Promise<FriendRequest>;
  getFriendRequest(id: string): Promise<FriendRequest | null>;
  deleteFriendRequest(id: string): Promise<void>;
  listFriendRequests(playerId: string): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>;
  addFriendship(a: string, b: string): Promise<void>;
  removeFriendship(a: string, b: string): Promise<void>;
  listFriends(playerId: string): Promise<string[]>;
  areFriends(a: string, b: string): Promise<boolean>;

  block(blocker: string, blocked: string): Promise<void>;
  unblock(blocker: string, blocked: string): Promise<void>;
  listBlocked(blocker: string): Promise<string[]>;
  /** True if either player blocked the other. */
  isBlockedEitherWay(a: string, b: string): Promise<boolean>;

  addReport(r: ReportRecord): Promise<void>;
  flush(): Promise<void>;
}
