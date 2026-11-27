import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../state/player';
import { useNav, type LocalMatchParams, type OnlineMatchParams } from '../state/nav';
import { createLocalMatch } from '../net/localMatch';
import { createOnlineMatch } from '../net/onlineMatch';
import type { MatchTransport } from '../net/transport';
import { connection, useConnection } from '../net/connection';
import { sfx } from '../audio/sfx';
import { useT } from '../i18n';
import { Loading } from '../design';
import { finalizeMatch, type MatchSummary } from './shared/finalize';
import { PostMatch } from './shared/PostMatch';
import type { MatchView } from './shared/useMatch';
import { WordBattleScreen } from './wordBattle/WordBattleScreen';
import { GrammarRaceScreen } from './grammarRace/GrammarRaceScreen';
import { SentenceDuelScreen } from './sentenceMaster/SentenceDuelScreen';
import { ConquestOnlineScreen } from './conquest/ConquestOnlineScreen';
import { EscapeCoopScreen } from './escape/EscapeCoopScreen';

export function MatchScreen({ params }: { params: LocalMatchParams | OnlineMatchParams }) {
  const t = useT();
  const [attempt, setAttempt] = useState(0);
  const [ended, setEnded] = useState<{ view: MatchView; summary: MatchSummary } | null>(null);
  const [rematchSent, setRematchSent] = useState(false);
  const go = useNav((s) => s.go);
  const home = useNav((s) => s.home);
  const finalized = useRef(false);
  const connPlayerId = useConnection((s) => s.playerId);

  const matchKey = params.kind === 'online' ? params.matchId : `${attempt}:${params.mode}:${params.levels.join(',')}:${params.setId ?? ''}:${params.racers ?? 2}`;
  const [transport, setTransport] = useState<MatchTransport | null>(null);

  // Created inside an effect (not useMemo) so React StrictMode's mount/unmount/mount cycle
  // disposes the first instance cleanly and keeps a live second one.
  useEffect(() => {
    const p = usePlayer.getState();
    const t =
      params.kind === 'local'
        ? createLocalMatch({
            mode: params.mode,
            levels: params.levels,
            botTier: params.botTier,
            ...(params.setId ? { setId: params.setId } : {}),
            ...(params.racers ? { racers: params.racers } : {}),
            ...(params.tactic ? { tactic: params.tactic } : {}),
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
          })
        : createOnlineMatch(params.matchId, params.mode, params.players);
    finalized.current = false;
    setTransport(t);
    sfx.setMusic('battle');
    return () => t.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  useEffect(() => () => sfx.setMusic('lobby'), []);

  const onEnd = useCallback(
    (view: MatchView) => {
      if (finalized.current || !view.end || !transport) return;
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
      if (params.kind === 'local' && params.cup) {
        const r = summary.result === 'win' ? 'win' : summary.result === 'loss' ? 'loss' : 'draw';
        summary.unlocked.push(...usePlayer.getState().recordCupResult(r));
      }
      setEnded({ view, summary });
      sfx.setMusic('lobby');
    },
    [params, transport],
  );

  // Cup and tournament matches return to the tournament screen instead of the lobby.
  const tour = useConnection((s) => s.tournament);
  const inTournament = (params.kind === 'local' && !!params.cup) || (params.kind === 'online' && !!tour && tour.status !== 'open' && tour.rounds.some((r) => r.some((m) => m.matchId === params.matchId)));
  const leaveToHub = useCallback(() => {
    if (inTournament) useNav.getState().replace({ id: 'tournament', tab: params.kind === 'local' ? 'cup' : 'friends' });
    else home();
  }, [inTournament, params.kind, home]);

  const onExit = useCallback(() => {
    if (params.kind === 'online') connection.clearPendingMatch();
    leaveToHub();
  }, [params.kind, leaveToHub]);

  if (!transport) return <Loading />;

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
          {...(inTournament ? {} : {
          onRematch: () => {
            if (params.kind === 'local') {
              setEnded(null);
              setAttempt((n) => n + 1);
            } else {
              setRematchSent(true);
              connection.send({ type: 'REMATCH_REQUEST', matchId: params.matchId });
            }
          } })}
          onLobby={() => {
            if (params.kind === 'online') connection.clearPendingMatch();
            leaveToHub();
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
  if (params.mode === 'english-conquest') return <ConquestOnlineScreen key={key} transport={transport} onEnd={onEnd} onExit={onExit} />;
  if (params.mode === 'escape-room') return <EscapeCoopScreen key={key} transport={transport} onEnd={onEnd} onExit={onExit} />;
  return <WordBattleScreen key={key} transport={transport} onEnd={onEnd} onExit={onExit} />;
}
