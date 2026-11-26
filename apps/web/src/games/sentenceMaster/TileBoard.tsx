/**
 * Sentence tile board with three input methods:
 *  - tap/click a tile to add or remove it,
 *  - drag with mouse or touch (pointer events) to insert at a position,
 *  - keyboard: 1–9 pick tiles, Backspace removes, ←/→ reorder, Enter checks.
 * The answer row is always LTR because it is English content.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { sfx } from '../../audio/sfx';

export interface Tile {
  id: string;
  text: string;
}

interface DragState {
  id: string;
  from: 'pool' | 'answer';
  x: number;
  y: number;
  startX: number;
  startY: number;
  active: boolean;
}

export function TileBoard({
  tiles,
  value,
  onChange,
  onSubmit,
  disabled,
  state,
}: {
  tiles: Tile[];
  value: string[];
  onChange: (ids: string[]) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  state?: 'idle' | 'correct' | 'wrong';
}) {
  const t = useT();
  const answerRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const setDrag = (d: DragState | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const pool = tiles.filter((tl) => !value.includes(tl.id));
  const textOf = (id: string) => tiles.find((x) => x.id === id)?.text ?? '';

  const add = useCallback(
    (id: string, at?: number) => {
      const cur = valueRef.current.filter((x) => x !== id);
      const idx = at === undefined ? cur.length : Math.max(0, Math.min(cur.length, at));
      cur.splice(idx, 0, id);
      sfx.play('tile');
      onChange(cur);
    },
    [onChange],
  );
  const remove = useCallback(
    (id: string) => {
      sfx.play('tick');
      onChange(valueRef.current.filter((x) => x !== id));
    },
    [onChange],
  );

  const indexAtPoint = (x: number): number => {
    const el = answerRef.current;
    if (!el) return valueRef.current.length;
    const kids = Array.from(el.querySelectorAll<HTMLElement>('[data-answer-tile]')).filter((k) => k.dataset.id !== dragRef.current?.id);
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i]!.getBoundingClientRect();
      if (x < r.left + r.width / 2) return i;
    }
    return kids.length;
  };

  const inRect = (el: HTMLElement | null, x: number, y: number) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 20;
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const active = d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 8;
      setDrag({ ...d, x: e.clientX, y: e.clientY, active });
      if (inRect(answerRef.current, e.clientX, e.clientY)) setInsertAt(indexAtPoint(e.clientX));
      else setInsertAt(null);
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      setInsertAt(null);
      if (!d || disabled) return;
      if (!d.active) {
        if (d.from === 'pool') add(d.id);
        else remove(d.id);
        return;
      }
      if (inRect(answerRef.current, e.clientX, e.clientY)) {
        const without = valueRef.current.filter((x) => x !== d.id);
        const idx = indexAtPoint(e.clientX);
        valueRef.current = without;
        add(d.id, idx);
      } else if (d.from === 'answer' && inRect(poolRef.current, e.clientX, e.clientY)) {
        remove(d.id);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.from, disabled, add, remove]);

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^[1-9]$/.test(e.key)) {
        const tile = pool[Number(e.key) - 1];
        if (tile) {
          e.preventDefault();
          add(tile.id);
        }
      } else if (e.key === 'Backspace') {
        const last = valueRef.current[valueRef.current.length - 1];
        if (last) {
          e.preventDefault();
          remove(last);
        }
      } else if (e.key === 'Enter' && onSubmit && valueRef.current.length === tiles.length) {
        const active = document.activeElement;
        if (active && active.tagName === 'BUTTON' && !(active as HTMLElement).dataset.answerTile && !(active as HTMLElement).dataset.poolTile) return;
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pool, tiles.length, add, remove, onSubmit, disabled]);

  const onAnswerKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const target = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    onChange(next);
    requestAnimationFrame(() => answerRef.current?.querySelectorAll<HTMLElement>('[data-answer-tile]')[target]?.focus());
  };

  const startDrag = (e: React.PointerEvent, id: string, from: 'pool' | 'answer') => {
    if (disabled || e.button > 0) return;
    e.preventDefault();
    setDrag({ id, from, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false });
  };

  return (
    <div className={`tiles ${state ? `tiles--${state}` : ''}`}>
      <div className="tiles__label">{t('sentence.yourSentence')}</div>
      <div ref={answerRef} className="tiles__answer en" dir="ltr" lang="en" aria-label={t('sentence.yourSentence')} role="list">
        {value.length === 0 && <span className="tiles__placeholder">{t('sentence.empty')}</span>}
        {value.map((id, i) => (
          <span key={id} role="listitem" className="tiles__slot">
            {insertAt === i && drag?.active && <span className="tiles__caret" />}
            <button
              type="button"
              className={`tile-word tile-word--placed ${drag?.active && drag.id === id ? 'tile-word--ghosted' : ''}`}
              data-answer-tile
              data-id={id}
              disabled={disabled}
              onPointerDown={(e) => startDrag(e, id, 'answer')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  remove(id);
                } else onAnswerKey(e, i);
              }}
            >
              {textOf(id)}
            </button>
          </span>
        ))}
        {insertAt === value.length && drag?.active && <span className="tiles__caret" />}
      </div>
      <div className="tiles__label">{t('sentence.tiles')}</div>
      <div ref={poolRef} className="tiles__pool en" dir="ltr" lang="en" role="list" aria-label={t('sentence.tiles')}>
        {pool.map((tl, i) => (
          <span key={tl.id} role="listitem">
            <button
              type="button"
              className={`tile-word ${drag?.active && drag.id === tl.id ? 'tile-word--ghosted' : ''}`}
              data-pool-tile
              disabled={disabled}
              onPointerDown={(e) => startDrag(e, tl.id, 'pool')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  add(tl.id);
                }
              }}
              aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
            >
              {i < 9 && <span className="tile-word__key">{i + 1}</span>}
              {tl.text}
            </button>
          </span>
        ))}
      </div>
      {drag?.active && (
        <div className="tile-word tile-word--drag en" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {textOf(drag.id)}
        </div>
      )}
    </div>
  );
}
