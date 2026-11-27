import type { CefrLevel, ContentConsumer, ContentItemInput, ErrorCategory, QuestionCategory, Skill } from '@lingua/shared';

type Wrong = string | [text: string, en: string, he: string, category?: ErrorCategory];

export interface QuestionSpec {
  id: string;
  level: CefrLevel;
  cat: QuestionCategory;
  skill?: Skill;
  also?: Skill[];
  d: number;
  /** Prompt; "___" marks a gap. */
  p: string;
  ctx?: string;
  listen?: string;
  ans: string;
  wrong: Wrong[];
  en: string;
  he: string;
  example?: string;
  v?: string[];
  g?: string[];
  bagrut?: string[];
  modes?: ContentConsumer[];
  time?: number;
  type?: ContentItemInput['type'];
  passageId?: string;
  hint?: { en: string; he: string };
}

const SKILL_FOR: Record<QuestionCategory, Skill> = {
  vocabulary: 'vocabulary',
  synonym: 'vocabulary',
  antonym: 'vocabulary',
  'sentence-completion': 'grammar',
  'grammar-correction': 'grammar',
  'phrasal-verb': 'vocabulary',
  collocation: 'vocabulary',
  'contextual-vocabulary': 'vocabulary',
  connector: 'grammar',
  'reading-inference': 'reading',
  grammar: 'grammar',
  'sentence-building': 'grammar',
  listening: 'listening',
};

const GRAMMAR_CATS: QuestionCategory[] = ['sentence-completion', 'grammar-correction', 'grammar', 'connector'];

function defaultModes(cat: QuestionCategory): ContentConsumer[] {
  if (GRAMMAR_CATS.includes(cat)) return ['word-battle', 'grammar-race', 'practice', 'placement', 'adventure'];
  if (cat === 'reading-inference') return ['word-battle', 'practice', 'placement', 'adventure', 'english-detective'];
  if (cat === 'listening') return ['practice', 'bagrut', 'adventure'];
  return ['word-battle', 'practice', 'placement', 'adventure'];
}

const IDS = ['a', 'b', 'c', 'd', 'e'];

/** Compact authoring helper for option-graded questions. The first answer is correct. */
export function q(s: QuestionSpec): ContentItemInput {
  const options = [
    { id: 'a', text: s.ans },
    ...s.wrong.map((w, i) => {
      const id = IDS[i + 1]!;
      if (typeof w === 'string') return { id, text: w };
      const [text, en, he, category] = w;
      return { id, text, feedback: { en, he }, ...(category ? { errorCategory: category } : {}) };
    }),
  ];
  const skill = s.skill ?? SKILL_FOR[s.cat];
  return {
    id: s.id,
    version: 1,
    level: s.level,
    primarySkill: skill,
    secondarySkills: s.also ?? [],
    difficulty: s.d,
    type: s.type ?? (s.p.includes('___') ? 'cloze' : 'multiple-choice'),
    category: s.cat,
    prompt: s.p,
    ...(s.ctx ? { context: s.ctx } : {}),
    ...(s.listen ? { listen: s.listen } : {}),
    options,
    acceptedAnswers: ['a'],
    grading: { mode: 'option' },
    explanation: { en: s.en, he: s.he },
    ...(s.example ? { example: s.example } : {}),
    ...(s.hint ? { hint: s.hint } : {}),
    tags: { vocabulary: s.v ?? [], grammar: s.g ?? [], bagrut: s.bagrut ?? [] },
    modes: s.modes ?? defaultModes(s.cat),
    ...(s.time ? { timeLimitSec: s.time } : {}),
    ...(s.passageId ? { passageId: s.passageId } : {}),
    reviewStatus: 'ai-drafted',
  };
}

export interface SentenceSpec {
  id: string;
  level: CefrLevel;
  d: number;
  /** Instruction or meaning hint shown to the player. */
  p: string;
  /** Accepted sentences. The tiles are derived from the first one. */
  accept: string[];
  en: string;
  he: string;
  g?: string[];
  v?: string[];
  mistakes?: { seq: string; en: string; he: string; cat: ErrorCategory }[];
  time?: number;
}

/** Sentence-building item; tiles are the words (and commas) of the first accepted sentence. */
export function sb(s: SentenceSpec): ContentItemInput {
  const first = s.accept[0]!;
  const tiles = first
    .replace(/[.!?]$/, '')
    .replace(/,/g, ' ,')
    .split(/\s+/)
    .filter(Boolean);
  return {
    id: s.id,
    version: 1,
    level: s.level,
    primarySkill: 'grammar',
    secondarySkills: ['writing'],
    difficulty: s.d,
    type: 'sentence-build',
    category: 'sentence-building',
    prompt: s.p,
    tiles,
    acceptedAnswers: s.accept,
    grading: { mode: 'token-sequence' },
    explanation: { en: s.en, he: s.he },
    ...(s.mistakes
      ? { commonMistakes: s.mistakes.map((m) => ({ sequence: m.seq, feedback: { en: m.en, he: m.he }, errorCategory: m.cat })) }
      : {}),
    tags: { vocabulary: s.v ?? [], grammar: s.g ?? [], bagrut: [] },
    modes: ['sentence-master', 'practice', 'adventure'],
    ...(s.time ? { timeLimitSec: s.time } : {}),
    reviewStatus: 'ai-drafted',
  };
}
