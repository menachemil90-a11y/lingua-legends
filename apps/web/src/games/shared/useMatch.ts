import { useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  AnswerResultEntry,
  CefrLevel,
  CombatEvent,
  PlayerStatePayload,
  PublicPlayer,
  PublicQuestion,
  ServerMessage,
  ServerMessageOf,
} from '@lingua/shared';
import type { LearningEvent } from '@lingua/learning';
import type { MatchTransport } from '../../net/transport';
import { uid } from '../../state/storage';

export interface Mistake {
  itemId: string;
  level: CefrLevel;
  /** Knowledge components (`v:` / `g:`) used to find similar practice items. */
  tags: string[];
  prompt: string;
  context?: string;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation: { en: string; he: string };
  feedback?: { en: string; he: string };
  example?: string;
  errorCategory?: string;
}

export interface RoundView {
  roundId: string;
  index: number;
  question: PublicQuestion;
  /** Deadline converted to the local clock. */
  deadline: number;
  durationMs: number;
  finalRound: boolean;
  startedAtLocal: number;
}

export interface MatchView {
  phase: 'waiting' | 'countdown' | 'round' | 'reveal' | 'ended';
  players: PublicPlayer[];
  startsAt: number | null;
  endsAt: number | null;
  config: Record<string, number>;
  round: RoundView | null;
  myAnswer: { optionId?: string; tileIds?: string[] } | null;
  locked: string[];
  result: ServerMessageOf<'ANSWER_RESULT'> | null;
  attempt: { attemptsLeft: number; seq: number } | null;
  state: PlayerStatePayload | null;
  combat: { events: CombatEvent[]; seq: number } | null;
  end: ServerMessageOf<'MATCH_END'> | null;
  cancelled: string | null;
  mistakes: Mistake[];
  learning: LearningEvent[];
  answered: number;
  correct: number;
  chat: { from: string; phraseId: string; at: number }[];
  rematch: ServerMessageOf<'REMATCH_STATE'> | null;
  error: string | null;
}

const initial = (players: PublicPlayer[]): MatchView => ({
  phase: 'waiting',
  players,
  startsAt: null,
  endsAt: null,
  config: {},
  round: null,
  myAnswer: null,
  locked: [],
  result: null,
  attempt: null,
  state: null,
  combat: null,
  end: null,
  cancelled: null,
  mistakes: [],
  learning: [],
  answered: 0,
  correct: 0,
  chat: [],
  rematch: null,
  error: null,
});

type Action =
  | { kind: 'msg'; msg: ServerMessage; selfId: string; mode: LearningEvent['mode']; toLocal: (t: number) => number }
  | { kind: 'answer'; optionId?: string; tileIds?: string[] };

function toEvent(msg: ServerMessageOf<'ANSWER_RESULT'>, mine: AnswerResultEntry | undefined, round: RoundView | null, selfId: string, mode: LearningEvent['mode']): LearningEvent {
  const l = msg.learning;
  const tags = [...l.vocabularyTags.map((t) => `v:${t}`), ...l.grammarTags.map((t) => `g:${t}`)];
  return {
    id: uid('ev_'),
    playerId: selfId,
    itemId: l.itemId,
    mode,
    correct: !!mine?.correct,
    responseMs: mine?.responseMs ?? null,
    attempt: 1,
    hintUsed: false,
    timestamp: Date.now(),
    ...(mine?.errorCategory ? { errorCategory: mine.errorCategory } : {}),
    level: l.level,
    primarySkill: l.primarySkill,
    secondarySkills: l.secondarySkills,
    tags: tags.length ? tags : [`i:${l.itemId}`],
    category: l.category,
    ...(round ? { timeLimitMs: round.durationMs } : {}),
  };
}

function reducer(s: MatchView, a: Action): MatchView {
  if (a.kind === 'answer') {
    return { ...s, myAnswer: { ...(a.optionId ? { optionId: a.optionId } : {}), ...(a.tileIds ? { tileIds: a.tileIds } : {}) } };
  }
  const { msg, selfId, toLocal, mode } = a;
  switch (msg.type) {
    case 'MATCH_START':
      return {
        ...s,
        players: msg.players,
        startsAt: toLocal(msg.startsAt),
        endsAt: msg.endsAt ? toLocal(msg.endsAt) : null,
        config: msg.config,
        phase: s.phase === 'waiting' ? 'countdown' : s.phase,
      };
    case 'ROUND_START': {
      const deadline = toLocal(msg.deadline);
      const durationMs = msg.question.timeLimitSec * 1000;
      return {
        ...s,
        phase: 'round',
        round: {
          roundId: msg.roundId,
          index: msg.index,
          question: msg.question,
          deadline,
          durationMs,
          finalRound: msg.finalRound,
          startedAtLocal: deadline - durationMs,
        },
        myAnswer: s.round?.roundId === msg.roundId ? s.myAnswer : null,
        locked: s.round?.roundId === msg.roundId ? s.locked : [],
        result: null,
        attempt: null,
      };
    }
    case 'ANSWER_LOCKED':
      if (s.round?.roundId !== msg.roundId) return s;
      return { ...s, locked: [...new Set([...s.locked, msg.playerId])] };
    case 'ATTEMPT_RESULT':
      return { ...s, attempt: { attemptsLeft: msg.attemptsLeft, seq: (s.attempt?.seq ?? 0) + 1 }, myAnswer: null };
    case 'ANSWER_RESULT': {
      const mine = msg.results.find((r) => r.playerId === selfId);
      const ev = toEvent(msg, mine, s.round, selfId, mode);
      const mistakes = mine?.correct
        ? s.mistakes
        : [
            ...s.mistakes,
            {
              itemId: msg.learning.itemId,
              level: msg.learning.level,
              tags: [...msg.learning.vocabularyTags.map((t) => `v:${t}`), ...msg.learning.grammarTags.map((t) => `g:${t}`)],
              prompt: msg.prompt,
              ...(s.round?.question.context ? { context: s.round.question.context } : {}),
              yourAnswer: mine?.answerText ?? null,
              correctAnswer: msg.correctAnswer,
              explanation: msg.explanation,
              ...(mine?.feedback ? { feedback: mine.feedback } : {}),
              ...(msg.example ? { example: msg.example } : {}),
              ...(mine?.errorCategory ? { errorCategory: mine.errorCategory } : {}),
            },
          ];
      return {
        ...s,
        phase: 'reveal',
        result: msg,
        mistakes,
        learning: [...s.learning, ev],
        answered: s.answered + (mine?.answered ? 1 : 0),
        correct: s.correct + (mine?.correct ? 1 : 0),
      };
    }
    case 'COMBAT_EVENT':
      return { ...s, combat: { events: msg.events, seq: (s.combat?.seq ?? 0) + 1 } };
    case 'PLAYER_STATE':
      return { ...s, state: msg.state };
    case 'MATCH_END':
      return { ...s, phase: 'ended', end: msg };
    case 'MATCH_CANCELLED':
      return { ...s, phase: 'ended', cancelled: msg.reason };
    case 'QUICK_CHAT':
      return { ...s, chat: [...s.chat.slice(-4), { from: msg.from, phraseId: msg.phraseId, at: Date.now() }] };
    case 'REMATCH_STATE':
      return { ...s, rematch: msg };
    case 'ERROR':
      return { ...s, error: `${msg.code}: ${msg.message}` };
    default:
      return s;
  }
}

/** Subscribes to a match transport and exposes a reduced view + intent helpers. */
export function useMatch(transport: MatchTransport, onMessage?: (msg: ServerMessage, view: MatchView) => void) {
  const [view, dispatch] = useReducer(reducer, transport.players, initial);
  const viewRef = useRef(view);
  viewRef.current = view;
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  useEffect(() => {
    const unsub = transport.subscribe((msg) => {
      dispatch({ kind: 'msg', msg, selfId: transport.selfId, mode: transport.mode, toLocal: transport.toLocal });
      cbRef.current?.(msg, viewRef.current);
    });
    transport.start();
    return () => {
      unsub();
    };
  }, [transport]);

  const actions = useMemo(
    () => ({
      answerOption(optionId: string) {
        const r = viewRef.current.round;
        if (!r || viewRef.current.myAnswer) return;
        dispatch({ kind: 'answer', optionId });
        transport.send({ type: 'ANSWER_SUBMIT', matchId: transport.matchId, roundId: r.roundId, answer: { kind: 'option', optionId } });
      },
      answerTiles(tileIds: string[]) {
        const r = viewRef.current.round;
        if (!r) return;
        dispatch({ kind: 'answer', tileIds });
        transport.send({ type: 'ANSWER_SUBMIT', matchId: transport.matchId, roundId: r.roundId, answer: { kind: 'tiles', tileIds } });
      },
      useAbility(ability: 'shield' | 'surge' | 'focus') {
        transport.send({ type: 'ABILITY_USE', matchId: transport.matchId, ability });
      },
      leave() {
        transport.send({ type: 'MATCH_LEAVE', matchId: transport.matchId });
      },
      quickChat(phraseId: string) {
        transport.send({ type: 'QUICK_CHAT', matchId: transport.matchId, phraseId: phraseId as never });
      },
      rematch() {
        transport.send({ type: 'REMATCH_REQUEST', matchId: transport.matchId });
      },
    }),
    [transport],
  );
  return { view, actions };
}

