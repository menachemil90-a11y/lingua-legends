/** Themed Word Battle question sets and the Adventure world map. */
import type { CefrLevel, QuestionCategory } from '@lingua/shared';

export interface WordBattleSet {
  id: string;
  name: string;
  nameHe: string;
  description: string;
  descriptionHe: string;
  levels: CefrLevel[];
  /** Explicit item ids (must exist in the public bank). */
  itemIds: string[];
}

export const WORD_BATTLE_SETS: WordBattleSet[] = [
  { id: 'set-first-steps', name: 'First Steps', nameHe: 'צעדים ראשונים', description: 'Core beginner words and grammar.', descriptionHe: 'מילים ודקדוק בסיסיים למתחילים.', levels: ['A1'], itemIds: ['a1-coffee', 'a1-family', 'a1-goes', 'a1-are-friends', 'a1-an-apple', 'a1-am-student', 'a1-tuesday', 'a1-pen', 'a1-umbrella', 'a1-there-are'] },
  { id: 'set-everyday', name: 'Everyday Words', nameHe: 'מילים יומיומיות', description: 'Words you need every day.', descriptionHe: 'מילים שצריך בכל יום.', levels: ['A1', 'A2'], itemIds: ['a1-umbrella', 'a1-pen', 'a2-ticket', 'a2-mechanic', 'a2-do-homework', 'a2-take-off', 'a1-tuesday', 'a1-coffee', 'a2-exhausted', 'a2-opp-cheap'] },
  { id: 'set-synonym-storm', name: 'Synonym Storm', nameHe: 'סערת מילים נרדפות', description: 'Find the word that means the same.', descriptionHe: 'מצאו את המילה בעלת אותה משמעות.', levels: ['A1', 'A2', 'B1', 'B2', 'C1'], itemIds: ['a1-syn-big', 'a2-exhausted', 'b1-syn-reliable', 'b2-syn-reluctant', 'c1-ubiquitous', 'b2-confirmed', 'b1-delayed', 'c1-convoluted', 'c1-undermined', 'c2-tactless'] },
  { id: 'set-opposites', name: 'Opposites Attack', nameHe: 'ההפכים תוקפים', description: 'Antonyms across levels.', descriptionHe: 'מילים הפוכות בכל הרמות.', levels: ['A1', 'A2', 'B1', 'B2'], itemIds: ['a1-opp-hot', 'a2-opp-cheap', 'b1-opp-increase', 'b2-opp-scarce', 'a1-syn-big', 'c2-play-down', 'c2-tactless', 'c1-convoluted', 'c2-turgid', 'b2-syn-reluctant'] },
  { id: 'set-connector-clash', name: 'Connector Clash', nameHe: 'קרב מילות קישור', description: 'Although, however, despite — master the links.', descriptionHe: 'although, however, despite — שלטו במילות הקישור.', levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], itemIds: ['a1-so-hungry', 'a2-because-rain', 'b1-although-cold', 'b1-however-hotel', 'b2-despite-traffic', 'b2-whereas', 'c1-nevertheless', 'c2-notwithstanding', 'race-c-although-tired', 'race-a-nonetheless'] },
  { id: 'set-phrasal-fury', name: 'Phrasal Fury', nameHe: 'זעם הפעלים המורכבים', description: 'Phrasal verbs in action.', descriptionHe: 'פעלים מורכבים בפעולה.', levels: ['A2', 'B1', 'B2', 'C1', 'C2'], itemIds: ['a2-take-off', 'b1-ran-out', 'b1-look-after', 'b2-put-off', 'b2-put-up-with', 'c1-came-up-with', 'c2-play-down', 'a2-do-homework', 'b1-make-decision', 'b2-put-effort'] },
  { id: 'set-collocations', name: 'Collocation Crossfire', nameHe: 'צירופים בקו האש', description: 'Words that belong together.', descriptionHe: 'מילים שהולכות יחד.', levels: ['A2', 'B1', 'B2', 'C1', 'C2'], itemIds: ['a2-do-homework', 'b1-make-decision', 'b2-impact', 'b2-put-effort', 'c1-raised-concerns', 'c2-fruition', 'c2-cast-doubt', 'a2-take-off', 'b2-put-off', 'c1-came-up-with'] },
  { id: 'set-grammar-guard', name: 'Grammar Guard', nameHe: 'משמר הדקדוק', description: 'Tenses, conditionals and the passive.', descriptionHe: 'זמנים, משפטי תנאי וסביל.', levels: ['B1', 'B2'], itemIds: ['b1-lived-since', 'b1-lost-yesterday', 'b1-will-cancel', 'b1-is-spoken', 'b1-if-had-time', 'b2-would-have-caught', 'b2-has-been-closed', 'b2-wish-knew', 'b2-had-started', 'b1-asked-where'] },
  { id: 'set-context-clues', name: 'Context Clues', nameHe: 'רמזים מההקשר', description: 'Read carefully, infer cleverly.', descriptionHe: 'קראו בעיון, הסיקו בחוכמה.', levels: ['A1', 'A2', 'B1', 'B2', 'C1'], itemIds: ['a1-pets', 'a2-maya-cafe', 'b1-daniel-raincoat', 'b2-factories', 'c1-temporary-tax', 'b1-delayed', 'b2-confirmed', 'c1-impasse', 'a1-umbrella', 'a2-ticket'] },
  { id: 'set-legends-gauntlet', name: "Legend's Gauntlet", nameHe: 'כפפת האגדה', description: 'C1–C2 challenges for the bold.', descriptionHe: 'אתגרי C1–C2 לאמיצים.', levels: ['C1', 'C2'], itemIds: ['c1-not-only-was-he', 'c1-rarely-have-i', 'c1-mixed-would-be', 'c1-impasse', 'c1-raised-concerns', 'c2-disingenuous', 'c2-should-you', 'c2-so-severe', 'c2-novel-review', 'c2-turgid'] },
];

export interface AdventureChapter {
  id: string;
  title: string;
  titleHe: string;
  mode: 'word-battle' | 'grammar-race' | 'sentence-master' | 'reading';
  levels: CefrLevel[];
  categories?: QuestionCategory[];
  setId?: string;
  passageId?: string;
  /** Boss chapters reuse material from earlier chapters in the region. */
  boss?: boolean;
  /** Accuracy needed for 1/2/3 stars. */
  stars: [number, number, number];
}

export interface AdventureRegion {
  id: string;
  name: string;
  nameHe: string;
  skill: string;
  skillHe: string;
  color: string;
  x: number;
  y: number;
  chapters: AdventureChapter[];
}

/**
 * Regions unlock in order, but every practice activity remains available from
 * Practice mode — progression never locks learning content.
 */
export const ADVENTURE_REGIONS: AdventureRegion[] = [
  {
    id: 'word-arena', name: 'Word Arena', nameHe: 'זירת המילים', skill: 'Vocabulary', skillHe: 'אוצר מילים', color: '#38e1ff', x: 18, y: 70,
    chapters: [
      { id: 'wa-1', title: 'Warm-up Duel', titleHe: 'דו-קרב חימום', mode: 'word-battle', levels: ['A1'], setId: 'set-first-steps', stars: [0.5, 0.7, 0.9] },
      { id: 'wa-2', title: 'Everyday Clash', titleHe: 'התנגשות יומיומית', mode: 'word-battle', levels: ['A1', 'A2'], setId: 'set-everyday', stars: [0.5, 0.7, 0.9] },
      { id: 'wa-boss', title: 'Boss: The Lexicon Golem', titleHe: 'בוס: גולם הלקסיקון', mode: 'word-battle', levels: ['A1', 'A2'], setId: 'set-opposites', boss: true, stars: [0.6, 0.75, 0.9] },
    ],
  },
  {
    id: 'grammar-circuit', name: 'Grammar Circuit', nameHe: 'מסלול הדקדוק', skill: 'Grammar', skillHe: 'דקדוק', color: '#f5c451', x: 38, y: 48,
    chapters: [
      { id: 'gc-1', title: 'Rookie Lap', titleHe: 'הקפת טירונים', mode: 'grammar-race', levels: ['A1', 'A2'], stars: [0.5, 0.7, 0.9] },
      { id: 'gc-2', title: 'Tense Turns', titleHe: 'פניות הזמנים', mode: 'grammar-race', levels: ['A2', 'B1'], stars: [0.5, 0.7, 0.9] },
      { id: 'gc-boss', title: 'Boss: The Conditional Cup', titleHe: 'בוס: גביע התנאים', mode: 'grammar-race', levels: ['B1', 'B2'], boss: true, stars: [0.6, 0.75, 0.9] },
    ],
  },
  {
    id: 'sentence-citadel', name: 'Sentence Citadel', nameHe: 'מצודת המשפטים', skill: 'Sentence building', skillHe: 'בניית משפטים', color: '#b26bff', x: 60, y: 62,
    chapters: [
      { id: 'sc-1', title: 'Foundation Stones', titleHe: 'אבני יסוד', mode: 'sentence-master', levels: ['A1', 'A2'], stars: [0.5, 0.7, 0.9] },
      { id: 'sc-2', title: 'Clause Towers', titleHe: 'מגדלי הפסוקיות', mode: 'sentence-master', levels: ['B1', 'B2'], stars: [0.5, 0.7, 0.9] },
      { id: 'sc-boss', title: 'Boss: The Inversion Keep', titleHe: 'בוס: מבצר ההיפוך', mode: 'sentence-master', levels: ['B2', 'C1', 'C2'], boss: true, stars: [0.6, 0.75, 0.9] },
    ],
  },
  {
    id: 'mystery-district', name: 'Mystery District', nameHe: 'רובע התעלומות', skill: 'Reading & inference', skillHe: 'קריאה והסקה', color: '#ff8a3d', x: 80, y: 40,
    chapters: [
      { id: 'md-1', title: 'The Night Market', titleHe: 'שוק הלילה', mode: 'reading', levels: ['A2'], passageId: 'p-night-market', stars: [0.34, 0.67, 1] },
      { id: 'md-2', title: 'Memory Files', titleHe: 'תיקי הזיכרון', mode: 'reading', levels: ['B1'], passageId: 'p-why-we-forget', stars: [0.34, 0.67, 1] },
      { id: 'md-boss', title: 'Boss: The Inference Engine', titleHe: 'בוס: מנוע ההסקה', mode: 'word-battle', levels: ['B1', 'B2', 'C1'], setId: 'set-context-clues', boss: true, stars: [0.6, 0.75, 0.9] },
    ],
  },
  {
    id: 'academic-summit', name: 'Academic Summit', nameHe: 'הפסגה האקדמית', skill: 'Advanced English', skillHe: 'אנגלית מתקדמת', color: '#7ff3ff', x: 56, y: 18,
    chapters: [
      { id: 'as-1', title: 'Connector Pass', titleHe: 'מעבר הקישורים', mode: 'word-battle', levels: ['B2', 'C1', 'C2'], setId: 'set-connector-clash', stars: [0.5, 0.7, 0.9] },
      { id: 'as-boss', title: "Boss: Legend's Gauntlet", titleHe: 'בוס: כפפת האגדה', mode: 'word-battle', levels: ['C1', 'C2'], setId: 'set-legends-gauntlet', boss: true, stars: [0.6, 0.75, 0.9] },
    ],
  },
];
