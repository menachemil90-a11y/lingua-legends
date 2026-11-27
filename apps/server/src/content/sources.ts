/** Question sources per mode/queue. Ranked matches use the server-only pool. */
import { BRACKET_LEVELS, shuffle, type Bracket, type ContentItem, type OnlineModeId, type QuestionSource, type RandomFn } from '@lingua/shared';
import { grammarRacePool, sentencePool, wordBattlePool } from '@lingua/content';
import type { RankedPool } from './rankedPool';

let RANKED_ITEMS: ContentItem[] = [];
let RANKED_SOURCE: RankedPool['source'] = 'disabled';

/** Installs the ranked pool chosen at startup (see rankedPool.ts). */
export function setRankedPool(pool: RankedPool): void {
  RANKED_ITEMS = pool.items;
  RANKED_SOURCE = pool.source;
}
export function rankedPoolInfo(): { source: RankedPool['source']; size: number } {
  return { source: RANKED_SOURCE, size: RANKED_ITEMS.length };
}
/** Ranked play needs a full match worth of server-only items in that bracket. */
export function rankedAvailable(mode: OnlineModeId, bracket: Bracket): boolean {
  return RANKED_ITEMS.length > 0 && rankedPool(mode, bracket, Math.random).length >= (mode === 'sentence-master' ? 3 : 10);
}

const GRAMMAR_CATS = new Set(['sentence-completion', 'grammar-correction', 'grammar', 'connector']);

function rankedPool(mode: OnlineModeId, bracket: Bracket, random: RandomFn): ContentItem[] {
  const levels = BRACKET_LEVELS[bracket];
  const inBracket = RANKED_ITEMS.filter((i) => levels.includes(i.level));
  if (mode === 'sentence-master') return inBracket.filter((i) => i.type === 'sentence-build');
  const options = inBracket.filter((i) => i.grading.mode === 'option');
  if (mode === 'grammar-race') {
    // Grammar first; vocabulary items (still server-only) pad the sequence.
    const grammar = options.filter((i) => GRAMMAR_CATS.has(i.category) && !i.context);
    const rest = options.filter((i) => !grammar.includes(i) && !i.context);
    return [...shuffle(grammar, random), ...shuffle(rest, random)];
  }
  return options;
}

function publicPool(mode: OnlineModeId, bracket: Bracket): ContentItem[] {
  const levels = BRACKET_LEVELS[bracket];
  if (mode === 'grammar-race') return grammarRacePool(levels);
  if (mode === 'sentence-master') return sentencePool(levels);
  return wordBattlePool(levels);
}

export function questionSource(mode: OnlineModeId, bracket: Bracket, queue: 'ranked' | 'casual' | 'private', random: RandomFn): QuestionSource {
  const ranked = queue === 'ranked';
  const rankedItems = ranked ? rankedPool(mode, bracket, random) : [];
  // Grammar Race keeps the grammar-first ordering; other modes are fully shuffled.
  const order = rankedItems.length > 0 ? (mode === 'grammar-race' ? rankedItems : shuffle(rankedItems, random)) : shuffle(publicPool(mode, bracket), random);
  return {
    publicItems: rankedItems.length === 0,
    next: (i) => order[i % order.length]!,
  };
}
