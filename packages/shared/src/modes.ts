import type { GameModeId } from './content/schema';
import type { Skill } from './cefr';

export type ModeStatus = 'playable' | 'preview' | 'planned';

export interface ModeDef {
  id: GameModeId;
  name: string;
  tagline: string;
  status: ModeStatus;
  online: boolean;
  skills: Skill[];
  players: string;
  phase: number;
}

/** Single source of truth for which modes exist and how complete they are. */
export const MODES: ModeDef[] = [
  { id: 'word-battle', name: 'Word Battle', tagline: '1v1 arena duel powered by vocabulary', status: 'playable', online: true, skills: ['vocabulary', 'grammar', 'reading', 'inference'], players: '1v1', phase: 2 },
  { id: 'grammar-race', name: 'Grammar Race', tagline: 'Hover-racing fuelled by correct grammar', status: 'playable', online: true, skills: ['grammar'], players: '1–4', phase: 2 },
  { id: 'sentence-master', name: 'Sentence Master', tagline: 'Build flawless sentences under pressure', status: 'playable', online: true, skills: ['grammar', 'writing'], players: '1v1', phase: 2 },
  { id: 'real-life', name: 'Real Life', tagline: 'Text conversations in real-world scenes', status: 'preview', online: false, skills: ['reading', 'writing', 'fluency'], players: 'Solo', phase: 6 },
  { id: 'english-detective', name: 'English Detective', tagline: 'Read the evidence, crack the case', status: 'preview', online: false, skills: ['reading', 'inference'], players: 'Solo', phase: 5 },
  { id: 'escape-room', name: 'Escape Room', tagline: 'Language puzzles that unlock doors', status: 'planned', online: false, skills: ['reading', 'vocabulary'], players: 'Solo / Co-op', phase: 5 },
  { id: 'english-conquest', name: 'English Conquest', tagline: 'Strategy kingdoms built on knowledge', status: 'planned', online: false, skills: ['vocabulary', 'grammar', 'reading'], players: '2–4', phase: 5 },
  { id: 'debate-arena', name: 'Debate Arena', tagline: 'Argue, persuade, respond', status: 'planned', online: false, skills: ['writing', 'argumentation'], players: '1v1', phase: 6 },
];

export function modeDef(id: GameModeId): ModeDef {
  const m = MODES.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mode ${id}`);
  return m;
}
