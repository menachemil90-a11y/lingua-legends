/** Leaderboards, friends, blocking and reporting. All data comes from the real server — never faked. */
import { useEffect, useState } from 'react';
import { BRACKETS, ONLINE_MODE_IDS, QUEUE_MODE_IDS, currentSeason, type Bracket, type OnlineModeId } from '@lingua/shared';
import { RankEmblem } from '../art/Art';
import { Button, Chip, Dialog, Loading, Panel, Segmented, StateMessage, toast } from '../design';
import { useT, type MessageKey } from '../i18n';
import { useNav } from '../state/nav';
import { fetchLeaderboard, type LeaderboardRow } from '../net/api';
import { connection, useConnection } from '../net/connection';

export function Leaderboard() {
  const t = useT();
  const back = useNav((s) => s.back);
  const [mode, setMode] = useState<OnlineModeId>('word-battle');
  const [bracket, setBracket] = useState<Bracket>('core');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState(false);
  const myId = useConnection((s) => s.playerId);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(false);
    fetchLeaderboard(mode, bracket)
      .then((r) => alive && setRows(r.rows))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [mode, bracket]);

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('leaderboard.title')}</h1>
        <Chip tone="gold">
          {t('leaderboard.season')}: {currentSeason().name}
        </Chip>
      </div>
      <div className="row">
        <Segmented label={t('play.mode')} value={mode} onChange={setMode} options={QUEUE_MODE_IDS.map((m) => ({ value: m, label: t(`mode.${m}` as MessageKey) }))} />
        <Segmented label={t('play.bracket')} value={bracket} onChange={setBracket} options={BRACKETS.map((b) => ({ value: b, label: t(`play.bracket.${b}` as MessageKey) }))} />
      </div>
      <Panel flush>
        {error ? (
          <StateMessage icon="wifiOff" title={t('common.offline')}>
            {t('leaderboard.offline')}
          </StateMessage>
        ) : rows === null ? (
          <Loading />
        ) : rows.length === 0 ? (
          <StateMessage icon="trophy" title={t('leaderboard.empty')} />
        ) : (
          <table className="lb">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('leaderboard.player')}</th>
                <th>{t('leaderboard.rating')}</th>
                <th>{t('leaderboard.games')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.playerId} className={r.playerId === myId ? 'lb__me' : ''}>
                  <td className="num">{r.rank}</td>
                  <td>
                    <span className="row" style={{ flexWrap: 'nowrap' }}>
                      <RankEmblem tier={r.tier as 'gold'} division={null} size={28} />
                      {r.nickname}
                    </span>
                  </td>
                  <td className="num">
                    {r.rating} <span className="tiny muted">{r.label}</span>
                  </td>
                  <td className="num">{r.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

export function Friends() {
  const t = useT();
  const back = useNav((s) => s.back);
  const status = useConnection((s) => s.status);
  const friendCode = useConnection((s) => s.friendCode);
  const friends = useConnection((s) => s.friends);
  const [code, setCode] = useState('');
  const [reportFor, setReportFor] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState<'cheating' | 'offensive-name' | 'harassment' | 'other'>('other');
  const [challengeFor, setChallengeFor] = useState<{ id: string; name: string } | null>(null);
  const [cmode, setCmode] = useState<OnlineModeId>('word-battle');

  useEffect(() => {
    void connection.connect().then((ok) => ok && connection.send({ type: 'FRIENDS_LIST' }));
  }, []);

  if (status !== 'connected' && status !== 'connecting' && status !== 'reconnecting') {
    return (
      <div className="page">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
          <h1 className="page__title">{t('friends.title')}</h1>
        </div>
        <StateMessage icon="wifiOff" title={t('common.offline')} action={<Button icon="refresh" onClick={() => void connection.connect()}>{t('common.retry')}</Button>}>
          {t('friends.offline')}
        </StateMessage>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('friends.title')}</h1>
      </div>
      <div className="grid-auto">
        <Panel title={t('friends.yourCode')} gold>
          <strong className="display en friend-code" data-testid="friend-code">
            {friendCode ?? '…'}
          </strong>
          <Button size="sm" icon="copy" onClick={() => friendCode && void navigator.clipboard?.writeText(friendCode).then(() => toast(t('common.copied'), 'good'))}>
            {t('common.copy')}
          </Button>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            {t('friends.safety')}
          </p>
        </Panel>
        <Panel title={t('friends.add')}>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (/^[A-Z0-9]{8}$/.test(c)) {
                connection.send({ type: 'FRIEND_REQUEST', friendCode: c });
                setCode('');
              }
            }}
          >
            <input className="input en" placeholder={t('friends.codePlaceholder')} value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label={t('friends.add')} />
            <Button type="submit" variant="secondary" icon="plus">
              {t('friends.add')}
            </Button>
          </form>
        </Panel>
      </div>

      {friends && friends.incoming.length > 0 && (
        <Panel title={t('friends.requests')}>
          {friends.incoming.map((r) => (
            <div key={r.requestId} className="friend-row">
              <strong>{r.nickname}</strong>
              <span className="spacer" />
              <Button size="sm" variant="secondary" onClick={() => connection.send({ type: 'FRIEND_RESPOND', requestId: r.requestId, accept: true })}>
                {t('friends.accept')}
              </Button>
              <Button size="sm" onClick={() => connection.send({ type: 'FRIEND_RESPOND', requestId: r.requestId, accept: false })}>
                {t('friends.decline')}
              </Button>
            </div>
          ))}
        </Panel>
      )}

      <Panel title={t('friends.list')}>
        {!friends || friends.friends.length === 0 ? (
          <p className="muted small">{t('friends.none')}</p>
        ) : (
          friends.friends.map((f) => (
            <div key={f.playerId} className="friend-row">
              <span className={`net-dot net-dot--${f.online ? 'connected' : 'idle'}`} />
              <strong>{f.nickname}</strong>
              <span className="spacer" />
              <Button size="sm" variant="primary" icon="sword" disabled={!f.online} onClick={() => setChallengeFor({ id: f.playerId, name: f.nickname })}>
                {t('friends.challenge')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => connection.send({ type: 'FRIEND_REMOVE', playerId: f.playerId })}>
                {t('friends.remove')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => connection.send({ type: 'BLOCK', playerId: f.playerId })}>
                {t('friends.block')}
              </Button>
              <Button size="sm" variant="ghost" icon="flag" aria-label={t('friends.report')} onClick={() => setReportFor({ id: f.playerId, name: f.nickname })} />
            </div>
          ))
        )}
        {friends && friends.outgoing.length > 0 && (
          <>
            <hr className="divider" />
            <span className="tiny muted">{t('friends.pending')}</span>
            {friends.outgoing.map((o) => (
              <div key={o.requestId} className="friend-row tiny">
                {o.nickname}
              </div>
            ))}
          </>
        )}
      </Panel>

      {friends && friends.blocked.length > 0 && (
        <Panel title={t('friends.blocked')}>
          {friends.blocked.map((b) => (
            <div key={b.playerId} className="friend-row">
              {b.nickname}
              <span className="spacer" />
              <Button size="sm" onClick={() => connection.send({ type: 'UNBLOCK', playerId: b.playerId })}>
                {t('friends.unblock')}
              </Button>
            </div>
          ))}
        </Panel>
      )}

      <Dialog
        open={!!challengeFor}
        title={`${t('friends.challenge')}: ${challengeFor?.name ?? ''}`}
        onClose={() => setChallengeFor(null)}
        actions={
          <Button
            variant="primary"
            icon="sword"
            onClick={() => {
              if (challengeFor) connection.send({ type: 'FRIEND_CHALLENGE', playerId: challengeFor.id, mode: cmode, bracket: 'core' });
              setChallengeFor(null);
            }}
          >
            {t('friends.challenge')}
          </Button>
        }
      >
        <Segmented label={t('play.mode')} value={cmode} onChange={setCmode} options={ONLINE_MODE_IDS.map((m) => ({ value: m, label: t(`mode.${m}` as MessageKey) }))} />
      </Dialog>

      <Dialog
        open={!!reportFor}
        title={t('friends.reportTitle')}
        onClose={() => setReportFor(null)}
        actions={
          <Button
            variant="danger"
            onClick={() => {
              if (reportFor) connection.send({ type: 'REPORT', playerId: reportFor.id, reason });
              setReportFor(null);
              toast(t('friends.reportSent'), 'good');
            }}
          >
            {t('friends.report')}
          </Button>
        }
      >
        <div className="stack">
          <strong>{reportFor?.name}</strong>
          <span className="field__label">{t('friends.reportReason')}</span>
          <Segmented
            label={t('friends.reportReason')}
            value={reason}
            onChange={setReason}
            options={(['cheating', 'offensive-name', 'harassment', 'other'] as const).map((r) => ({ value: r, label: t(`friends.reason.${r}`) }))}
          />
        </div>
      </Dialog>
    </div>
  );
}
