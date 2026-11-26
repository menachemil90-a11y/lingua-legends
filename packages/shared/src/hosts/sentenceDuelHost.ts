/**
 * Authoritative Sentence Master duel host: both players build the same sentence
 * from shuffled tiles; correct sentences score points (two attempts per round).
 */
import { correctAnswerText, gradeAnswer, prepareRoundQuestion, type GradeResult, type RoundQuestion } from '../content/grading';
import { ERROR_CODES, type AnswerPayload, type SentencePlayerState, type ServerMessage } from '../protocol';
import { SENTENCE_MASTER, sentencePoints, type SentenceMasterConfig } from '../rules/sentenceMaster';
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

interface Builder {
  playerId: string;
  score: number;
  solved: number;
  attemptsUsed: number;
  done: boolean;
  lastGrade: GradeResult | null;
  solvedMs: number | null;
  connected: boolean;
  graceTimer: TimerHandle | null;
  answeredRounds: number;
  responseTimes: number[];
  streak: number;
  bestStreak: number;
}

type Phase = 'created' | 'countdown' | 'round' | 'resolving' | 'ended';

export class SentenceDuelHost implements MatchHost {
  readonly mode = 'sentence-master' as const;
  readonly matchId: string;
  private readonly deps: MatchHostDeps;
  private readonly cfg: SentenceMasterConfig;
  private readonly builders: Builder[];
  private phase: Phase = 'created';
  private roundIndex = 0;
  private round: { id: string; rq: RoundQuestion; startedAt: number; deadline: number } | null = null;
  private readonly rounds = new Map<string, RoundQuestion>();
  private timer: TimerHandle | null = null;
  private startsAt = 0;

  constructor(deps: MatchHostDeps, cfg: Partial<SentenceMasterConfig> = {}) {
    if (deps.players.length !== 2) throw new Error('Sentence Master duel is 1v1');
    this.deps = deps;
    this.matchId = deps.matchId;
    this.cfg = { ...SENTENCE_MASTER, ...cfg };
    this.builders = deps.players.map((p) => ({
      playerId: p.playerId,
      score: 0,
      solved: 0,
      attemptsUsed: 0,
      done: false,
      lastGrade: null,
      solvedMs: null,
      connected: true,
      graceTimer: null,
      answeredRounds: 0,
      responseTimes: [],
      streak: 0,
      bestStreak: 0,
    }));
  }

  start(): void {
    if (this.phase !== 'created') return;
    const now = this.deps.clock.now();
    this.startsAt = now + this.cfg.countdownMs;
    this.phase = 'countdown';
    this.deps.emit(null, this.matchStartMessage(now));
    this.emitState();
    this.schedule(() => this.startRound(), this.cfg.countdownMs);
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
      config: {
        rounds: this.cfg.rounds,
        attempts: this.cfg.attempts,
        firstTryPoints: this.cfg.firstTryPoints,
        secondTryPoints: this.cfg.secondTryPoints,
        speedBonusMax: this.cfg.speedBonusMax,
      },
    };
  }

  private schedule(fn: () => void, ms: number): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  private startRound(): void {
    if (this.phase === 'ended') return;
    const now = this.deps.clock.now();
    const item = this.deps.questions.next(this.roundIndex);
    const roundId = `${this.matchId}-s${this.roundIndex + 1}`;
    const rq = prepareRoundQuestion(item, roundId, this.deps.random);
    const durationMs = rq.question.timeLimitSec * 1000;
    this.round = { id: roundId, rq, startedAt: now, deadline: now + durationMs };
    this.rounds.set(roundId, rq);
    for (const b of this.builders) {
      b.attemptsUsed = 0;
      b.done = false;
      b.lastGrade = null;
      b.solvedMs = null;
    }
    this.phase = 'round';
    this.deps.emit(null, this.roundStartMessage(now));
    this.emitState();
    this.schedule(() => this.resolveRound(), durationMs + NETWORK_GRACE_MS);
  }

  private roundStartMessage(now: number): ServerMessage {
    const r = this.round!;
    return {
      type: 'ROUND_START',
      matchId: this.matchId,
      roundId: r.id,
      index: this.roundIndex,
      question: r.rq.question,
      serverTime: now,
      deadline: r.deadline,
      finalRound: this.roundIndex === this.cfg.rounds - 1,
    };
  }

  submitAnswer(playerId: string, roundId: string, answer: AnswerPayload): ActionResult {
    const b = this.builders.find((x) => x.playerId === playerId);
    if (!b) return fail(ERROR_CODES.FORBIDDEN, 'Not a player in this match');
    if (this.phase !== 'round' || !this.round) return fail(ERROR_CODES.INVALID_STATE, 'No round in progress');
    if (this.round.id !== roundId) return fail(ERROR_CODES.STALE_ROUND, 'That round is over');
    if (b.done) return fail(ERROR_CODES.DUPLICATE, 'Round already completed');
    if (answer.kind !== 'tiles') return fail(ERROR_CODES.BAD_MESSAGE, 'Expected tiles');
    const known = new Set(Object.keys(this.round.rq.tileMap));
    if (!answer.tileIds.every((t) => known.has(t))) return fail(ERROR_CODES.BAD_MESSAGE, 'Unknown tile');
    const now = this.deps.clock.now();
    if (now > this.round.deadline + NETWORK_GRACE_MS) return fail(ERROR_CODES.STALE_ROUND, 'Too late');
    const grade = gradeAnswer(this.round.rq, answer);
    b.attemptsUsed++;
    b.lastGrade = grade;
    const responseMs = Math.max(0, now - this.round.startedAt);
    if (grade.correct) {
      b.done = true;
      b.solved++;
      b.solvedMs = responseMs;
      b.responseTimes.push(responseMs);
      b.score += sentencePoints(b.attemptsUsed, responseMs, this.round.deadline - this.round.startedAt, this.cfg);
    } else if (b.attemptsUsed >= this.cfg.attempts) {
      b.done = true;
    }
    if (!b.done) {
      this.deps.emit(playerId, {
        type: 'ATTEMPT_RESULT',
        matchId: this.matchId,
        roundId,
        correct: false,
        attemptsLeft: this.cfg.attempts - b.attemptsUsed,
      });
    } else {
      this.deps.emit(null, { type: 'ANSWER_LOCKED', matchId: this.matchId, roundId, playerId });
    }
    if (this.builders.every((x) => x.done || !x.connected)) this.resolveRound();
    else this.emitState();
    return ok();
  }

  useAbility(): ActionResult {
    return fail(ERROR_CODES.INVALID_STATE, 'Sentence Master has no abilities');
  }

  private resolveRound(): void {
    if (this.phase !== 'round' || !this.round) return;
    this.phase = 'resolving';
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    this.timer = null;
    const r = this.round;
    const item = r.rq.item;
    const results = this.builders.map((b) => {
      const answered = b.attemptsUsed > 0;
      if (answered) b.answeredRounds++;
      const correct = !!b.lastGrade?.correct;
      b.streak = correct ? b.streak + 1 : 0;
      b.bestStreak = Math.max(b.bestStreak, b.streak);
      return { playerId: b.playerId, answered, correct, responseMs: b.solvedMs };
    });
    this.deps.onRound?.({ roundIndex: this.roundIndex, item, results });
    for (const b of this.builders) {
      this.deps.emit(b.playerId, {
        type: 'ANSWER_RESULT',
        matchId: this.matchId,
        roundId: r.id,
        prompt: item.prompt,
        results: results.map((res) =>
          res.playerId === b.playerId && b.lastGrade
            ? {
                ...res,
                answerText: b.lastGrade.answerText,
                ...(b.lastGrade.errorCategory ? { errorCategory: b.lastGrade.errorCategory } : {}),
                ...(b.lastGrade.feedback ? { feedback: b.lastGrade.feedback } : {}),
              }
            : res,
        ),
        correctAnswer: correctAnswerText(r.rq),
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
    this.emitState();
    this.roundIndex++;
    if (this.roundIndex >= this.cfg.rounds) {
      this.schedule(() => this.finish('rounds-complete'), 600);
      return;
    }
    this.schedule(() => this.startRound(), this.cfg.resolveMs);
  }

  private finish(reason: MatchOutcome['reason'], forfeiter?: string): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.clearTimers();
    const [a, b] = this.builders as [Builder, Builder];
    let ra: 'win' | 'loss' | 'draw';
    if (reason === 'cancelled') ra = 'draw';
    else if (forfeiter) ra = forfeiter === a.playerId ? 'loss' : 'win';
    else ra = a.score === b.score ? 'draw' : a.score > b.score ? 'win' : 'loss';
    const rb = ra === 'draw' ? 'draw' : ra === 'win' ? 'loss' : 'win';
    this.deps.onEnd({
      mode: this.mode,
      reason,
      winnerId: ra === 'win' ? a.playerId : rb === 'win' ? b.playerId : null,
      outcomes: [
        { playerId: a.playerId, result: ra },
        { playerId: b.playerId, result: rb },
      ],
      stats: this.builders.map((x) => ({
        playerId: x.playerId,
        answered: x.answeredRounds,
        correct: x.solved,
        incorrect: Math.max(0, this.roundIndex - x.solved),
        avgResponseMs: averageOf(x.responseTimes),
        bestCombo: x.bestStreak,
        score: x.score,
      })),
      startedAt: this.startsAt,
      endedAt: this.deps.clock.now(),
    });
  }

  setConnected(playerId: string, connected: boolean): void {
    const b = this.builders.find((x) => x.playerId === playerId);
    if (!b || this.phase === 'ended') return;
    b.connected = connected;
    if (b.graceTimer !== null) this.deps.clock.clearTimeout(b.graceTimer);
    b.graceTimer = null;
    if (!connected) {
      const allGone = this.builders.every((x) => !x.connected);
      b.graceTimer = this.deps.clock.setTimeout(
        () => (allGone ? this.finish('cancelled') : this.forfeit(playerId)),
        this.cfg.disconnectGraceMs,
      );
      if (this.phase === 'round' && this.builders.every((x) => x.done || !x.connected)) this.resolveRound();
    }
    this.emitState();
  }

  forfeit(playerId: string): void {
    if (!this.builders.some((x) => x.playerId === playerId) || this.phase === 'ended') return;
    this.finish('forfeit', playerId);
  }

  snapshot(_playerId: string): ServerMessage[] {
    const now = this.deps.clock.now();
    const msgs: ServerMessage[] = [this.matchStartMessage(now), this.stateMessage()];
    if (this.phase === 'round' && this.round) msgs.push(this.roundStartMessage(now));
    return msgs;
  }

  peekRound(roundId: string): RoundQuestion | undefined {
    return this.rounds.get(roundId);
  }

  isEnded(): boolean {
    return this.phase === 'ended';
  }

  private clearTimers(): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    this.timer = null;
    for (const b of this.builders) {
      if (b.graceTimer !== null) this.deps.clock.clearTimeout(b.graceTimer);
      b.graceTimer = null;
    }
  }

  dispose(): void {
    this.clearTimers();
    this.phase = 'ended';
  }

  private stateMessage(): ServerMessage {
    const players: SentencePlayerState[] = this.builders.map((b) => ({
      playerId: b.playerId,
      score: b.score,
      solved: b.solved,
      attemptsLeft: this.cfg.attempts - b.attemptsUsed,
      done: b.done,
      connected: b.connected,
    }));
    return { type: 'PLAYER_STATE', matchId: this.matchId, state: { mode: 'sentence-master', players } };
  }

  private emitState(): void {
    this.deps.emit(null, this.stateMessage());
  }
}
