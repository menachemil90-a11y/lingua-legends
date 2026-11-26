import { useCallback, useEffect, useRef, useState } from 'react';
import type { RacePlayerState, ServerMessage } from '@lingua/shared';
import { GRAMMAR_RACE } from '@lingua/shared';
import { Vehicle } from '../../art/Art';
import { Icon } from '../../art/icons';
import { BotBadge, Button, Dialog, En, TimerRing } from '../../design';
import { useT, type MessageKey } from '../../i18n';
import { sfx } from '../../audio/sfx';
import type { MatchTransport } from '../../net/transport';
import type { RaceApi } from '../../phaser/RaceScene';
import { Countdown, MatchIntro, QuestionCard, VisualCue } from '../shared/components';
import { ReadyCheck } from '../shared/MatchChrome';
import { useMatch, type MatchView } from '../shared/useMatch';

export function GrammarRaceScreen({ transport, onEnd, onExit }: { transport: MatchTransport; onEnd: (view: MatchView) => void; onExit: () => void }) {
  const t = useT();
  const stageRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<RaceApi | null>(null);
  const prevRef = useRef<Map<string, RacePlayerState>>(new Map());
  const [ready, setReady] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; turbo: boolean; seq: number } | null>(null);
  const selfId = transport.selfId;

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      const api = apiRef.current;
      if (msg.type === 'PLAYER_STATE' && msg.state.mode === 'grammar-race') {
        api?.update(
          msg.state.players.map((p) => ({
            playerId: p.playerId,
            distance: p.distance,
            speed: p.speed,
            turbo: p.turbo,
            stalled: p.stalled,
            finished: p.finishedAtMs !== null,
          })),
        );
        for (const p of msg.state.players) {
          const prev = prevRef.current.get(p.playerId);
          if (p.playerId !== selfId && prev) {
            if (p.turbo && !prev.turbo) api?.pulse(p.playerId, 'turbo');
            if (p.stalled && !prev.stalled) api?.pulse(p.playerId, 'stall');
          }
          prevRef.current.set(p.playerId, p);
        }
      }
      if (msg.type === 'ANSWER_RESULT') {
        const mine = msg.results.find((r) => r.playerId === selfId);
        const streak = (prevRef.current.get(selfId)?.streak ?? 0) + (mine?.correct ? 1 : 0);
        const turbo = !!mine?.correct && streak > 0 && streak % GRAMMAR_RACE.turboStreak === 0;
        if (mine?.correct) {
          sfx.play(turbo ? 'turbo' : 'boost');
          api?.pulse(selfId, turbo ? 'turbo' : 'boost');
        } else {
          sfx.play('wrong');
          if (mine?.answered) api?.pulse(selfId, 'stall');
        }
        setFlash((f) => ({ ok: !!mine?.correct, turbo, seq: (f?.seq ?? 0) + 1 }));
      }
    },
    [selfId],
  );

  const { view, actions } = useMatch(transport, onMessage);
  const trackLength = view.config.trackLength ?? GRAMMAR_RACE.trackLength;

  useEffect(() => {
    let disposed = false;
    void import('../../phaser/RaceScene').then(({ bootRace }) => {
      if (disposed || !stageRef.current) return;
      void bootRace(
        stageRef.current,
        transport.players.map((p) => ({ playerId: p.playerId, vehicleId: p.vehicleId, nickname: p.nickname, isSelf: p.playerId === selfId })),
        trackLength,
      ).then((api) => {
        if (disposed) api.destroy();
        else {
          apiRef.current = api;
          setReady(true);
        }
      });
    });
    return () => {
      disposed = true;
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport]);

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

  const racers = view.state?.mode === 'grammar-race' ? view.state.players : [];
  const order = racers
    .slice()
    .sort((a, b) => (a.finishedAtMs !== null && b.finishedAtMs !== null ? a.finishedAtMs - b.finishedAtMs : a.finishedAtMs !== null ? -1 : b.finishedAtMs !== null ? 1 : b.distance - a.distance));
  const position = Math.max(1, order.findIndex((r) => r.playerId === selfId) + 1);
  const me = racers.find((r) => r.playerId === selfId);
  const showIntro = view.phase === 'waiting' || (view.phase === 'countdown' && (view.startsAt ?? 0) - Date.now() > 2200);
  const streakInCycle = (me?.streak ?? 0) % GRAMMAR_RACE.turboStreak;

  return (
    <div className="game gr">
      <header className="game__hud gr__hud">
        <Button variant="ghost" size="sm" icon="back" aria-label={t('match.leave')} onClick={() => setLeaveOpen(true)} />
        <div className="gr__pos" aria-label={t('match.position')}>
          <span className="gr__posnum display">{t(`race.place.${position}` as MessageKey)}</span>
          <span className="tiny muted">/ {transport.players.length}</span>
        </div>
        <div className="gr__track" aria-hidden="true">
          <div className="gr__trackline" />
          {transport.players.map((p) => {
            const r = racers.find((x) => x.playerId === p.playerId);
            const frac = Math.min(1, (r?.distance ?? 0) / trackLength);
            return (
              <div key={p.playerId} className={`gr__marker ${p.playerId === selfId ? 'gr__marker--me' : ''}`} style={{ insetInlineStart: `calc(${frac * 100}% - 18px)` }}>
                <Vehicle id={p.vehicleId} style={{ width: 36 }} />
              </div>
            );
          })}
          <Icon name="flag" className="gr__flag" />
        </div>
        <div className="gr__speed num">
          <strong>{Math.round((me?.speed ?? 0) * 3.6)}</strong>
          <span className="tiny muted">km/h</span>
        </div>
      </header>

      <div className="game__stage gr__stage">
        <div className="arena" ref={stageRef} role="img" aria-label="Race track">
          {!ready && <div className="arena__loading spinner" />}
        </div>
        {me?.turbo && <div className="gr__turbo display">{t('match.turbo')}</div>}
        <Countdown startsAt={view.phase === 'countdown' ? view.startsAt : null} goLabel={t('match.go')} />
        {showIntro && <MatchIntro players={view.players} selfId={selfId} modeLabel={t('mode.grammar-race')} />}
        <VisualCue />
      </div>

      <section className="game__panel">
        {view.phase === 'waiting' && transport.kind === 'online' && <ReadyCheck transport={transport} />}
        <div className="row gr__racers">
          {transport.players
            .filter((p) => p.isBot)
            .map((p) => (
              <span key={p.playerId} className="row tiny">
                {p.nickname} <BotBadge tier={p.botTier ? t(`bot.${p.botTier}` as MessageKey) : undefined} />
              </span>
            ))}
          <span className="spacer" />
          <div className="streak" aria-label={`Turbo ${streakInCycle}/${GRAMMAR_RACE.turboStreak}`}>
            <Icon name="bolt" />
            {[0, 1, 2].map((i) => (
              <span key={i} className={`pip ${i < streakInCycle ? 'pip--on' : ''}`} />
            ))}
          </div>
        </div>
        {view.round && (view.phase === 'round' || view.phase === 'reveal') && me?.finishedAtMs == null && (
          <>
            <div className="qhead">
              <span className="chip">{t('match.question', { n: view.round.index + 1 })}</span>
              <span className="spacer" />
              {view.phase === 'round' && !view.myAnswer && <TimerRing deadline={view.round.deadline} total={view.round.durationMs} size={46} />}
            </div>
            <QuestionCard
              key={view.round.roundId}
              question={view.round.question}
              selected={view.myAnswer?.optionId}
              result={view.result?.roundId === view.round.roundId ? view.result : null}
              selfId={selfId}
              onAnswer={actions.answerOption}
            />
            {flash && view.result?.roundId === view.round.roundId && (
              <div key={flash.seq} className={`raceflash ${flash.ok ? 'raceflash--good' : 'raceflash--bad'}`} role="status">
                <Icon name={flash.ok ? (flash.turbo ? 'bolt' : 'check') : 'x'} />
                {flash.ok ? (flash.turbo ? t('match.turbo') : t('match.correct')) : <span>{t('match.correctAnswer')}: <En>{view.result.correctAnswer}</En></span>}
              </div>
            )}
          </>
        )}
        {me?.finishedAtMs != null && view.phase !== 'ended' && <p className="center display gr__finished">{t('match.finish')}!</p>}
      </section>

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
