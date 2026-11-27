/** Escape Room (solo): read signs, notes and messages in English to open every lock. */
import { useEffect, useMemo, useState } from 'react';
import { checkEscapeAnswer, ESCAPE_ROOMS, type EscapePuzzle, type EscapeRoom as Room } from '@lingua/content';
import { shuffle } from '@lingua/shared';
import type { LearningEvent } from '@lingua/learning';
import { HOTSPOTS, RoomScene } from '../art/rooms';
import { Icon, type IconName } from '../art/icons';
import { Button, Chip, Dialog, En, Panel, Segmented } from '../design';
import { useT, useLang } from '../i18n';
import { sfx } from '../audio/sfx';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { uid } from '../state/storage';
import { Explanation } from '../games/shared/components';
import { TileBoard } from '../games/sentenceMaster/TileBoard';

const OBJECT_ICON: Record<EscapePuzzle['object'], IconName> = {
  note: 'scroll',
  clock: 'clock',
  bookshelf: 'book',
  desk: 'pen',
  telescope: 'sparkle',
  logbook: 'book',
  chest: 'lock',
  'door-panel': 'gear',
  map: 'map',
  radio: 'volume',
};

function puzzleEvent(room: Room, p: EscapePuzzle, correct: boolean, attempt: number, hintUsed: boolean): LearningEvent {
  return {
    id: uid('ev_'),
    playerId: '',
    itemId: `escape:${p.id}`,
    mode: 'escape-room',
    correct,
    responseMs: null,
    attempt,
    hintUsed,
    timestamp: Date.now(),
    level: room.level,
    primarySkill: 'reading',
    secondarySkills: p.kind === 'text' ? ['vocabulary'] : ['inference'],
    tags: p.vocabulary.map((v) => `v:${v}`),
    category: 'reading-inference',
  };
}

function PuzzlePanel({ room, puzzle, onSolved }: { room: Room; puzzle: EscapePuzzle; onSolved: (attempts: number, hint: boolean) => void }) {
  const t = useT();
  const recordLearning = usePlayer((s) => s.recordLearning);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [text, setText] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const choiceOrder = useMemo(() => (puzzle.kind === 'choice' ? shuffle(puzzle.options.map((_, i) => i), Math.random) : []), [puzzle]);
  const stepTiles = useMemo(() => (puzzle.kind === 'order' ? shuffle(puzzle.steps.map((s, i) => ({ id: `s${i}`, text: s })), Math.random) : []), [puzzle]);

  const submit = (answer: Parameters<typeof checkEscapeAnswer>[1]) => {
    if (solved) return;
    const ok = checkEscapeAnswer(puzzle, answer);
    const n = attempts + 1;
    setAttempts(n);
    if (ok) {
      setSolved(true);
      sfx.play('correct');
      recordLearning([puzzleEvent(room, puzzle, n === 1 && !hint, n, hint)]);
      onSolved(n, hint);
    } else {
      sfx.play('wrong');
      setWrong((w) => w + 1);
      if (n === 1) recordLearning([puzzleEvent(room, puzzle, false, 1, hint)]);
    }
  };

  return (
    <div className="stack">
      {puzzle.text && (
        <En as="div" className="escape-doc">
          {puzzle.text.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </En>
      )}
      <En as="p" className="q-prompt">
        {puzzle.question}
      </En>
      {puzzle.kind === 'choice' && (
        <div className="answer-grid">
          {choiceOrder.map((idx, k) => (
            <button key={idx} type="button" className={`answer ${solved && idx === puzzle.answer ? 'answer--correct' : ''}`} disabled={solved} onClick={() => submit({ kind: 'choice', index: idx })}>
              <span className="answer__key">{'ABCD'[k]}</span>
              <En className="answer__text">{puzzle.options[idx]}</En>
            </button>
          ))}
        </div>
      )}
      {puzzle.kind === 'text' && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit({ kind: 'text', text });
          }}
        >
          <input className="input en escape-input" dir="ltr" lang="en" value={text} onChange={(e) => setText(e.target.value)} disabled={solved} aria-label={puzzle.question} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          <Button type="submit" variant="secondary" icon="check" disabled={solved || !text.trim()}>
            {t('common.check')}
          </Button>
        </form>
      )}
      {puzzle.kind === 'order' && (
        <>
          <TileBoard tiles={stepTiles} value={order} onChange={(ids) => !solved && setOrder(ids)} disabled={solved} state={solved ? 'correct' : 'idle'} onSubmit={() => submit({ kind: 'order', order: order.map((id) => stepTiles.find((s) => s.id === id)!.text) })} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button size="sm" variant="ghost" icon="x" disabled={solved || order.length === 0} onClick={() => setOrder([])}>
              {t('common.clear')}
            </Button>
            <Button variant="secondary" icon="check" disabled={solved || order.length !== stepTiles.length} onClick={() => submit({ kind: 'order', order: order.map((id) => stepTiles.find((s) => s.id === id)!.text) })}>
              {t('common.check')}
            </Button>
          </div>
        </>
      )}
      {wrong > 0 && !solved && (
        <p key={wrong} className="sm__retry" role="status">
          <Icon name="x" /> {t('match.wrong')}
        </p>
      )}
      {!solved && (
        <Button size="sm" variant="ghost" icon="info" onClick={() => setHint(true)} disabled={hint}>
          {t('common.hint')}
        </Button>
      )}
      {hint && !solved && <Explanation exp={puzzle.hint} compact />}
      {solved && (
        <div className="feedback feedback--good" role="status">
          <div className="feedback__head">
            <Icon name="check" />
            <strong>{t('escape.unlocked')}</strong>
          </div>
          <Explanation exp={puzzle.explanation} />
        </div>
      )}
    </div>
  );
}

function RoomPlay({ room }: { room: Room }) {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const recordMatch = usePlayer((s) => s.recordMatch);
  const [mode, setMode] = useState<'relaxed' | 'timed'>('relaxed');
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState<EscapePuzzle | null>(null);
  const [solved, setSolved] = useState<Record<string, { attempts: number; hint: boolean }>>({});
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const allSolved = room.puzzles.every((p) => solved[p.id]);

  useEffect(() => {
    if (!started || finishedAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [started, finishedAt]);

  useEffect(() => {
    if (!allSolved || finishedAt || !started) return;
    const end = Date.now();
    setFinishedAt(end);
    sfx.play('victory');
    const hints = Object.values(solved).filter((s) => s.hint).length;
    const firstTry = Object.values(solved).filter((s) => s.attempts === 1).length;
    recordMatch({
      mode: 'escape-room',
      online: false,
      queue: 'solo',
      opponent: null,
      result: 'complete',
      correct: firstTry,
      incorrect: room.puzzles.length - firstTry,
      accuracy: firstTry / room.puzzles.length,
      bestCombo: 0,
      xp: Math.max(20, 30 + room.puzzles.length * 12 - hints * 4),
      shards: 10 + firstTry * 3,
    });
  }, [allSolved, finishedAt, started, solved, room, recordMatch]);

  const elapsed = Math.max(0, (finishedAt ?? now) - (started ?? now));
  const remaining = room.timedSeconds * 1000 - elapsed;
  const fmt = (ms: number) => `${Math.floor(Math.abs(ms) / 60000)}:${String(Math.floor((Math.abs(ms) % 60000) / 1000)).padStart(2, '0')}`;

  if (!started) {
    return (
      <div className="page">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
          <h1 className="page__title">{lang === 'he' ? room.titleHe : room.title}</h1>
          <Chip tone="purple">{room.level}</Chip>
        </div>
        <Panel gold className="stack">
          <En as="p">{room.intro}</En>
          {lang === 'he' && <p className="small muted">{room.introHe}</p>}
          <Segmented
            label={t('escape.mode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'relaxed', label: t('escape.relaxed') },
              { value: 'timed', label: `${t('escape.timed')} (${fmt(room.timedSeconds * 1000)})` },
            ]}
          />
          <Button variant="primary" size="lg" icon="door" onClick={() => setStarted(Date.now())} data-testid="enter-room">
            {t('escape.enter')}
          </Button>
        </Panel>
      </div>
    );
  }

  const spots = HOTSPOTS[room.theme];
  return (
    <div className="page escape">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{lang === 'he' ? room.titleHe : room.title}</h1>
        <Chip tone={mode === 'timed' && remaining < 60_000 ? 'bad' : 'gold'} icon="clock">
          {mode === 'timed' ? fmt(remaining) : fmt(elapsed)}
        </Chip>
      </div>
      <div className={`room-scene ${allSolved ? 'room-scene--open' : ''}`}>
        <RoomScene theme={room.theme} />
        {room.puzzles.map((p) => {
          const pos = spots[p.object] ?? { x: 50, y: 50 };
          const done = !!solved[p.id];
          return (
            <button
              key={p.id}
              type="button"
              className={`hotspot ${done ? 'hotspot--done' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => setOpen(p)}
              aria-label={p.title}
            >
              <Icon name={done ? 'check' : OBJECT_ICON[p.object]} />
              <span className="hotspot__label en">{p.title}</span>
            </button>
          );
        })}
        <div className="locks" aria-label={t('escape.locks')}>
          {room.puzzles.map((p) => (
            <span key={p.id} className={`lock ${solved[p.id] ? 'lock--open' : ''}`}>
              <Icon name={solved[p.id] ? 'check' : 'lock'} />
            </span>
          ))}
        </div>
        {mode === 'timed' && remaining <= 0 && !allSolved && <div className="game__banner">{t('escape.timeUp')}</div>}
      </div>
      <p className="small muted">{t('escape.instructions')}</p>

      <Dialog open={!!open} title={open?.title ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <PuzzlePanel
            key={open.id}
            room={room}
            puzzle={open}
            onSolved={(attempts, hint) => {
              setSolved((s) => ({ ...s, [open.id]: { attempts, hint } }));
              sfx.play('shield');
            }}
          />
        )}
      </Dialog>

      <Dialog open={allSolved && !!finishedAt && !open} title={t('escape.escaped')} onClose={back}>
        <div className="stack">
          <En as="p">{room.outro}</En>
          {lang === 'he' && <p className="small muted">{room.outroHe}</p>}
          <div className="row">
            <Chip tone="gold" icon="clock">
              {fmt(elapsed)}
            </Chip>
            <Chip tone="good" icon="check">
              {t('escape.firstTry', { n: Object.values(solved).filter((s) => s.attempts === 1).length, total: room.puzzles.length })}
            </Chip>
            <Chip icon="info">{t('escape.hints', { n: Object.values(solved).filter((s) => s.hint).length })}</Chip>
          </div>
          <Button variant="primary" onClick={back}>
            {t('common.done')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function EscapeRoomScreen({ roomId }: { roomId?: string }) {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const room = ESCAPE_ROOMS.find((r) => r.id === roomId);
  if (room) return <RoomPlay room={room} />;
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('mode.escape-room')}</h1>
      </div>
      <p className="small muted">{t('escape.intro')}</p>
      <div className="grid-auto">
        {ESCAPE_ROOMS.map((r) => (
          <button key={r.id} type="button" className="tile escape-card" onClick={() => go({ id: 'escape-room', roomId: r.id })}>
            <div className="escape-card__art">
              <RoomScene theme={r.theme} />
            </div>
            <span className="row">
              <Chip tone="purple">{r.level}</Chip>
              <Chip icon="lock">{r.puzzles.length}</Chip>
            </span>
            <span className="tile__title" style={{ maxWidth: '100%' }}>
              {lang === 'he' ? r.titleHe : r.title}
            </span>
          </button>
        ))}
      </div>
      <p className="tiny muted">{t('escape.coopNote')}</p>
    </div>
  );
}
