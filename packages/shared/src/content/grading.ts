import type { Bilingual, ContentItem, ErrorCategory, PublicQuestion } from './schema';
import { shuffle, type RandomFn } from '../random';

export const DEFAULT_TIME_LIMIT_SEC: Record<ContentItem['type'], number> = {
  'multiple-choice': 12,
  cloze: 12,
  'error-correction': 15,
  'sentence-build': 45,
};

/** Per-category time limits override type defaults (reading needs more time). */
const CATEGORY_TIME_LIMIT_SEC: Partial<Record<ContentItem['category'], number>> = {
  'reading-inference': 25,
};

export function timeLimitFor(item: ContentItem): number {
  return item.timeLimitSec ?? CATEGORY_TIME_LIMIT_SEC[item.category] ?? DEFAULT_TIME_LIMIT_SEC[item.type];
}

/** Normalises free text for lenient comparison (whitespace, quotes, trailing punctuation). */
export function normalizeText(text: string, caseSensitive = false): string {
  let t = text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
    .replace(/[.!?]+$/, '')
    .trim();
  if (!caseSensitive) t = t.toLowerCase();
  return t;
}

/** Splits a sentence into word/punctuation tokens. "Hi, Tom." -> ["hi", ",", "tom"] */
export function tokenize(sentence: string): string[] {
  const n = normalizeText(sentence);
  return n
    .replace(/([,;:])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean);
}

export interface AnswerKey {
  /** Correct option ids in the *round* id space (after shuffling). */
  correctOptionIds?: string[];
  /** Accepted token sequences for sentence building. */
  acceptedSequences?: string[][];
  /** Accepted normalised text answers. */
  acceptedTexts?: string[];
  caseSensitive?: boolean;
}

/** A question prepared for one round: public payload + server-side answer key. */
export interface RoundQuestion {
  item: ContentItem;
  question: PublicQuestion;
  key: AnswerKey;
  /** Maps round option id -> original content option id. */
  optionMap: Record<string, string>;
  /** Maps round tile id -> tile text. */
  tileMap: Record<string, string>;
}

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

/**
 * Prepares an item for delivery: shuffles options/tiles and assigns fresh ids so
 * the original content ids cannot be used to look up answers.
 */
export function prepareRoundQuestion(item: ContentItem, qid: string, random: RandomFn): RoundQuestion {
  const timeLimitSec = timeLimitFor(item);
  const optionMap: Record<string, string> = {};
  const tileMap: Record<string, string> = {};
  const question: PublicQuestion = {
    qid,
    type: item.type,
    category: item.category,
    level: item.level,
    prompt: item.prompt,
    timeLimitSec,
  };
  if (item.context) question.context = item.context;
  const key: AnswerKey = {};

  if (item.options && item.grading.mode === 'option') {
    const shuffled = shuffle(item.options, random);
    question.options = shuffled.map((o, i) => {
      const rid = OPTION_IDS[i] ?? `o${i}`;
      optionMap[rid] = o.id;
      return { id: rid, text: o.text };
    });
    key.correctOptionIds = Object.entries(optionMap)
      .filter(([, original]) => item.acceptedAnswers.includes(original))
      .map(([rid]) => rid);
  }
  if (item.tiles && item.grading.mode === 'token-sequence') {
    let shuffled = shuffle(item.tiles, random);
    // Avoid presenting an already-solved puzzle.
    const accepted = item.acceptedAnswers.map(tokenize);
    for (let attempt = 0; attempt < 5; attempt++) {
      const seq = tokenize(shuffled.join(' '));
      if (!accepted.some((a) => sameSequence(a, seq))) break;
      shuffled = shuffle(item.tiles, random);
    }
    question.tiles = shuffled.map((text, i) => {
      const tid = `t${i}`;
      tileMap[tid] = text;
      return { id: tid, text };
    });
    key.acceptedSequences = accepted;
  }
  if (item.grading.mode === 'normalized-text') {
    const caseSensitive = item.grading.caseSensitive;
    key.caseSensitive = caseSensitive;
    key.acceptedTexts = item.acceptedAnswers.map((a) => normalizeText(a, caseSensitive));
  }
  return { item, question, key, optionMap, tileMap };
}

function sameSequence(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

export type SubmittedAnswer =
  | { kind: 'option'; optionId: string }
  | { kind: 'tiles'; tileIds: string[] }
  | { kind: 'text'; text: string };

export interface GradeResult {
  correct: boolean;
  /** Error category of the chosen distractor, when known. */
  errorCategory?: ErrorCategory;
  /** Feedback specific to the player's wrong answer, when available. */
  feedback?: Bilingual;
  /** Human-readable version of what the player answered. */
  answerText: string;
}

/** Deterministically grades a submission against a prepared round question. */
export function gradeAnswer(rq: RoundQuestion, answer: SubmittedAnswer): GradeResult {
  const { item, key } = rq;
  if (answer.kind === 'option') {
    const original = rq.optionMap[answer.optionId];
    const option = item.options?.find((o) => o.id === original);
    const correct = !!key.correctOptionIds?.includes(answer.optionId);
    const res: GradeResult = { correct, answerText: option?.text ?? '' };
    if (!correct && option) {
      if (option.errorCategory) res.errorCategory = option.errorCategory;
      if (option.feedback) res.feedback = option.feedback;
    }
    return res;
  }
  if (answer.kind === 'tiles') {
    const unique = new Set(answer.tileIds);
    const allTiles = Object.keys(rq.tileMap);
    const words = answer.tileIds.map((id) => rq.tileMap[id]).filter((w): w is string => !!w);
    const answerText = words.join(' ');
    // Every tile must be used exactly once.
    if (unique.size !== answer.tileIds.length || words.length !== allTiles.length) {
      return { correct: false, answerText, errorCategory: 'word-order' };
    }
    const seq = tokenize(answerText);
    const correct = !!key.acceptedSequences?.some((a) => sameSequence(a, seq));
    const res: GradeResult = { correct, answerText };
    if (!correct) {
      const known = item.commonMistakes?.find((m) => sameSequence(tokenize(m.sequence), seq));
      if (known) {
        res.feedback = known.feedback;
        res.errorCategory = known.errorCategory;
      } else {
        res.errorCategory = 'word-order';
        const diag = diagnoseSentence(seq, key.acceptedSequences ?? []);
        if (diag) res.feedback = diag;
      }
    }
    return res;
  }
  const normalized = normalizeText(answer.text, key.caseSensitive);
  const correct = !!key.acceptedTexts?.includes(normalized);
  return { correct, answerText: answer.text };
}

/**
 * Generic structural diagnosis for a wrong sentence: finds the accepted
 * sentence that shares the longest correct prefix and reports where the order breaks.
 */
export function diagnoseSentence(seq: string[], accepted: string[][]): Bilingual | undefined {
  let best: { prefix: number; target: string[] } | undefined;
  for (const target of accepted) {
    let p = 0;
    while (p < seq.length && p < target.length && seq[p] === target[p]) p++;
    if (!best || p > best.prefix) best = { prefix: p, target };
  }
  if (!best) return undefined;
  const expected = best.target[best.prefix];
  if (expected === undefined) return undefined;
  if (best.prefix === 0) {
    return {
      en: `Check how the sentence begins. A correct version starts with "${expected}".`,
      he: `בדקו איך המשפט מתחיל. גרסה נכונה מתחילה ב-"${expected}".`,
    };
  }
  const before = best.target.slice(Math.max(0, best.prefix - 2), best.prefix).join(' ');
  return {
    en: `The order is correct up to "${before}". The next word should be "${expected}".`,
    he: `סדר המילים נכון עד "${before}". המילה הבאה צריכה להיות "${expected}".`,
  };
}

/** Returns the correct answer as readable text (for post-round reveal). */
export function correctAnswerText(rq: RoundQuestion): string {
  const { item } = rq;
  if (item.grading.mode === 'option') {
    return item.options?.filter((o) => item.acceptedAnswers.includes(o.id)).map((o) => o.text).join(' / ') ?? '';
  }
  return item.acceptedAnswers[0] ?? '';
}
