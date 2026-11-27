/**
 * Co-op Escape Room host (2–4 players, unranked).
 *
 * The team shares one room: any player may open a lock, every attempt and hint is
 * visible to all, and the server checks every answer so the shared state cannot be
 * forged by one client. The team escapes when all locks are open before time runs out.
 */
import { ERROR_CODES, type AnswerPayload, type EscapeAction, type ServerMessage } from '../protocol';
import type { RoundQuestion } from '../content/grading';
import { checkEscapeAnswer, type EscapeRoom } from '../rules/escape';
import { fail, ok, type ActionResult, type MatchHost, type MatchHostDeps, type MatchOutcome, type TimerHandle } from './common';

export const ESCAPE_COOP = {
  countdownMs: 3000,
  /** Team time = the room's suggested time × this factor (co-op is relaxed but finite). */
  timeFactor: 1.5,
  disconnectGraceMs: 60_000,
  /** Guards against brute-forcing a lock by spamming attempts. */
  maxAttemptsPerPuzzle: 12,
};

interface Seat {
  playerId: string;
  connected: boolean;
  left: boolean;
  attempts: number;
  solved: number;
}

export class EscapeCoopHost implements MatchHost {
  readonly mode = 'escape-room' as const;
  readonly matchId: string;
  private readonly deps: MatchHostDeps;
  private readonly room: EscapeRoom;
  private readonly cfg: typeof ESCAPE_COOP;
  private readonly seats: Seat[];
  private status: 'created' | 'countdown' | 'live' | 'ended' = 'created';
  private solved = new Map<string, { by: string; attempts: number; hinted: boolean }>();
  private attempts = new Map<string, number>();
  private hints = new Set<string>();
  private last: { puzzleId: string; by: string; correct: boolean; seq: number } | null = null;
  private seq = 0;
  private timer: TimerHandle | null = null;
  private graceTimers = new Map<string, TimerHandle>();
  private startsAt = 0;
  private endsAt = 0;

  constructor(deps: MatchHostDeps, room: EscapeRoom, cfg: Partial<typeof ESCAPE_COOP> = {}) {
    if (deps.players.length < 2 || deps.players.length > 4) throw new Error('Co-op Escape Room needs 2–4 players');
    this.deps = deps;
    this.matchId = deps.matchId;
    this.room = room;
    this.cfg = { ...ESCAPE_COOP, ...cfg };
    this.seats = deps.players.map((p) => ({ playerId: p.playerId, connected: true, left: false, attempts: 0, solved: 0 }));
  }

  start(): void {
    if (this.status !== 'created') return;
    const now = this.deps.clock.now();
    this.startsAt = now + this.cfg.countdownMs;
    this.endsAt = this.startsAt + Math.round(this.room.timedSeconds * 1000 * this.cfg.timeFactor);
    this.status = 'countdown';
    this.deps.emit(null, this.matchStartMessage(now));
    this.emitState();
    this.timer = this.deps.clock.setTimeout(() => {
      this.status = 'live';
      this.emitState();
      this.timer = this.deps.clock.setTimeout(() => this.finish('timeout'), this.endsAt - this.deps.clock.now());
    }, this.cfg.countdownMs);
  }

  private matchStartMessage(now: number): ServerMessage {
    return {
      type: 'MATCH_START',
      matchId: this.matchId,
      mode: this.mode,
      players: this.deps.players,
      serverTime: now,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
      config: { puzzles: this.room.puzzles.length, players: this.seats.length },
    };
  }

  private seat(playerId: string): Seat | undefined {
    return this.seats.find((s) => s.playerId === playerId);
  }

  submitEscape(playerId: string, action: EscapeAction): ActionResult {
    const seat = this.seat(playerId);
    if (!seat || seat.left) return fail(ERROR_CODES.FORBIDDEN, 'Not a player in this room');
    if (this.status !== 'live') return fail(ERROR_CODES.INVALID_STATE, 'The room is not open');
    const puzzle = this.room.puzzles.find((p) => p.id === action.puzzleId);
    if (!puzzle) return fail(ERROR_CODES.BAD_MESSAGE, 'Unknown lock');
    if (this.solved.has(puzzle.id)) return fail(ERROR_CODES.DUPLICATE, 'That lock is already open');
    if (action.type === 'hint') {
      this.hints.add(puzzle.id);
      this.emitState();
      return ok();
    }
    const tries = this.attempts.get(puzzle.id) ?? 0;
    if (tries >= this.cfg.maxAttemptsPerPuzzle * this.seats.length) return fail(ERROR_CODES.RATE_LIMITED, 'Too many attempts on this lock');
    this.attempts.set(puzzle.id, tries + 1);
    seat.attempts++;
    const correct = checkEscapeAnswer(puzzle, action.answer);
    this.last = { puzzleId: puzzle.id, by: playerId, correct, seq: ++this.seq };
    if (correct) {
      seat.solved++;
      this.solved.set(puzzle.id, { by: playerId, attempts: tries + 1, hinted: this.hints.has(puzzle.id) });
    }
    this.emitState();
    if (this.solved.size === this.room.puzzles.length) this.finish('finish');
    return ok();
  }

  submitAnswer(_playerId: string, _roundId: string, _answer: AnswerPayload): ActionResult {
    return fail(ERROR_CODES.INVALID_STATE, 'Escape Room uses ESCAPE_ACTION');
  }

  useAbility(): ActionResult {
    return fail(ERROR_CODES.INVALID_STATE, 'Escape Room has no abilities');
  }

  setConnected(playerId: string, connected: boolean): void {
    const seat = this.seat(playerId);
    if (!seat || seat.left || this.status === 'ended') return;
    seat.connected = connected;
    const g = this.graceTimers.get(playerId);
    if (g !== undefined) this.deps.clock.clearTimeout(g);
    this.graceTimers.delete(playerId);
    if (!connected) {
      const present = this.seats.filter((s) => !s.left && s.connected);
      this.graceTimers.set(
        playerId,
        this.deps.clock.setTimeout(() => (present.length === 0 ? this.finish('cancelled') : this.forfeit(playerId)), this.cfg.disconnectGraceMs),
      );
    }
    this.emitState();
  }

  forfeit(playerId: string): void {
    const seat = this.seat(playerId);
    if (!seat || seat.left || this.status === 'ended') return;
    seat.left = true;
    seat.connected = false;
    const g = this.graceTimers.get(playerId);
    if (g !== undefined) this.deps.clock.clearTimeout(g);
    this.graceTimers.delete(playerId);
    // The team plays on; if nobody is left, the room closes without a result.
    if (this.seats.every((s) => s.left)) this.finish('cancelled');
    else this.emitState();
  }

  private finish(reason: MatchOutcome['reason']): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    this.timer = null;
    for (const t of this.graceTimers.values()) this.deps.clock.clearTimeout(t);
    this.graceTimers.clear();
    const escaped = reason === 'finish';
    this.emitState();
    this.deps.onEnd({
      mode: this.mode,
      reason,
      winnerId: null,
      // Co-op: the whole team shares the result. Not escaping in time is a draw, never a "defeat".
      outcomes: this.seats.map((s) => ({ playerId: s.playerId, result: s.left ? 'loss' : escaped ? 'win' : 'draw' })),
      stats: this.seats.map((s) => ({ playerId: s.playerId, answered: s.attempts, correct: s.solved, incorrect: s.attempts - s.solved, avgResponseMs: null, bestCombo: 0 })),
      startedAt: this.startsAt,
      endedAt: this.deps.clock.now(),
      forfeited: this.seats.filter((s) => s.left).map((s) => s.playerId),
    });
  }

  snapshot(): ServerMessage[] {
    return [this.matchStartMessage(this.deps.clock.now()), this.stateMessage()];
  }

  peekRound(): RoundQuestion | undefined {
    return undefined;
  }

  isEnded(): boolean {
    return this.status === 'ended';
  }

  dispose(): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    for (const t of this.graceTimers.values()) this.deps.clock.clearTimeout(t);
    this.graceTimers.clear();
    this.timer = null;
    if (this.status !== 'ended') this.status = 'ended';
  }

  private stateMessage(): ServerMessage {
    return {
      type: 'PLAYER_STATE',
      matchId: this.matchId,
      state: {
        mode: 'escape-room',
        roomId: this.room.id,
        solved: [...this.solved.entries()].map(([puzzleId, v]) => ({ puzzleId, ...v })),
        attempts: Object.fromEntries(this.attempts),
        hints: [...this.hints],
        connected: this.seats.filter((s) => s.connected && !s.left).map((s) => s.playerId),
        last: this.last,
        escaped: this.status === 'ended' && this.solved.size === this.room.puzzles.length,
      },
    };
  }

  private emitState(): void {
    this.deps.emit(null, this.stateMessage());
  }
}
