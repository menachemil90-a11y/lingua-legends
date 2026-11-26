import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerMessage, WordBattlePlayerState } from '@lingua/shared';
import { QUICK_CHAT_PHRASES } from '@lingua/shared';
import { Icon } from '../../art/icons';
import { Button, Dialog, HealthBar, TimerRing } from '../../design';
import { useT, useLang } from '../../i18n';
import { sfx } from '../../audio/sfx';
import { usePlayer } from '../../state/player';
import type { MatchTransport } from '../../net/transport';
import type { ArenaApi, Side } from '../../phaser/ArenaScene';
import { Countdown, MatchIntro, PlayerTag, QuestionCard, RoundFeedback, VisualCue } from '../shared/components';
import { useMatch, type MatchView } from '../shared/useMatch';
import { MatchClock, ReadyCheck } from '../shared/MatchChrome';

export function WordBattleScreen({ transport, onEnd, onExit }: { transport: MatchTransport; onEnd: (view: MatchView) => void; onExit: () => void }) {
  const t = useT();
  const lang = useLang();
  const arenaRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ArenaApi | null>(null);
  const [arenaReady, setArenaReady] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const arenaTheme = usePlayer((s) => s.loadout.arenaId);
  const selfId = transport.selfId;
  const sideOf = useCallback((id: string): Side => (id === selfId ? 'left' : 'right'), [selfId]);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      const api = apiRef.current;
      if (msg.type === 'ANSWER_RESULT') {
        const mine = msg.results.find((r) => r.playerId === selfId);
        sfx.play(mine?.correct ? 'correct' : 'wrong');
      }
      if (msg.type === 'COMBAT_EVENT') {
        let delay = 0;
        for (const e of msg.events) {
          const side = sideOf(e.from);
          const run = () => {
            if (!api) return;
            switch (e.kind) {
              case 'attack':
                sfx.play('attack');
                setTimeout(() => sfx.play('hit'), 420);
                api.attack(side, e.amount ?? 0, { ...(e.surge ? { surge: true } : {}), ...(e.speedBonus ? { speedBonus: e.speedBonus } : {}) });
                if (e.surge) api.setSurge(side, false);
                break;
              case 'blocked':
                sfx.play('attack');
                setTimeout(() => sfx.play('shield'), 420);
                api.attack(side, e.amount ?? 0, { blocked: true });
                if (e.to) setTimeout(() => api.setShield(sideOf(e.to!), false), 450);
                if (e.surge) api.setSurge(side, false);
                break;
              case 'miss':
                api.miss(side);
                break;
              case 'heal':
                sfx.play('heal');
                api.heal(side, e.amount ?? 0);
                break;
              case 'shield-up':
                sfx.play('shield');
                api.setShield(side, true);
                break;
              case 'surge-ready':
                sfx.play('charge');
                api.setSurge(side, true);
                break;
              case 'charged':
                sfx.play('charge');
                api.charged(side);
                break;
            }
          };
          if (e.kind === 'attack' || e.kind === 'blocked') {
            setTimeout(run, delay);
            delay += 380;
          } else setTimeout(run, e.kind === 'charged' ? delay + 500 : 0);
        }
      }
      if (msg.type === 'MATCH_END') {
        const winner = msg.winnerId ? sideOf(msg.winnerId) : null;
        setTimeout(() => api?.finish(winner), 900);
      }
    },
    [selfId, sideOf],
  );

  const { view, actions } = useMatch(transport, onMessage);

  useEffect(() => {
    let disposed = false;
    const me = view.players.find((p) => p.playerId === selfId) ?? view.players[0]!;
    const foe = view.players.find((p) => p.playerId !== selfId) ?? view.players[1]!;
    void import('../../phaser/ArenaScene').then(({ bootArena }) => {
      if (disposed || !arenaRef.current) return;
      void bootArena(arenaRef.current, {
        left: { characterId: me.characterId },
        right: { characterId: foe.characterId },
        theme: arenaTheme === 'arena-nightbloom' ? 'nightbloom' : 'skyforge',
      }).then((api) => {
        if (disposed) api.destroy();
        else {
          apiRef.current = api;
          setArenaReady(true);
        }
      });
    });
    return () => {
      disposed = true;
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // The arena is created once per transport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport]);

  useEffect(() => {
    if (view.phase === 'ended') {
      const id = setTimeout(() => onEnd(view), 2600);
      return () => clearTimeout(id);
    }
  }, [view.phase, view, onEnd]);

  useEffect(() => {
    const onReq = () => setLeaveOpen(true);
    window.addEventListener('ll:request-leave', onReq);
    return () => window.removeEventListener('ll:request-leave', onReq);
  }, []);

  const wb = view.state?.mode === 'word-battle' ? view.state.players : [];
  const meState: WordBattlePlayerState | undefined = wb.find((p) => p.playerId === selfId);
  const foeState = wb.find((p) => p.playerId !== selfId);
  const me = view.players.find((p) => p.playerId === selfId) ?? view.players[0]!;
  const foe = view.players.find((p) => p.playerId !== selfId) ?? view.players[1]!;
  const charged = !!meState?.abilityCharged && view.phase === 'round';
  const showIntro = view.phase === 'waiting' || (view.phase === 'countdown' && (view.startsAt ?? 0) - Date.now() > 2200);
  const foeAnswered = view.round && view.locked.includes(foe.playerId) && !view.result;

  return (
    <div className="game wb">
      <header className="game__hud">
        <Button variant="ghost" size="sm" icon="back" aria-label={t('match.leave')} onClick={() => setLeaveOpen(true)} />
        <div className="wb__fighter">
          <PlayerTag player={me} side="left" />
          <HealthBar hp={meState?.hp ?? 100} max={meState?.maxHp ?? 100} label={`${me.nickname} HP`} />
          <ComboPips combo={meState?.combo ?? 0} charged={!!meState?.abilityCharged} shield={!!meState?.shield} surge={!!meState?.surge} />
        </div>
        <MatchClock endsAt={view.endsAt} finalRound={!!view.round?.finalRound} />
        <div className="wb__fighter wb__fighter--foe">
          <PlayerTag player={foe} side="right" extra={foeAnswered ? <span className="chip chip--good">{t('match.opponentAnswered')}</span> : null} />
          <HealthBar hp={foeState?.hp ?? 100} max={foeState?.maxHp ?? 100} label={`${foe.nickname} HP`} />
          <ComboPips combo={foeState?.combo ?? 0} charged={!!foeState?.abilityCharged} shield={!!foeState?.shield} surge={!!foeState?.surge} />
        </div>
      </header>

      <div className="game__stage">
        <div className="arena" ref={arenaRef} aria-label="Battle arena" role="img">
          {!arenaReady && <div className="arena__loading spinner" />}
        </div>
        {foeState && !foeState.connected && <div className="game__banner">{t('match.opponentDisconnected')}</div>}
        <Countdown startsAt={view.phase === 'countdown' ? view.startsAt : null} goLabel={t('match.fight')} />
        {showIntro && <MatchIntro players={view.players} selfId={selfId} modeLabel={t('mode.word-battle')} />}
        <VisualCue />
      </div>

      <section className="game__panel" aria-live="polite">
        {view.phase === 'waiting' && transport.kind === 'online' && <ReadyCheck transport={transport} />}
        {view.round && (view.phase === 'round' || view.phase === 'reveal') && (
          <>
            <div className="qhead">
              <span className="chip">{t('match.round', { n: view.round.index + 1 })}</span>
              {view.round.finalRound && <span className="chip chip--gold">{t('match.finalRound')}</span>}
              <span className="spacer" />
              {view.phase === 'round' && <TimerRing deadline={view.round.deadline} total={view.round.durationMs} size={50} />}
            </div>
            <QuestionCard
              key={view.round.roundId}
              question={view.round.question}
              selected={view.myAnswer?.optionId}
              result={view.result?.roundId === view.round.roundId ? view.result : null}
              selfId={selfId}
              onAnswer={actions.answerOption}
            />
            {view.myAnswer && !view.result && <p className="muted small center">{t('match.waitingOpponent')}</p>}
            {view.result && <RoundFeedback result={view.result} selfId={selfId} />}
          </>
        )}
        <div className="abilities" role="group" aria-label={t('match.abilityReady')}>
          {(['shield', 'surge', 'focus'] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`ability ability--${a} ${charged ? 'ability--ready' : ''}`}
              disabled={!charged || (a === 'shield' && meState?.shield) || (a === 'surge' && meState?.surge)}
              onClick={() => {
                actions.useAbility(a);
              }}
            >
              <Icon name={a === 'shield' ? 'shield' : a === 'surge' ? 'bolt' : 'heart'} />
              <span className="ability__name">{t(`match.ability.${a}`)}</span>
              <span className="ability__desc">{t(`match.ability.${a}.desc`)}</span>
            </button>
          ))}
          {transport.kind === 'online' && (
            <Button variant="ghost" size="sm" icon="chat" aria-label={t('match.quickChat')} onClick={() => setChatOpen((v) => !v)} />
          )}
        </div>
        {chatOpen && (
          <div className="quickchat">
            {QUICK_CHAT_PHRASES.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => {
                  actions.quickChat(p.id);
                  setChatOpen(false);
                }}
              >
                {lang === 'he' ? p.he : p.en}
              </button>
            ))}
          </div>
        )}
        <ChatBubbles view={view} selfId={selfId} />
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

function ComboPips({ combo, charged, shield, surge }: { combo: number; charged: boolean; shield: boolean; surge: boolean }) {
  const t = useT();
  const filled = charged ? 3 : combo % 3;
  return (
    <div className="pips" aria-label={t('match.combo', { n: combo })}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`pip ${i < filled ? 'pip--on' : ''} ${charged ? 'pip--charged' : ''}`} />
      ))}
      {combo >= 2 && <span className="pips__combo">×{combo}</span>}
      {shield && <Icon name="shield" className="pips__status" aria-label={t('match.shieldUp')} />}
      {surge && <Icon name="bolt" className="pips__status pips__status--surge" aria-label={t('match.ability.surge')} />}
    </div>
  );
}

function ChatBubbles({ view, selfId }: { view: MatchView; selfId: string }) {
  const lang = useLang();
  const recent = view.chat.filter((c) => Date.now() - c.at < 3500);
  if (recent.length === 0) return null;
  return (
    <div className="chatbubbles">
      {recent.map((c) => {
        const p = QUICK_CHAT_PHRASES.find((x) => x.id === c.phraseId);
        return (
          <span key={c.at} className={`bubble ${c.from === selfId ? 'bubble--me' : ''}`}>
            {p ? (lang === 'he' ? p.he : p.en) : ''}
          </span>
        );
      })}
    </div>
  );
}
