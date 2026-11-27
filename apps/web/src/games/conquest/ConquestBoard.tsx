/** Shared English Conquest board: map, factions, the active player's action panel and the log. */
import { useState, type ReactNode } from 'react';
import { CONQUEST, CONQUEST_FACTIONS, CONQUEST_MAP, currentPlayer, income, ownedBy, previewAttack, type ConquestAction, type ConquestState } from '@lingua/shared';
import { Icon } from '../../art/icons';
import { BotBadge, Button, Chip, En, Panel } from '../../design';
import { useT, useLang, type MessageKey } from '../../i18n';

export const factionColor = (s: ConquestState, owner: string | null) =>
  owner ? (CONQUEST_FACTIONS.find((f) => f.id === s.players.find((p) => p.id === owner)?.faction)?.color ?? '#888') : '#56627d';

/** Deterministic island outline around a centre point. */
function islandPath(id: string, x: number, y: number): string {
  let seed = [...id].reduce((a, c) => a + c.charCodeAt(0) * 31, 7);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pts = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r = 62 + rnd() * 18;
    return [x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 0.78] as const;
  });
  return pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ') + ' Z';
}

export function ConquestMap({ s, selected, targets, onPick }: { s: ConquestState; selected: string | null; targets: Set<string>; onPick: (id: string) => void }) {
  const drawn = new Set<string>();
  return (
    <svg viewBox="0 0 1000 620" className="conquest-map" role="group" aria-label="Map">
      <defs>
        <radialGradient id="cq-sea" cx="50%" cy="45%" r="75%">
          <stop offset="0" stopColor="#123a7a" />
          <stop offset="1" stopColor="#050b24" />
        </radialGradient>
        <filter id="cq-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000" floodOpacity=".5" />
        </filter>
      </defs>
      <rect width="1000" height="620" fill="url(#cq-sea)" />
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M${(i * 97) % 1000} ${40 + ((i * 131) % 560)} q20 -8 40 0 t40 0`} stroke="#7ff3ff" strokeOpacity=".12" strokeWidth="2" fill="none" />
      ))}
      {CONQUEST_MAP.flatMap((t) =>
        t.neighbors.map((n) => {
          const key = [t.id, n].sort().join('-');
          if (drawn.has(key)) return null;
          drawn.add(key);
          const o = CONQUEST_MAP.find((x) => x.id === n)!;
          return <line key={key} x1={t.x} y1={t.y} x2={o.x} y2={o.y} stroke="#f5c451" strokeOpacity=".45" strokeWidth="4" strokeDasharray="10 8" />;
        }),
      )}
      {CONQUEST_MAP.map((t) => {
        const st = s.territories[t.id]!;
        const col = factionColor(s, st.owner);
        const isSel = selected === t.id;
        const isTarget = targets.has(t.id);
        const isCapital = s.players.some((p) => p.capital === t.id && p.alive && st.owner === p.id);
        return (
          <g key={t.id} className={`cq-terr ${isTarget ? 'cq-terr--target' : ''}`} onClick={() => onPick(t.id)} role="button" aria-label={`${t.name}: ${st.troops}`} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(t.id)}>
            <path d={islandPath(t.id, t.x, t.y + 10)} fill="#04102a" opacity=".6" />
            <path d={islandPath(t.id, t.x, t.y)} fill={col} fillOpacity={st.owner ? 0.55 : 0.35} stroke={isSel ? '#ffffff' : isTarget ? '#ffe7a3' : col} strokeWidth={isSel ? 6 : isTarget ? 5 : 3} filter="url(#cq-shadow)" />
            <path d={islandPath(t.id, t.x - 6, t.y - 8)} fill="#ffffff" fillOpacity=".08" />
            <text x={t.x} y={t.y - 30} textAnchor="middle" className="cq-name">
              {t.name}
            </text>
            <circle cx={t.x} cy={t.y + 6} r="24" fill="#04091a" stroke={col} strokeWidth="3" />
            <text x={t.x} y={t.y + 14} textAnchor="middle" className="cq-troops">
              {st.troops}
            </text>
            {st.fort && <path d={`M${t.x + 26} ${t.y - 4} h18 v-14 h-4 v5 h-3 v-5 h-4 v5 h-3 v-5 h-4 z`} fill="#c8d3ea" stroke="#04091a" strokeWidth="1.5" />}
            {isCapital && <path d={`M${t.x - 46} ${t.y - 2} l5 -12 6 7 5 -10 5 10 6 -7 5 12 z`} fill="#f5c451" stroke="#6c4508" strokeWidth="1.5" />}
            <text x={t.x} y={t.y + 46} textAnchor="middle" className="cq-yield">
              +{t.yield}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


export function ConquestBoard({
  s,
  selfId,
  myTurn,
  onAction,
  waiting,
  turnExtra,
  disconnected,
}: {
  s: ConquestState;
  selfId: string;
  /** True when the local player may act now. */
  myTurn: boolean;
  onAction: (a: ConquestAction) => void;
  /** Shown while another player is taking their turn. */
  waiting?: ReactNode;
  /** Extra content in the player's own turn panel (e.g. a timer). */
  turnExtra?: ReactNode;
  /** Players currently disconnected (online only). */
  disconnected?: ReadonlySet<string>;
}) {
  const t = useT();
  const lang = useLang();
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [troops, setTroops] = useState(1);
  const [useFocus, setUseFocus] = useState(false);
  const me = s.players.find((p) => p.id === selfId);
  const cur = currentPlayer(s);
  const canAct = myTurn && s.phase === 'actions' && !!me;

  const act = (a: ConquestAction) => {
    onAction(a);
    setTarget(null);
    if (a.type === 'end') setSelected(null);
  };

  const pick = (id: string) => {
    if (!canAct) return;
    const st = s.territories[id]!;
    if (st.owner === selfId && (selected === null || !CONQUEST_MAP.find((x) => x.id === selected)?.neighbors.includes(id) || id === selected)) {
      setSelected(id === selected ? null : id);
      setTarget(null);
      return;
    }
    if (selected && CONQUEST_MAP.find((x) => x.id === selected)!.neighbors.includes(id)) {
      setTarget(id);
      setTroops(Math.max(1, s.territories[selected]!.troops - 1));
      setUseFocus(false);
    }
  };

  // A selection that is no longer ours (captured meanwhile) is dropped.
  const sel = selected && s.territories[selected]?.owner === selfId ? selected : null;
  const targets = new Set(sel && canAct ? CONQUEST_MAP.find((x) => x.id === sel)!.neighbors : []);
  const selState = sel ? s.territories[sel] : null;
  const tgtState = sel && target ? s.territories[target] : null;
  const isAttack = !!tgtState && tgtState.owner !== selfId;
  const maxTroops = Math.max(1, (selState?.troops ?? 2) - 1);
  const k = Math.min(troops, maxTroops);
  const pv = sel && target && isAttack ? previewAttack(s, sel, target, k, useFocus) : null;
  const nameOf = (id: string | null) => CONQUEST_MAP.find((x) => x.id === id)?.name ?? '';

  return (
    <div className="conquest__layout">
      <div className="conquest__board">
        <ConquestMap s={s} selected={sel} targets={targets} onPick={pick} />
      </div>
      <aside className="stack">
        <Panel title={t('conquest.factions')}>
          <div className="stack">
            {s.players.map((p) => {
              const f = CONQUEST_FACTIONS.find((x) => x.id === p.faction)!;
              const away = disconnected?.has(p.id) && p.alive;
              return (
                <div key={p.id} className={`cq-player ${cur.id === p.id && s.phase !== 'ended' ? 'cq-player--turn' : ''} ${p.alive ? '' : 'cq-player--out'}`}>
                  <span className="cq-dot" style={{ background: f.color }} />
                  <span className="stack" style={{ gap: 0, flex: 1 }}>
                    <strong className="small">
                      {p.name} {p.isBot && <BotBadge tier={t(`bot.${p.botTier}` as MessageKey)} />}
                      {p.id === selfId && <span className="tiny muted"> ({t('conquest.you')})</span>}
                    </strong>
                    <span className="tiny muted">
                      {lang === 'he' ? f.nameHe : f.name}
                      {away ? ` · ${t('conquest.away')}` : ''}
                    </span>
                  </span>
                  <span className="tiny num cq-stats">
                    <Icon name="castle" /> {ownedBy(s, p.id).length}
                    <Icon name="gem" /> {p.gold}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
        {canAct && me && (
          <Panel title={t('conquest.yourTurn')} gold>
            <div className="row small">
              <Chip tone="gold" icon="gem">
                {me.gold}
              </Chip>
              <Chip tone="purple" icon="bolt">
                {t('conquest.focus')} {me.focus}
              </Chip>
              <Chip>{t('conquest.actions', { n: s.actionsLeft })}</Chip>
              <Chip>+{income(s, selfId)}/{t('conquest.turn')}</Chip>
              {turnExtra}
            </div>
            <p className="tiny muted" style={{ margin: '8px 0' }}>
              {sel ? t('conquest.selected', { name: nameOf(sel) }) : t('conquest.selectHint')}
            </p>
            <div className="row">
              <Button size="sm" icon="users" disabled={!sel || me.gold < CONQUEST.recruitCost || s.actionsLeft === 0} onClick={() => sel && act({ type: 'recruit', at: sel })}>
                {t('conquest.recruit', { cost: CONQUEST.recruitCost })}
              </Button>
              <Button size="sm" icon="castle" disabled={!sel || !!selState?.fort || me.gold < CONQUEST.fortifyCost || s.actionsLeft === 0} onClick={() => sel && act({ type: 'fortify', at: sel })}>
                {t('conquest.fortify', { cost: CONQUEST.fortifyCost })}
              </Button>
            </div>
            {sel && target && selState && tgtState && (
              <div className="cq-attack">
                <strong className="small">
                  {isAttack ? t('conquest.attack') : t('conquest.move')}: {nameOf(sel)} → {nameOf(target)}
                </strong>
                <label className="field">
                  <span className="field__label">
                    {t('conquest.troops')}: {k}
                  </span>
                  <input type="range" className="range" min={1} max={maxTroops} value={k} onChange={(e) => setTroops(Number(e.target.value))} disabled={selState.troops < 2} />
                </label>
                {isAttack && (
                  <label className="check-row small">
                    <input type="checkbox" checked={useFocus} disabled={me.focus === 0} onChange={(e) => setUseFocus(e.target.checked)} />
                    <span>{t('conquest.useFocus', { n: CONQUEST.focusPower })}</span>
                  </label>
                )}
                {pv && (
                  <p className={`small ${pv.success ? 'text-good' : 'text-bad'}`}>
                    <Icon name={pv.success ? 'check' : 'x'} style={{ width: 16, height: 16, verticalAlign: 'middle' }} />{' '}
                    <bdi dir="ltr" className="num">
                      {pv.attackPower} vs {pv.defensePower}
                    </bdi>{' '}
                    — {pv.success ? t('conquest.willCapture', { n: pv.occupy }) : t('conquest.willFail', { n: pv.losses })}
                  </p>
                )}
                <Button
                  size="sm"
                  variant={isAttack ? 'danger' : 'secondary'}
                  icon={isAttack ? 'sword' : 'forward'}
                  disabled={selState.troops < 2 || s.actionsLeft === 0}
                  onClick={() => act(isAttack ? { type: 'attack', from: sel, to: target, troops: k, useFocus } : { type: 'move', from: sel, to: target, troops: k })}
                >
                  {isAttack ? t('conquest.attack') : t('conquest.move')}
                </Button>
              </div>
            )}
            <Button variant="primary" icon="forward" onClick={() => act({ type: 'end' })} style={{ marginTop: 10 }} data-testid="cq-end-turn">
              {t('conquest.endTurn')}
            </Button>
          </Panel>
        )}
        {!canAct && s.phase !== 'ended' && waiting && <Panel>{waiting}</Panel>}
        <Panel title={t('conquest.log')}>
          {!s.log.some((l) => l.kind !== 'income') && <p className="tiny muted">{t('conquest.logEmpty')}</p>}
          <ul className="plain-list tiny cq-log">
            {s.log
              .filter((l) => l.kind !== 'income')
              .slice(-7)
              .reverse()
              .map((l, i) => {
                const p = s.players.find((x) => x.id === l.playerId);
                return (
                  <li key={i}>
                    <span className="cq-dot" style={{ background: factionColor(s, p?.id ?? null) }} /> <strong>{p?.name}</strong> <En>{l.text}</En>
                  </li>
                );
              })}
          </ul>
        </Panel>
        <p className="tiny muted">{t('conquest.rules', { n: CONQUEST.victoryTerritories, r: CONQUEST.maxRounds })}</p>
      </aside>
    </div>
  );
}
