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
  createConquest,
  currentPlayer,
  endTurn,
  gradeAnswer,
  prepareRoundQuestion,
  type BotTier,
  type Bracket,
  type ConquestAction,
  type ConquestState,
  type ContentItem,
} from '@lingua/shared';
import { eventFromItem, recommendedLevel, selectItems } from '@lingua/learning';
import { wordBattlePool } from '@lingua/content';
import { Button, Chip, Dialog, En, Panel, Segmented, toast } from '../design';
import { useT, type MessageKey } from '../i18n';
import { sfx } from '../audio/sfx';
import { usePlayer } from '../state/player';
import { useNav } from '../state/nav';
import { uid } from '../state/storage';
import { Explanation, Prompt } from '../games/shared/components';
import { ConquestBoard } from '../games/conquest/ConquestBoard';

const HUMAN = 'you';

function QuestionDialog({ item, onDone }: { item: ContentItem; onDone: (correct: boolean) => void }) {
  const t = useT();
  const recordLearning = usePlayer((s) => s.recordLearning);
  const rq = useMemo(() => prepareRoundQuestion(item, uid('cq'), Math.random), [item]);
  const [picked, setPicked] = useState<string | null>(null);
  const [started] = useState(Date.now());
  const grade = picked ? gradeAnswer(rq, { kind: 'option', optionId: picked }) : null;
  const correctText = rq.question.options?.find((o) => rq.key.correctOptionIds?.includes(o.id))?.text ?? '';
  return (
    <Dialog open title={t('conquest.knowledge')} dismissible={false} onClose={() => {}}>
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
  const back = useNav((s) => s.back);
  const learner = usePlayer((s) => s.learner);
  const nickname = usePlayer((s) => s.nickname);
  const recordMatch = usePlayer((s) => s.recordMatch);
  const botNames = ['Quill', 'Cipher', 'Lumen'];
  const [s, setS] = useState<ConquestState>(() =>
    createConquest([{ id: HUMAN, name: nickname, isBot: false }, ...Array.from({ length: bots }, (_, i) => ({ id: `bot${i + 1}`, name: botNames[i]!, isBot: true, botTier: tier }))]),
  );
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

  return (
    <div className="page conquest">
      <div className="page__head">
        <Button variant="ghost" icon="back" aria-label={t('common.back')} onClick={back} />
        <h1 className="page__title">{t('mode.english-conquest')}</h1>
        <Chip tone="gold">{t('conquest.round', { n: s.round, total: CONQUEST.maxRounds })}</Chip>
      </div>
      <ConquestBoard s={s} selfId={HUMAN} myTurn={myTurn} onAction={act} waiting={<p className="small">{t('conquest.botTurn', { name: cur.name })}</p>} />

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
  const go = useNav((s) => s.go);
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
        <Button variant="secondary" icon="users" onClick={() => go({ id: 'online', mode: 'english-conquest', flow: 'room', bracket })} data-testid="conquest-online">
          {t('conquest.playOnline')}
        </Button>
        <p className="tiny muted">{t('conquest.onlineNote')}</p>
      </Panel>
    </div>
  );
}
