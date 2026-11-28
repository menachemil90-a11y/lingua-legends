import { useCallback, useEffect, useState } from 'react';
import type { ServerMessage } from '@lingua/shared';
import { Hero } from '../../art/Art';
import { Icon } from '../../art/icons';
import { Button, Dialog, En, TimerRing } from '../../design';
import { useT } from '../../i18n';
import { sfx } from '../../audio/sfx';
import type { MatchTransport } from '../../net/transport';
import { Countdown, MatchIntro, PlayerTag, RoundFeedback, VisualCue } from '../shared/components';
import { ReadyCheck } from '../shared/MatchChrome';
import { useMatch, type MatchView } from '../shared/useMatch';
import { TileBoard } from './TileBoard';

export function SentenceDuelScreen({ transport, onEnd, onExit }: { transport: MatchTransport; onEnd: (view: MatchView) => void; onExit: () => void }) {
  const t = useT();
  const selfId = transport.selfId;
  const [order, setOrder] = useState<string[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(0);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === 'ATTEMPT_RESULT') {
        sfx.play('wrong');
        setWrongFlash((n) => n + 1);
      }
      if (msg.type === 'ANSWER_RESULT') {
        const mine = msg.results.find((r) => r.playerId === selfId);
        sfx.play(mine?.correct ? 'correct' : 'wrong');
      }
      if (msg.type === 'ROUND_START') setOrder([]);
    },
    [selfId],
  );
  const { view, actions } = useMatch(transport, onMessage);

  useEffect(() => {
    if (view.phase === 'ended') {
      const id = setTimeout(() => onEnd(view), 1800);
      return () => clearTimeout(id);
    }
  }, [view.phase, view, onEnd]);

  useEffect(() => {
    const onReq = () => setLeaveOpen(true);
    window.addEventListener('ll:request-leave', onReq);
    return () => window.removeEventListener('ll:request-leave', onReq);
  }, []);

  const sm = view.state?.mode === 'sentence-master' ? view.state.players : [];
  const meS = sm.find((p) => p.playerId === selfId);
  const foeS = sm.find((p) => p.playerId !== selfId);
  const me = view.players.find((p) => p.playerId === selfId) ?? view.players[0]!;
  const foe = view.players.find((p) => p.playerId !== selfId) ?? view.players[1]!;
  const rounds = view.config.rounds ?? 5;
  const q = view.round?.question;
  const revealed = !!view.result && view.result.roundId === view.round?.roundId;
  const done = !!meS?.done || revealed;
  const myCorrect = !!view.result?.results.find((r) => r.playerId === selfId)?.correct;
  const foeCorrect = !!view.result?.results.find((r) => r.playerId === foe.playerId)?.correct;
  const showIntro = view.phase === 'waiting' || (view.phase === 'countdown' && (view.startsAt ?? 0) - Date.now() > 2200);

  const submit = () => {
    if (!q?.tiles || order.length !== q.tiles.length || done) return;
    actions.answerTiles(order);
  };

  return (
    <div className="game sm">
      <header className="game__hud">
        <Button variant="ghost" size="sm" icon="back" aria-label={t('match.leave')} onClick={() => setLeaveOpen(true)} />
        <div className="sm__score">
          <Hero id={me.characterId} className="sm__avatar" />
          <div>
            <PlayerTag player={me} side="left" />
            <div className="sm__points num">{meS?.score ?? 0}</div>
          </div>
        </div>
        <div className="sm__round display">{view.round ? t('match.sentence', { n: view.round.index + 1, total: rounds }) : ''}</div>
        <div className="sm__score sm__score--foe">
          <div>
            <PlayerTag player={foe} side="right" extra={foeS?.done && !revealed ? <span className="chip chip--good">{t('match.opponentAnswered')}</span> : null} />
            <div className="sm__points num">{foeS?.score ?? 0}</div>
          </div>
          <Hero id={foe.characterId} flip className="sm__avatar" />
        </div>
      </header>

      <div className="game__stage sm__stage">
        <div className="citadel" aria-hidden="true" />
        <Countdown startsAt={view.phase === 'countdown' ? view.startsAt : null} goLabel={t('match.go')} />
        {showIntro && <MatchIntro players={view.players} selfId={selfId} modeLabel={t('mode.sentence-master')} />}
        <VisualCue />
        {view.round && (
          <div className="sm-duel" aria-hidden="true">
            <div className={`sm-duel__side ${meS?.done ? 'is-done' : ''} ${revealed && myCorrect ? 'is-win' : ''}`}>
              <span className="sm-duel__podium" />
              <Hero id={me.characterId} animated className="sm-duel__hero" />
            </div>
            <div className="sm-duel__scroll">
              {Array.from({ length: rounds }, (_, i) => (
                <span key={i} className={`sm-duel__pip ${i < view.round!.index ? 'is-past' : i === view.round!.index ? 'is-now' : ''}`} />
              ))}
            </div>
            <div className={`sm-duel__side sm-duel__side--foe ${foeS?.done ? 'is-done' : ''} ${revealed && foeCorrect ? 'is-win' : ''}`}>
              <span className="sm-duel__podium" />
              <Hero id={foe.characterId} flip animated className="sm-duel__hero" />
            </div>
          </div>
        )}
        {view.round && q?.tiles && (
          <div className="sm__board panel">
            <div className="qhead">
              <En as="p" className="sm__prompt">
                {q.prompt}
              </En>
              <span className="spacer" />
              {!revealed && <TimerRing deadline={view.round.deadline} total={view.round.durationMs} size={50} />}
            </div>
            <TileBoard
              key={view.round.roundId}
              tiles={q.tiles}
              value={revealed ? order : order}
              onChange={setOrder}
              onSubmit={submit}
              disabled={done}
              state={revealed ? (view.result?.results.find((r) => r.playerId === selfId)?.correct ? 'correct' : 'wrong') : 'idle'}
            />
            {wrongFlash > 0 && view.attempt && !done && (
              <p key={wrongFlash} className="sm__retry" role="status">
                <Icon name="refresh" /> {t('match.tryAgain')} · {t('match.attemptsLeft', { n: view.attempt.attemptsLeft })}
              </p>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" icon="x" disabled={done || order.length === 0} onClick={() => setOrder([])}>
                {t('common.clear')}
              </Button>
              <Button variant="secondary" icon="check" disabled={done || order.length !== q.tiles.length} onClick={submit}>
                {t('common.check')}
              </Button>
            </div>
            {meS?.done && !revealed && <p className="muted small center">{t('match.waitingOpponent')}</p>}
            {revealed && view.result && <RoundFeedback result={view.result} selfId={selfId} compact={false} />}
          </div>
        )}
        {view.phase === 'waiting' && transport.kind === 'online' && (
          <div className="sm__board panel">
            <ReadyCheck transport={transport} />
          </div>
        )}
      </div>
      <p className="tiny muted center sm__help">{t('sentence.instructions')}</p>

      <Dialog
        open={leaveOpen}
        title={t('match.leave')}
        onClose={() => setLeaveOpen(false)}
        actions={
          <>
            <Button onClick={() => setLeaveOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                actions.leave();
                setLeaveOpen(false);
                onExit();
              }}
            >
              {t('match.leave')}
            </Button>
          </>
        }
      >
        <p>{t('match.leaveConfirm')}</p>
      </Dialog>
    </div>
  );
}
