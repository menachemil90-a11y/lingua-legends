import { useEffect, useState, type ReactNode } from 'react';
import type { PublicPlayer, PublicQuestion, ServerMessageOf } from '@lingua/shared';
import { Icon } from '../../art/icons';
import { Hero, RankEmblem } from '../../art/Art';
import { BotBadge, En, He } from '../../design';
import { useT } from '../../i18n';
import { sfx } from '../../audio/sfx';
import { effectiveExplanations, useSettings } from '../../state/settings';

/** Renders a prompt, turning "___" into a styled gap (filled after reveal). */
export function Prompt({ text, fill, correct }: { text: string; fill?: string | null; correct?: boolean | null }) {
  const parts = text.split('___');
  return (
    <En as="p" className="q-prompt">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className={`gap ${fill ? (correct ? 'gap--good' : 'gap--filled') : ''}`}>{fill ?? ' '}</span>
          )}
        </span>
      ))}
    </En>
  );
}

export function Explanation({ exp, feedback, example, compact }: { exp: { en: string; he: string }; feedback?: { en: string; he: string } | undefined; example?: string | undefined; compact?: boolean }) {
  const mode = useSettings((s) => effectiveExplanations(s));
  return (
    <div className={`explain ${compact ? 'explain--compact' : ''}`}>
      {feedback && (
        <div className="explain__feedback">
          {(mode === 'en' || mode === 'both') && <En as="p">{feedback.en}</En>}
          {(mode === 'he' || mode === 'both') && <He as="p">{feedback.he}</He>}
        </div>
      )}
      {(mode === 'en' || mode === 'both') && <En as="p">{exp.en}</En>}
      {(mode === 'he' || mode === 'both') && <He as="p" className="explain__he">{exp.he}</He>}
      {example && !compact && (
        <En as="p" className="explain__example">
          {example}
        </En>
      )}
    </div>
  );
}

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Multiple-choice question with keyboard support (1–4 or A–D). */
export function QuestionCard({
  question,
  selected,
  result,
  selfId,
  onAnswer,
  disabled,
  header,
}: {
  question: PublicQuestion;
  selected: string | null | undefined;
  result: ServerMessageOf<'ANSWER_RESULT'> | null;
  selfId: string;
  onAnswer: (optionId: string) => void;
  disabled?: boolean;
  header?: ReactNode;
}) {
  const t = useT();
  const mine = result?.results.find((r) => r.playerId === selfId);
  const revealed = !!result;
  const correctText = result?.correctAnswer;

  useEffect(() => {
    if (revealed || disabled || selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toUpperCase();
      let idx = KEYS.indexOf(k);
      if (idx < 0 && /^[1-6]$/.test(k)) idx = Number(k) - 1;
      const opt = question.options?.[idx];
      if (opt) {
        e.preventDefault();
        onAnswer(opt.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, revealed, disabled, selected, onAnswer]);

  const selectedText = question.options?.find((o) => o.id === selected)?.text;
  return (
    <div className="qcard">
      {header}
      {question.context && (
        <En as="div" className="q-context">
          {question.context}
        </En>
      )}
      <Prompt text={question.prompt} fill={revealed ? correctText : selectedText} correct={revealed ? true : null} />
      <div className={`answer-grid ${(question.options?.length ?? 0) >= 4 ? 'answer-grid--2' : ''}`} role="group" aria-label={t('practice.questions')}>
        {question.options?.map((o, i) => {
          const isSel = selected === o.id;
          const isCorrect = revealed && o.text === correctText;
          const isWrong = revealed && isSel && !mine?.correct;
          const cls = ['answer', isSel && !revealed ? 'answer--selected' : '', isCorrect ? 'answer--correct' : '', isWrong ? 'answer--wrong' : '', revealed && !isCorrect && !isWrong ? 'answer--dim' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={o.id}
              type="button"
              className={cls}
              disabled={disabled || revealed || !!selected}
              onClick={() => {
                sfx.play('click');
                onAnswer(o.id);
              }}
              aria-pressed={isSel}
            >
              <span className="answer__key" aria-hidden="true">
                {KEYS[i]}
              </span>
              <En className="answer__text">{o.text}</En>
              {isCorrect && <Icon name="check" className="answer__mark" aria-label={t('match.correct')} />}
              {isWrong && <Icon name="x" className="answer__mark" aria-label={t('match.wrong')} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Concise in-match feedback after a round. */
export function RoundFeedback({ result, selfId, compact = true }: { result: ServerMessageOf<'ANSWER_RESULT'>; selfId: string; compact?: boolean }) {
  const t = useT();
  const mine = result.results.find((r) => r.playerId === selfId);
  const ok = !!mine?.correct;
  return (
    <div className={`feedback ${ok ? 'feedback--good' : 'feedback--bad'}`} role="status" aria-live="polite">
      <div className="feedback__head">
        <Icon name={ok ? 'check' : mine?.answered ? 'x' : 'clock'} />
        <strong>{ok ? t('match.correct') : mine?.answered ? t('match.wrong') : t('match.timeUp')}</strong>
        {!ok && (
          <span className="feedback__answer">
            {t('match.correctAnswer')}: <En>{result.correctAnswer}</En>
          </span>
        )}
      </div>
      {!ok && <Explanation exp={result.explanation} feedback={mine?.feedback} compact={compact} />}
    </div>
  );
}

/** 3-2-1 countdown overlay driven by the match start time. */
export function Countdown({ startsAt, goLabel }: { startsAt: number | null; goLabel: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startsAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startsAt]);
  const left = startsAt ? Math.ceil((startsAt - now) / 1000) : null;
  const [last, setLast] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || left === last) return;
    setLast(left);
    if (left > 0 && left <= 3) sfx.play('countdown');
    if (left === 0) sfx.play('go');
  }, [left, last]);
  if (left === null || left < -0.5 || left > 3) return null;
  return (
    <div className="countdown" aria-live="assertive">
      <span key={left} className="countdown__num display">
        {left > 0 ? left : goLabel}
      </span>
    </div>
  );
}

export function PlayerTag({ player, side, extra }: { player: PublicPlayer; side: 'left' | 'right'; extra?: ReactNode }) {
  const t = useT();
  return (
    <div className={`ptag ptag--${side}`}>
      <div className="ptag__name">
        <span className="ptag__nick">{player.nickname}</span>
        {player.isBot && <BotBadge tier={player.botTier ? t(`bot.${player.botTier}` as 'bot.adept') : undefined} />}
        {player.rankTier && !player.isBot && <RankEmblem tier={player.rankTier} division={null} size={22} />}
      </div>
      {extra}
    </div>
  );
}

/** VS splash shown before a match (Clash-style introduction). */
export function MatchIntro({ players, selfId, modeLabel }: { players: PublicPlayer[]; selfId: string; modeLabel: string }) {
  const t = useT();
  const me = players.find((p) => p.playerId === selfId) ?? players[0]!;
  const others = players.filter((p) => p.playerId !== me.playerId);
  return (
    <div className="intro">
      <div className="intro__mode display">{modeLabel}</div>
      <div className="intro__row">
        <div className="intro__side intro__side--me">
          <Hero id={me.characterId} className="intro__hero" />
          <div className="intro__nick">{me.nickname}</div>
          {me.rankLabel && <div className="tiny muted">{me.rankLabel}</div>}
        </div>
        <div className="intro__vs display">{t('common.vs')}</div>
        {others.map((o) => (
          <div key={o.playerId} className="intro__side intro__side--foe">
            <Hero id={o.characterId} flip className="intro__hero" />
            <div className="intro__nick">
              {o.nickname} {o.isBot && <BotBadge tier={o.botTier ? t(`bot.${o.botTier}` as 'bot.adept') : undefined} />}
            </div>
            {o.rankLabel && <div className="tiny muted">{o.rankLabel}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Small visual indicator for audio events (accessibility alternative to sound). */
export function VisualCue() {
  const enabled = useSettings((s) => s.visualCues);
  const [cue, setCue] = useState<{ name: string; at: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return sfx.onPlay((name) => {
      if (['correct', 'wrong', 'hit', 'shield', 'turbo', 'charge', 'victory', 'defeat'].includes(name)) setCue({ name, at: Date.now() });
    });
  }, [enabled]);
  useEffect(() => {
    if (!cue) return;
    const id = setTimeout(() => setCue(null), 900);
    return () => clearTimeout(id);
  }, [cue]);
  if (!enabled || !cue) return null;
  const icon = cue.name === 'correct' ? 'check' : cue.name === 'wrong' ? 'x' : cue.name === 'shield' ? 'shield' : cue.name === 'turbo' || cue.name === 'charge' ? 'bolt' : cue.name === 'victory' ? 'trophy' : 'sparkle';
  return (
    <div className={`vcue vcue--${cue.name}`} aria-hidden="true" key={cue.at}>
      <Icon name={icon} />
    </div>
  );
}
