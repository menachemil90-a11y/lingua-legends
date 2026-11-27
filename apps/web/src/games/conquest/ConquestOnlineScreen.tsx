/** Online English Conquest: the server runs the game; this screen renders state and sends intents. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONQUEST, CONQUEST_MAP, currentPlayer, type ConquestAction, type ServerMessage } from '@lingua/shared';
import { Button, Chip, Dialog, Loading, toast } from '../../design';
import { useT, type MessageKey } from '../../i18n';
import { Icon } from '../../art/icons';
import { sfx } from '../../audio/sfx';
import type { MatchTransport } from '../../net/transport';
import { Countdown, Explanation, QuestionCard } from '../shared/components';
import { ReadyCheck } from '../shared/MatchChrome';
import { useMatch, type MatchView } from '../shared/useMatch';
import { ConquestBoard } from './ConquestBoard';

export function ConquestOnlineScreen({ transport, onEnd, onExit }: { transport: MatchTransport; onEnd: (view: MatchView) => void; onExit: () => void }) {
  const t = useT();
  const selfId = transport.selfId;
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const seenLog = useRef<string>('');

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === 'ERROR') toast(msg.message, 'bad');
      if (msg.type === 'ROUND_START') sfx.play('whoosh');
      if (msg.type === 'ANSWER_RESULT') sfx.play(msg.results.find((r) => r.playerId === selfId)?.correct ? 'correct' : 'wrong');
      if (msg.type === 'PLAYER_STATE' && msg.state.mode === 'english-conquest') {
        // Sound cues for new battle events, for every player at the table.
        const log = msg.state.state.log;
        const last = log[log.length - 1];
        const key = last ? `${last.round}:${log.length}:${last.text}` : '';
        if (key && key !== seenLog.current) {
          if (last!.kind === 'capture') sfx.play('hit');
          else if (last!.kind === 'repelled') sfx.play('shield');
          else if (last!.kind === 'recruit' || last!.kind === 'fortify') sfx.play('tile');
          seenLog.current = key;
        }
      }
    },
    [selfId],
  );
  const { view, actions } = useMatch(transport, onMessage);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (view.phase === 'ended') {
      const id = setTimeout(() => onEnd(view), 2200);
      return () => clearTimeout(id);
    }
  }, [view.phase, view, onEnd]);

  useEffect(() => {
    const onReq = () => setLeaveOpen(true);
    window.addEventListener('ll:request-leave', onReq);
    return () => window.removeEventListener('ll:request-leave', onReq);
  }, []);

  const cq = view.state?.mode === 'english-conquest' ? view.state : null;
  const send = (action: ConquestAction) => transport.send({ type: 'CONQUEST_ACTION', matchId: transport.matchId, action });

  const leaveDialog = (
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
  );

  if (!cq) {
    return (
      <div className="page conquest">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('match.leave')} onClick={() => setLeaveOpen(true)} />
          <h1 className="page__title">{t('mode.english-conquest')}</h1>
        </div>
        {view.phase === 'waiting' && transport.kind === 'online' ? <ReadyCheck transport={transport} /> : <Loading />}
        {leaveDialog}
      </div>
    );
  }

  const s = cq.state;
  const cur = currentPlayer(s);
  const myTurn = cur.id === selfId && s.phase !== 'ended';
  const away = new Set(view.players.map((p) => p.playerId).filter((id) => !cq.connected.includes(id)));
  const secondsLeft = cq.phaseDeadline ? Math.max(0, Math.ceil((transport.toLocal(cq.phaseDeadline) - now) / 1000)) : null;
  const timer = secondsLeft !== null && s.phase !== 'ended' ? (
    <Chip tone={secondsLeft <= 10 ? 'bad' : undefined} icon="clock">
      {t('conquest.timeLeft', { s: secondsLeft })}
    </Chip>
  ) : null;

  const round = view.round;
  const result = view.result && round && view.result.roundId === round.roundId ? view.result : null;
  const askingMe = !!round && myTurn && s.phase === 'question';
  const showQuestion = !!round && (askingMe || (!!result && dismissed !== round.roundId));
  const mine = result?.results.find((r) => r.playerId === selfId);
  const me = s.players.find((p) => p.id === selfId);
  const winner = s.players.find((p) => p.id === s.winnerId);

  return (
    <div className="page conquest">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('match.leave')} onClick={() => setLeaveOpen(true)} />
        <h1 className="page__title">{t('mode.english-conquest')}</h1>
        <Chip tone="gold">{t('conquest.round', { n: s.round, total: CONQUEST.maxRounds })}</Chip>
      </div>
      <Countdown startsAt={view.phase === 'countdown' ? view.startsAt : null} goLabel={t('match.go')} />
      <ConquestBoard
        s={s}
        selfId={selfId}
        myTurn={myTurn && !showQuestion}
        onAction={send}
        disconnected={away}
        turnExtra={timer}
        waiting={
          <div className="row">
            <p className="small" style={{ flex: 1 }}>
              {s.phase === 'question' ? t('conquest.answering', { name: cur.name }) : t('conquest.planning', { name: cur.name })}
            </p>
            {timer}
          </div>
        }
      />

      {showQuestion && round && (
        <Dialog open title={t('conquest.yourQuestion')} dismissible={!!result} onClose={() => result && setDismissed(round.roundId)}>
          <div className="stack">
            <div className="row">
              <p className="small muted" style={{ flex: 1 }}>
                {t('conquest.knowledgeHint', { gold: CONQUEST.correctGold })}
              </p>
              {!result && timer}
            </div>
            <QuestionCard question={round.question} selected={view.myAnswer?.optionId} result={result} selfId={selfId} onAnswer={actions.answerOption} />
            {view.myAnswer && !result && <p className="small muted">{t('conquest.waitingResult')}</p>}
            {result && (
              <>
                {!mine?.correct && <Explanation exp={result.explanation} feedback={mine?.feedback} example={result.example} compact />}
                <Button variant="primary" iconEnd="forward" onClick={() => setDismissed(round.roundId)} autoFocus data-testid="cq-continue">
                  {t('common.continue')}
                </Button>
              </>
            )}
          </div>
        </Dialog>
      )}

      {s.phase === 'ended' && (
        <Dialog open title={s.winnerId === selfId ? t('result.victory') : s.winnerId === null ? t('result.draw') : t('result.defeat')} dismissible={false} onClose={() => {}}>
          <p>
            {winner ? `${winner.name} — ` : ''}
            {t(`conquest.endReason.${s.endReason ?? 'rounds'}` as MessageKey)}
          </p>
          {me && (
            <p className="small muted">
              {t('result.correct')}: {me.correctAnswers}/{me.questionsAnswered} · <Icon name="castle" style={{ width: 14, height: 14, verticalAlign: 'middle' }} /> {CONQUEST_MAP.filter((m) => s.territories[m.id]?.owner === selfId).length}
            </p>
          )}
        </Dialog>
      )}
      {leaveDialog}
    </div>
  );
}
