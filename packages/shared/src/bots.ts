/**
 * Bot opponents. Bots are ALWAYS labelled as bots in the UI and are never placed
 * into online queues as if they were real players. They play through the same
 * host API as humans (submitting intents), so they cannot bend the rules.
 */
import { cefrIndex, type CefrLevel } from './cefr';
import { tokenize } from './content/grading';
import type { Clock, MatchHost, TimerHandle } from './hosts/common';
import type { ServerMessage } from './protocol';
import { shuffle, type RandomFn } from './random';

export const BOT_TIERS = ['rookie', 'adept', 'veteran', 'champion'] as const;
export type BotTier = (typeof BOT_TIERS)[number];

export interface BotProfile {
  tier: BotTier;
  name: string;
  /** Probability of a correct answer on an item at the bot's comfort level. */
  accuracy: number;
  /** Mean fraction of the time limit the bot takes to answer. */
  speed: number;
  /** CEFR level the bot is "comfortable" at; harder items reduce accuracy. */
  comfortLevel: CefrLevel;
}

export const BOT_PROFILES: Record<BotTier, Omit<BotProfile, 'comfortLevel'>> = {
  rookie: { tier: 'rookie', name: 'Rookie Bot', accuracy: 0.55, speed: 0.62 },
  adept: { tier: 'adept', name: 'Adept Bot', accuracy: 0.7, speed: 0.5 },
  veteran: { tier: 'veteran', name: 'Veteran Bot', accuracy: 0.82, speed: 0.4 },
  champion: { tier: 'champion', name: 'Champion Bot', accuracy: 0.9, speed: 0.32 },
};

export function makeBotProfile(tier: BotTier, comfortLevel: CefrLevel): BotProfile {
  return { ...BOT_PROFILES[tier], comfortLevel };
}

/** Chooses a bot tier from the player's recent accuracy so matches stay competitive. */
export function suggestBotTier(recentAccuracy: number | null): BotTier {
  if (recentAccuracy === null) return 'adept';
  if (recentAccuracy < 0.55) return 'rookie';
  if (recentAccuracy < 0.72) return 'adept';
  if (recentAccuracy < 0.86) return 'veteran';
  return 'champion';
}

function accuracyFor(profile: BotProfile, level: CefrLevel): number {
  const gap = cefrIndex(level) - cefrIndex(profile.comfortLevel);
  return Math.max(0.15, Math.min(0.97, profile.accuracy - Math.max(0, gap) * 0.12 + Math.max(0, -gap) * 0.05));
}

/** Drives one bot seat in any match host. */
export class BotController {
  private timers: TimerHandle[] = [];
  private disposed = false;

  constructor(
    private readonly host: MatchHost,
    private readonly playerId: string,
    private readonly profile: BotProfile,
    private readonly clock: Clock,
    private readonly random: RandomFn,
  ) {}

  /** Feed every message addressed to the bot's seat (or broadcast) here. */
  handle(msg: ServerMessage): void {
    if (this.disposed) return;
    if (msg.type === 'ROUND_START') this.onRound(msg);
    if (msg.type === 'ATTEMPT_RESULT') this.onRetry(msg.roundId);
    if (msg.type === 'PLAYER_STATE' && msg.state.mode === 'word-battle') {
      const me = msg.state.players.find((p) => p.playerId === this.playerId);
      const foe = msg.state.players.find((p) => p.playerId !== this.playerId);
      if (me?.abilityCharged && foe) this.maybeUseAbility(me.hp, foe.hp, me.shield, me.surge);
    }
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(this.clock.setTimeout(() => !this.disposed && fn(), ms));
  }

  private thinkMs(limitSec: number): number {
    const mean = limitSec * 1000 * this.profile.speed;
    const jitter = (this.random() - 0.5) * mean * 0.7;
    return Math.max(900, Math.min(limitSec * 1000 - 400, mean + jitter));
  }

  private onRound(msg: Extract<ServerMessage, { type: 'ROUND_START' }>): void {
    const q = msg.question;
    const delay = this.thinkMs(q.timeLimitSec);
    this.later(() => this.answer(msg.roundId, true), delay);
  }

  private onRetry(roundId: string): void {
    this.later(() => this.answer(roundId, false), 2500 + this.random() * 3000);
  }

  private answer(roundId: string, firstAttempt: boolean): void {
    const rq = this.host.peekRound(roundId);
    if (!rq) return;
    const p = accuracyFor(this.profile, rq.item.level) + (firstAttempt ? 0 : 0.1);
    const correct = this.random() < p;
    const q = rq.question;
    if (q.options) {
      const right = rq.key.correctOptionIds ?? [];
      const wrong = q.options.map((o) => o.id).filter((id) => !right.includes(id));
      const choice = correct || wrong.length === 0 ? right[0]! : wrong[Math.floor(this.random() * wrong.length)]!;
      this.host.submitAnswer(this.playerId, roundId, { kind: 'option', optionId: choice });
      return;
    }
    if (q.tiles) {
      const target = rq.key.acceptedSequences?.[0] ?? [];
      const pool = q.tiles.slice();
      let ids: string[];
      if (correct) {
        ids = [];
        for (const token of target) {
          const idx = pool.findIndex((t) => tokenize(t.text).join(' ') === token || tokenize(t.text)[0] === token);
          if (idx >= 0) ids.push(pool.splice(idx, 1)[0]!.id);
        }
        ids.push(...pool.map((t) => t.id));
      } else {
        ids = shuffle(q.tiles, this.random).map((t) => t.id);
      }
      this.host.submitAnswer(this.playerId, roundId, { kind: 'tiles', tileIds: ids });
    }
  }

  private maybeUseAbility(hp: number, foeHp: number, shield: boolean, surge: boolean): void {
    this.later(() => {
      if (foeHp <= 22 && !surge) this.host.useAbility(this.playerId, 'surge');
      else if (hp <= 40 && !shield) this.host.useAbility(this.playerId, hp <= 25 ? 'focus' : 'shield');
      else if (!surge) this.host.useAbility(this.playerId, 'surge');
    }, 700 + this.random() * 900);
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.timers) this.clock.clearTimeout(t);
    this.timers = [];
  }
}
