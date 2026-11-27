/** Debate Arena — private practice: argue, read the other side, rebut. Heuristic checklist only, never a grade. */
import { useMemo, useState } from 'react';
import { DEBATE_TOPICS, type DebateTopic } from '@lingua/content';
import { checkWriting, type WritingReport } from '@lingua/learning';
import { Icon } from '../art/icons';
import { Button, Chip, En, He, Panel, ProgressBar, Segmented, toast } from '../design';
import { useT, useLang } from '../i18n';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { sfx } from '../audio/sfx';

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
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [step, setStep] = useState<'opening' | 'rebuttal' | 'review'>('opening');
  const key = (part: string) => `debate:${topic.id}:${side}:${part}`;
  const [opening, setOpening] = useState(notes[key('opening')] ?? '');
  const [rebuttal, setRebuttal] = useState(notes[key('rebuttal')] ?? '');
  const persist = () => saveBagrut({ notes: { ...usePlayer.getState().bagrut.notes, [key('opening')]: opening, [key('rebuttal')]: rebuttal } });
  const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const openingReport = useMemo(() => checkWriting(opening, { minWords: topic.openingWords[0], maxWords: topic.openingWords[1] }), [opening, topic]);
  const rebuttalReport = useMemo(() => checkWriting(rebuttal, { minWords: topic.rebuttalWords[0], maxWords: topic.rebuttalWords[1], expectConcession: true }), [rebuttal, topic]);

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
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {t('debate.neutral')}
        </p>
      </Panel>

      <div className="reading">
        <Panel className="stack">
          <strong>{t('debate.opening')}</strong>
          <p className="small muted">{t('debate.openingHint')}</p>
          <textarea className="input en" dir="ltr" lang="en" value={opening} onChange={(e) => setOpening(e.target.value)} onBlur={persist} disabled={step !== 'opening'} aria-label={t('debate.opening')} spellCheck />
          <ProgressBar value={Math.min(1, words(opening) / topic.openingWords[0])} tone="good" label="words" />
          <span className="tiny muted">{t('bagrut.wordTarget', { min: topic.openingWords[0], max: topic.openingWords[1] })}</span>
          {step === 'opening' && (
            <Button variant="primary" iconEnd="forward" disabled={words(opening) < Math.round(topic.openingWords[0] * 0.6)} onClick={() => { persist(); setStep('rebuttal'); sfx.play('whoosh'); }}>
              {t('debate.showOpposition')}
            </Button>
          )}
          {step !== 'opening' && (
            <>
              <div className="debate-opp">
                <span className="tiny muted">{t('debate.opposition')}</span>
                <En as="p">{topic.opposition[side]}</En>
              </div>
              <strong>{t('debate.rebuttal')}</strong>
              <p className="small muted">{t('debate.rebuttalHint')}</p>
              <textarea className="input en" dir="ltr" lang="en" value={rebuttal} onChange={(e) => setRebuttal(e.target.value)} onBlur={persist} disabled={step === 'review'} aria-label={t('debate.rebuttal')} spellCheck />
              <span className="tiny muted">{t('bagrut.wordTarget', { min: topic.rebuttalWords[0], max: topic.rebuttalWords[1] })}</span>
              {step === 'rebuttal' && (
                <Button
                  variant="primary"
                  icon="check"
                  disabled={words(rebuttal) < Math.round(topic.rebuttalWords[0] * 0.6)}
                  onClick={() => {
                    persist();
                    setStep('review');
                    sfx.play('correct');
                    recordMatch({ mode: 'debate-arena', online: false, queue: 'solo', opponent: null, result: 'complete', correct: 0, incorrect: 0, accuracy: 0, bestCombo: 0, xp: 45, shards: 12 });
                  }}
                >
                  {t('debate.check')}
                </Button>
              )}
            </>
          )}
        </Panel>
        <Panel className="stack">
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
          {step === 'review' && (
            <>
              <div className="notice">
                <Icon name="info" />
                <p className="small">{t('debate.disclaimer')}</p>
              </div>
              <strong>{t('debate.opening')}</strong>
              <Report report={openingReport} />
              <strong>{t('debate.rebuttal')}</strong>
              <Report report={rebuttalReport} />
              <Button icon="refresh" onClick={() => setStep('opening')}>
                {t('debate.revise')}
              </Button>
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
  const topic = DEBATE_TOPICS.find((x) => x.id === topicId);
  if (topic) return <Workspace topic={topic} />;
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('mode.debate-arena')}</h1>
        <Chip tone="purple">{t('debate.practice')}</Chip>
      </div>
      <p className="small muted">{t('debate.intro')}</p>
      <div className="grid-auto">
        {DEBATE_TOPICS.map((d) => (
          <button key={d.id} type="button" className="tile" onClick={() => go({ id: 'debate', topicId: d.id })}>
            <Chip tone="purple">{d.level}</Chip>
            <En className="tile__title debate-tile">{d.motion}</En>
            {lang === 'he' && <span className="tile__sub">{d.motionHe}</span>}
          </button>
        ))}
      </div>
      <p className="tiny muted">{t('debate.pvpNote')}</p>
    </div>
  );
}
