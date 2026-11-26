/**
 * Authoritative Grammar Race host. Each racer answers their own copy of the same
 * question sequence; the host integrates race physics on a fixed tick and
 * broadcasts positions. Supports 2–4 racers.
 */
import { correctAnswerText, gradeAnswer, prepareRoundQuestion, type RoundQuestion } from '../content/grading';
import { ERROR_CODES, type AnswerPayload, type RacePlayerState, type ServerMessage } from '../protocol';
import {
  applyRaceAnswer,
  applyRaceTimeout,
  GRAMMAR_RACE,
  newRacer,
  racePositions,
  racerSpeed,
  stepRacer,
  type GrammarRaceConfig,
  type RacerPhysics,
} from '../rules/grammarRace';
import {
  averageOf,
  fail,
  NETWORK_GRACE_MS,
  ok,
  type ActionResult,
  type MatchHost,
  type MatchHostDeps,
  type MatchOutcome,
  type TimerHandle,
} from './common';

interface Racer {
  playerId: string;
  slot: number;
  phys: RacerPhysics;
  qIndex: number;
  current: { roundId: string; rq: RoundQuestion; startedAt: number; deadline: number } | null;
  questionTimer: TimerHandle | null;
  connected: boolean;
  graceTimer: TimerHandle | null;
  forfeited: boolean;
  answered: number;
  correct: number;
  bestStreak: number;
  responseTimes: number[];
}

type Phase = 'created' | 'countdown' | 'racing' | 'ended';

export class GrammarRaceHost implements MatchHost {
  readonly mode = 'grammar-race' as const;
  readonly matchId: string;
  private readonly deps: MatchHostDeps;
  private readonly cfg: GrammarRaceConfig;
  private readonly racers: Racer[];
  private readonly sequence: RoundQuestion[] = [];
  private readonly rounds = new Map<string, RoundQuestion>();
  private phase: Phase = 'created';
  private raceStart = 0;
  private lastTick = 0;
  private tickTimer: TimerHandle | null = null;
  private startTimer: TimerHandle | null = null;
  private firstFinishAt: number | null = null;

  constructor(deps: MatchHostDeps, cfg: Partial<GrammarRaceConfig> = {}) {
    if (deps.players.length < 2 || deps.players.length > 4) throw new Error('Grammar Race supports 2–4 racers');
    this.deps = deps;
    this.matchId = deps.matchId;
    this.cfg = { ...GRAMMAR_RACE, ...cfg };
    this.racers = deps.players.map((p, slot) => ({
      playerId: p.playerId,
      slot,
      phys: newRacer(),
      qIndex: 0,
      current: null,
      questionTimer: null,
      connected: true,
      graceTimer: null,
      forfeited: false,
      answered: 0,
      correct: 0,
      bestStreak: 0,
      responseTimes: [],
    }));
  }

  start(): void {
    if (this.phase !== 'created') return;
    const now = this.deps.clock.now();
    this.raceStart = now + this.cfg.countdownMs;
    this.phase = 'countdown';
    this.deps.emit(null, this.matchStartMessage(now));
    this.emitState();
    this.startTimer = this.deps.clock.setTimeout(() => this.beginRace(), this.cfg.countdownMs);
  }

  private matchStartMessage(now: number): ServerMessage {
    return {
      type: 'MATCH_START',
      matchId: this.matchId,
      mode: this.mode,
      players: this.deps.players,
      serverTime: now,
      startsAt: this.raceStart,
      endsAt: this.raceStart + this.cfg.maxRaceMs,
      config: {
        trackLength: this.cfg.trackLength,
        cruiseSpeed: this.cfg.cruiseSpeed,
        boostImpulse: this.cfg.boostImpulse,
        boostDecaySec: this.cfg.boostDecaySec,
        turboBoost: this.cfg.turboBoost,
        turboMs: this.cfg.turboMs,
        turboStreak: this.cfg.turboStreak,
        stallMs: this.cfg.stallMs,
        stallSpeed: this.cfg.stallSpeed,
        maxRaceMs: this.cfg.maxRaceMs,
      },
    };
  }

  private beginRace(): void {
    this.startTimer = null;
    if (this.phase !== 'countdown') return;
    this.phase = 'racing';
    this.lastTick = this.deps.clock.now();
    for (const r of this.racers) this.nextQuestion(r);
    this.scheduleTick();
  }

  private scheduleTick(): void {
    this.tickTimer = this.deps.clock.setTimeout(() => this.tick(), this.cfg.tickMs);
  }

  private tick(): void {
    this.tickTimer = null;
    if (this.phase !== 'racing') return;
    const now = this.deps.clock.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    for (const r of this.racers) {
      if (!r.connected || r.forfeited) continue;
      const wasFinished = r.phys.finishedAtMs !== null;
      stepRacer(r.phys, now - dt, dt, this.raceStart, this.cfg);
      if (!wasFinished && r.phys.finishedAtMs !== null) {
        this.clearQuestion(r);
        if (this.firstFinishAt === null) this.firstFinishAt = now;
      }
    }
    this.emitState();
    const active = this.racers.filter((r) => !r.forfeited);
    const allDone = active.every((r) => r.phys.finishedAtMs !== null || !r.connected);
    const graceOver = this.firstFinishAt !== null && now - this.firstFinishAt >= this.cfg.finishGraceMs;
    const timeOver = now - this.raceStart >= this.cfg.maxRaceMs;
    if (allDone || graceOver || timeOver) {
      this.finish(this.firstFinishAt !== null ? 'finish' : 'timeout');
      return;
    }
    this.scheduleTick();
  }

  private questionAt(index: number): RoundQuestion {
    while (this.sequence.length <= index) {
      const i = this.sequence.length;
      this.sequence.push(prepareRoundQuestion(this.deps.questions.next(i), `${this.matchId}-q${i + 1}`, this.deps.random));
    }
    return this.sequence[index]!;
  }

  private nextQuestion(r: Racer): void {
    if (this.phase !== 'racing' || r.phys.finishedAtMs !== null || r.forfeited) return;
    const now = this.deps.clock.now();
    const rq = this.questionAt(r.qIndex);
    const roundId = `${this.matchId}-p${r.slot}-q${r.qIndex + 1}`;
    const duration = Math.min(this.cfg.questionMs, rq.question.timeLimitSec * 1000);
    r.current = { roundId, rq, startedAt: now, deadline: now + duration };
    this.rounds.set(roundId, rq);
    r.qIndex++;
    if (r.connected) this.deps.emit(r.playerId, this.roundStartMessage(r, now));
    r.questionTimer = this.deps.clock.setTimeout(() => this.timeoutQuestion(r, roundId), duration + NETWORK_GRACE_MS);
  }

  private roundStartMessage(r: Racer, now: number): ServerMessage {
    const c = r.current!;
    return {
      type: 'ROUND_START',
      matchId: this.matchId,
      roundId: c.roundId,
      index: r.qIndex - 1,
      question: { ...c.rq.question, timeLimitSec: Math.round((c.deadline - c.startedAt) / 1000) },
      serverTime: now,
      deadline: c.deadline,
      finalRound: false,
    };
  }

  private clearQuestion(r: Racer): void {
    if (r.questionTimer !== null) this.deps.clock.clearTimeout(r.questionTimer);
    r.questionTimer = null;
    r.current = null;
  }

  private timeoutQuestion(r: Racer, roundId: string): void {
    r.questionTimer = null;
    if (!r.current || r.current.roundId !== roundId) return;
    applyRaceTimeout(r.phys);
    this.sendResult(r, r.current.rq, roundId, null, null);
    r.current = null;
    this.deps.clock.setTimeout(() => this.nextQuestion(r), this.cfg.feedbackMs);
  }

  submitAnswer(playerId: string, roundId: string, answer: AnswerPayload): ActionResult {
    const r = this.racers.find((x) => x.playerId === playerId);
    if (!r) return fail(ERROR_CODES.FORBIDDEN, 'Not a racer in this match');
    if (this.phase !== 'racing') return fail(ERROR_CODES.INVALID_STATE, 'Race is not running');
    if (!r.current) {
      return this.rounds.has(roundId)
        ? fail(ERROR_CODES.DUPLICATE, 'Answer already submitted')
        : fail(ERROR_CODES.INVALID_STATE, 'No active question');
    }
    if (r.current.roundId !== roundId) {
      return this.rounds.has(roundId)
        ? fail(ERROR_CODES.DUPLICATE, 'Answer already submitted')
        : fail(ERROR_CODES.STALE_ROUND, 'Unknown question');
    }
    if (answer.kind !== 'option') return fail(ERROR_CODES.BAD_MESSAGE, 'Expected option');
    if (!r.current.rq.question.options?.some((o) => o.id === answer.optionId)) {
      return fail(ERROR_CODES.BAD_MESSAGE, 'Unknown option');
    }
    const now = this.deps.clock.now();
    if (now > r.current.deadline + NETWORK_GRACE_MS) return fail(ERROR_CODES.STALE_ROUND, 'Too late');
    const grade = gradeAnswer(r.current.rq, answer);
    const responseMs = Math.max(0, now - r.current.startedAt);
    r.answered++;
    if (grade.correct) {
      r.correct++;
      r.responseTimes.push(responseMs);
    }
    applyRaceAnswer(r.phys, grade.correct, now, this.cfg);
    r.bestStreak = Math.max(r.bestStreak, r.phys.streak);
    const rq = r.current.rq;
    if (r.questionTimer !== null) this.deps.clock.clearTimeout(r.questionTimer);
    r.questionTimer = null;
    r.current = null;
    this.sendResult(r, rq, roundId, grade, responseMs);
    this.emitState();
    this.deps.clock.setTimeout(() => this.nextQuestion(r), this.cfg.feedbackMs);
    return ok();
  }

  private sendResult(
    r: Racer,
    rq: RoundQuestion,
    roundId: string,
    grade: ReturnType<typeof gradeAnswer> | null,
    responseMs: number | null,
  ): void {
    const item = rq.item;
    this.deps.onRound?.({
      roundIndex: r.qIndex - 1,
      item,
      results: [{ playerId: r.playerId, answered: !!grade, correct: !!grade?.correct, responseMs }],
    });
    this.deps.emit(r.playerId, {
      type: 'ANSWER_RESULT',
      matchId: this.matchId,
      roundId,
      prompt: item.prompt,
      results: [
        {
          playerId: r.playerId,
          answered: !!grade,
          correct: !!grade?.correct,
          responseMs,
          ...(grade ? { answerText: grade.answerText } : {}),
          ...(grade?.errorCategory ? { errorCategory: grade.errorCategory } : {}),
          ...(grade?.feedback ? { feedback: grade.feedback } : {}),
        },
      ],
      correctAnswer: correctAnswerText(rq),
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

  useAbility(): ActionResult {
    return fail(ERROR_CODES.INVALID_STATE, 'Grammar Race has no manual abilities');
  }

  private finish(reason: MatchOutcome['reason'], forfeiter?: string): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.clearTimers();
    const order = racePositions(
      this.racers.map((r) => ({
        playerId: r.playerId,
        distance: r.forfeited ? -1 : r.phys.distance,
        finishedAtMs: r.forfeited ? null : r.phys.finishedAtMs,
      })),
    );
    if (forfeiter) {
      // A forfeiting racer is always last.
      order.splice(order.indexOf(forfeiter), 1);
      order.push(forfeiter);
    }
    const first = this.racers.find((r) => r.playerId === order[0])!;
    const second = this.racers.find((r) => r.playerId === order[1])!;
    const tie =
      !forfeiter &&
      first.phys.finishedAtMs === null &&
      second.phys.finishedAtMs === null &&
      Math.abs(first.phys.distance - second.phys.distance) < 0.5;
    const tieFinish =
      !forfeiter && first.phys.finishedAtMs !== null && first.phys.finishedAtMs === second.phys.finishedAtMs;
    const isDraw = reason !== 'cancelled' && (tie || tieFinish) && this.racers.length === 2;
    const outcome: MatchOutcome = {
      mode: this.mode,
      reason,
      winnerId: reason === 'cancelled' || isDraw ? null : order[0]!,
      outcomes: this.racers.map((r) => ({
        playerId: r.playerId,
        result: reason === 'cancelled' || isDraw ? 'draw' : r.playerId === order[0] ? 'win' : 'loss',
      })),
      stats: this.racers.map((r) => ({
        playerId: r.playerId,
        answered: r.answered,
        correct: r.correct,
        incorrect: r.answered - r.correct,
        avgResponseMs: averageOf(r.responseTimes),
        bestCombo: r.bestStreak,
        distance: Math.round(r.phys.distance),
        finishMs: r.phys.finishedAtMs,
        position: order.indexOf(r.playerId) + 1,
      })),
      startedAt: this.raceStart,
      endedAt: this.deps.clock.now(),
    };
    this.deps.onEnd(outcome);
  }

  setConnected(playerId: string, connected: boolean): void {
    const r = this.racers.find((x) => x.playerId === playerId);
    if (!r || this.phase === 'ended') return;
    r.connected = connected;
    if (r.graceTimer !== null) this.deps.clock.clearTimeout(r.graceTimer);
    r.graceTimer = null;
    if (!connected) {
      const allGone = this.racers.every((x) => !x.connected);
      r.graceTimer = this.deps.clock.setTimeout(
        () => (allGone ? this.finish('cancelled') : this.forfeit(playerId)),
        this.cfg.disconnectGraceMs,
      );
    }
    this.emitState();
  }

  forfeit(playerId: string): void {
    const r = this.racers.find((x) => x.playerId === playerId);
    if (!r || this.phase === 'ended') return;
    r.forfeited = true;
    this.clearQuestion(r);
    const remaining = this.racers.filter((x) => !x.forfeited);
    if (remaining.length <= 1) this.finish('forfeit', playerId);
  }

  snapshot(playerId: string): ServerMessage[] {
    const now = this.deps.clock.now();
    const msgs: ServerMessage[] = [this.matchStartMessage(now), this.stateMessage()];
    const r = this.racers.find((x) => x.playerId === playerId);
    if (r?.current) msgs.push(this.roundStartMessage(r, now));
    return msgs;
  }

  peekRound(roundId: string): RoundQuestion | undefined {
    return this.rounds.get(roundId);
  }

  isEnded(): boolean {
    return this.phase === 'ended';
  }

  private clearTimers(): void {
    if (this.tickTimer !== null) this.deps.clock.clearTimeout(this.tickTimer);
    if (this.startTimer !== null) this.deps.clock.clearTimeout(this.startTimer);
    this.tickTimer = null;
    this.startTimer = null;
    for (const r of this.racers) {
      this.clearQuestion(r);
      if (r.graceTimer !== null) this.deps.clock.clearTimeout(r.graceTimer);
      r.graceTimer = null;
    }
  }

  dispose(): void {
    this.clearTimers();
    this.phase = 'ended';
  }

  private stateMessage(): ServerMessage {
    const now = this.deps.clock.now();
    const players: RacePlayerState[] = this.racers.map((r) => ({
      playerId: r.playerId,
      distance: Math.round(r.phys.distance * 10) / 10,
      speed: Math.round(racerSpeed(r.phys, now, this.cfg) * 10) / 10,
      streak: r.phys.streak,
      turbo: now < r.phys.turboUntil,
      stalled: now < r.phys.stallUntil,
      finishedAtMs: r.phys.finishedAtMs,
      connected: r.connected && !r.forfeited,
    }));
    return {
      type: 'PLAYER_STATE',
      matchId: this.matchId,
      state: {
        mode: 'grammar-race',
        trackLength: this.cfg.trackLength,
        elapsedMs: Math.max(0, now - this.raceStart),
        players,
      },
    };
  }

  private emitState(): void {
    this.deps.emit(null, this.stateMessage());
  }
}
