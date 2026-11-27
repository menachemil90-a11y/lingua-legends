/** Online co-op Escape Room: the server checks answers and keeps the team's shared state. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EscapeAnswer, ServerMessage } from '@lingua/shared';
import { ESCAPE_ROOMS, type EscapePuzzle } from '@lingua/content';
import { HOTSPOTS, RoomScene } from '../../art/rooms';
import { Icon } from '../../art/icons';
import { Button, Chip, Dialog, En, Loading, toast } from '../../design';
import { useT, useLang } from '../../i18n';
import { sfx } from '../../audio/sfx';
import { usePlayer } from '../../state/player';
import type { MatchTransport } from '../../net/transport';
import { Countdown } from '../shared/components';
import { ReadyCheck } from '../shared/MatchChrome';
import { useMatch, type MatchView } from '../shared/useMatch';
import { OBJECT_ICON, PuzzleView, puzzleEvent } from '../../screens/EscapeRoom';

const fmt = (ms: number) => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor((Math.max(0, ms) % 60000) / 1000)).padStart(2, '0')}`;

export function EscapeCoopScreen({ transport, onEnd, onExit }: { transport: MatchTransport; onEnd: (view: MatchView) => void; onExit: () => void }) {
  const t = useT();
  const lang = useLang();
  const selfId = transport.selfId;
  const recordLearning = usePlayer((s) => s.recordLearning);
  const [openId, setOpenId] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lastSeq = useRef(0);
  const recorded = useRef(new Set<string>());

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === 'ERROR') toast(msg.message, 'bad');
      if (msg.type !== 'PLAYER_STATE' || msg.state.mode !== 'escape-room') return;
      const st = msg.state;
      const last = st.last;
      if (!last || last.seq === lastSeq.current) return;
      lastSeq.current = last.seq;
      sfx.play(last.correct ? 'shield' : 'wrong');
      // Learning evidence: my first attempt on each lock (like solo play).
      if (last.by === selfId && !recorded.current.has(last.puzzleId)) {
        const room = ESCAPE_ROOMS.find((r) => r.id === st.roomId);
        const puzzle = room?.puzzles.find((p) => p.id === last.puzzleId);
        if (room && puzzle) {
          recorded.current.add(last.puzzleId);
          const hinted = st.hints.includes(last.puzzleId);
          recordLearning([puzzleEvent(room, puzzle, last.correct && !hinted, 1, hinted)]);
        }
      }
    },
    [selfId, recordLearning],
  );
  const { view, actions } = useMatch(transport, onMessage);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
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

  const st = view.state?.mode === 'escape-room' ? view.state : null;
  const room = st ? ESCAPE_ROOMS.find((r) => r.id === st.roomId) : null;
  const send = (puzzleId: string, action: { type: 'hint' } | { type: 'answer'; answer: EscapeAnswer }) =>
    transport.send({ type: 'ESCAPE_ACTION', matchId: transport.matchId, action: action.type === 'hint' ? { type: 'hint', puzzleId } : { type: 'answer', puzzleId, answer: action.answer } });
  const nameOf = (id: string) => view.players.find((p) => p.playerId === id)?.nickname ?? '';

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

  if (!st || !room) {
    return (
      <div className="page">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('match.leave')} onClick={() => setLeaveOpen(true)} />
          <h1 className="page__title">{t('mode.escape-room')}</h1>
        </div>
        {view.phase === 'waiting' && transport.kind === 'online' ? <ReadyCheck transport={transport} /> : <Loading />}
        {leaveDialog}
      </div>
    );
  }

  const solved = new Map(st.solved.map((s) => [s.puzzleId, s]));
  const open: EscapePuzzle | undefined = room.puzzles.find((p) => p.id === openId);
  const remaining = view.endsAt ? view.endsAt - now : 0;
  const last = st.last;
  const lastPuzzle = last ? room.puzzles.find((p) => p.id === last.puzzleId) : undefined;
  const spots = HOTSPOTS[room.theme];

  return (
    <div className="page escape">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('match.leave')} onClick={() => setLeaveOpen(true)} />
        <h1 className="page__title">{lang === 'he' ? room.titleHe : room.title}</h1>
        <Chip tone={remaining < 60_000 && view.phase !== 'ended' ? 'bad' : 'gold'} icon="clock">
          {t('escape.teamTime')} {fmt(remaining)}
        </Chip>
      </div>
      <Countdown startsAt={view.phase === 'countdown' ? view.startsAt : null} goLabel={t('match.go')} />
      <div className="row small" data-testid="escape-team">
        {view.players.map((p) => (
          <Chip key={p.playerId} tone={st.connected.includes(p.playerId) ? 'good' : undefined} icon="user">
            {p.nickname}
            {p.playerId === selfId ? ` (${t('common.you')})` : ''}
          </Chip>
        ))}
        <span className="spacer" />
        <Chip tone="purple" icon="lock">
          {t('escape.teamProgress', { n: st.solved.length, total: room.puzzles.length })}
        </Chip>
      </div>
      <div className={`room-scene ${st.escaped ? 'room-scene--open' : ''}`}>
        <RoomScene theme={room.theme} />
        {room.puzzles.map((p) => {
          const pos = spots[p.object] ?? { x: 50, y: 50 };
          const done = solved.has(p.id);
          return (
            <button key={p.id} type="button" className={`hotspot ${done ? 'hotspot--done' : ''}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={() => setOpenId(p.id)} aria-label={p.title}>
              <Icon name={done ? 'check' : OBJECT_ICON[p.object]} />
              <span className="hotspot__label en">{p.title}</span>
            </button>
          );
        })}
        <div className="locks" aria-label={t('escape.locks')}>
          {room.puzzles.map((p) => (
            <span key={p.id} className={`lock ${solved.has(p.id) ? 'lock--open' : ''}`}>
              <Icon name={solved.has(p.id) ? 'check' : 'lock'} />
            </span>
          ))}
        </div>
      </div>
      {last && lastPuzzle && (
        <p className={`small ${last.correct ? 'text-good' : 'muted'}`} role="status" data-testid="escape-feed">
          <Icon name={last.correct ? 'check' : 'x'} style={{ width: 16, height: 16, verticalAlign: 'middle' }} />{' '}
          {last.correct ? t('escape.feedOpened', { name: nameOf(last.by), lock: lastPuzzle.title }) : t('escape.feedTried', { name: nameOf(last.by), lock: lastPuzzle.title })}
        </p>
      )}
      <p className="small muted">{t('escape.instructions')}</p>

      <Dialog open={!!open && view.phase !== 'ended'} title={open ? <En>{open.title}</En> : ''} onClose={() => setOpenId(null)}>
        {open && (
          <PuzzleView
            key={open.id}
            puzzle={open}
            solved={solved.has(open.id)}
            hintShown={st.hints.includes(open.id)}
            wrongSignal={(st.attempts[open.id] ?? 0) - (solved.has(open.id) ? 1 : 0)}
            onSubmit={(answer) => send(open.id, { type: 'answer', answer })}
            onHint={() => send(open.id, { type: 'hint' })}
            solvedNote={solved.get(open.id) ? <span className="tiny muted"> · {t('escape.openedBy', { name: nameOf(solved.get(open.id)!.by) })}</span> : undefined}
          />
        )}
      </Dialog>

      {view.phase === 'ended' && (
        <Dialog open title={st.escaped ? t('escape.escaped') : t('result.draw')} dismissible={false} onClose={() => {}}>
          {st.escaped ? <En as="p">{room.outro}</En> : <p>{t('escape.outOfTime')}</p>}
          {st.escaped && lang === 'he' && <p className="small muted">{room.outroHe}</p>}
        </Dialog>
      )}
      {leaveDialog}
    </div>
  );
}
