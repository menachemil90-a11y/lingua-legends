import { useEffect, useState } from 'react';
import { Button } from '../../design';
import { useT } from '../../i18n';
import { useConnection } from '../../net/connection';
import type { MatchTransport } from '../../net/transport';

export function MatchClock({ endsAt, finalRound }: { endsAt: number | null; finalRound?: boolean }) {
  const t = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!endsAt) return <div className="mclock" />;
  const left = Math.max(0, endsAt - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className={`mclock ${left < 20000 ? 'mclock--low' : ''}`} aria-label={t('match.timer')}>
      <span className="mclock__time num">
        {m}:{String(s).padStart(2, '0')}
      </span>
      {finalRound && <span className="mclock__final">{t('match.finalRound')}</span>}
    </div>
  );
}

/** Online ready check after MATCH_FOUND: both players must accept. */
export function ReadyCheck({ transport }: { transport: MatchTransport }) {
  const t = useT();
  const readyIds = useConnection((s) => s.readyIds);
  const pending = useConnection((s) => s.pendingMatch);
  const [sent, setSent] = useState(false);
  const iAmReady = sent || readyIds.includes(transport.selfId);
  const deadline = pending?.readyDeadline ? pending.readyDeadline - useConnection.getState().offsetMs : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="readycheck">
      <h2 className="display">{t('queue.found')}</h2>
      <div className="row" style={{ justifyContent: 'center' }}>
        {transport.players.map((p) => (
          <span key={p.playerId} className={`chip ${readyIds.includes(p.playerId) ? 'chip--good' : ''}`}>
            {p.nickname} · {readyIds.includes(p.playerId) ? t('room.ready') : t('room.notReady')}
          </span>
        ))}
      </div>
      {deadline && <p className="tiny muted center num">{Math.max(0, Math.ceil((deadline - now) / 1000))}s</p>}
      <Button
        variant="primary"
        size="lg"
        icon="check"
        disabled={iAmReady}
        onClick={() => {
          setSent(true);
          transport.send({ type: 'READY', matchId: transport.matchId });
        }}
      >
        {iAmReady ? t('room.ready') : t('queue.accept')}
      </Button>
    </div>
  );
}
