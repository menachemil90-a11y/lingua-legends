/** Bagrut Academy — independent 5-unit English preparation (not an official MoE product). */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BAGRUT_CURRICULUM,
  BAGRUT_OFFICIAL_REFERENCE,
  itemById,
  MOCK_EXAMS,
  OPEN_TASKS,
  passageById,
  type OpenTask,
} from '@lingua/content';
import type { ContentItem } from '@lingua/shared';
import { Icon } from '../art/icons';
import { Button, Chip, En, He, Panel, ProgressBar, StateMessage } from '../design';
import { useT, useLang } from '../i18n';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { QuizSession } from './Learning';
import { toast } from '../design';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function BagrutHub() {
  const t = useT();
  const lang = useLang();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const bagrut = usePlayer((s) => s.bagrut);
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('bagrut.title')}</h1>
        <Chip tone="gold">{t('bagrut.subtitle')}</Chip>
      </div>
      <div className="notice" role="note">
        <Icon name="info" />
        <div>
          <p className="small">{t('bagrut.disclaimer')}</p>
          <a className="tiny" href={BAGRUT_OFFICIAL_REFERENCE} target="_blank" rel="noopener noreferrer">
            {t('bagrut.officialRef')}
          </a>
        </div>
      </div>
      <div className="grid-auto">
        {BAGRUT_CURRICULUM.components.map((c) => {
          const done = c.taskIds.filter((id) => bagrut.completed.includes(id)).length;
          return (
            <Panel key={c.id} title={lang === 'he' ? c.nameHe : c.name}>
              <ul className="plain-list small">
                {(lang === 'he' ? c.focusHe : c.focus).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <div style={{ margin: '12px 0' }}>
                <ProgressBar value={c.taskIds.length ? done / c.taskIds.length : 0} tone="gold" label={t('bagrut.progress')} />
                <span className="tiny muted num">
                  {done}/{c.taskIds.length} {t('bagrut.tasks')}
                </span>
              </div>
              <div className="stack">
                {c.passageIds.map((pid) => {
                  const p = passageById(pid);
                  return p ? (
                    <Button key={pid} size="sm" icon="book" className="btn--wrap" onClick={() => go({ id: 'reading', passageId: pid })}>
                      <En>{p.title}</En>
                    </Button>
                  ) : null;
                })}
                {c.taskIds.map((tid) => {
                  const task = OPEN_TASKS.find((x) => x.id === tid);
                  if (!task) return null;
                  return (
                    <Button key={tid} size="sm" className="btn--wrap" variant={bagrut.completed.includes(tid) ? 'ghost' : 'secondary'} icon={task.kind === 'speaking' ? 'mic' : 'pen'} onClick={() => go({ id: 'bagrut-task', taskId: tid })}>
                      {bagrut.completed.includes(tid) && <Icon name="check" className="btn__icon" />}
                      <En>{task.title}</En>
                    </Button>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel title={t('bagrut.mockExams')}>
        <div className="grid-auto">
          {MOCK_EXAMS.map((m) => {
            const best = bagrut.mockScores[m.id];
            return (
              <div key={m.id} className="tile">
                <strong className="tile__title" style={{ maxWidth: '100%' }}>
                  {lang === 'he' ? m.titleHe : m.title}
                </strong>
                <span className="tile__sub">
                  <Icon name="clock" style={{ width: 14, height: 14, verticalAlign: 'middle' }} /> {t('common.minutes', { n: m.minutes })}
                  {best ? ` · ${best.score}/${best.total}` : ''}
                </span>
                <Button variant="primary" size="sm" icon="hourglass" onClick={() => go({ id: 'bagrut-mock', examId: m.id })}>
                  {t('bagrut.startMock')}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

const NO_CHECKS: number[] = [];

function Checklist({ task }: { task: OpenTask }) {
  const t = useT();
  const lang = useLang();
  const checks = usePlayer((s) => s.bagrut.checks[task.id] ?? NO_CHECKS);
  const save = usePlayer((s) => s.saveBagrut);
  const all = usePlayer((s) => s.bagrut.checks);
  return (
    <div className="checklist">
      <strong className="small">{t('bagrut.selfCheck')}</strong>
      <p className="tiny muted">{t('bagrut.selfCheckNote')}</p>
      {task.checklist.map((c, i) => (
        <label key={i} className="check-row">
          <input
            type="checkbox"
            checked={checks.includes(i)}
            onChange={(e) => save({ checks: { ...all, [task.id]: e.target.checked ? [...checks, i] : checks.filter((x) => x !== i) } })}
          />
          <span>{lang === 'he' ? c.he : c.en}</span>
        </label>
      ))}
    </div>
  );
}

function SpeakingPractice({ task }: { task: OpenTask }) {
  const t = useT();
  const [phase, setPhase] = useState<'idle' | 'prep' | 'speak' | 'done'>('idle');
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (ttsAvailable) window.speechSynthesis.cancel();
  }, [ttsAvailable]);
  const run = (seconds: number, nextPhase: 'speak' | 'done') => {
    setLeft(seconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          if (timer.current) clearInterval(timer.current);
          if (nextPhase === 'speak') {
            setPhase('speak');
            run(task.speakSeconds ?? 60, 'done');
          } else setPhase('done');
          return 0;
        }
        return l - 1;
      });
    }, 1000);
  };
  const listen = () => {
    if (!ttsAvailable || !task.listeningScript) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(task.listeningScript);
    u.lang = 'en-US';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };
  return (
    <div className="stack">
      <p className="tiny muted">
        <Icon name="mic" style={{ width: 14, height: 14, verticalAlign: 'middle' }} /> {t('bagrut.speakingNote')}
      </p>
      {task.listeningScript && (
        <div className="row">
          <Button variant="secondary" icon="ear" onClick={listen} disabled={!ttsAvailable}>
            {t('bagrut.listen')}
          </Button>
          {!ttsAvailable && <span className="tiny muted">{t('bagrut.listenUnavailable')}</span>}
        </div>
      )}
      {task.guidingQuestions && (
        <div>
          <strong className="small">{t('bagrut.guiding')}</strong>
          <ul className="plain-list">
            {task.guidingQuestions.map((g) => (
              <li key={g}>
                <En>• {g}</En>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="speak-timer">
        <span className="tiny muted">{phase === 'prep' ? t('bagrut.prep') : phase === 'speak' ? t('bagrut.speak') : ''}</span>
        <span className="display num speak-timer__num">{phase === 'idle' ? `${task.prepSeconds ?? 30}s / ${task.speakSeconds ?? 60}s` : `${left}s`}</span>
        <Button
          variant="primary"
          icon={phase === 'idle' || phase === 'done' ? 'play' : 'x'}
          onClick={() => {
            if (phase === 'idle' || phase === 'done') {
              setPhase('prep');
              run(task.prepSeconds ?? 30, 'speak');
            } else {
              if (timer.current) clearInterval(timer.current);
              setPhase('idle');
            }
          }}
        >
          {phase === 'idle' || phase === 'done' ? t('common.start') : t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

export function BagrutTask({ taskId }: { taskId: string }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const task = OPEN_TASKS.find((x) => x.id === taskId);
  const notes = usePlayer((s) => s.bagrut.notes);
  const save = usePlayer((s) => s.saveBagrut);
  const complete = usePlayer((s) => s.completeBagrutTask);
  const [text, setText] = useState(notes[taskId] ?? '');
  const [showModel, setShowModel] = useState(false);
  if (!task) return <StateMessage title={t('error.generic')} error />;
  const passage = task.passageId ? passageById(task.passageId) : undefined;
  const words = countWords(text);
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">
          <En>{task.title}</En>
        </h1>
        <Chip tone="purple">{task.level}</Chip>
      </div>
      <div className={passage ? 'reading' : ''}>
        {passage && (
          <Panel className="reading__text">
            <En as="h2" className="display reading__title">
              {passage.title}
            </En>
            {passage.paragraphs.map((para, k) => (
              <En as="p" key={k} className={`reading__para ${passage.genre === 'poem' ? 'reading__para--poem' : ''}`}>
                <span className="reading__num">{k + 1}</span>
                {passage.genre === 'poem' ? para.split(' / ').map((line, j) => <span key={j} className="poem-line">{line}</span>) : para}
              </En>
            ))}
          </Panel>
        )}
        <Panel className="stack">
          <En as="p" className="q-prompt">
            {task.prompt}
          </En>
          <He as="p" className="small muted">
            {task.promptHe}
          </He>
          {task.kind === 'speaking' ? (
            <SpeakingPractice task={task} />
          ) : (
            <div className="field">
              <label className="field__label" htmlFor="answer">
                {t('bagrut.notes')}
              </label>
              <textarea id="answer" className="input en" dir="ltr" lang="en" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => save({ notes: { ...notes, [taskId]: text } })} spellCheck />
              <div className="row tiny muted" style={{ justifyContent: 'space-between' }}>
                <span className="num">{t('bagrut.words', { n: words })}</span>
                {task.wordRange && <span>{t('bagrut.wordTarget', { min: task.wordRange[0], max: task.wordRange[1] })}</span>}
              </div>
              {task.wordRange && <ProgressBar value={Math.min(1, words / task.wordRange[0])} tone={words > task.wordRange[1] ? 'purple' : 'good'} label="words" />}
              <p className="tiny muted">{t('bagrut.aiUnavailable')}</p>
            </div>
          )}
          <Checklist task={task} />
          {task.modelAnswer && (
            <div>
              <Button size="sm" variant="ghost" icon="sparkle" onClick={() => setShowModel((v) => !v)}>
                {t('bagrut.showModel')}
              </Button>
              {showModel && (
                <div className="model-answer">
                  <strong className="tiny">{t('bagrut.modelAnswer')}</strong>
                  <En as="p">{task.modelAnswer}</En>
                </div>
              )}
            </div>
          )}
          <Button
            variant="primary"
            icon="check"
            onClick={() => {
              save({ notes: { ...notes, [taskId]: text } });
              const unlocked = complete(taskId);
              toast(unlocked.length ? `${t('result.unlocked')}: ${t('achievement.bagrut-first')}` : t('common.done'), 'good');
              back();
            }}
          >
            {t('common.done')}
          </Button>
        </Panel>
      </div>
    </div>
  );
}

export function BagrutMock({ examId }: { examId: string }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const exam = MOCK_EXAMS.find((m) => m.id === examId);
  const saveScore = usePlayer((s) => s.saveBagrut);
  const scores = usePlayer((s) => s.bagrut.mockScores);
  const [endsAt] = useState(() => Date.now() + (exam?.minutes ?? 30) * 60_000);
  const [now, setNow] = useState(Date.now());
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const items = useMemo(() => (exam?.itemIds.map((id) => itemById(id)).filter(Boolean) as ContentItem[]) ?? [], [exam]);
  if (!exam) return <StateMessage title={t('error.generic')} error />;
  const left = Math.max(0, endsAt - now);
  const passage = exam.passageIds[0] ? passageById(exam.passageIds[0]) : undefined;
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{exam.title}</h1>
        <Chip tone={left < 300_000 ? 'bad' : 'gold'} icon="clock">
          {t('bagrut.timeLeft')}: {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
        </Chip>
      </div>
      <div className="reading">
        {passage && (
          <Panel className="reading__text">
            <En as="h2" className="display reading__title">
              {passage.title}
            </En>
            {passage.paragraphs.map((para, k) => (
              <En as="p" key={k} className="reading__para">
                <span className="reading__num">{k + 1}</span>
                {para}
              </En>
            ))}
          </Panel>
        )}
        <Panel>
          {score ? (
            <div className="stack">
              <h2 className="display">{t('bagrut.examResult', { score: score.correct, total: score.total })}</h2>
              <p className="small muted">{t('bagrut.selfCheckNote')}</p>
              {exam.taskIds.map((tid) => (
                <Button key={tid} variant="secondary" icon="pen" onClick={() => go({ id: 'bagrut-task', taskId: tid })}>
                  {OPEN_TASKS.find((x) => x.id === tid)?.title}
                </Button>
              ))}
              <Button onClick={back}>{t('common.back')}</Button>
            </div>
          ) : left === 0 ? (
            <StateMessage icon="hourglass" title={t('bagrut.finishExam')} action={<Button onClick={back}>{t('common.back')}</Button>} />
          ) : (
            <QuizSession
              items={items}
              mode="bagrut"
              onDone={(s) => {
                setScore(s);
                const prev = scores[exam.id];
                if (!prev || s.correct > prev.score) saveScore({ mockScores: { ...scores, [exam.id]: { score: s.correct, total: s.total, at: Date.now() } } });
              }}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
