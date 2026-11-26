/** Untimed Sentence Master practice with difficulty progression and detailed feedback. */
import { useMemo, useState } from 'react';
import { cefrFromIndex, cefrIndex, gradeAnswer, prepareRoundQuestion, type CefrLevel, type GradeResult, type RoundQuestion } from '@lingua/shared';
import { eventFromItem, recommendedLevel, selectItems } from '@lingua/learning';
import { sentencePool } from '@lingua/content';
import { Button, Chip, En, Panel } from '../../design';
import { Icon } from '../../art/icons';
import { useT } from '../../i18n';
import { sfx } from '../../audio/sfx';
import { usePlayer } from '../../state/player';
import { useNav } from '../../state/nav';
import { uid } from '../../state/storage';
import { Explanation } from '../shared/components';
import { TileBoard } from './TileBoard';

export function SentencePracticeScreen({ startLevels }: { startLevels?: CefrLevel[] }) {
  const t = useT();
  const learner = usePlayer((s) => s.learner);
  const recordLearning = usePlayer((s) => s.recordLearning);
  const incrementCounter = usePlayer((s) => s.incrementCounter);
  const back = useNav((s) => s.back);
  const [levelIdx, setLevelIdx] = useState(() => cefrIndex(startLevels?.[0] ?? recommendedLevel(learner, 'grammar')));
  const [seen, setSeen] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [order, setOrder] = useState<string[]>([]);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [nonce, setNonce] = useState(0);

  const rq: RoundQuestion | null = useMemo(() => {
    const level = cefrFromIndex(levelIdx);
    let pool = sentencePool([level]).filter((i) => !seen.includes(i.id));
    if (pool.length === 0) pool = sentencePool().filter((i) => !seen.includes(i.id));
    if (pool.length === 0) pool = sentencePool();
    const [item] = selectItems(pool, learner, { count: 1, now: Date.now(), random: Math.random, levels: [level, ...pool.map((p) => p.level)], reviewShare: 0.5 });
    return item ? prepareRoundQuestion(item, `practice-${nonce}`, Math.random) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  if (!rq) return null;
  const tiles = rq.question.tiles ?? [];
  const finished = !!grade && (grade.correct || attempt > 2);

  const check = () => {
    if (order.length !== tiles.length || finished) return;
    const g = gradeAnswer(rq, { kind: 'tiles', tileIds: order });
    setGrade(g);
    sfx.play(g.correct ? 'correct' : 'wrong');
    if (g.correct || attempt >= 2) {
      recordLearning([
        eventFromItem(rq.item, {
          id: uid('ev_'),
          playerId: '',
          mode: 'sentence-master',
          correct: g.correct,
          responseMs: null,
          timestamp: Date.now(),
          attempt,
          ...(g.errorCategory ? { errorCategory: g.errorCategory } : {}),
        }),
      ]);
      if (g.correct) {
        setSolved((n) => n + 1);
        incrementCounter('sentencesSolved');
        setStreak((s) => s + 1);
      } else setStreak(0);
    }
    if (!g.correct && attempt < 2) setAttempt(2);
    else setAttempt(3);
  };

  const next = () => {
    let idx = levelIdx;
    if (grade?.correct && streak >= 2) {
      idx = Math.min(5, levelIdx + 1);
      setStreak(0);
    } else if (!grade?.correct && levelIdx > 0) idx = levelIdx - 1;
    setLevelIdx(idx);
    setSeen((s) => [...s, rq.item.id]);
    setOrder([]);
    setGrade(null);
    setAttempt(1);
    setNonce((n) => n + 1);
  };

  return (
    <div className="page sm-practice">
      <div className="page__head">
        <Button variant="ghost" icon="back" onClick={back} aria-label={t('common.back')} />
        <h1 className="page__title">{t('mode.sentence-master')}</h1>
        <Chip tone="purple">{t('sentence.practice')}</Chip>
        <Chip tone="gold" icon="star">
          {t('sentence.solved', { n: solved })}
        </Chip>
      </div>
      <Panel className="sm__board">
        <div className="qhead">
          <Chip>{rq.item.level}</Chip>
          <En as="p" className="sm__prompt">
            {rq.question.prompt}
          </En>
        </div>
        <TileBoard tiles={tiles} value={order} onChange={(ids) => !finished && setOrder(ids)} onSubmit={check} disabled={finished} state={grade ? (grade.correct ? 'correct' : 'wrong') : 'idle'} />
        {grade && !grade.correct && !finished && (
          <div className="feedback feedback--bad" role="status">
            <div className="feedback__head">
              <Icon name="refresh" />
              <strong>{t('match.tryAgain')}</strong>
            </div>
            {grade.feedback && <Explanation exp={grade.feedback} compact />}
          </div>
        )}
        {finished && grade && (
          <div className={`feedback ${grade.correct ? 'feedback--good' : 'feedback--bad'}`} role="status">
            <div className="feedback__head">
              <Icon name={grade.correct ? 'check' : 'x'} />
              <strong>{grade.correct ? t('match.correct') : t('match.wrong')}</strong>
              {!grade.correct && (
                <span className="feedback__answer">
                  {t('match.correctAnswer')}: <En>{rq.item.acceptedAnswers[0]}</En>
                </span>
              )}
            </div>
            {rq.item.acceptedAnswers.length > 1 && grade.correct && (
              <p className="small muted">
                <En>{rq.item.acceptedAnswers.join('  ·  ')}</En>
              </p>
            )}
            <Explanation exp={rq.item.explanation} feedback={grade.correct ? undefined : grade.feedback} />
            {grade.correct && streak >= 2 && <p className="small">{t('sentence.levelUp')}</p>}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {!finished && (
            <>
              <Button variant="ghost" size="sm" icon="x" disabled={order.length === 0} onClick={() => setOrder([])}>
                {t('common.clear')}
              </Button>
              <Button variant="secondary" icon="check" disabled={order.length !== tiles.length} onClick={check}>
                {t('common.check')}
              </Button>
            </>
          )}
          {finished && (
            <Button variant="primary" iconEnd="forward" onClick={next}>
              {t('common.next')}
            </Button>
          )}
        </div>
      </Panel>
      <p className="tiny muted center">{t('sentence.instructions')}</p>
    </div>
  );
}
