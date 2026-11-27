/** Debate Arena — private practice: opening, prepared opposition, rebuttal, closing. Transparent checklist only, never a grade. */
import { useMemo, useState } from 'react';
import { DEBATE_TOPICS, type DebateTopic } from '@lingua/content';
import { checkWriting, debateChecklist, type WritingReport } from '@lingua/learning';
import { Icon } from '../art/icons';
import { Button, Chip, En, He, Panel, ProgressBar, Segmented, toast } from '../design';
import { useT, useLang, type MessageKey } from '../i18n';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { sfx } from '../audio/sfx';

const STEPS = ['opening', 'rebuttal', 'closing', 'review'] as const;
type Step = (typeof STEPS)[number];
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function Report({ report }: { report: WritingReport }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="stack">
      <div className="row small">
        <Chip>{t('bagrut.words', { n: report.words })}</Chip>
        <Chip>{t('debate.sentences', { n: report.sentences })}</Chip>
        <Chip>{t('debate.avgLength', { n: report.avgSentenceLength })}</Chip>
      </div>
      <ul className="plain-list findings">
        {report.findings.map((f) => (
          <li key={f.id} className={`finding finding--${f.kind}`}>
            <Icon name={f.kind === 'good' ? 'check' : f.kind === 'error' ? 'x' : 'info'} />
            <span>
              {lang === 'he' ? <He>{f.he}</He> : f.en}
              {f.matches && f.matches.length > 0 && (
                <span className="tiny muted">
                  {' '}
                  (<En>{f.matches.join(', ')}</En>)
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Workspace({ topic }: { topic: DebateTopic }) {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const notes = usePlayer((s) => s.bagrut.notes);
  const saveBagrut = usePlayer((s) => s.saveBagrut);
  const recordMatch = usePlayer((s) => s.recordMatch);
  const recordDebate = usePlayer((s) => s.recordDebate);
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [step, setStep] = useState<Step>('opening');
  const key = (part: string) => `debate:${topic.id}:${side}:${part}`;
  const [opening, setOpening] = useState(notes[key('opening')] ?? '');
  const [rebuttal, setRebuttal] = useState(notes[key('rebuttal')] ?? '');
  const [closing, setClosing] = useState(notes[key('closing')] ?? '');
  const persist = () =>
    saveBagrut({ notes: { ...usePlayer.getState().bagrut.notes, [key('opening')]: opening, [key('rebuttal')]: rebuttal, [key('closing')]: closing } });
  const openingReport = useMemo(() => checkWriting(opening, { minWords: topic.openingWords[0], maxWords: topic.openingWords[1] }), [opening, topic]);
  const rebuttalReport = useMemo(() => checkWriting(rebuttal, { minWords: topic.rebuttalWords[0], maxWords: topic.rebuttalWords[1], expectConcession: true }), [rebuttal, topic]);
  const closingReport = useMemo(() => checkWriting(closing, { minWords: topic.closingWords[0], maxWords: topic.closingWords[1], expectSummary: true }), [closing, topic]);
  const checklist = useMemo(() => debateChecklist({ opening: openingReport, rebuttal: rebuttalReport, closing: closingReport }), [openingReport, rebuttalReport, closingReport]);
  const stepIndex = STEPS.indexOf(step);
  const advance = (to: Step) => {
    persist();
    setStep(to);
    sfx.play('whoosh');
  };
  const finish = () => {
    persist();
    setStep('review');
    sfx.play('correct');
    const met = checklist.filter((c) => c.met).length;
    recordDebate({ topicId: topic.id, side, met, total: checklist.length });
    // Practice is rewarded for completing it, never for the opinion or a "score".
    recordMatch({ mode: 'debate-arena', online: false, queue: 'solo', opponent: null, result: 'complete', correct: 0, incorrect: 0, accuracy: 0, bestCombo: 0, xp: 60, shards: 15 });
  };

  const editor = (part: 'opening' | 'rebuttal' | 'closing', value: string, set: (v: string) => void, range: [number, number], hint: MessageKey) => (
    <div className="stack">
      <strong>{t(`debate.${part}` as MessageKey)}</strong>
      <p className="small muted">{t(hint)}</p>
      <textarea className="input en" dir="ltr" lang="en" value={value} onChange={(e) => set(e.target.value)} onBlur={persist} disabled={step !== part} aria-label={t(`debate.${part}` as MessageKey)} spellCheck data-testid={`debate-${part}`} />
      <ProgressBar value={Math.min(1, words(value) / range[0])} tone="good" label={t('bagrut.words', { n: words(value) })} />
      <span className="tiny muted">{t('bagrut.wordTarget', { min: range[0], max: range[1] })}</span>
    </div>
  );

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('mode.debate-arena')}</h1>
        <Chip tone="purple">{topic.level}</Chip>
      </div>
      <Panel gold>
        <En as="h2" className="display debate-motion">
          {topic.motion}
        </En>
        {lang === 'he' && <He as="p" className="small muted">{topic.motionHe}</He>}
        <div className="row" style={{ marginTop: 10 }}>
          <span className="field__label">{t('debate.side')}</span>
          <Segmented label={t('debate.side')} value={side} onChange={(v) => step === 'opening' && setSide(v)} options={[{ value: 'for', label: t('debate.for') }, { value: 'against', label: t('debate.against') }]} />
        </div>
        <ol className="debate-steps" aria-label={t('debate.progress')}>
          {STEPS.map((s, i) => (
            <li key={s} className={`debate-step ${i < stepIndex ? 'debate-step--done' : i === stepIndex ? 'debate-step--now' : ''}`}>
              <Icon name={i < stepIndex ? 'check' : i === stepIndex ? 'pen' : 'lock'} />
              <span>{t(`debate.step.${s}` as MessageKey)}</span>
            </li>
          ))}
        </ol>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {t('debate.neutral')}
        </p>
      </Panel>

      <div className="reading">
        <Panel className="stack">
          {editor('opening', opening, setOpening, topic.openingWords, 'debate.openingHint')}
          {step === 'opening' && (
            <Button variant="primary" iconEnd="forward" disabled={words(opening) < Math.round(topic.openingWords[0] * 0.6)} onClick={() => advance('rebuttal')} data-testid="debate-next">
              {t('debate.showOpposition')}
            </Button>
          )}
          {stepIndex >= 1 && (
            <>
              <div className="debate-opp">
                <span className="tiny muted">{t('debate.opposition')}</span>
                <En as="p">{topic.opposition[side]}</En>
              </div>
              {editor('rebuttal', rebuttal, setRebuttal, topic.rebuttalWords, 'debate.rebuttalHint')}
              {step === 'rebuttal' && (
                <Button variant="primary" iconEnd="forward" disabled={words(rebuttal) < Math.round(topic.rebuttalWords[0] * 0.6)} onClick={() => advance('closing')} data-testid="debate-next">
                  {t('debate.showClosing')}
                </Button>
              )}
            </>
          )}
          {stepIndex >= 2 && (
            <>
              <div className="debate-opp">
                <span className="tiny muted">{t('debate.oppClosing')}</span>
                <En as="p">{topic.closingOpp[side]}</En>
              </div>
              {editor('closing', closing, setClosing, topic.closingWords, 'debate.closingHint')}
              {step === 'closing' && (
                <Button variant="primary" icon="check" disabled={words(closing) < Math.round(topic.closingWords[0] * 0.6)} onClick={finish} data-testid="debate-finish">
                  {t('debate.check')}
                </Button>
              )}
            </>
          )}
        </Panel>
        <Panel className="stack">
          {step === 'review' ? (
            <>
              <div className="notice">
                <Icon name="info" />
                <p className="small">{t('debate.disclaimer')}</p>
              </div>
              <strong>{t('debate.checklist')}</strong>
              <ul className="plain-list findings" data-testid="debate-checklist">
                {checklist.map((c) => (
                  <li key={c.id} className={`finding finding--${c.met ? 'good' : 'tip'}`}>
                    <Icon name={c.met ? 'check' : 'info'} />
                    <span>{lang === 'he' ? <He>{c.he}</He> : c.en}</span>
                  </li>
                ))}
              </ul>
              <p className="small">{t('debate.checklistCount', { n: checklist.filter((c) => c.met).length, total: checklist.length })}</p>
              <details>
                <summary className="small">{t('debate.details')}</summary>
                <strong>{t('debate.opening')}</strong>
                <Report report={openingReport} />
                <strong>{t('debate.rebuttal')}</strong>
                <Report report={rebuttalReport} />
                <strong>{t('debate.closing')}</strong>
                <Report report={closingReport} />
              </details>
              <Button icon="refresh" onClick={() => setStep('opening')}>
                {t('debate.revise')}
              </Button>
            </>
          ) : (
            <>
              <strong>{t('debate.phrases')}</strong>
              <ul className="plain-list">
                {topic.phrases.map((p) => (
                  <li key={p}>
                    <button type="button" className="chip" onClick={() => { void navigator.clipboard?.writeText(p.replace('…', '').trim()); toast(t('common.copied'), 'good'); }}>
                      <En>{p}</En>
                    </button>
                  </li>
                ))}
              </ul>
              <strong>{t('debate.vocabulary')}</strong>
              <dl className="debate-vocab">
                {topic.vocabulary.map((v) => (
                  <div key={v.en}>
                    <dt className="en" dir="ltr" lang="en">
                      {v.en}
                    </dt>
                    <dd className="small muted" dir="rtl" lang="he">
                      {v.he}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function DebateScreen({ topicId }: { topicId?: string }) {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const history = usePlayer((s) => s.debates);
  const topic = DEBATE_TOPICS.find((x) => x.id === topicId);
  if (topic) return <Workspace topic={topic} />;
  const best = (id: string) => history.filter((h) => h.topicId === id).reduce<{ met: number; total: number } | null>((b, h) => (!b || h.met > b.met ? { met: h.met, total: h.total } : b), null);
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('mode.debate-arena')}</h1>
        <Chip tone="purple">{t('debate.practice')}</Chip>
      </div>
      <p className="small muted">{t('debate.intro')}</p>
      <div className="grid-auto">
        {DEBATE_TOPICS.map((d) => {
          const b = best(d.id);
          return (
            <button key={d.id} type="button" className="tile" onClick={() => go({ id: 'debate', topicId: d.id })} data-testid={`debate-topic-${d.id}`}>
              <span className="row">
                <Chip tone="purple">{d.level}</Chip>
                {b && (
                  <Chip tone="good" icon="check">
                    {b.met}/{b.total}
                  </Chip>
                )}
              </span>
              <En className="tile__title debate-tile">{d.motion}</En>
              {lang === 'he' && <span className="tile__sub">{d.motionHe}</span>}
            </button>
          );
        })}
      </div>
      <p className="tiny muted">{t('debate.pvpNote')}</p>
    </div>
  );
}
