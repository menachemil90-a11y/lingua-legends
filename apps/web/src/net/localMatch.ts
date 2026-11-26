/**
 * Offline practice matches: runs the SAME authoritative host code as the server,
 * in the browser, against a clearly labelled bot. Nothing here affects online
 * ratings or server-side rewards.
 */
import {
  BOT_CHARACTER_IDS,
  BotController,
  GrammarRaceHost,
  makeBotProfile,
  matchXp,
  realClock,
  SentenceDuelHost,
  WordBattleHost,
  type BotTier,
  type CefrLevel,
  type ContentItem,
  type MatchHost,
  type MatchOutcome,
  type OnlineModeId,
  type PublicPlayer,
  type QuestionSource,
  type ServerMessage,
} from '@lingua/shared';
import { selectItems, type LearnerProfile } from '@lingua/learning';
import { grammarRacePool, itemById, sentencePool, WORD_BATTLE_SETS, wordBattlePool } from '@lingua/content';
import type { MatchIntent, MatchTransport } from './transport';
import { uid } from '../state/storage';

export function poolFor(mode: OnlineModeId, levels: readonly CefrLevel[], setId?: string): ContentItem[] {
  if (setId) {
    const set = WORD_BATTLE_SETS.find((s) => s.id === setId);
    if (set) return set.itemIds.map((id) => itemById(id)).filter((i): i is ContentItem => !!i);
  }
  if (mode === 'grammar-race') return grammarRacePool(levels);
  if (mode === 'sentence-master') return sentencePool(levels);
  return wordBattlePool(levels);
}

/** Adaptive question source backed by the shared learning engine. */
export function adaptiveSource(pool: ContentItem[], learner: LearnerProfile, mode: OnlineModeId, levels: readonly CefrLevel[]): QuestionSource {
  const count = Math.max(8, Math.min(40, pool.length));
  let batch = selectItems(pool, learner, { count, now: Date.now(), random: Math.random, levels, mode, reviewShare: 0.35 });
  if (batch.length === 0) batch = pool.slice();
  return {
    publicItems: true,
    next: (i) => {
      if (i > 0 && i % batch.length === 0) {
        batch = selectItems(pool, learner, { count, now: Date.now(), random: Math.random, levels, mode, reviewShare: 0.2 });
      }
      return batch[i % batch.length]!;
    },
  };
}

export interface LocalMatchOptions {
  mode: OnlineModeId;
  levels: CefrLevel[];
  botTier: BotTier;
  setId?: string;
  me: PublicPlayer;
  learner: LearnerProfile;
}

const BOT_NAMES: Record<BotTier, string> = { rookie: 'Sparky', adept: 'Quill', veteran: 'Cipher', champion: 'Aurelius' };

export function createLocalMatch(opts: LocalMatchOptions): MatchTransport {
  const matchId = uid('local-');
  const botCharacter = BOT_CHARACTER_IDS.filter((c) => c !== opts.me.characterId)[Math.floor(Math.random() * 3)] ?? 'kael';
  const bot: PublicPlayer = {
    playerId: 'bot',
    nickname: BOT_NAMES[opts.botTier],
    isBot: true,
    botTier: opts.botTier,
    characterId: botCharacter,
    vehicleId: ['viper', 'aurum', 'ember', 'comet'].find((v) => v !== opts.me.vehicleId) ?? 'viper',
  };
  const players = [opts.me, bot];
  const listeners = new Set<(m: ServerMessage) => void>();
  const pool = poolFor(opts.mode, opts.levels, opts.setId);
  const source = adaptiveSource(pool, opts.learner, opts.mode, opts.levels);
  let botCtl: BotController | null = null;
  let disposed = false;

  const deliver = (msg: ServerMessage) => {
    // Async delivery mimics the network and keeps React updates out of host call stacks.
    queueMicrotask(() => {
      if (disposed) return;
      for (const l of listeners) l(msg);
    });
  };

  const onEnd = (o: MatchOutcome) => {
    const mine = o.stats.find((s) => s.playerId === opts.me.playerId)!;
    const result = o.outcomes.find((x) => x.playerId === opts.me.playerId)!.result;
    const completed = o.reason !== 'cancelled' && o.reason !== 'forfeit';
    deliver({
      type: 'MATCH_END',
      matchId,
      mode: opts.mode,
      reason: o.reason,
      winnerId: o.winnerId,
      outcomes: o.outcomes,
      stats: o.stats,
      ratingChange: null,
      xpEarned: matchXp(mine, result, completed),
      ranked: false,
    });
  };

  const deps = {
    matchId,
    players,
    clock: realClock,
    questions: source,
    random: Math.random,
    onEnd,
    emit: (to: string | null, msg: ServerMessage) => {
      if (to === null || to === 'bot') botCtl?.handle(msg);
      if (to === null || to === opts.me.playerId) deliver(msg);
    },
  };
  let host: MatchHost;
  if (opts.mode === 'grammar-race') host = new GrammarRaceHost(deps);
  else if (opts.mode === 'sentence-master') host = new SentenceDuelHost(deps);
  else host = new WordBattleHost(deps);

  const comfort = opts.levels[Math.floor(opts.levels.length / 2)] ?? 'A2';
  botCtl = new BotController(host, 'bot', makeBotProfile(opts.botTier, comfort), realClock, Math.random);

  return {
    kind: 'local',
    matchId,
    mode: opts.mode,
    selfId: opts.me.playerId,
    players,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    send(intent: MatchIntent) {
      if (disposed) return;
      switch (intent.type) {
        case 'ANSWER_SUBMIT':
          host.submitAnswer(opts.me.playerId, intent.roundId, intent.answer);
          break;
        case 'ABILITY_USE':
          host.useAbility(opts.me.playerId, intent.ability);
          break;
        case 'MATCH_LEAVE':
          host.forfeit(opts.me.playerId);
          break;
        default:
          break;
      }
    },
    serverNow: () => Date.now(),
    toLocal: (t) => t,
    start: () => host.start(),
    dispose() {
      disposed = true;
      botCtl?.dispose();
      host.dispose();
      listeners.clear();
    },
  };
}
