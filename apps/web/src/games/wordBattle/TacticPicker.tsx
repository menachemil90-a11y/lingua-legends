/** Word Battle tactic choice: four openly shown styles, balanced by simulation (see rules/wordBattle.ts). */
import { TACTIC_IDS, type TacticId } from '@lingua/shared';
import { Icon, type IconName } from '../../art/icons';
import { useT, type MessageKey } from '../../i18n';

const ICON: Record<TacticId, IconName> = { balanced: 'sword', guardian: 'shield', striker: 'bolt', scholar: 'brain' };

export function TacticPicker({ value, onChange, compact }: { value: TacticId; onChange: (t: TacticId) => void; compact?: boolean }) {
  const t = useT();
  return (
    <div className={`tactics ${compact ? 'tactics--compact' : ''}`} role="radiogroup" aria-label={t('tactic.title')}>
      {TACTIC_IDS.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={`tactic ${value === id ? 'tactic--on' : ''}`} onClick={() => onChange(id)} data-testid={`tactic-${id}`}>
          <Icon name={ICON[id]} />
          <strong className="small">{t(`tactic.${id}` as MessageKey)}</strong>
          {!compact && <span className="tiny muted">{t(`tactic.${id}.desc` as MessageKey)}</span>}
        </button>
      ))}
    </div>
  );
}

export function TacticChip({ tactic }: { tactic?: TacticId | undefined }) {
  const t = useT();
  if (!tactic) return null;
  return (
    <span className="chip chip--tactic" title={t(`tactic.${tactic}.desc` as MessageKey)}>
      <Icon name={ICON[tactic]} /> {t(`tactic.${tactic}` as MessageKey)}
    </span>
  );
}
