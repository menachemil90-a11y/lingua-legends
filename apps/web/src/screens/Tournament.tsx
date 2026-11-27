/** Tournaments: the offline Champion's Cup (vs labelled bots) and friends' knockout brackets (online). */
import { useEffect, useRef, useState } from 'react';
import { BRACKET_LEVELS, BRACKETS, bracketForLevel, QUEUE_MODE_IDS, type Bracket, type BotTier, type QueueModeId } from '@lingua/shared';
import { recommendedLevel } from '@lingua/learning';
import { Icon } from '../art/icons';
import { Hero } from '../art/Art';
import { BotBadge, Button, Chip, Panel, Segmented, StateMessage, toast } from '../design';
import { useT, type MessageKey } from '../i18n';
import { sfx } from '../audio/sfx';
import { CUP_ROUNDS, cupRound, cupStatus, usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { connection, useConnection } from '../net/connection';

const CUP_TIERS: Record<'standard' | 'hard', BotTier[]> = {
  standard: ['rookie', 'adept', 'veteran'],
  hard: ['adept', 'veteran', 'champion'],
};
const ROUND_KEYS = ['tournament.round.quarter', 'tournament.round.semi', 'tournament.round.final'] as const;

function roundLabel(t: ReturnType<typeof useT>, roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  return t(fromEnd === 0 ? 'tournament.round.final' : fromEnd === 1 ? 'tournament.round.semi' : 'tournament.round.quarter');
}

function Cup() {
  const t = useT();
  const go = useNav((s) => s.go);
  const learner = usePlayer((s) => s.learner);
  const cup = usePlayer((s) => s.cup);
  const startCup = usePlayer((s) => s.startCup);
  const endCup = usePlayer((s) => s.endCup);
  const [mode, setMode] = useState<QueueModeId>('word-battle');
  const [bracket, setBracket] = useState<Bracket>(bracketForLevel(recommendedLevel(learner)));
  const [difficulty, setDifficulty] = useState<'standard' | 'hard'>('standard');

  if (!cup) {
    return (
      <Panel gold className="stack">
        <p>{t('tournament.cupIntro')}</p>
        <span className="field__label">{t('play.mode')}</span>
        <Segmented label={t('play.mode')} value={mode} onChange={setMode} options={QUEUE_MODE_IDS.map((m) => ({ value: m, label: t(`mode.${m}` as MessageKey) }))} />
        <span className="field__label">{t('play.bracket')}</span>
        <Segmented label={t('play.bracket')} value={bracket} onChange={setBracket} options={BRACKETS.map((b) => ({ value: b, label: t(`play.bracket.${b}` as MessageKey) }))} />
        <span className="field__label">{t('tournament.difficulty')}</span>
        <Segmented
          label={t('tournament.difficulty')}
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'standard', label: t('tournament.standard') },
            { value: 'hard', label: t('tournament.hard') },
          ]}
        />
        <Button variant="primary" size="lg" icon="trophy" data-testid="cup-start" onClick={() => startCup({ mode, levels: [...BRACKET_LEVELS[bracket]], tiers: CUP_TIERS[difficulty] })}>
          {t('tournament.cupStart')}
        </Button>
        <p className="tiny muted">{t('tournament.botsNote')}</p>
      </Panel>
    );
  }

  const status = cupStatus(cup);
  const round = cupRound(cup);
  return (
    <Panel gold className="stack">
      <div className="row">
        <Chip>{t(`mode.${cup.mode}` as MessageKey)}</Chip>
        <Chip tone="purple">{cup.levels.join('–')}</Chip>
      </div>
      <ol className="cup-path" aria-label={t('tournament.cupTitle')}>
        {Array.from({ length: CUP_ROUNDS }, (_, i) => {
          const state = i < round ? 'won' : i === round && status === 'playing' ? 'next' : i === round && status === 'out' ? 'lost' : 'locked';
          return (
            <li key={i} className={`cup-node cup-node--${state}`} data-testid={`cup-round-${i}`}>
              <span className="cup-node__icon">
                <Icon name={state === 'won' ? 'check' : state === 'lost' ? 'x' : state === 'next' ? 'sword' : 'lock'} />
              </span>
              <strong className="small">{t(ROUND_KEYS[i]!)}</strong>
              <BotBadge tier={t(`bot.${cup.tiers[i]}` as MessageKey)} />
            </li>
          );
        })}
      </ol>
      {status === 'playing' && (
        <>
          {cup.results[cup.results.length - 1] === 'draw' && <p className="small muted">{t('tournament.drawReplay')}</p>}
          <Button
            variant="primary"
            size="lg"
            icon="play"
            data-testid="cup-play"
            onClick={() => go({ id: 'match', params: { kind: 'local', mode: cup.mode, levels: cup.levels, botTier: cup.tiers[round]!, cup: true, ...(cup.mode === 'grammar-race' ? { racers: 2 } : {}) } })}
          >
            {t('tournament.playRound', { round: t(ROUND_KEYS[round]!) })}
          </Button>
        </>
      )}
      {status === 'champion' && (
        <div className="feedback feedback--good" role="status">
          <div className="feedback__head">
            <Icon name="trophy" />
            <strong>{t('tournament.cupWon')}</strong>
          </div>
          <p className="small">{t('tournament.cupWonNote')}</p>
        </div>
      )}
      {status === 'out' && <p className="small">{t('tournament.cupOut', { n: round })}</p>}
      {status !== 'playing' ? (
        <Button icon="refresh" onClick={endCup} data-testid="cup-new">
          {t('tournament.newCup')}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={endCup}>
          {t('tournament.abandon')}
        </Button>
      )}
    </Panel>
  );
}

function Friends({ initialCode }: { initialCode?: string }) {
  const t = useT();
  const status = useConnection((s) => s.status);
  const me = useConnection((s) => s.playerId);
  const tour = useConnection((s) => s.tournament);
  const lastError = useConnection((s) => s.lastError);
  const unlockAchievement = usePlayer((s) => s.unlockAchievement);
  const learner = usePlayer((s) => s.learner);
  const [mode, setMode] = useState<QueueModeId>('word-battle');
  const [bracket, setBracket] = useState<Bracket>(bracketForLevel(recommendedLevel(learner)));
  const [code, setCode] = useState(initialCode ?? '');
  const joined = useRef(false);

  useEffect(() => {
    void connection.connect().then((ok) => {
      if (ok && initialCode && !joined.current) {
        joined.current = true;
        connection.send({ type: 'TOURNAMENT_JOIN', code: initialCode });
      }
    });
  }, [initialCode]);

  useEffect(() => {
    if (lastError?.startsWith('ROOM_NOT_FOUND')) toast(t('error.roomNotFound'), 'bad');
    if (lastError?.startsWith('ROOM_FULL')) toast(t('error.roomFull'), 'bad');
  }, [lastError, t]);

  useEffect(() => {
    if (tour?.status === 'finished' && tour.championId && tour.championId === me && unlockAchievement('tournament-champion')) sfx.play('victory');
  }, [tour?.status, tour?.championId, me, unlockAchievement]);

  if (status === 'unavailable') {
    return (
      <StateMessage icon="wifiOff" title={t('common.offline')} error>
        {t('play.serverOffline')}
      </StateMessage>
    );
  }

  if (!tour) {
    return (
      <div className="grid-auto">
        <Panel title={t('tournament.create')} className="stack">
          <span className="field__label">{t('play.mode')}</span>
          <Segmented label={t('play.mode')} value={mode} onChange={setMode} options={QUEUE_MODE_IDS.map((m) => ({ value: m, label: t(`mode.${m}` as MessageKey) }))} />
          <span className="field__label">{t('play.bracket')}</span>
          <Segmented label={t('play.bracket')} value={bracket} onChange={setBracket} options={BRACKETS.map((b) => ({ value: b, label: t(`play.bracket.${b}` as MessageKey) }))} />
          <Button variant="primary" icon="trophy" disabled={status !== 'connected'} data-testid="tournament-create" onClick={() => connection.send({ type: 'TOURNAMENT_CREATE', mode, bracket })}>
            {t('tournament.create')}
          </Button>
        </Panel>
        <Panel title={t('tournament.join')}>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (/^[A-Z0-9]{6}$/.test(c)) connection.send({ type: 'TOURNAMENT_JOIN', code: c });
            }}
          >
            <input className="input en room-code-input" aria-label={t('room.joinPrompt')} placeholder="ABC123" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} data-testid="tournament-code-input" />
            <Button type="submit" variant="secondary" icon="forward" disabled={status !== 'connected'}>
              {t('room.join')}
            </Button>
          </form>
        </Panel>
      </div>
    );
  }

  const name = (id: string | null) => (id ? (tour.players.find((p) => p.playerId === id)?.nickname ?? '—') : '—');
  const inviteUrl = `${window.location.origin}${window.location.pathname}?tournament=${tour.code}`;
  const isHost = tour.hostId === me;

  return (
    <div className="stack">
      <Panel gold>
        <div className="row">
          <Chip>{t(`mode.${tour.mode}` as MessageKey)}</Chip>
          <Chip tone="purple">{t(`play.bracket.${tour.bracket}` as MessageKey)}</Chip>
          <Chip tone={tour.status === 'running' ? 'good' : tour.status === 'finished' ? 'gold' : undefined}>{t(`tournament.status.${tour.status}` as MessageKey)}</Chip>
          <span className="spacer" />
          <strong className="display en num" data-testid="tournament-code">
            {tour.code}
          </strong>
          <Button size="sm" icon="share" onClick={() => void navigator.clipboard?.writeText(inviteUrl).then(() => toast(t('common.copied'), 'good'))}>
            {t('room.shareLink')}
          </Button>
        </div>
        {tour.status === 'open' && (
          <div className="stack" style={{ marginTop: 12 }}>
            <span className="tiny muted">
              {t('room.members')} · {tour.players.length}/{tour.maxPlayers}
            </span>
            <div className="row">
              {tour.players.map((p) => (
                <Chip key={p.playerId} icon="user" tone={p.playerId === tour.hostId ? 'gold' : undefined}>
                  {p.nickname}
                  {p.playerId === me ? ` (${t('common.you')})` : ''}
                </Chip>
              ))}
            </div>
            {isHost ? (
              <Button variant="primary" icon="play" disabled={tour.players.length < 3} onClick={() => connection.send({ type: 'TOURNAMENT_START' })} data-testid="tournament-start">
                {tour.players.length < 3 ? t('tournament.needPlayers') : t('tournament.start')}
              </Button>
            ) : (
              <p className="small muted">{t('tournament.waitingHost')}</p>
            )}
          </div>
        )}
        {tour.status === 'finished' && tour.championId && (
          <div className="feedback feedback--good" role="status" style={{ marginTop: 12 }}>
            <div className="feedback__head">
              <Icon name="trophy" />
              <strong>{t('tournament.champion', { name: name(tour.championId) })}</strong>
            </div>
          </div>
        )}
      </Panel>

      {tour.rounds.length > 0 && (
        <div className="bracket" style={{ ['--rounds' as string]: tour.rounds.length }} data-testid="bracket">
          {tour.rounds.map((round, ri) => (
            <section key={ri} className="bracket__round" aria-label={roundLabel(t, ri, tour.rounds.length)}>
              <h3 className="bracket__title">{roundLabel(t, ri, tour.rounds.length)}</h3>
              <div className="bracket__matches">
                {round.map((m, mi) => {
                  const mine = m.a === me || m.b === me;
                  return (
                    <div key={mi} className={`bracket-match bracket-match--${m.status} ${mine ? 'bracket-match--mine' : ''}`}>
                      {[m.a, m.b].map((pid, k) => {
                        const p = tour.players.find((x) => x.playerId === pid);
                        const won = !!pid && m.winnerId === pid;
                        return (
                          <div key={k} className={`bracket-slot ${won ? 'bracket-slot--won' : ''} ${m.winnerId && pid && !won ? 'bracket-slot--out' : ''}`}>
                            {p ? <Hero id={p.characterId} className="bracket-slot__hero" /> : <span className="bracket-slot__hero" />}
                            <span className="bracket-slot__name">{pid ? name(pid) : m.status === 'bye' ? t('tournament.bye') : '…'}</span>
                            {won && <Icon name="check" className="bracket-slot__mark" aria-label={t('tournament.advances')} />}
                            {pid && tour.left.includes(pid) && <span className="tiny muted">{t('tournament.left')}</span>}
                          </div>
                        );
                      })}
                      {m.status === 'live' && <span className="chip chip--good bracket-match__live">{t('tournament.live')}</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {tour.status === 'running' && <p className="small muted">{t('tournament.autoStart')}</p>}
      <div className="row">
        <Button variant="ghost" icon="x" onClick={() => connection.send({ type: 'TOURNAMENT_LEAVE' })} data-testid="tournament-leave">
          {tour.status === 'finished' ? t('common.close') : t('tournament.leave')}
        </Button>
      </div>
      <p className="tiny muted">{t('tournament.fairNote')}</p>
    </div>
  );
}

export function TournamentScreen({ tab, code }: { tab?: 'cup' | 'friends'; code?: string }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const [view, setView] = useState<'cup' | 'friends'>(tab ?? (code ? 'friends' : 'cup'));
  return (
    <div className="page tournament">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('tournament.title')}</h1>
      </div>
      <Segmented
        label={t('tournament.title')}
        value={view}
        onChange={setView}
        options={[
          { value: 'cup', label: t('tournament.cupTitle') },
          { value: 'friends', label: t('tournament.friendsTitle') },
        ]}
      />
      {view === 'cup' ? <Cup /> : <Friends {...(code ? { initialCode: code } : {})} />}
    </div>
  );
}

