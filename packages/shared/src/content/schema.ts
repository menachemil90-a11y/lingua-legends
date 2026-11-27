import { z } from 'zod';
import { CEFR_LEVELS, SKILLS } from '../cefr';

export const GAME_MODE_IDS = [
  'word-battle',
  'grammar-race',
  'sentence-master',
  'english-conquest',
  'english-detective',
  'escape-room',
  'debate-arena',
  'real-life',
] as const;
export type GameModeId = (typeof GAME_MODE_IDS)[number];

export const ONLINE_MODE_IDS = ['word-battle', 'grammar-race', 'sentence-master'] as const;
export type OnlineModeId = (typeof ONLINE_MODE_IDS)[number];

/** Modes that can draw items from the content bank (also practice + placement). */
export const CONTENT_CONSUMERS = [...GAME_MODE_IDS, 'practice', 'placement', 'bagrut', 'adventure'] as const;
export type ContentConsumer = (typeof CONTENT_CONSUMERS)[number];

export const QUESTION_TYPES = ['multiple-choice', 'cloze', 'sentence-build', 'error-correction'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_CATEGORIES = [
  'vocabulary',
  'synonym',
  'antonym',
  'sentence-completion',
  'grammar-correction',
  'phrasal-verb',
  'collocation',
  'contextual-vocabulary',
  'connector',
  'reading-inference',
  'grammar',
  'sentence-building',
  'listening',
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

/** Error categories used for mistake analysis. */
export const ERROR_CATEGORIES = [
  'subject-verb-agreement',
  'tense',
  'aspect',
  'word-order',
  'preposition',
  'article',
  'collocation',
  'word-meaning',
  'false-synonym',
  'opposite-meaning',
  'connector-logic',
  'phrasal-verb',
  'modal',
  'conditional',
  'passive',
  'relative-clause',
  'plural',
  'pronoun',
  'comparison',
  'inference',
  'register',
  'spelling',
  'other',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export const REVIEW_STATUSES = ['draft', 'ai-drafted', 'reviewed', 'approved'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const bilingualSchema = z.object({
  en: z.string().min(1),
  he: z.string().min(1),
});
export type Bilingual = z.infer<typeof bilingualSchema>;

export const optionSchema = z.object({
  id: z.string().min(1).max(8),
  text: z.string().min(1),
  /** Why this option is wrong (shown after a mistake). Not used for correct options. */
  feedback: bilingualSchema.optional(),
  errorCategory: z.enum(ERROR_CATEGORIES).optional(),
});
export type ContentOption = z.infer<typeof optionSchema>;

export const gradingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('option') }),
  z.object({
    mode: z.literal('normalized-text'),
    caseSensitive: z.boolean().default(false),
  }),
  z.object({ mode: z.literal('token-sequence') }),
]);
export type GradingRule = z.infer<typeof gradingSchema>;

export const contentItemSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase kebab-case'),
    version: z.number().int().min(1),
    level: z.enum(CEFR_LEVELS),
    primarySkill: z.enum(SKILLS),
    secondarySkills: z.array(z.enum(SKILLS)).default([]),
    /** Within-level difficulty, 1 (easiest) to 5 (hardest). */
    difficulty: z.number().int().min(1).max(5),
    type: z.enum(QUESTION_TYPES),
    category: z.enum(QUESTION_CATEGORIES),
    /** The instruction / question. Use "___" to mark a gap. */
    prompt: z.string().min(1),
    /** Optional passage or context shown above the prompt. */
    context: z.string().optional(),
    /** Listening items: script spoken aloud with text-to-speech (transcript shown after answering). */
    listen: z.string().optional(),
    options: z.array(optionSchema).optional(),
    /** Word tiles for sentence-building (canonical order is irrelevant; shuffled at runtime). */
    tiles: z.array(z.string().min(1)).optional(),
    /**
     * For `option` grading: ids of correct options (exactly one for single-answer items).
     * For `token-sequence`: every grammatically valid full sentence using all tiles.
     * For `normalized-text`: accepted written answers.
     */
    acceptedAnswers: z.array(z.string().min(1)).min(1),
    grading: gradingSchema,
    explanation: bilingualSchema,
    /** Optional example sentence illustrating the rule. */
    example: z.string().optional(),
    /** Optional hint (used in practice; reduces the review quality when used). */
    hint: bilingualSchema.optional(),
    /** Sentence-building: likely wrong orders and why they are wrong. */
    commonMistakes: z
      .array(
        z.object({
          sequence: z.string().min(1),
          feedback: bilingualSchema,
          errorCategory: z.enum(ERROR_CATEGORIES),
        }),
      )
      .optional(),
    tags: z.object({
      vocabulary: z.array(z.string()).default([]),
      grammar: z.array(z.string()).default([]),
      bagrut: z.array(z.string()).default([]),
    }),
    modes: z.array(z.enum(CONTENT_CONSUMERS)).min(1),
    timeLimitSec: z.number().int().min(5).max(180).optional(),
    reviewStatus: z.enum(REVIEW_STATUSES),
    /** Optional reference to a reading passage this item belongs to. */
    passageId: z.string().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.grading.mode === 'option') {
      if (!item.options || item.options.length < 2) {
        ctx.addIssue({ code: 'custom', message: `${item.id}: option-graded items need >= 2 options` });
        return;
      }
      const ids = new Set(item.options.map((o) => o.id));
      if (ids.size !== item.options.length) {
        ctx.addIssue({ code: 'custom', message: `${item.id}: duplicate option ids` });
      }
      for (const a of item.acceptedAnswers) {
        if (!ids.has(a)) ctx.addIssue({ code: 'custom', message: `${item.id}: accepted answer ${a} is not an option` });
      }
      const texts = new Set(item.options.map((o) => o.text.trim().toLowerCase()));
      if (texts.size !== item.options.length) {
        ctx.addIssue({ code: 'custom', message: `${item.id}: duplicate option texts` });
      }
    }
    if (item.grading.mode === 'token-sequence') {
      if (!item.tiles || item.tiles.length < 2) {
        ctx.addIssue({ code: 'custom', message: `${item.id}: token-sequence items need tiles` });
      }
    }
    if (item.type === 'cloze' && !item.prompt.includes('___')) {
      ctx.addIssue({ code: 'custom', message: `${item.id}: cloze prompt must contain ___` });
    }
  });

export type ContentItem = z.infer<typeof contentItemSchema>;
export type ContentItemInput = z.input<typeof contentItemSchema>;

export const readingPassageSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.number().int().min(1),
  level: z.enum(CEFR_LEVELS),
  title: z.string().min(1),
  /** Paragraphs of the original passage. */
  paragraphs: z.array(z.string().min(1)).min(1),
  genre: z.enum(['article', 'story', 'poem', 'opinion', 'report', 'dialogue', 'notice']),
  source: z.literal('original'),
  bagrut: z.array(z.string()).default([]),
  glossary: z.array(z.object({ term: z.string(), he: z.string() })).default([]),
  reviewStatus: z.enum(REVIEW_STATUSES),
});
export type ReadingPassage = z.infer<typeof readingPassageSchema>;
export type ReadingPassageInput = z.input<typeof readingPassageSchema>;

/**
 * The question as delivered to a player. Never contains the answer key,
 * explanations or option feedback.
 */
export const publicQuestionSchema = z.object({
  qid: z.string(),
  type: z.enum(QUESTION_TYPES),
  category: z.enum(QUESTION_CATEGORIES),
  level: z.enum(CEFR_LEVELS),
  prompt: z.string(),
  context: z.string().optional(),
  listen: z.string().optional(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  tiles: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  timeLimitSec: z.number(),
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;
