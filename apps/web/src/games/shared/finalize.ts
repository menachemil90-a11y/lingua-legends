import { matchShards, type OnlineModeId, type PublicPlayer, type ServerMessageOf } from '@lingua/shared';
import { ADVENTURE_REGIONS } from '@lingua/content';
import { usePlayer, type MatchRecord } from '../../state/player';
import { pushLearningEvents } from '../../data/supabase';
import type { MatchView } from './useMatch';

export interface MatchSummary {
  result: 'win' | 'loss' | 'draw';
  xp: number;
  shards: number;
  levelBefore: number;
  levelAfter: number;
  unlocked: string[];
  accuracy: number;
  stars: number | null;
}

/** Records a finished match into local progression + the learning engine (once). */
export function finalizeMatch(opts: {
  mode: OnlineModeId;
  online: boolean;
  queue: MatchRecord['queue'];
  selfId: string;
  view: MatchView;
  end: ServerMessageOf<'MATCH_END'>;
  chapterId?: string;
}): MatchSummary {
  const { end, view, selfId } = opts;
  const store = usePlayer.getState();
  const mine = end.stats.find((s) => s.playerId === selfId);
  const result = end.outcomes.find((o) => o.playerId === selfId)?.result ?? 'draw';
  const completed = end.reason !== 'cancelled';
  const total = view.learning.length;
  const correct = view.learning.filter((e) => e.correct).length;
  const accuracy = total > 0 ? correct / total : 0;
  const opponent: PublicPlayer | undefined = view.players.find((p) => p.playerId !== selfId);

  store.recordLearning(view.learning);
  void pushLearningEvents(view.learning);

  // Online rewards are computed by the server (xpEarned). Offline rewards are local only.
  const xp = end.xpEarned;
  const shards = mine ? matchShards(mine, result, completed) : 0;
  const { levelBefore, levelAfter, unlocked } = store.recordMatch({
    mode: opts.mode,
    online: opts.online,
    queue: opts.queue,
    opponent: opponent
      ? { nickname: opponent.nickname, isBot: opponent.isBot, ...(opponent.botTier ? { botTier: opponent.botTier } : {}), characterId: opponent.characterId }
      : null,
    result,
    reason: end.reason,
    correct,
    incorrect: total - correct,
    accuracy,
    bestCombo: mine?.bestCombo ?? 0,
    xp,
    shards,
    ...(end.ratingChange ? { ratingDelta: end.ratingChange.delta } : {}),
    ...(mine?.position ? { position: mine.position } : {}),
  });
  if (opts.mode === 'sentence-master') {
    const solved = mine?.correct ?? 0;
    if (solved > 0) unlocked.push(...store.incrementCounter('sentencesSolved', solved));
  }
  let stars: number | null = null;
  if (opts.chapterId) {
    const chapter = ADVENTURE_REGIONS.flatMap((r) => r.chapters).find((c) => c.id === opts.chapterId);
    if (chapter && completed) {
      stars = chapter.stars.filter((th) => accuracy >= th).length;
      if (result === 'loss') stars = Math.min(stars, 1);
      store.setAdventureStars(chapter.id, stars);
    }
  }
  return { result, xp, shards, levelBefore, levelAfter, unlocked, accuracy, stars };
}
