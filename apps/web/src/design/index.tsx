/**
 * Lingua Legends design system components. Every screen composes these; see
 * docs/DESIGN_SYSTEM.md for usage rules.
 */
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { create } from 'zustand';
import { Icon, ShardIcon, type IconName } from '../art/icons';
import { sfx } from '../audio/sfx';
import { useT } from '../i18n';

type Variant = 'primary' | 'secondary' | 'arcane' | 'ghost' | 'danger' | 'default';

export function Button({
  variant = 'default',
  size,
  block,
  icon,
  iconEnd,
  children,
  className,
  onClick,
  silent,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'lg';
  block?: boolean;
  icon?: IconName;
  iconEnd?: IconName;
  silent?: boolean;
}) {
  const cls = [
    'btn',
    variant !== 'default' ? `btn--${variant}` : '',
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    !children && icon ? 'btn--icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={(e) => {
        if (!silent) sfx.play('click');
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <Icon name={icon} className="btn__icon" />}
      {children}
      {iconEnd && <Icon name={iconEnd} className="btn__icon flip-rtl" />}
    </button>
  );
}

export function Panel({ title, children, className, gold, flush, as: As = 'section', ...rest }: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  gold?: boolean;
  flush?: boolean;
  as?: 'section' | 'div' | 'article';
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={['panel', gold ? 'panel--gold' : '', flush ? 'panel--flush' : '', className ?? ''].join(' ')} {...rest}>
      {title && <h2 className="panel__title">{title}</h2>}
      {children}
    </As>
  );
}

export function Chip({ children, tone, icon, title }: { children: ReactNode; tone?: 'gold' | 'purple' | 'good' | 'bad' | 'bot'; icon?: IconName; title?: string }) {
  return (
    <span className={`chip ${tone ? `chip--${tone}` : ''}`} title={title}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export function BotBadge({ tier }: { tier?: string }) {
  const t = useT();
  return (
    <Chip tone="bot" icon="dice" title={t('common.bot')}>
      {t('common.bot')}
      {tier ? ` · ${tier}` : ''}
    </Chip>
  );
}

export function ProgressBar({ value, tone, label, height }: { value: number; tone?: 'gold' | 'purple' | 'good'; label?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`bar ${tone ? `bar--${tone}` : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
      style={{ ['--v' as string]: v, ...(height ? { height } : {}) }}
    >
      <div className="bar__fill" />
    </div>
  );
}

export function HealthBar({ hp, max, label }: { hp: number; max: number; label: string }) {
  const v = Math.max(0, Math.min(1, hp / max));
  const cls = v <= 0.25 ? 'hp--low' : v <= 0.55 ? 'hp--mid' : '';
  return (
    <div className={`hp ${cls}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} style={{ ['--v' as string]: v }}>
      <div className="hp__lag" />
      <div className="hp__fill" />
      <div className="hp__text num">
        {hp} / {max}
      </div>
    </div>
  );
}

/** Countdown ring driven by an absolute deadline (ms, local clock). */
export function TimerRing({ deadline, total, size = 58, paused }: { deadline: number; total: number; size?: number; paused?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, deadline]);
  const left = Math.max(0, deadline - now);
  const frac = total > 0 ? left / total : 0;
  const r = 24;
  const circ = 2 * Math.PI * r;
  const secs = Math.ceil(left / 1000);
  return (
    <div className={`timer ${frac < 0.3 ? 'timer--low' : ''}`} style={{ width: size, height: size }} role="timer" aria-label={`${secs}s`}>
      <svg viewBox="0 0 58 58">
        <circle className="timer__track" cx="29" cy="29" r={r} strokeWidth="6" fill="none" />
        <circle className="timer__arc" cx="29" cy="29" r={r} strokeWidth="6" fill="none" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} />
      </svg>
      <div className="timer__num num">{secs}</div>
    </div>
  );
}

export function Currency({ amount }: { amount: number }) {
  return (
    <span className="currency num" aria-label={`${amount} shards`}>
      <ShardIcon />
      {amount.toLocaleString()}
    </span>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function StateMessage({ icon = 'info', title, children, error, action }: { icon?: IconName; title: ReactNode; children?: ReactNode; error?: boolean; action?: ReactNode }) {
  return (
    <div className={`state ${error ? 'state--error' : ''}`} role={error ? 'alert' : 'status'}>
      <Icon name={icon} className="state__icon" />
      <div className="state__title">{title}</div>
      {children && <div>{children}</div>}
      {action}
    </div>
  );
}

export function Dialog({ open, title, onClose, children, actions, labelledBy }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, textarea, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const id = labelledBy ?? 'dialog-title';
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel dialog" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="dialog__head">
          <h2 className="dialog__title" id={id}>
            {title}
          </h2>
          <Button variant="ghost" size="sm" icon="x" aria-label={t('common.close')} onClick={onClose} />
        </div>
        {children}
        {actions && <div className="dialog__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', cursor: 'pointer' }}>
      <span className="stack" style={{ gap: 2 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        {description && <span className="small muted">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode; disabled?: boolean }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => {
            sfx.play('tick');
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Wrap English learning content so it always renders LTR inside the Hebrew UI. */
export function En({ children, as: As = 'span', className }: { children: ReactNode; as?: 'span' | 'p' | 'div' | 'h2' | 'h3'; className?: string }) {
  return (
    <As className={`en ${className ?? ''}`} dir="ltr" lang="en">
      {children}
    </As>
  );
}

export function He({ children, as: As = 'span', className }: { children: ReactNode; as?: 'span' | 'p' | 'div'; className?: string }) {
  return (
    <As className={`he ${className ?? ''}`} dir="rtl" lang="he">
      {children}
    </As>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat__value num">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Toasts
interface Toast {
  id: number;
  text: string;
  tone?: 'good' | 'bad';
}
const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; remove: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4200);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(text: string, tone?: 'good' | 'bad'): void {
  useToasts.getState().push(tone ? { text, tone } : { text });
}

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ? `toast--${t.tone}` : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
