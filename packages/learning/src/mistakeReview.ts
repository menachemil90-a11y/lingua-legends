/**
 * Builds a short practice session from the mistakes of a finished match.
 *
 * Public items are replayed exactly. Ranked (server-only) items are never available
 * to the client, so they are replaced by public items that share the same knowledge
 * components (vocabulary / grammar tags) at a nearby level.
 */
import { CEFR_LEVELS, type CefrLevel, type ContentItem } from '@lingua/shared';

export interface MistakeTarget {
  itemId: string;
  level: CefrLevel;
  /** Knowledge components in `v:` / `g:` form. */
  tags: string[];
}

const kcsOf = (item: ContentItem) => [...item.tags.vocabulary.map((t) => `v:${t}`), ...item.tags.grammar.map((t) => `g:${t}`)];

export function buildMistakeReview(
  pool: readonly ContentItem[],
  mistakes: readonly MistakeTarget[],
  opts: { count?: number; random?: () => number } = {},
): ContentItem[] {
  const count = opts.count ?? 8;
  const random = opts.random ?? Math.random;
  const byId = new Map(pool.map((i) => [i.id, i]));
  const chosen: ContentItem[] = [];
  const taken = new Set<string>();
  const take = (i: ContentItem) => {
    if (taken.has(i.id) || chosen.length >= count) return;
    taken.add(i.id);
    chosen.push(i);
  };

  // 1) Exact replays of public items.
  for (const m of mistakes) {
    const exact = byId.get(m.itemId);
    if (exact) take(exact);
  }

  // 2) Similar items for every mistake (one each, round-robin), most shared tags first.
  const candidatesFor = (m: MistakeTarget) => {
    const li = CEFR_LEVELS.indexOf(m.level);
    const wanted = new Set(m.tags);
    return pool
      .filter((i) => !taken.has(i.id) && Math.abs(CEFR_LEVELS.indexOf(i.level) - li) <= 1)
      .map((i) => ({ i, shared: kcsOf(i).filter((k) => wanted.has(k)).length, jitter: random() }))
      .filter((c) => c.shared > 0)
      .sort((a, b) => b.shared - a.shared || a.jitter - b.jitter)
      .map((c) => c.i);
  };
  let progress = true;
  while (chosen.length < count && progress) {
    progress = false;
    for (const m of mistakes) {
      const next = candidatesFor(m)[0];
      if (next) {
        take(next);
        progress = true;
      }
      if (chosen.length >= count) break;
    }
  }
  return chosen;
}
