import type { ContentItem, OnlineModeId } from '../content/schema';
import type { RoundQuestion } from '../content/grading';
import type { AnswerPayload, PlayerMatchStats, PublicPlayer, ServerMessage } from '../protocol';
import type { RandomFn } from '../random';

export type TimerHandle = unknown;

/** Injected time source so hosts are deterministic under test. */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
};

/** Manual clock for tests and simulations. */
export class FakeClock implements Clock {
  private t: number;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();

  constructor(start = 1_000_000) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): TimerHandle {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + Math.max(0, ms), fn });
    return id;
  }
  clearTimeout(handle: TimerHandle): void {
    this.timers.delete(handle as number);
  }
  /** Advances time, firing due timers in chronological order. */
  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      let nextId: number | undefined;
      let nextAt = Infinity;
      for (const [id, timer] of this.timers) {
        if (timer.at <= target && (timer.at < nextAt || (timer.at === nextAt && id < (nextId ?? Infinity)))) {
          nextAt = timer.at;
          nextId = id;
        }
      }
      if (nextId === undefined) break;
      const timer = this.timers.get(nextId)!;
      this.timers.delete(nextId);
      this.t = Math.max(this.t, timer.at);
      timer.fn();
    }
    this.t = target;
  }
  pending(): number {
    return this.timers.size;
  }
}

/** Supplies content for each round. Implementations decide pools (ranked vs public). */
export interface QuestionSource {
  next(roundIndex: number): ContentItem;
  /** Whether items come from the public bank (affects what the client may cache). */
  readonly publicItems: boolean;
}

export type Emit = (to: string | null, message: ServerMessage) => void;

export interface MatchOutcome {
  mode: OnlineModeId;
  reason: Extract<ServerMessage, { type: 'MATCH_END' }>['reason'];
  winnerId: string | null;
  outcomes: { playerId: string; result: 'win' | 'loss' | 'draw' }[];
  stats: PlayerMatchStats[];
  startedAt: number;
  endedAt: number;
}

export interface RoundLog {
  roundIndex: number;
  item: ContentItem;
  results: { playerId: string; answered: boolean; correct: boolean; responseMs: number | null }[];
}

export interface MatchHostDeps {
  matchId: string;
  players: PublicPlayer[];
  clock: Clock;
  questions: QuestionSource;
  emit: Emit;
  random: RandomFn;
  onEnd: (outcome: MatchOutcome) => void;
  onRound?: (log: RoundLog) => void;
}

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

export interface MatchHost {
  readonly mode: OnlineModeId;
  readonly matchId: string;
  start(): void;
  submitAnswer(playerId: string, roundId: string, answer: AnswerPayload): ActionResult;
  useAbility(playerId: string, ability: string): ActionResult;
  setConnected(playerId: string, connected: boolean): void;
  forfeit(playerId: string): void;
  /** Messages that restore a reconnecting player's view of the match. */
  snapshot(playerId: string): ServerMessage[];
  /** In-process only (bots / tests). Never exposed over the network. */
  peekRound(roundId: string): RoundQuestion | undefined;
  isEnded(): boolean;
  dispose(): void;
}

export function ok(): ActionResult {
  return { ok: true };
}
export function fail(code: string, message: string): ActionResult {
  return { ok: false, code, message };
}

export function emptyStats(playerId: string): PlayerMatchStats {
  return { playerId, answered: 0, correct: 0, incorrect: 0, avgResponseMs: null, bestCombo: 0 };
}

export function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Small grace window for network latency after a deadline (server-measured). */
export const NETWORK_GRACE_MS = 400;
