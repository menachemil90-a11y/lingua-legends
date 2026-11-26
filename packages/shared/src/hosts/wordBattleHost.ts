/**
 * Authoritative Word Battle match host.
 *
 * Runs on the multiplayer server for online matches and in the browser for
 * offline bot practice. All rules (correctness, damage, abilities, winner)
 * are decided here from player intents — never by the client UI.
 */
import { correctAnswerText, gradeAnswer, prepareRoundQuestion, type GradeResult, type RoundQuestion } from '../content/grading';
import type { AnswerPayload, CombatEvent, ServerMessage, WordBattlePlayerState } from '../protocol';
import { ERROR_CODES } from '../protocol';
import { computeDamage, decideBattle, WORD_BATTLE, type WordBattleConfig } from '../rules/wordBattle';
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

interface Fighter {
  playerId: string;
  hp: number;
  combo: number;
  bestCombo: number;
  abilityCharged: boolean;
  shield: boolean;
  surge: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  answered: number;
  correct: number;
  responseTimes: number[];
  damageDealt: number;
}

interface Round {
  id: string;
  index: number;
  rq: RoundQuestion;
  startedAt: number;
  deadline: number;
  final: boolean;
  answers: Map<string, { grade: GradeResult; responseMs: number }>;
}

type Phase = 'created' | 'countdown' | 'round' | 'resolving' | 'ended';

export class WordBattleHost implements MatchHost {
  readonly mode = 'word-battle' as const;
  readonly matchId: string;
  private readonly deps: MatchHostDeps;
  private readonly cfg: WordBattleConfig;
  private readonly fighters: Fighter[];
  private phase: Phase = 'created';
  private round: Round | null = null;
  private pastRounds = new Map<string, RoundQuestion>();
  private roundIndex = 0;
  private timer: TimerHandle | null = null;
  private graceTimers = new Map<string, TimerHandle>();
  private startsAt = 0;
  private endsAt = 0;

  constructor(deps: MatchHostDeps, cfg: Partial<WordBattleConfig> = {}) {
    if (deps.players.length !== 2) throw new Error('Word Battle is a 1v1 mode');
    this.deps = deps;
    this.matchId = deps.matchId;
    this.cfg = { ...WORD_BATTLE, ...cfg };
    this.fighters = deps.players.map((p) => ({
      playerId: p.playerId,
      hp: this.cfg.maxHp,
      combo: 0,
      bestCombo: 0,
      abilityCharged: false,
      shield: false,
      surge: false,
      connected: true,
      disconnectedAt: null,
      answered: 0,
      correct: 0,
      responseTimes: [],
      damageDealt: 0,
    }));
  }

  start(): void {
    if (this.phase !== 'created') return;
    const now = this.deps.clock.now();
    this.startsAt = now + this.cfg.countdownMs;
    this.endsAt = this.startsAt + this.cfg.matchMs;
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
      endsAt: this.endsAt,
      config: {
        maxHp: this.cfg.maxHp,
        matchMs: this.cfg.matchMs,
        baseDamage: this.cfg.baseDamage,
        speedBonusMax: this.cfg.speedBonusMax,
        comboForCharge: this.cfg.comboForCharge,
        focusHeal: this.cfg.focusHeal,
        surgeMultiplier: this.cfg.surgeMultiplier,
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
    const roundId = `${this.matchId}-r${this.roundIndex + 1}`;
    const rq = prepareRoundQuestion(item, roundId, this.deps.random);
    const durationMs = rq.question.timeLimitSec * 1000;
    const final = now + durationMs >= this.endsAt;
    this.round = {
      id: roundId,
      index: this.roundIndex,
      rq,
      startedAt: now,
      deadline: now + durationMs,
      final,
      answers: new Map(),
    };
    this.pastRounds.set(roundId, rq);
    this.roundIndex++;
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
      index: r.index,
      question: r.rq.question,
      serverTime: now,
      deadline: r.deadline,
      finalRound: r.final,
    };
  }

  submitAnswer(playerId: string, roundId: string, answer: AnswerPayload): ActionResult {
    const fighter = this.fighter(playerId);
    if (!fighter) return fail(ERROR_CODES.FORBIDDEN, 'Not a player in this match');
    if (this.phase !== 'round' || !this.round) return fail(ERROR_CODES.INVALID_STATE, 'No round in progress');
    if (this.round.id !== roundId) return fail(ERROR_CODES.STALE_ROUND, 'That round is over');
    if (this.round.answers.has(playerId)) return fail(ERROR_CODES.DUPLICATE, 'Answer already submitted');
    if (answer.kind !== 'option') return fail(ERROR_CODES.BAD_MESSAGE, 'Word Battle expects an option answer');
    if (!this.round.rq.question.options?.some((o) => o.id === answer.optionId)) {
      return fail(ERROR_CODES.BAD_MESSAGE, 'Unknown option');
    }
    const now = this.deps.clock.now();
    if (now > this.round.deadline + NETWORK_GRACE_MS) return fail(ERROR_CODES.STALE_ROUND, 'Too late');
    const responseMs = Math.max(0, Math.min(now - this.round.startedAt, this.round.deadline - this.round.startedAt));
    this.round.answers.set(playerId, { grade: gradeAnswer(this.round.rq, answer), responseMs });
    this.deps.emit(null, { type: 'ANSWER_LOCKED', matchId: this.matchId, roundId, playerId });
    if (this.fighters.every((f) => this.round!.answers.has(f.playerId) || !f.connected)) {
      this.resolveRound();
    } else {
      this.emitState();
    }
    return ok();
  }

  useAbility(playerId: string, ability: string): ActionResult {
    const f = this.fighter(playerId);
    if (!f) return fail(ERROR_CODES.FORBIDDEN, 'Not a player in this match');
    if (this.phase !== 'round') return fail(ERROR_CODES.INVALID_STATE, 'Abilities can be used during a round');
    if (!f.abilityCharged) return fail(ERROR_CODES.INVALID_STATE, 'Ability not charged');
    const events: CombatEvent[] = [];
    if (ability === 'shield') {
      if (f.shield) return fail(ERROR_CODES.INVALID_STATE, 'Shield already active');
      f.shield = true;
      events.push({ kind: 'shield-up', from: playerId });
    } else if (ability === 'surge') {
      if (f.surge) return fail(ERROR_CODES.INVALID_STATE, 'Surge already active');
      f.surge = true;
      events.push({ kind: 'surge-ready', from: playerId });
    } else if (ability === 'focus') {
      const before = f.hp;
      f.hp = Math.min(this.cfg.maxHp, f.hp + this.cfg.focusHeal);
      events.push({ kind: 'heal', from: playerId, to: playerId, amount: f.hp - before });
    } else {
      return fail(ERROR_CODES.BAD_MESSAGE, 'Unknown ability');
    }
    f.abilityCharged = false;
    this.deps.emit(null, { type: 'COMBAT_EVENT', matchId: this.matchId, roundId: this.round?.id, events });
    this.emitState();
    return ok();
  }

  private resolveRound(): void {
    if (this.phase !== 'round' || !this.round) return;
    this.phase = 'resolving';
    if (this.timer !== null) {
      this.deps.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    const round = this.round;
    const roundMs = round.deadline - round.startedAt;
    const events: CombatEvent[] = [];
    const [a, b] = this.fighters as [Fighter, Fighter];

    const outcome = (f: Fighter) => round.answers.get(f.playerId);
    for (const [att, def] of [
      [a, b],
      [b, a],
    ] as const) {
      const ans = outcome(att);
      if (ans) att.answered++;
      if (ans?.grade.correct) {
        att.correct++;
        att.responseTimes.push(ans.responseMs);
        att.combo++;
        att.bestCombo = Math.max(att.bestCombo, att.combo);
        const { damage, speedBonus } = computeDamage(ans.responseMs, roundMs, att.surge, this.cfg);
        const surged = att.surge;
        att.surge = false;
        if (def.shield) {
          def.shield = false;
          events.push({ kind: 'blocked', from: att.playerId, to: def.playerId, amount: damage, surge: surged });
        } else {
          def.hp = Math.max(0, def.hp - damage);
          att.damageDealt += damage;
          events.push({ kind: 'attack', from: att.playerId, to: def.playerId, amount: damage, surge: surged, speedBonus });
        }
        if (att.combo % this.cfg.comboForCharge === 0 && !att.abilityCharged) {
          att.abilityCharged = true;
          events.push({ kind: 'charged', from: att.playerId });
        }
      } else {
        att.combo = 0;
        events.push({ kind: 'miss', from: att.playerId });
      }
    }

    const results = this.fighters.map((f) => {
      const ans = outcome(f);
      return {
        playerId: f.playerId,
        answered: !!ans,
        correct: !!ans?.grade.correct,
        responseMs: ans ? ans.responseMs : null,
      };
    });
    this.deps.onRound?.({ roundIndex: round.index, item: round.rq.item, results });

    const item = round.rq.item;
    for (const f of this.fighters) {
      const own = outcome(f);
      this.deps.emit(f.playerId, {
        type: 'ANSWER_RESULT',
        matchId: this.matchId,
        roundId: round.id,
        prompt: item.prompt,
        results: results.map((r) =>
          r.playerId === f.playerId && own
            ? {
                ...r,
                answerText: own.grade.answerText,
                ...(own.grade.errorCategory ? { errorCategory: own.grade.errorCategory } : {}),
                ...(own.grade.feedback ? { feedback: own.grade.feedback } : {}),
              }
            : r,
        ),
        correctAnswer: correctAnswerText(round.rq),
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
    this.deps.emit(null, { type: 'COMBAT_EVENT', matchId: this.matchId, roundId: round.id, events });
    this.emitState();

    if (a.hp <= 0 || b.hp <= 0) {
      this.finish(a.hp <= 0 && b.hp <= 0 ? 'double-ko' : 'ko');
      return;
    }
    if (round.final || this.deps.clock.now() >= this.endsAt) {
      this.finish('timeout');
      return;
    }
    this.schedule(() => this.startRound(), this.cfg.resolveMs);
  }

  private finish(reason: MatchOutcome['reason'], forfeiter?: string): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    this.timer = null;
    for (const t of this.graceTimers.values()) this.deps.clock.clearTimeout(t);
    this.graceTimers.clear();
    const [a, b] = this.fighters as [Fighter, Fighter];
    let results: { a: 'win' | 'loss' | 'draw'; b: 'win' | 'loss' | 'draw' };
    if (reason === 'forfeit' && forfeiter) {
      results = forfeiter === a.playerId ? { a: 'loss', b: 'win' } : { a: 'win', b: 'loss' };
    } else if (reason === 'cancelled') {
      results = { a: 'draw', b: 'draw' };
    } else {
      results = decideBattle(a.hp, b.hp);
    }
    const winnerId = results.a === 'win' ? a.playerId : results.b === 'win' ? b.playerId : null;
    const outcome: MatchOutcome = {
      mode: this.mode,
      reason,
      winnerId,
      outcomes: [
        { playerId: a.playerId, result: results.a },
        { playerId: b.playerId, result: results.b },
      ],
      stats: this.fighters.map((f) => ({
        playerId: f.playerId,
        answered: f.answered,
        correct: f.correct,
        incorrect: Math.max(0, this.roundIndex - f.correct),
        avgResponseMs: averageOf(f.responseTimes),
        bestCombo: f.bestCombo,
        damageDealt: f.damageDealt,
      })),
      startedAt: this.startsAt,
      endedAt: this.deps.clock.now(),
    };
    this.deps.onEnd(outcome);
  }

  setConnected(playerId: string, connected: boolean): void {
    const f = this.fighter(playerId);
    if (!f || this.phase === 'ended') return;
    f.connected = connected;
    const existing = this.graceTimers.get(playerId);
    if (existing !== undefined) {
      this.deps.clock.clearTimeout(existing);
      this.graceTimers.delete(playerId);
    }
    if (!connected) {
      f.disconnectedAt = this.deps.clock.now();
      if (this.fighters.every((x) => !x.connected)) {
        this.graceTimers.set(
          playerId,
          this.deps.clock.setTimeout(() => this.finish('cancelled'), this.cfg.disconnectGraceMs),
        );
      } else {
        this.graceTimers.set(
          playerId,
          this.deps.clock.setTimeout(() => this.forfeit(playerId), this.cfg.disconnectGraceMs),
        );
      }
      // Don't make the connected opponent wait for a disconnected player's answer.
      if (this.phase === 'round' && this.round && this.fighters.every((x) => this.round!.answers.has(x.playerId) || !x.connected)) {
        this.resolveRound();
      }
    } else {
      f.disconnectedAt = null;
    }
    this.emitState();
  }

  forfeit(playerId: string): void {
    if (!this.fighter(playerId) || this.phase === 'ended') return;
    this.finish('forfeit', playerId);
  }

  snapshot(_playerId: string): ServerMessage[] {
    const now = this.deps.clock.now();
    const msgs: ServerMessage[] = [this.matchStartMessage(now), this.stateMessage()];
    if (this.phase === 'round' && this.round) msgs.push(this.roundStartMessage(now));
    return msgs;
  }

  peekRound(roundId: string): RoundQuestion | undefined {
    return this.pastRounds.get(roundId);
  }

  isEnded(): boolean {
    return this.phase === 'ended';
  }

  dispose(): void {
    if (this.timer !== null) this.deps.clock.clearTimeout(this.timer);
    for (const t of this.graceTimers.values()) this.deps.clock.clearTimeout(t);
    this.graceTimers.clear();
    this.timer = null;
    if (this.phase !== 'ended') this.phase = 'ended';
  }

  private fighter(playerId: string): Fighter | undefined {
    return this.fighters.find((f) => f.playerId === playerId);
  }

  private stateMessage(): ServerMessage {
    const players: WordBattlePlayerState[] = this.fighters.map((f) => ({
      playerId: f.playerId,
      hp: f.hp,
      maxHp: this.cfg.maxHp,
      combo: f.combo,
      abilityCharged: f.abilityCharged,
      shield: f.shield,
      surge: f.surge,
      answered: !!this.round?.answers.has(f.playerId) && this.phase === 'round',
      connected: f.connected,
    }));
    return { type: 'PLAYER_STATE', matchId: this.matchId, state: { mode: 'word-battle', players } };
  }

  private emitState(): void {
    this.deps.emit(null, this.stateMessage());
  }
}
