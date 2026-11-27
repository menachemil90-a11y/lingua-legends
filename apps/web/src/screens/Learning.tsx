/** Placement test, practice/review sessions and the reading room. */
import { useMemo, useState } from 'react';
import { CEFR_LEVELS, prepareRoundQuestion, gradeAnswer, type ContentItem, type GradeResult } from '@lingua/shared';
import { PlacementSession, dueReviews, eventFromItem, recommendedLevel, selectItems, weakTopics } from '@lingua/learning';
import { CONTENT_ITEMS, itemsFor, itemsForPassage, listeningPool, passageById, READING_PASSAGES } from '@lingua/content';
import { Icon } from '../art/icons';
import { Button, Chip, En, Panel, ProgressBar, StateMessage } from '../design';
import { useT } from '../i18n';
import { sfx } from '../audio/sfx';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { uid } from '../state/storage';
import { Explanation, Prompt } from '../games/shared/components';

const ttsAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Plays a listening script with the browser's on-device text-to-speech (free, no data sent by us). */
export function ListenControl({ script, revealed }: { script: string; revealed: boolean }) {
  const t = useT();
  const [plays, setPlays] = useState(0);
  const speak = (rate: number) => {
    if (!ttsAvailable()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.lang = 'en-US';
    u.rate = rate;
    window.speechSynthesis.speak(u);
    setPlays((n) => n + 1);
  };
  if (!ttsAvailable()) {
    return (
      <div className="stack">
        <p className="tiny muted">{t('listening.unavailable')}</p>
        <En as="div" className="q-context">
          {script}
        </En>
      </div>
    );
  }
  return (
    <div className="listen">
      <div className="row">
        <Button variant="secondary" icon="volume" onClick={() => speak(0.95)} data-testid="listen-play">
          {plays ? t('listening.again') : t('listening.play')}
        </Button>
        <Button size="sm" variant="ghost" icon="hourglass" onClick={() => speak(0.7)}>
          {t('listening.slow')}
        </Button>
      </div>
      {revealed ? (
        <En as="div" className="q-context">
          {script}
        </En>
      ) : (
        <p className="tiny muted">{t('listening.hidden')}</p>
      )}
    </div>
  );
}

/** Runs a list of option-graded items with immediate, detailed feedback. */
export function QuizSession({
  items,
  mode,
  onDone,
}: {
  items: ContentItem[];
  mode: 'practice' | 'bagrut' | 'adventure' | 'english-detective';
  onDone: (score: { correct: number; total: number }) => void;
}) {
  const t = useT();
  const recordLearning = usePlayer((s) => s.recordLearning);
  const [i, setI] = useState(0);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const item = items[i];
  const rq = useMemo(() => (item ? prepareRoundQuestion(item, `${mode}-${i}`, Math.random) : null), [item, i, mode]);
  if (!item || !rq) return null;

  const answer = (optionId: string) => {
    if (grade) return;
    const g = gradeAnswer(rq, { kind: 'option', optionId });
    setChosen(optionId);
    setGrade(g);
    sfx.play(g.correct ? 'correct' : 'wrong');
    if (g.correct) setCorrect((c) => c + 1);
    const ev = eventFromItem(item, {
      id: uid('ev_'),
      playerId: '',
      mode,
      correct: g.correct,
      responseMs: Date.now() - startedAt,
      timestamp: Date.now(),
      timeLimitMs: rq.question.timeLimitSec * 1000,
      ...(g.errorCategory ? { errorCategory: g.errorCategory } : {}),
    });
    // Without real audio the learner read the script, so it must not count as listening evidence.
    if (item.listen && !ttsAvailable()) ev.primarySkill = 'reading';
    recordLearning([ev]);
  };
  const next = () => {
    if (i + 1 >= items.length) {
      onDone({ correct, total: items.length });
      return;
    }
    setI(i + 1);
    setGrade(null);
    setChosen(null);
    setStartedAt(Date.now());
  };
  const correctText = rq.question.options?.find((o) => rq.key.correctOptionIds?.includes(o.id))?.text ?? '';

  return (
    <div className="quiz">
      <div className="row">
        <Chip>{t('match.question', { n: i + 1 })}</Chip>
        <Chip tone="purple">{item.level}</Chip>
        <span className="spacer" />
        <span className="tiny muted num">
          {i + 1}/{items.length}
        </span>
      </div>
      <ProgressBar value={(i + (grade ? 1 : 0)) / items.length} label={t('placement.progress', { n: i + 1, total: items.length })} />
      {rq.question.context && (
        <En as="div" className="q-context">
          {rq.question.context}
        </En>
      )}
      {item.listen && <ListenControl key={item.id} script={item.listen} revealed={!!grade} />}
      <Prompt text={rq.question.prompt} fill={grade ? correctText : null} correct={grade ? true : null} />
      <div className={`answer-grid ${(rq.question.options?.length ?? 0) >= 4 ? 'answer-grid--2' : ''}`}>
        {rq.question.options?.map((o, k) => {
          const isCorrect = !!grade && rq.key.correctOptionIds?.includes(o.id);
          const isWrong = !!grade && chosen === o.id && !grade.correct;
          return (
            <button
              key={o.id}
              type="button"
              className={`answer ${isCorrect ? 'answer--correct' : ''} ${isWrong ? 'answer--wrong' : ''} ${grade && !isCorrect && !isWrong ? 'answer--dim' : ''}`}
              disabled={!!grade}
              onClick={() => answer(o.id)}
            >
              <span className="answer__key">{'ABCD'[k]}</span>
              <En className="answer__text">{o.text}</En>
              {isCorrect && <Icon name="check" className="answer__mark" />}
              {isWrong && <Icon name="x" className="answer__mark" />}
            </button>
          );
        })}
      </div>
      {grade && (
        <div className={`feedback ${grade.correct ? 'feedback--good' : 'feedback--bad'}`} role="status">
          <div className="feedback__head">
            <Icon name={grade.correct ? 'check' : 'x'} />
            <strong>{grade.correct ? t('match.correct') : t('match.wrong')}</strong>
            {!grade.correct && (
              <span className="feedback__answer">
                {t('match.correctAnswer')}: <En>{correctText}</En>
              </span>
            )}
          </div>
          <Explanation exp={item.explanation} feedback={grade.correct ? undefined : grade.feedback} example={item.example} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="primary" iconEnd="forward" onClick={next} autoFocus>
              {i + 1 >= items.length ? t('common.done') : t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Placement() {
  const t = useT();
  const back = useNav((s) => s.back);
  const learner = usePlayer((s) => s.learner);
  const setLearner = usePlayer((s) => s.setLearner);
  const [session, setSession] = useState<PlacementSession | null>(null);
  const [, force] = useState(0);
  const [done, setDone] = useState(false);
  const pool = useMemo(() => CONTENT_ITEMS.filter((i) => i.grading.mode === 'option' && !i.passageId), []);

  const start = () => setSession(new PlacementSession(pool, { random: Math.random, startLevel: learner.selfReportedLevel ?? 'B1' }));

  if (done && session) {
    const res = session.result();
    return (
      <div className="page">
        <Panel gold>
          <h1 className="display">{t('placement.done')}</h1>
          <p className="muted">{t('placement.result')}</p>
          <div className="skills" style={{ marginTop: 16 }}>
            {(['vocabulary', 'grammar', 'reading'] as const).map((s) => (
              <div key={s} className="skill">
                <span className="skill__name">{t(`skill.${s}`)}</span>
                <span className="skill__level en">{res.estimates[s] ?? '—'}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            {t('placement.note')} {t('profile.estimateDisclaimer')}
          </p>
          <Button variant="primary" onClick={back} style={{ marginTop: 16 }}>
            {t('common.continue')}
          </Button>
        </Panel>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
          <h1 className="page__title">{t('placement.title')}</h1>
        </div>
        <Panel>
          <p>{t('placement.intro')}</p>
          <div className="row" style={{ marginTop: 16 }}>
            <Button variant="primary" size="lg" icon="brain" onClick={start} data-testid="start-placement">
              {t('placement.start')}
            </Button>
            <Button onClick={back}>{t('placement.skip')}</Button>
          </div>
        </Panel>
      </div>
    );
  }

  const item = session.current();
  const rq = item ? prepareRoundQuestion(item, `pl-${session.answered}`, () => 0.42) : null;
  const choose = (optionId: string | null) => {
    if (!rq || !item) return;
    const correct = optionId ? gradeAnswer(rq, { kind: 'option', optionId }).correct : false;
    session.answer(correct);
    if (session.isDone()) {
      setLearner(session.applyTo(usePlayer.getState().learner, Date.now()));
      setDone(true);
    } else force((n) => n + 1);
  };
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('placement.title')}</h1>
        <Chip>{t('placement.progress', { n: session.answered + 1, total: session.total })}</Chip>
      </div>
      <ProgressBar value={session.answered / session.total} label={t('placement.progress', { n: session.answered + 1, total: session.total })} />
      {rq && (
        <Panel className="quiz">
          {rq.question.context && (
            <En as="div" className="q-context">
              {rq.question.context}
            </En>
          )}
          <Prompt text={rq.question.prompt} />
          <div className="answer-grid answer-grid--2">
            {rq.question.options?.map((o, k) => (
              <button key={o.id} type="button" className="answer" onClick={() => choose(o.id)}>
                <span className="answer__key">{'ABCD'[k]}</span>
                <En className="answer__text">{o.text}</En>
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => choose(null)}>
            {t('placement.dontKnow')}
          </Button>
        </Panel>
      )}
      <p className="tiny muted">{t('profile.estimateDisclaimer')}</p>
    </div>
  );
}

export function Practice({ focus }: { focus?: 'review' | 'mix' }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const learner = usePlayer((s) => s.learner);
  const incrementCounter = usePlayer((s) => s.incrementCounter);
  const [session, setSession] = useState<ContentItem[] | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  const due = dueReviews(learner, Date.now());
  const weak = weakTopics(learner, 5);

  const startSession = (kind: 'review' | 'mix' | 'listening') => {
    const pool = kind === 'listening' ? listeningPool() : itemsFor('practice').filter((i) => i.grading.mode === 'option' && !i.passageId && !i.listen);
    const lvl = recommendedLevel(learner);
    const idx = CEFR_LEVELS.indexOf(lvl);
    const levels = CEFR_LEVELS.filter((_, k) => Math.abs(k - idx) <= 1);
    const items = selectItems(pool, learner, { count: kind === 'listening' ? 6 : 8, now: Date.now(), random: Math.random, levels: kind === 'mix' ? levels : CEFR_LEVELS, reviewShare: kind === 'review' ? 1 : 0.35 });
    setResult(null);
    setSession(items);
  };

  if (session) {
    return (
      <div className="page">
        <div className="page__head">
          <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={() => setSession(null)} />
          <h1 className="page__title">{t('practice.title')}</h1>
        </div>
        {result ? (
          <Panel gold>
            <h2 className="display">{t('practice.sessionDone')}</h2>
            <p className="num" style={{ fontSize: 'var(--fs-2xl)' }}>
              {result.correct}/{result.total}
            </p>
            <p className="small muted">{t('result.reviewLater')}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="primary" icon="refresh" onClick={() => startSession('mix')}>
                {t('practice.mix')}
              </Button>
              <Button onClick={() => setSession(null)}>{t('common.back')}</Button>
            </div>
          </Panel>
        ) : (
          <Panel>
            <QuizSession
              items={session}
              mode="practice"
              onDone={(r) => {
                setResult(r);
                incrementCounter('reviewSessions');
              }}
            />
          </Panel>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('practice.title')}</h1>
      </div>
      <div className="grid-auto">
        <Panel title={t('practice.due')} gold={due.length > 0}>
          <p className="num" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>
            {due.length}
          </p>
          {due.length === 0 && <p className="small muted">{t('practice.noDue')}</p>}
          <Button variant="primary" icon="target" onClick={() => startSession(due.length > 0 || focus === 'review' ? 'review' : 'mix')} data-testid="start-review">
            {due.length > 0 ? t('practice.startReview') : t('practice.mix')}
          </Button>
        </Panel>
        <Panel title={t('listening.lab')}>
          <p className="small muted">{t('listening.labDesc')}</p>
          <Button variant="secondary" icon="ear" onClick={() => startSession('listening')} data-testid="start-listening">
            {t('listening.start')}
          </Button>
        </Panel>
        <Panel title={t('practice.topics')}>
          {weak.length === 0 ? (
            <p className="small muted">{t('profile.noData')}</p>
          ) : (
            <div className="row tags">
              {weak.map((w) => (
                <span key={w.tag} className="chip chip--bad">
                  <En>{w.tag.replace(/^[vgi]:/, '').replace(/-/g, ' ')}</En>
                </span>
              ))}
            </div>
          )}
          <Button variant="secondary" icon="puzzle" onClick={() => go({ id: 'sentence-practice' })} style={{ marginTop: 12 }}>
            {t('sentence.practice')}
          </Button>
        </Panel>
      </div>
      <Panel title={t('practice.reading')}>
        <div className="grid-auto">
          {READING_PASSAGES.filter((p) => !p.id.startsWith('lit-')).map((p) => (
            <button key={p.id} type="button" className="tile" onClick={() => go({ id: 'reading', passageId: p.id })}>
              <span className="row">
                <Chip tone="purple">{p.level}</Chip>
                <Chip>{p.genre}</Chip>
              </span>
              <En className="tile__title">{p.title}</En>
              <span className="tile__sub">{t('practice.questions')}: {itemsForPassage(p.id).length}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function Reading({ passageId, chapterId }: { passageId: string; chapterId?: string }) {
  const t = useT();
  const back = useNav((s) => s.back);
  const setStars = usePlayer((s) => s.setAdventureStars);
  const passage = passageById(passageId);
  const items = itemsForPassage(passageId);
  const [phase, setPhase] = useState<'read' | 'quiz' | 'done'>('read');
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  if (!passage) return <StateMessage title={t('error.generic')} error />;
  return (
    <div className="page">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('practice.reading')}</h1>
        <Chip tone="purple">{passage.level}</Chip>
      </div>
      <div className="reading">
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
          {passage.glossary.length > 0 && (
            <div className="glossary">
              <span className="tiny muted">{t('practice.glossary')}</span>
              {passage.glossary.map((g) => (
                <span key={g.term} className="chip">
                  <En>{g.term}</En> — {g.he}
                </span>
              ))}
            </div>
          )}
        </Panel>
        <Panel className="reading__quiz">
          {phase === 'read' && (
            <div className="stack">
              <p className="small muted">{t('practice.passage')}</p>
              <Button variant="primary" icon="forward" onClick={() => setPhase('quiz')}>
                {t('common.start')} ({items.length})
              </Button>
            </div>
          )}
          {phase === 'quiz' && (
            <QuizSession
              items={items}
              mode={chapterId ? 'adventure' : 'practice'}
              onDone={(s) => {
                setScore(s);
                setPhase('done');
                if (chapterId) setStars(chapterId, Math.round((s.correct / Math.max(1, s.total)) * 3));
              }}
            />
          )}
          {phase === 'done' && score && (
            <div className="stack">
              <h2 className="display">{t('practice.sessionDone')}</h2>
              <p className="num" style={{ fontSize: 'var(--fs-2xl)' }}>
                {score.correct}/{score.total}
              </p>
              <Button onClick={back}>{t('common.back')}</Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
