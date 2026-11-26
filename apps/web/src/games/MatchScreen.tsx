import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../state/player';
import { useNav, type LocalMatchParams, type OnlineMatchParams } from '../state/nav';
import { createLocalMatch } from '../net/localMatch';
import { createOnlineMatch } from '../net/onlineMatch';
import { connection, useConnection } from '../net/connection';
import { sfx } from '../audio/sfx';
import { useT } from '../i18n';
import { finalizeMatch, type MatchSummary } from './shared/finalize';
import { PostMatch } from './shared/PostMatch';
import type { MatchView } from './shared/useMatch';
import { WordBattleScreen } from './wordBattle/WordBattleScreen';
import { GrammarRaceScreen } from './grammarRace/GrammarRaceScreen';
import { SentenceDuelScreen } from './sentenceMaster/SentenceDuelScreen';

export function MatchScreen({ params }: { params: LocalMatchParams | OnlineMatchParams }) {
  const t = useT();
  const [attempt, setAttempt] = useState(0);
  const [ended, setEnded] = useState<{ view: MatchView; summary: MatchSummary } | null>(null);
  const [rematchSent, setRematchSent] = useState(false);
  const go = useNav((s) => s.go);
  const home = useNav((s) => s.home);
  const finalized = useRef(false);
  const connPlayerId = useConnection((s) => s.playerId);

  const transport = useMemo(() => {
    const p = usePlayer.getState();
    if (params.kind === 'local') {
      return createLocalMatch({
        mode: params.mode,
        levels: params.levels,
        botTier: params.botTier,
        ...(params.setId ? { setId: params.setId } : {}),
        learner: p.learner,
        me: {
          playerId: 'me',
          nickname: p.nickname,
          isBot: false,
          characterId: p.loadout.characterId,
          vehicleId: p.loadout.vehicleId,
          titleId: p.loadout.titleId,
          frameId: p.loadout.frameId,
        },
      });
    }
    return createOnlineMatch(params.matchId, params.mode, params.players);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, params.kind === 'online' ? params.matchId : params]);

  useEffect(() => {
    finalized.current = false;
    sfx.setMusic('battle');
    return () => {
      transport.dispose();
    };
  }, [transport]);

  useEffect(() => () => sfx.setMusic('lobby'), []);

  const onEnd = useCallback(
    (view: MatchView) => {
      if (finalized.current || !view.end) return;
      finalized.current = true;
      const summary = finalizeMatch({
        mode: params.mode,
        online: params.kind === 'online',
        queue: params.kind === 'online' ? params.queue : 'bot',
        selfId: transport.selfId,
        view,
        end: view.end,
        ...(params.kind === 'local' && params.chapterId ? { chapterId: params.chapterId } : {}),
      });
      setEnded({ view, summary });
      sfx.setMusic('lobby');
    },
    [params, transport],
  );

  const onExit = useCallback(() => {
    if (params.kind === 'online') connection.clearPendingMatch();
    home();
  }, [params.kind, home]);

  if (ended && ended.view.end) {
    const view = ended.view;
    const rematchState = view.rematch;
    const oppRequested = !!rematchState?.requestedBy.some((id) => id !== (connPlayerId ?? transport.selfId));
    return (
      <div className="page">
        <PostMatch
          end={view.end!}
          summary={ended.summary}
          mistakes={view.mistakes}
          players={view.players}
          selfId={transport.selfId}
          rematchPending={rematchSent}
          rematchRequestedByOpponent={oppRequested && !rematchSent}
          onRematch={() => {
            if (params.kind === 'local') {
              setEnded(null);
              setAttempt((n) => n + 1);
            } else {
              setRematchSent(true);
              connection.send({ type: 'REMATCH_REQUEST', matchId: params.matchId });
            }
          }}
          onLobby={() => {
            if (params.kind === 'online') connection.clearPendingMatch();
            home();
          }}
          {...(params.mode === 'sentence-master' && params.kind === 'local'
            ? {
                extraStats: (
                  <button type="button" className="linkish small" onClick={() => go({ id: 'sentence-practice' })}>
                    {t('sentence.practice')} →
                  </button>
                ),
              }
            : {})}
        />
      </div>
    );
  }

  const key = `${transport.matchId}`;
  if (params.mode === 'grammar-race') return <GrammarRaceScreen key={key} transport={transport} onEnd={onEnd} onExit={onExit} />;
  if (params.mode === 'sentence-master') return <SentenceDuelScreen key={key} transport={transport} onEnd={onEnd} onExit={onExit} />;
  return <WordBattleScreen key={key} transport={transport} onEnd={onEnd} onExit={onExit} />;
}
