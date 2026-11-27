/** Adventure map, Real Life conversations, English Detective and roadmap info for planned modes. */
import { useState } from 'react';
import { BRACKET_LEVELS, bracketForLevel, modeDef, type GameModeId } from '@lingua/shared';
import { ADVENTURE_REGIONS, DETECTIVE_CASES, REAL_LIFE_SCENARIOS, type DialogueChoice } from '@lingua/content';
import { Hero } from '../art/Art';
import { Icon } from '../art/icons';
import { Button, Chip, En, Panel, StateMessage } from '../design';
import { useT, useLang, type MessageKey } from '../i18n';
import { sfx } from '../audio/sfx';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { Explanation } from '../games/shared/components';

export function Adventure() {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const stars = usePlayer((s) => s.adventure);
  const character = usePlayer((s) => s.loadout.characterId);
  const [regionId, setRegionId] = useState(ADVENTURE_REGIONS[0]!.id);
  const allChapters = ADVENTURE_REGIONS.flatMap((r) => r.chapters);
  const unlocked = (chapterId: string) => {
    const idx = allChapters.findIndex((c) => c.id === chapterId);
    return idx === 0 || (stars[allChapters[idx - 1]!.id] ?? 0) > 0;
  };
  const region = ADVENTURE_REGIONS.find((r) => r.id === regionId)!;
  const current = allChapters.find((c) => unlocked(c.id) && !(stars[c.id] ?? 0));
  const currentRegion = ADVENTURE_REGIONS.find((r) => r.chapters.some((c) => c.id === current?.id)) ?? ADVENTURE_REGIONS[0]!;

  const playChapter = (chapterId: string) => {
    const c = allChapters.find((x) => x.id === chapterId)!;
    if (c.mode === 'reading' && c.passageId) {
      go({ id: 'reading', passageId: c.passageId, chapterId: c.id });
      return;
    }
    const levels = c.levels.length ? c.levels : [...BRACKET_LEVELS[bracketForLevel('A2')]];
    go({ id: 'match', params: { kind: 'local', mode: c.mode as 'word-battle', levels, botTier: c.boss ? 'veteran' : 'adept', chapterId: c.id, ...(c.setId ? { setId: c.setId } : {}) } });
  };

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('adventure.title')}</h1>
      </div>
      <p className="small muted">{t('adventure.intro')}</p>
      <div className="worldmap" role="group" aria-label={t('adventure.title')}>
        <svg className="worldmap__paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={ADVENTURE_REGIONS.map((r) => `${r.x},${r.y}`).join(' ')} fill="none" stroke="rgba(245,196,81,.6)" strokeWidth="0.8" strokeDasharray="2 1.5" />
        </svg>
        {ADVENTURE_REGIONS.map((r) => {
          const earned = r.chapters.reduce((a, c) => a + (stars[c.id] ?? 0), 0);
          const open = unlocked(r.chapters[0]!.id);
          return (
            <button
              key={r.id}
              type="button"
              className={`region ${regionId === r.id ? 'region--on' : ''} ${open ? '' : 'region--locked'}`}
              style={{ insetInlineStart: `${r.x}%`, top: `${r.y}%`, ['--rc' as string]: r.color }}
              onClick={() => setRegionId(r.id)}
            >
              <span className="region__orb">
                <Icon name={open ? 'castle' : 'lock'} />
              </span>
              <span className="region__name">{lang === 'he' ? r.nameHe : r.name}</span>
              <span className="region__stars num">
                ★ {earned}/{r.chapters.length * 3}
              </span>
            </button>
          );
        })}
        <div className="worldmap__hero" style={{ insetInlineStart: `${currentRegion.x}%`, top: `${currentRegion.y}%` }} aria-hidden="true">
          <Hero id={character} animated />
        </div>
      </div>
      <Panel title={`${lang === 'he' ? region.nameHe : region.name} · ${lang === 'he' ? region.skillHe : region.skill}`}>
        <div className="chapters">
          {region.chapters.map((c, i) => {
            const open = unlocked(c.id);
            const s = stars[c.id] ?? 0;
            return (
              <div key={c.id} className={`chapter ${c.boss ? 'chapter--boss' : ''} ${open ? '' : 'chapter--locked'}`}>
                <span className="chapter__num">{c.boss ? <Icon name="crown" /> : i + 1}</span>
                <div className="stack" style={{ gap: 2, flex: 1 }}>
                  <strong>{lang === 'he' ? c.titleHe : c.title}</strong>
                  <span className="tiny muted">
                    {t(`mode.${c.mode === 'reading' ? 'english-detective' : c.mode}` as MessageKey)} · {c.levels.join('–')}
                  </span>
                </div>
                <span className="chapter__stars" aria-label={t('adventure.stars', { n: s })}>
                  {[0, 1, 2].map((k) => (
                    <Icon key={k} name="star" filled style={{ color: k < s ? 'var(--c-gold)' : 'var(--c-text-mute)', fillOpacity: k < s ? 1 : 0.1 }} />
                  ))}
                </span>
                {open ? (
                  <Button size="sm" variant={c.boss ? 'arcane' : 'primary'} icon="play" onClick={() => playChapter(c.id)}>
                    {t('adventure.play')}
                  </Button>
                ) : (
                  <Chip icon="lock">{t('adventure.locked')}</Chip>
                )}
              </div>
            );
          })}
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          {t('adventure.practiceAnyway')}
        </p>
      </Panel>
    </div>
  );
}

export function RealLife({ scenarioId }: { scenarioId?: string }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const lang = useLang();
  const scenario = REAL_LIFE_SCENARIOS.find((s) => s.id === scenarioId);
  const [nodeId, setNodeId] = useState(scenario?.start ?? '');
  const [log, setLog] = useState<{ line: string; choice: DialogueChoice }[]>([]);
  if (!scenario) {
    return (
      <div className="page">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
          <h1 className="page__title">{t('realLife.title')}</h1>
          <Chip tone="purple">{t('common.preview')}</Chip>
        </div>
        <p className="small muted">{t('realLife.speechNote')}</p>
        <div className="grid-auto">
          {REAL_LIFE_SCENARIOS.map((s) => (
            <button key={s.id} type="button" className="tile" onClick={() => go({ id: 'real-life', scenarioId: s.id })}>
              <Chip tone="purple">{s.level}</Chip>
              <span className="tile__title" style={{ maxWidth: '100%' }}>
                {lang === 'he' ? s.titleHe : s.title}
              </span>
              <span className="tile__sub">
                <En>{s.setting}</En>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const node = scenario.nodes.find((n) => n.id === nodeId)!;
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{lang === 'he' ? scenario.titleHe : scenario.title}</h1>
      </div>
      <Panel className="convo">
        <div className="convo__log">
          {log.map((l, i) => (
            <div key={i} className="stack">
              <div className="bubble-npc en">{l.line}</div>
              <div className={`bubble-me en q-${l.choice.quality}`}>{l.choice.text}</div>
              <div className={`chip ${l.choice.quality === 'best' ? 'chip--good' : l.choice.quality === 'ok' ? 'chip--gold' : 'chip--bad'}`} style={{ justifySelf: 'end' }}>
                {t(`realLife.${l.choice.quality}` as MessageKey)}: {lang === 'he' ? l.choice.feedback.he : l.choice.feedback.en}
              </div>
            </div>
          ))}
          <div className="bubble-npc en">
            <strong className="tiny">
              {scenario.character.name} · {scenario.character.role}
            </strong>
            <br />
            {node.line}
          </div>
        </div>
        {node.choices ? (
          <div className="answer-grid">
            {node.choices.map((c) => (
              <button
                key={c.text}
                type="button"
                className="answer"
                onClick={() => {
                  sfx.play(c.quality === 'poor' ? 'wrong' : 'correct');
                  setLog([...log, { line: node.line, choice: c }]);
                  setNodeId(c.next);
                }}
              >
                <En className="answer__text">{c.text}</En>
              </button>
            ))}
          </div>
        ) : (
          <div className="stack">
            <strong>{t('realLife.summary')}</strong>
            <p>{lang === 'he' ? node.end?.he : node.end?.en}</p>
            <p className="num">
              {log.filter((l) => l.choice.quality === 'best').length}/{log.length} {t('realLife.best')}
            </p>
            <div className="row">
              <Button
                variant="primary"
                icon="refresh"
                onClick={() => {
                  setLog([]);
                  setNodeId(scenario.start);
                }}
              >
                {t('common.retry')}
              </Button>
              <Button onClick={back}>{t('common.back')}</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function Detective({ caseId }: { caseId?: string }) {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const c = DETECTIVE_CASES.find((x) => x.id === caseId);
  if (!c) {
    return (
      <div className="page">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
          <h1 className="page__title">{t('detective.title')}</h1>
          <Chip tone="purple">{t('common.preview')}</Chip>
        </div>
        <div className="grid-auto">
          {DETECTIVE_CASES.map((d) => (
            <button key={d.id} type="button" className="tile" onClick={() => go({ id: 'detective', caseId: d.id })}>
              <span className="row">
                <Chip tone="purple">{d.level}</Chip>
                <Chip icon="search">{d.evidence.length}</Chip>
              </span>
              <span className="tile__title" style={{ maxWidth: '100%' }}>
                {lang === 'he' ? d.titleHe : d.title}
              </span>
              <span className="tile__sub" style={{ maxWidth: '100%' }}>
                {lang === 'he' ? d.briefingHe : d.briefing}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return <DetectiveCaseView key={c.id} c={c} />;
}

function DetectiveCaseView({ c }: { c: (typeof DETECTIVE_CASES)[number] }) {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [accused, setAccused] = useState<string | null>(null);
  const q = c.questions[qi];
  const finished = qi >= c.questions.length;
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{lang === 'he' ? c.titleHe : c.title}</h1>
        <Chip tone="purple">{t('common.preview')}</Chip>
        <Chip>{c.level}</Chip>
      </div>
      <p>{lang === 'he' ? c.briefingHe : c.briefing}</p>
      <div className="reading">
        <Panel title={t('detective.evidence')} className="evidence-board">
          {c.evidence.map((e) => (
            <article key={e.id} className={`evidence evidence--${e.kind} ${q?.evidenceIds.includes(e.id) ? 'evidence--hl' : ''}`}>
              <En as="div" className="evidence__title">
                {e.title}
              </En>
              {e.from && <En className="tiny muted">{e.from}</En>}
              <En as="p">{e.body}</En>
            </article>
          ))}
        </Panel>
        <Panel title={t('detective.questions')}>
          {!finished && q && (
            <div className="stack">
              <En as="p" className="q-prompt">
                {q.prompt}
              </En>
              <div className="answer-grid">
                {q.options.map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    disabled={picked !== null}
                    className={`answer ${picked !== null && i === q.answer ? 'answer--correct' : ''} ${picked === i && i !== q.answer ? 'answer--wrong' : ''}`}
                    onClick={() => {
                      setPicked(i);
                      sfx.play(i === q.answer ? 'correct' : 'wrong');
                    }}
                  >
                    <En className="answer__text">{o}</En>
                  </button>
                ))}
              </div>
              {picked !== null && (
                <>
                  <Explanation exp={q.explanation} />
                  <Button
                    variant="primary"
                    iconEnd="forward"
                    onClick={() => {
                      setPicked(null);
                      setQi(qi + 1);
                    }}
                  >
                    {t('common.next')}
                  </Button>
                </>
              )}
            </div>
          )}
          {finished && (
            <div className="stack">
              <strong>{t('detective.accuse')}</strong>
              <div className="row">
                {c.suspects.map((s) => (
                  <Button
                    key={s.id}
                    variant={accused === s.id ? (s.id === c.culpritId ? 'secondary' : 'danger') : 'default'}
                    onClick={() => {
                      setAccused(s.id);
                      sfx.play(s.id === c.culpritId ? 'victory' : 'wrong');
                    }}
                  >
                    <En>
                      {s.name} — {s.role}
                    </En>
                  </Button>
                ))}
              </div>
              {accused && accused === c.culpritId && (
                <div className="feedback feedback--good">
                  <div className="feedback__head">
                    <Icon name="trophy" /> <strong>{t('detective.solved')}</strong>
                  </div>
                  <Explanation exp={c.solution} />
                </div>
              )}
              {accused && accused !== c.culpritId && <p className="small">{t('detective.wrong')}</p>}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ModeInfo({ mode }: { mode: GameModeId }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const def = modeDef(mode);
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t(`mode.${mode}` as MessageKey)}</h1>
        <Chip tone={def.status === 'preview' ? 'purple' : undefined}>{t(`mode.status.${def.status}`)}</Chip>
      </div>
      <Panel gold>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Hero id="nyra" className="modeinfo__hero" />
          <div className="stack" style={{ flex: 1, minWidth: 220 }}>
            <p>{t(`mode.${mode}.desc` as MessageKey)}</p>
            <Chip>{t('mode.roadmapPhase', { n: def.phase })}</Chip>
            <Chip>{def.players}</Chip>
            <StateMessage icon="hourglass" title={t('common.comingSoon')}>
              {t('mode.status.planned')}
            </StateMessage>
          </div>
        </div>
      </Panel>
    </div>
  );
}
