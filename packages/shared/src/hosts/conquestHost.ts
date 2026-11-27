/**
 * Authoritative English Conquest host (2–4 players, turn-based).
 *
 * Runs on the multiplayer server. Each turn the active player answers one question
 * (sent only to them; the key stays here until they answer or time runs out), then
 * takes up to three strategy actions. All legality, combat and victory checks use the
 * pure rules in `rules/conquest.ts`. Clients only send intents.
 */
import { correctAnswerText, gradeAnswer, prepareRoundQuestion, type RoundQuestion } from '../content/grading';
import { ERROR_CODES, type AnswerPayload, type ServerMessage } from '../protocol';
import {
  answerQuestion,
  applyAction,
  createConquest,
  currentPlayer,
  eliminatePlayer,
  endTurn,
  type ConquestAction,
  type ConquestState,
} from '../rules/conquest';
import { averageOf, fail, NETWORK_GRACE_MS, ok, type ActionResult, type MatchHost, type MatchHostDeps, type MatchOutcome, type TimerHandle } from './common';

export const CONQUEST_ONLINE = {
  countdownMs: 3000,
  /** Time for the three actions of a turn. */
  actionPhaseMs: 45_000,
  /** Pause after an answer so everyone can read the result. */
  answerRevealMs: 1800,
  /** A disconnected player's turn is skipped after this long. */
  disconnectedTurnMs: 8000,
  /** A player disconnected for longer than this leaves the conquest. */
  disconnectGraceMs: 60_000,
  /** Recent log entries included in each state message. */
  logTail: 24,
};

interface Seat {
  playerId: string;
  connected: boolean;
  left: boolean;
  responseTimes: number[];
  combo: number;
  bestCombo: number;
}

interface Question {
  id: string;
  index: number;
  playerId: string;
  rq: RoundQuestion;
  startedAt: number;
  deadline: number;
  answered: boolean;
}

export class ConquestHost implements MatchHost {
  readonly mode = 'english-conquest' as const;
  readonly matchId: string;
  private readonly deps: MatchHostDeps;
  private readonly cfg: typeof CONQUEST_ONLINE;
  private s: ConquestState;
  private readonly seats: Seat[];
  private status: 'created' | 'countdown' | 'live' | 'ended' = 'created';
  private question: Question | null = null;
  private pastQuestions = new Map<string, RoundQuestion>();
  private questionIndex = 0;
  private timer: TimerHandle | null = null;
  private phaseDeadline: number | null = null;
  private graceTimers = new Map<string, TimerHandle>();
  private startsAt = 0;

  constructor(deps: MatchHostDeps, cfg: Partial<typeof CONQUEST_ONLINE> = {}) {
    if (deps.players.length < 2 || deps.players.length > 4) throw new Error('English Conquest needs 2–4 players');
    this.deps = deps;
    this.matchId = deps.matchId;
    this.cfg = { ...CONQUEST_ONLINE, ...cfg };
    this.s = createConquest(deps.players.map((p) => ({ id: p.playerId, name: p.nickname, isBot: p.isBot, ...(p.botTier ? { botTier: p.botTier } : {}) })));
    this.seats = deps.players.map((p) => ({ playerId: p.playerId, connected: true, left: false, responseTimes: [], combo: 0, bestCombo: 0 }));
  }

  /** Read-only view of the authoritative state (tests / in-process tools). */
  get state(): ConquestState {
    return this.s;
  }

  start(): void {
    if (this.status !== 'created') return;
    const now = this.deps.clock.now();
    this.startsAt = now + this.cfg.countdownMs;
    this.status = 'countdown';
    this.deps.emit(null, this.matchStartMessage(now));
    this.emitState();
    this.schedule(() => {
      this.status = 'live';
      this.beginTurn();
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
      endsAt: null,
      config: { actionPhaseMs: this.cfg.actionPhaseMs, players: this.seats.length },
    };
  }

  private schedule(fn: () => void, ms: number): void {
    this.clearTimer();
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private seat(playerId: string): Seat | undefined {
    return this.seats.find((x) => x.playerId === playerId);
  }

  /** Starts the question phase for the current player (or skips an absent player). */
  private beginTurn(): void {
    if (this.status !== 'live') return;
    if (this.s.phase === 'ended') return this.finish();
    const active = currentPlayer(this.s).id;
    const seat = this.seat(active)!;
    const now = this.deps.clock.now();
    const item = this.deps.questions.next(this.questionIndex);
    const qid = `${this.matchId}-q${this.questionIndex + 1}`;
    const rq = prepareRoundQuestion(item, qid, this.deps.random);
    const durationMs = rq.question.timeLimitSec * 1000;
    this.question = { id: qid, index: this.questionIndex, playerId: active, rq, startedAt: now, deadline: now + durationMs, answered: false };
    this.pastQuestions.set(qid, rq);
    this.questionIndex++;
    if (!seat.connected) {
      // Absent players lose their question (no gold bonus) after a short wait.
      this.phaseDeadline = now + this.cfg.disconnectedTurnMs;
      this.emitState();
      this.schedule(() => this.resolveQuestion(null), this.cfg.disconnectedTurnMs);
      return;
    }
    this.phaseDeadline = this.question.deadline;
    this.deps.emit(active, this.roundStartMessage(now));
    this.emitState();
    this.schedule(() => this.resolveQuestion(null), durationMs + NETWORK_GRACE_MS);
  }

  private roundStartMessage(now: number): ServerMessage {
    const q = this.question!;
    return { type: 'ROUND_START', matchId: this.matchId, roundId: q.id, index: q.index, question: q.rq.question, serverTime: now, deadline: q.deadline, finalRound: false };
  }

  submitAnswer(playerId: string, roundId: string, answer: AnswerPayload): ActionResult {
    if (!this.seat(playerId)) return fail(ERROR_CODES.FORBIDDEN, 'Not a player in this match');
    const q = this.question;
    if (this.status !== 'live' || this.s.phase !== 'question' || !q) return fail(ERROR_CODES.INVALID_STATE, 'No question in progress');
    if (q.playerId !== playerId) return fail(ERROR_CODES.FORBIDDEN, 'It is not your turn');
    if (q.id !== roundId) return fail(ERROR_CODES.STALE_ROUND, 'That question is over');
    if (q.answered) return fail(ERROR_CODES.DUPLICATE, 'Answer already submitted');
    if (answer.kind !== 'option' || !q.rq.question.options?.some((o) => o.id === answer.optionId)) return fail(ERROR_CODES.BAD_MESSAGE, 'Unknown option');
    const now = this.deps.clock.now();
    if (now > q.deadline + NETWORK_GRACE_MS) return fail(ERROR_CODES.STALE_ROUND, 'Too late');
    this.resolveQuestion({ answer, responseMs: Math.max(0, Math.min(now - q.startedAt, q.deadline - q.startedAt)) });
    return ok();
  }

  private resolveQuestion(given: { answer: AnswerPayload; responseMs: number } | null): void {
    const q = this.question;
    if (!q || q.answered || this.s.phase !== 'question' || this.status !== 'live') return;
    q.answered = true;
    this.clearTimer();
    const grade = given ? gradeAnswer(q.rq, given.answer) : null;
    const correct = !!grade?.correct;
    const seat = this.seat(q.playerId)!;
    if (correct && given) {
      seat.responseTimes.push(given.responseMs);
      seat.combo++;
      seat.bestCombo = Math.max(seat.bestCombo, seat.combo);
    } else seat.combo = 0;
    this.s = answerQuestion(this.s, correct);
    const result = { playerId: q.playerId, answered: !!given, correct, responseMs: given ? given.responseMs : null };
    this.deps.onRound?.({ roundIndex: q.index, item: q.rq.item, results: [result] });
    if (seat.connected) {
      const item = q.rq.item;
      this.deps.emit(q.playerId, {
        type: 'ANSWER_RESULT',
        matchId: this.matchId,
        roundId: q.id,
        prompt: item.prompt,
        results: [
          grade
            ? { ...result, answerText: grade.answerText, ...(grade.errorCategory ? { errorCategory: grade.errorCategory } : {}), ...(grade.feedback ? { feedback: grade.feedback } : {}) }
            : result,
        ],
        correctAnswer: correctAnswerText(q.rq),
        explanation: item.explanation,
        ...(item.example ? { example: item.example } : {}),
        learning: {
          itemId: item.id,
          level: item.level,
          primarySkill: item.primarySkill,
          secondarySkills: item.secondarySkills,
          vocabularyTags: item.tags.vocabulary,
          grammarTags: item.tags.grammar,
          category: item.category,
          publicItem: this.deps.questions.publicItems,
        },
      });
    }
    // Absent players skip their action phase entirely.
    if (!seat.connected) {
      this.s = endTurn(this.s);
      this.phaseDeadline = null;
      this.emitState();
      this.schedule(() => this.beginTurn(), this.cfg.answerRevealMs);
      return;
    }
    const now = this.deps.clock.now();
    this.phaseDeadline = now + this.cfg.answerRevealMs + this.cfg.actionPhaseMs;
    this.emitState();
    this.schedule(() => this.timeUp(), this.cfg.answerRevealMs + this.cfg.actionPhaseMs + NETWORK_GRACE_MS);
  }

  submitAction(playerId: string, action: ConquestAction): ActionResult {
    if (!this.seat(playerId)) return fail(ERROR_CODES.FORBIDDEN, 'Not a player in this match');
    if (this.status !== 'live' || this.s.phase !== 'actions') return fail(ERROR_CODES.INVALID_STATE, 'Not in the action phase');
    if (currentPlayer(this.s).id !== playerId) return fail(ERROR_CODES.FORBIDDEN, 'It is not your turn');
    const r = applyAction(this.s, action);
    if (!r.ok) return fail(ERROR_CODES.INVALID_STATE, r.error);
    const turnBefore = this.s.turn;
    const roundBefore = this.s.round;
    this.s = r.state;
    // The turn passes automatically once all actions are spent.
    if (this.s.phase === 'actions' && this.s.actionsLeft <= 0) this.s = endTurn(this.s);
    if (this.s.phase === 'ended') {
      this.emitState();
      this.finish();
      return ok();
    }
    if (action.type === 'end' || this.s.turn !== turnBefore || this.s.round !== roundBefore) {
      this.afterTurn();
    } else {
      this.emitState();
    }
    return ok();
  }

  /** Action phase timed out: the turn ends automatically. */
  private timeUp(): void {
    if (this.status !== 'live' || this.s.phase !== 'actions') return;
    this.s = endTurn(this.s);
    this.afterTurn();
  }

  private afterTurn(): void {
    this.clearTimer();
    this.question = null;
    this.phaseDeadline = null;
    this.emitState();
    if (this.s.phase === 'ended') return this.finish();
    this.beginTurn();
  }

  useAbility(): ActionResult {
    return fail(ERROR_CODES.INVALID_STATE, 'English Conquest has no abilities');
  }

  setConnected(playerId: string, connected: boolean): void {
    const seat = this.seat(playerId);
    if (!seat || seat.left || this.status === 'ended') return;
    seat.connected = connected;
    const existing = this.graceTimers.get(playerId);
    if (existing !== undefined) {
      this.deps.clock.clearTimeout(existing);
      this.graceTimers.delete(playerId);
    }
    if (!connected) {
      const present = this.seats.filter((x) => !x.left && x.connected);
      if (present.length === 0) {
        this.graceTimers.set(playerId, this.deps.clock.setTimeout(() => this.finish('cancelled'), this.cfg.disconnectGraceMs));
      } else {
        this.graceTimers.set(playerId, this.deps.clock.setTimeout(() => this.forfeit(playerId), this.cfg.disconnectGraceMs));
      }
      // Don't keep everyone waiting for an absent player's turn.
      if (this.status === 'live' && currentPlayer(this.s).id === playerId) {
        const now = this.deps.clock.now();
        this.phaseDeadline = now + this.cfg.disconnectedTurnMs;
        this.schedule(() => {
          if (this.s.phase === 'question') this.resolveQuestion(null);
          else this.timeUp();
        }, this.cfg.disconnectedTurnMs);
      }
    } else if (this.status === 'live' && currentPlayer(this.s).id === playerId) {
      // Back in time: restore a fair deadline for the rest of the turn.
      const now = this.deps.clock.now();
      const q = this.question;
      if (this.s.phase === 'question' && q && !q.answered && q.playerId === playerId && now < q.deadline) {
        this.phaseDeadline = q.deadline;
        this.deps.emit(playerId, this.roundStartMessage(now));
        this.schedule(() => this.resolveQuestion(null), q.deadline - now + NETWORK_GRACE_MS);
      } else if (this.s.phase === 'actions') {
        const ms = Math.round(this.cfg.actionPhaseMs / 2);
        this.phaseDeadline = now + ms;
        this.schedule(() => this.timeUp(), ms + NETWORK_GRACE_MS);
      }
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
    const wasTurn = currentPlayer(this.s).id === playerId;
    this.s = eliminatePlayer(this.s, playerId);
    if (this.s.phase === 'ended') {
      this.emitState();
      this.finish(this.seats.filter((x) => !x.left).length <= 1 ? 'forfeit' : undefined);
      return;
    }
    if (wasTurn && this.status === 'live') this.afterTurn();
    else this.emitState();
  }

  private finish(forced?: MatchOutcome['reason']): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.clearTimer();
    for (const t of this.graceTimers.values()) this.deps.clock.clearTimeout(t);
    this.graceTimers.clear();
    this.phaseDeadline = null;
    const winnerId = forced === 'cancelled' ? null : this.s.winnerId;
    const reason: MatchOutcome['reason'] = forced ?? (this.s.endReason === 'rounds' ? 'rounds-complete' : 'finish');
    this.emitState();
    this.deps.onEnd({
      mode: this.mode,
      reason,
      winnerId,
      outcomes: this.s.players.map((p) => ({ playerId: p.id, result: winnerId === null ? 'draw' : p.id === winnerId ? 'win' : 'loss' })),
      stats: this.s.players.map((p) => {
        const seat = this.seat(p.id)!;
        return {
          playerId: p.id,
          answered: p.questionsAnswered,
          correct: p.correctAnswers,
          incorrect: p.questionsAnswered - p.correctAnswers,
          avgResponseMs: averageOf(seat.responseTimes),
          bestCombo: seat.bestCombo,
        };
      }),
      startedAt: this.startsAt,
      endedAt: this.deps.clock.now(),
      forfeited: this.seats.filter((x) => x.left).map((x) => x.playerId),
    });
  }

  snapshot(playerId: string): ServerMessage[] {
    const now = this.deps.clock.now();
    const msgs: ServerMessage[] = [this.matchStartMessage(now), this.stateMessage()];
    const q = this.question;
    if (q && !q.answered && q.playerId === playerId && this.s.phase === 'question' && this.status === 'live') msgs.push(this.roundStartMessage(now));
    return msgs;
  }

  peekRound(roundId: string): RoundQuestion | undefined {
    return this.pastQuestions.get(roundId);
  }

  isEnded(): boolean {
    return this.status === 'ended';
  }

  dispose(): void {
    this.clearTimer();
    for (const t of this.graceTimers.values()) this.deps.clock.clearTimeout(t);
    this.graceTimers.clear();
    if (this.status !== 'ended') this.status = 'ended';
  }

  private stateMessage(): ServerMessage {
    return {
      type: 'PLAYER_STATE',
      matchId: this.matchId,
      state: {
        mode: 'english-conquest',
        state: { ...this.s, log: this.s.log.slice(-this.cfg.logTail) },
        connected: this.seats.filter((x) => x.connected && !x.left).map((x) => x.playerId),
        phaseDeadline: this.phaseDeadline,
      },
    };
  }

  private emitState(): void {
    this.deps.emit(null, this.stateMessage());
  }
}
