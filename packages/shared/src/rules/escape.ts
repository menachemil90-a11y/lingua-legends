/**
 * Escape Room rules shared by the solo client and the co-op server host.
 * Puzzles are graded deterministically; content lives in @lingua/content.
 */
import { normalizeText } from '../content/grading';
import type { CefrLevel } from '../cefr';

export interface EscapePuzzleBase {
  id: string;
  /** Hotspot in the room scene that opens this puzzle. */
  object: 'note' | 'clock' | 'bookshelf' | 'desk' | 'telescope' | 'logbook' | 'chest' | 'door-panel' | 'map' | 'radio';
  title: string;
  /** The English material to read (sign, note, document). */
  text?: string;
  question: string;
  explanation: { en: string; he: string };
  hint: { en: string; he: string };
  vocabulary: string[];
}

export type EscapePuzzle =
  | (EscapePuzzleBase & { kind: 'choice'; options: string[]; answer: number })
  | (EscapePuzzleBase & { kind: 'text'; accepted: string[] })
  | (EscapePuzzleBase & { kind: 'order'; steps: string[] });

export interface EscapeRoom {
  id: string;
  title: string;
  titleHe: string;
  level: CefrLevel;
  theme: 'workshop' | 'observatory' | 'station' | 'archive';
  intro: string;
  introHe: string;
  /** Suggested time for the optional timed mode. */
  timedSeconds: number;
  puzzles: EscapePuzzle[];
  outro: string;
  outroHe: string;
}

export type EscapeAnswer = { kind: 'choice'; index: number } | { kind: 'text'; text: string } | { kind: 'order'; order: string[] };

export function checkEscapeAnswer(p: EscapePuzzle, a: EscapeAnswer): boolean {
  if (p.kind === 'choice' && a.kind === 'choice') return a.index === p.answer;
  if (p.kind === 'text' && a.kind === 'text') {
    const n = normalizeText(a.text).replace(/^(a|an|the)\s+/, '');
    return p.accepted.some((x) => normalizeText(x).replace(/^(a|an|the)\s+/, '') === n);
  }
  if (p.kind === 'order' && a.kind === 'order') return a.order.length === p.steps.length && a.order.every((s, i) => s === p.steps[i]);
  return false;
}

