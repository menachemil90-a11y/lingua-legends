/** Online matchmaking queue and private rooms. Matches start via the global MATCH_FOUND router. */
import { useEffect, useRef, useState } from 'react';
import type { Bracket, OnlineModeId } from '@lingua/shared';
import { Hero } from '../art/Art';
import { Button, Chip, Panel, StateMessage, toast } from '../design';
import { useT, type MessageKey } from '../i18n';
import { useNav } from '../state/nav';
import { connection, useConnection } from '../net/connection';
import { quickPlayParams } from './Lobby';

export function Online({ mode, flow, queue, bracket, roomCode }: { mode: OnlineModeId; flow: 'queue' | 'room'; queue?: 'ranked' | 'casual'; bracket: Bracket; roomCode?: string }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const replace = useNav((s) => s.replace);
  const status = useConnection((s) => s.status);
  const q = useConnection((s) => s.queue);
  const room = useConnection((s) => s.room);
  const lastError = useConnection((s) => s.lastError);
  const playerId = useConnection((s) => s.playerId);
  const [code, setCode] = useState(roomCode ?? '');
  const [now, setNow] = useState(Date.now());
  const started = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void connection.connect().then((ok) => {
      if (!ok) return;
      if (flow === 'queue' && queue) connection.send({ type: 'QUEUE_JOIN', mode, queue, bracket });
      if (flow === 'room' && roomCode) connection.send({ type: 'ROOM_JOIN', code: roomCode });
    });
    return () => {
      const s = useConnection.getState();
      if (s.queue) connection.send({ type: 'QUEUE_LEAVE' });
    };
  }, [flow, queue, mode, bracket, roomCode]);

  useEffect(() => {
    if (lastError?.startsWith('ROOM_NOT_FOUND')) toast(t('error.roomNotFound'), 'bad');
    if (lastError?.startsWith('ROOM_FULL')) toast(t('error.roomFull'), 'bad');
  }, [lastError, t]);

  const leave = () => {
    if (q) connection.send({ type: 'QUEUE_LEAVE' });
    if (room) connection.send({ type: 'ROOM_LEAVE' });
    back();
  };

  if (status === 'unavailable') {
    return (
      <div className="page">
        <StateMessage icon="wifiOff" title={t('common.offline')} error action={<Button onClick={back}>{t('common.back')}</Button>}>
          {t('play.serverOffline')}
        </StateMessage>
      </div>
    );
  }

  if (flow === 'queue') {
    const waited = q?.elapsedMs ?? 0;
    return (
      <div className="page online">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={leave} />
          <h1 className="page__title">{queue === 'ranked' ? t('play.ranked') : t('play.casual')}</h1>
          <Chip>{t(`mode.${mode}` as MessageKey)}</Chip>
          <Chip tone="purple">{t(`play.bracket.${bracket}` as MessageKey)}</Chip>
        </div>
        <Panel className="searching">
          <div className="searching__radar" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2 className="display">{t('queue.searching')}</h2>
          <p className="num muted">{Math.floor(waited / 1000)}s</p>
          {q?.searching !== undefined && <p className="small muted">{t('queue.inQueue', { n: q.searching })}</p>}
          {waited > 30_000 && (
            <div className="stack" style={{ justifyItems: 'center' }}>
              <p className="small">{t('queue.waitedLong')}</p>
              <p className="small muted">{t('queue.noBots')}</p>
              <Button
                variant="secondary"
                icon="dice"
                onClick={() => {
                  connection.send({ type: 'QUEUE_LEAVE' });
                  replace({ id: 'match', params: quickPlayParams(mode) });
                }}
              >
                {t('queue.playBot')}
              </Button>
            </div>
          )}
          <Button variant="danger" icon="x" onClick={leave}>
            {t('queue.cancel')}
          </Button>
        </Panel>
      </div>
    );
  }

  const inviteUrl = room ? `${window.location.origin}${window.location.pathname}?room=${room.code}` : '';
  return (
    <div className="page online">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={leave} />
        <h1 className="page__title">{t('room.title')}</h1>
        <Chip>{t(`mode.${room?.mode ?? mode}` as MessageKey)}</Chip>
      </div>
      {!room ? (
        <div className="grid-auto">
          <Panel title={t('room.create')}>
            <Button variant="primary" size="lg" icon="plus" disabled={status !== 'connected'} onClick={() => connection.send({ type: 'ROOM_CREATE', mode, bracket })} data-testid="create-room">
              {t('room.create')}
            </Button>
          </Panel>
          <Panel title={t('room.join')}>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const c = code.trim().toUpperCase();
                if (/^[A-Z0-9]{6}$/.test(c)) connection.send({ type: 'ROOM_JOIN', code: c });
              }}
            >
              <input
                className="input en room-code-input"
                aria-label={t('room.joinPrompt')}
                placeholder="ABC123"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                data-testid="room-code-input"
              />
              <Button type="submit" variant="secondary" icon="forward" disabled={status !== 'connected'} data-testid="join-room">
                {t('room.join')}
              </Button>
            </form>
          </Panel>
        </div>
      ) : (
        <Panel gold>
          <div className="room">
            <div className="room__code">
              <span className="tiny muted">{t('room.code')}</span>
              <strong className="display en num" data-testid="room-code">
                {room.code}
              </strong>
              <div className="row">
                <Button
                  size="sm"
                  icon="copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText(room.code).then(() => toast(t('common.copied'), 'good'));
                  }}
                >
                  {t('common.copy')}
                </Button>
                <Button
                  size="sm"
                  icon="share"
                  onClick={() => {
                    if (navigator.share) void navigator.share({ title: 'Lingua Legends', text: t('friends.invited', { name: '', mode: t(`mode.${room.mode}` as MessageKey) }), url: inviteUrl }).catch(() => {});
                    else void navigator.clipboard?.writeText(inviteUrl).then(() => toast(t('common.copied'), 'good'));
                  }}
                >
                  {t('room.shareLink')}
                </Button>
              </div>
              <span className="tiny muted">{t('room.expires', { t: `${Math.max(0, Math.ceil((room.expiresAt - now - useConnection.getState().offsetMs) / 60000))} min` })}</span>
            </div>
            <div className="room__members">
              <span className="tiny muted">{t('room.members')}</span>
              {room.members.map((m) => (
                <div key={m.playerId} className="room__member">
                  <Hero id={m.characterId} className="room__hero" />
                  <span>
                    {m.nickname} {m.playerId === playerId && <Chip>{t('common.you')}</Chip>}
                  </span>
                </div>
              ))}
              {room.members.length < 2 && <p className="muted small">{t('room.waiting')}</p>}
            </div>
          </div>
          <p className="tiny muted">{t('friends.safety')}</p>
        </Panel>
      )}
    </div>
  );
}
