/** English Conquest — strategy vs labelled bots. Knowledge funds the economy; strategy wins the war. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  answerQuestion,
  applyAction,
  BOT_PROFILES,
  BOT_TIERS,
  BRACKET_LEVELS,
  BRACKETS,
  bracketForLevel,
  botNextAction,
  CONQUEST,
  CONQUEST_FACTIONS,
  CONQUEST_MAP,
  createConquest,
  currentPlayer,
  endTurn,
  gradeAnswer,
  income,
  ownedBy,
  prepareRoundQuestion,
  previewAttack,
  type BotTier,
  type Bracket,
  type ConquestAction,
  type ConquestState,
  type ContentItem,
} from '@lingua/shared';
import { eventFromItem, recommendedLevel, selectItems } from '@lingua/learning';
import { wordBattlePool } from '@lingua/content';
import { Icon } from '../art/icons';
import { BotBadge, Button, Chip, Dialog, En, Panel, Segmented, toast } from '../design';
import { useT, useLang, type MessageKey } from '../i18n';
import { sfx } from '../audio/sfx';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { uid } from '../state/storage';
import { Explanation, Prompt } from '../games/shared/components';

const HUMAN = 'you';
const factionColor = (s: ConquestState, owner: string | null) =>
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

function ConquestMap({ s, selected, targets, onPick }: { s: ConquestState; selected: string | null; targets: Set<string>; onPick: (id: string) => void }) {
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

function QuestionDialog({ item, onDone }: { item: ContentItem; onDone: (correct: boolean) => void }) {
  const t = useT();
  const recordLearning = usePlayer((s) => s.recordLearning);
  const rq = useMemo(() => prepareRoundQuestion(item, uid('cq'), Math.random), [item]);
  const [picked, setPicked] = useState<string | null>(null);
  const [started] = useState(Date.now());
  const grade = picked ? gradeAnswer(rq, { kind: 'option', optionId: picked }) : null;
  const correctText = rq.question.options?.find((o) => rq.key.correctOptionIds?.includes(o.id))?.text ?? '';
  return (
    <Dialog open title={t('conquest.knowledge')} onClose={() => {}}>
      <div className="stack">
        <p className="small muted">{t('conquest.knowledgeHint', { gold: CONQUEST.correctGold })}</p>
        {rq.question.context && (
          <En as="div" className="q-context">
            {rq.question.context}
          </En>
        )}
        <Prompt text={rq.question.prompt} fill={grade ? correctText : null} correct={grade ? true : null} />
        <div className="answer-grid">
          {rq.question.options?.map((o, k) => {
            const isCorrect = !!grade && rq.key.correctOptionIds?.includes(o.id);
            const isWrong = !!grade && picked === o.id && !grade.correct;
            return (
              <button
                key={o.id}
                type="button"
                disabled={!!grade}
                className={`answer ${isCorrect ? 'answer--correct' : ''} ${isWrong ? 'answer--wrong' : ''}`}
                onClick={() => {
                  setPicked(o.id);
                  const g = gradeAnswer(rq, { kind: 'option', optionId: o.id });
                  sfx.play(g.correct ? 'correct' : 'wrong');
                  recordLearning([
                    eventFromItem(item, { id: uid('ev_'), playerId: '', mode: 'english-conquest', correct: g.correct, responseMs: Date.now() - started, timestamp: Date.now(), ...(g.errorCategory ? { errorCategory: g.errorCategory } : {}) }),
                  ]);
                }}
              >
                <span className="answer__key">{'ABCD'[k]}</span>
                <En className="answer__text">{o.text}</En>
              </button>
            );
          })}
        </div>
        {grade && (
          <>
            {!grade.correct && <Explanation exp={item.explanation} feedback={grade.feedback} compact />}
            <Button variant="primary" iconEnd="forward" onClick={() => onDone(grade.correct)} autoFocus>
              {t('common.continue')}
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function Game({ bots, tier, bracket }: { bots: number; tier: BotTier; bracket: Bracket }) {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const learner = usePlayer((s) => s.learner);
  const nickname = usePlayer((s) => s.nickname);
  const recordMatch = usePlayer((s) => s.recordMatch);
  const botNames = ['Quill', 'Cipher', 'Lumen'];
  const [s, setS] = useState<ConquestState>(() =>
    createConquest([{ id: HUMAN, name: nickname, isBot: false }, ...Array.from({ length: bots }, (_, i) => ({ id: `bot${i + 1}`, name: botNames[i]!, isBot: true, botTier: tier }))]),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [troops, setTroops] = useState(1);
  const [useFocus, setUseFocus] = useState(false);
  const recorded = useRef(false);
  const pool = useMemo(() => wordBattlePool(BRACKET_LEVELS[bracket]), [bracket]);
  const queue = useRef<ContentItem[]>([]);
  const nextItem = () => {
    if (queue.current.length === 0) queue.current = selectItems(pool, learner, { count: 12, now: Date.now(), random: Math.random, levels: BRACKET_LEVELS[bracket] });
    return queue.current.shift() ?? pool[0]!;
  };
  const [question, setQuestion] = useState<ContentItem | null>(null);
  const me = s.players.find((p) => p.id === HUMAN)!;
  const cur = currentPlayer(s);
  const myTurn = cur.id === HUMAN && s.phase !== 'ended';

  const act = (a: ConquestAction) => {
    const r = applyAction(s, a);
    if (!r.ok) {
      toast(r.error, 'bad');
      return;
    }
    if (a.type === 'attack') {
      const captured = r.state.territories[a.to]!.owner === cur.id;
      sfx.play(captured ? 'hit' : 'shield');
    } else if (a.type === 'recruit' || a.type === 'fortify') sfx.play('tile');
    setS(r.state);
    setTarget(null);
  };

  // Human question at the start of each turn.
  useEffect(() => {
    if (myTurn && s.phase === 'question' && !question) setQuestion(nextItem());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, s.phase, s.round]);

  // Bot turns play out step by step so the player can follow them.
  useEffect(() => {
    if (s.phase === 'ended' || cur.id === HUMAN) return;
    const id = setTimeout(() => {
      if (s.phase === 'question') {
        const acc = BOT_PROFILES[(cur.botTier as BotTier) ?? 'adept'].accuracy;
        setS(answerQuestion(s, Math.random() < acc));
        return;
      }
      const a = botNextAction(s, Math.random);
      const r = applyAction(s, a);
      if (r.ok) {
        if (a.type === 'attack') sfx.play(r.state.territories[a.to]!.owner === cur.id ? 'hit' : 'shield');
        setS(r.state);
      } else setS(endTurn(s));
    }, s.phase === 'question' ? 700 : 850);
    return () => clearTimeout(id);
  }, [s, cur]);

  useEffect(() => {
    if (s.phase !== 'ended' || recorded.current) return;
    recorded.current = true;
    const result = s.winnerId === HUMAN ? 'win' : s.winnerId === null ? 'draw' : 'loss';
    sfx.play(result === 'win' ? 'victory' : result === 'loss' ? 'defeat' : 'heal');
    recordMatch({
      mode: 'english-conquest',
      online: false,
      queue: 'bot',
      opponent: { nickname: s.players.filter((p) => p.isBot).map((p) => p.name).join(', '), isBot: true, botTier: tier, characterId: 'kael' },
      result,
      correct: me.correctAnswers,
      incorrect: me.questionsAnswered - me.correctAnswers,
      accuracy: me.questionsAnswered ? me.correctAnswers / me.questionsAnswered : 0,
      bestCombo: 0,
      xp: 40 + me.correctAnswers * 4 + (result === 'win' ? 40 : result === 'draw' ? 20 : 10),
      shards: 10 + (result === 'win' ? 15 : 5),
    });
  }, [s, me, recordMatch, tier]);

  const pick = (id: string) => {
    if (!myTurn || s.phase !== 'actions') return;
    const st = s.territories[id]!;
    if (st.owner === HUMAN && (selected === null || !CONQUEST_MAP.find((x) => x.id === selected)?.neighbors.includes(id) || id === selected)) {
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

  const targets = new Set(selected && myTurn ? CONQUEST_MAP.find((x) => x.id === selected)!.neighbors : []);
  const selState = selected ? s.territories[selected] : null;
  const tgtState = target ? s.territories[target] : null;
  const isAttack = !!tgtState && tgtState.owner !== HUMAN;
  const pv = selected && target && isAttack ? previewAttack(s, selected, target, troops, useFocus) : null;
  const nameOf = (id: string | null) => CONQUEST_MAP.find((x) => x.id === id)?.name ?? '';

  return (
    <div className="page conquest">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('mode.english-conquest')}</h1>
        <Chip tone="gold">{t('conquest.round', { n: s.round, total: CONQUEST.maxRounds })}</Chip>
      </div>
      <div className="conquest__layout">
        <div className="conquest__board">
          <ConquestMap s={s} selected={selected} targets={targets} onPick={pick} />
        </div>
        <aside className="stack">
          <Panel title={t('conquest.factions')}>
            <div className="stack">
              {s.players.map((p) => {
                const f = CONQUEST_FACTIONS.find((x) => x.id === p.faction)!;
                return (
                  <div key={p.id} className={`cq-player ${cur.id === p.id && s.phase !== 'ended' ? 'cq-player--turn' : ''} ${p.alive ? '' : 'cq-player--out'}`}>
                    <span className="cq-dot" style={{ background: f.color }} />
                    <span className="stack" style={{ gap: 0, flex: 1 }}>
                      <strong className="small">
                        {p.name} {p.isBot && <BotBadge tier={t(`bot.${p.botTier}` as MessageKey)} />}
                      </strong>
                      <span className="tiny muted">{lang === 'he' ? f.nameHe : f.name}</span>
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
          {myTurn && s.phase === 'actions' && (
            <Panel title={t('conquest.yourTurn')} gold>
              <div className="row small">
                <Chip tone="gold" icon="gem">
                  {me.gold}
                </Chip>
                <Chip tone="purple" icon="bolt">
                  {t('conquest.focus')} {me.focus}
                </Chip>
                <Chip>{t('conquest.actions', { n: s.actionsLeft })}</Chip>
                <Chip>+{income(s, HUMAN)}/{t('conquest.turn')}</Chip>
              </div>
              <p className="tiny muted" style={{ margin: '8px 0' }}>
                {selected ? t('conquest.selected', { name: nameOf(selected) }) : t('conquest.selectHint')}
              </p>
              <div className="row">
                <Button size="sm" icon="users" disabled={!selected || me.gold < CONQUEST.recruitCost || s.actionsLeft === 0} onClick={() => selected && act({ type: 'recruit', at: selected })}>
                  {t('conquest.recruit', { cost: CONQUEST.recruitCost })}
                </Button>
                <Button size="sm" icon="castle" disabled={!selected || !!selState?.fort || me.gold < CONQUEST.fortifyCost || s.actionsLeft === 0} onClick={() => selected && act({ type: 'fortify', at: selected })}>
                  {t('conquest.fortify', { cost: CONQUEST.fortifyCost })}
                </Button>
              </div>
              {selected && target && selState && tgtState && (
                <div className="cq-attack">
                  <strong className="small">
                    {isAttack ? t('conquest.attack') : t('conquest.move')}: {nameOf(selected)} → {nameOf(target)}
                  </strong>
                  <label className="field">
                    <span className="field__label">
                      {t('conquest.troops')}: {troops}
                    </span>
                    <input type="range" className="range" min={1} max={Math.max(1, selState.troops - 1)} value={troops} onChange={(e) => setTroops(Number(e.target.value))} disabled={selState.troops < 2} />
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
                    onClick={() => act(isAttack ? { type: 'attack', from: selected, to: target, troops, useFocus } : { type: 'move', from: selected, to: target, troops })}
                  >
                    {isAttack ? t('conquest.attack') : t('conquest.move')}
                  </Button>
                </div>
              )}
              <Button variant="primary" icon="forward" onClick={() => act({ type: 'end' })} style={{ marginTop: 10 }}>
                {t('conquest.endTurn')}
              </Button>
            </Panel>
          )}
          {!myTurn && s.phase !== 'ended' && (
            <Panel>
              <p className="small">{t('conquest.botTurn', { name: cur.name })}</p>
            </Panel>
          )}
          <Panel title={t('conquest.log')}>
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

      {question && myTurn && s.phase === 'question' && (
        <QuestionDialog
          key={question.id + s.round}
          item={question}
          onDone={(correct) => {
            setQuestion(null);
            setS(answerQuestion(s, correct));
          }}
        />
      )}
      {s.phase === 'ended' && (
        <Dialog open title={s.winnerId === HUMAN ? t('result.victory') : s.winnerId === null ? t('result.draw') : t('result.defeat')} onClose={back}>
          <div className="stack">
            <p>{s.winnerId === HUMAN ? t('result.winCheer') : s.winnerId === null ? t('result.drawCheer') : t('result.lossEncourage')}</p>
            <p className="small muted">
              {t('conquest.endReason.' + (s.endReason ?? 'rounds') as MessageKey)} · {t('result.correct')}: {me.correctAnswers}/{me.questionsAnswered}
            </p>
            <Button variant="primary" onClick={back}>
              {t('result.lobby')}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function ConquestScreen() {
  const t = useT();
  const back = useNav((s) => s.back);
  const learner = usePlayer((s) => s.learner);
  const [bots, setBots] = useState<'1' | '2' | '3'>('2');
  const [tier, setTier] = useState<BotTier>('adept');
  const [bracket, setBracket] = useState<Bracket>(bracketForLevel(recommendedLevel(learner)));
  const [started, setStarted] = useState(false);
  if (started) return <Game bots={Number(bots)} tier={tier} bracket={bracket} />;
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('mode.english-conquest')}</h1>
      </div>
      <Panel gold className="stack">
        <p>{t('conquest.intro')}</p>
        <ul className="plain-list small">
          <li>• {t('conquest.rule1', { gold: CONQUEST.correctGold })}</li>
          <li>• {t('conquest.rule2')}</li>
          <li>• {t('conquest.rules', { n: CONQUEST.victoryTerritories, r: CONQUEST.maxRounds })}</li>
        </ul>
        <span className="field__label">{t('conquest.opponents')}</span>
        <Segmented label={t('conquest.opponents')} value={bots} onChange={setBots} options={(['1', '2', '3'] as const).map((n) => ({ value: n, label: n }))} />
        <span className="field__label">{t('play.botLevel')}</span>
        <Segmented label={t('play.botLevel')} value={tier} onChange={setTier} options={BOT_TIERS.map((b) => ({ value: b, label: t(`bot.${b}` as MessageKey) }))} />
        <span className="field__label">{t('play.bracket')}</span>
        <Segmented label={t('play.bracket')} value={bracket} onChange={setBracket} options={BRACKETS.map((b) => ({ value: b, label: t(`play.bracket.${b}` as MessageKey) }))} />
        <Button variant="primary" size="lg" icon="castle" onClick={() => setStarted(true)} data-testid="start-conquest">
          {t('common.start')}
        </Button>
        <p className="tiny muted">{t('conquest.onlineNote')}</p>
      </Panel>
    </div>
  );
}
