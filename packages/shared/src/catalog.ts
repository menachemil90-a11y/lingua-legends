/**
 * Original characters, vehicles and cosmetics. Cosmetics never affect gameplay.
 * Unlocks are deterministic (account level or achievements) — no purchases, no loot boxes.
 */

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  /** Palette used by the SVG art generator. */
  palette: { primary: string; secondary: string; accent: string; glow: string };
  unlock: Unlock;
}

export type Unlock =
  | { kind: 'default' }
  | { kind: 'level'; level: number }
  | { kind: 'achievement'; achievementId: string };

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'vexa',
    name: 'Vexa',
    title: 'Glyph Duelist',
    palette: { primary: '#1c3d7a', secondary: '#0d1b3d', accent: '#38e1ff', glow: '#7ff3ff' },
    unlock: { kind: 'default' },
  },
  {
    id: 'kael',
    name: 'Kael',
    title: 'Rune Warden',
    palette: { primary: '#2a3550', secondary: '#141b2e', accent: '#f5c451', glow: '#ffe7a3' },
    unlock: { kind: 'default' },
  },
  {
    id: 'nyra',
    name: 'Nyra',
    title: 'Storm Archer',
    palette: { primary: '#3b2370', secondary: '#1b1038', accent: '#b26bff', glow: '#e0c2ff' },
    unlock: { kind: 'level', level: 3 },
  },
  {
    id: 'torque',
    name: 'Torque',
    title: 'Clockwork Sentinel',
    palette: { primary: '#3a3f4f', secondary: '#1d2130', accent: '#ff8a3d', glow: '#ffc79e' },
    unlock: { kind: 'achievement', achievementId: 'first-victory' },
  },
];

export const BOT_CHARACTER_IDS = CHARACTERS.map((c) => c.id);

export interface VehicleDef {
  id: string;
  name: string;
  body: string;
  trim: string;
  flame: string;
  unlock: Unlock;
}

export const VEHICLES: VehicleDef[] = [
  { id: 'comet', name: 'Comet GT', body: '#1aa9d6', trim: '#0b2a4a', flame: '#7ff3ff', unlock: { kind: 'default' } },
  { id: 'viper', name: 'Viper X', body: '#8b4dff', trim: '#1b1038', flame: '#e0c2ff', unlock: { kind: 'default' } },
  { id: 'aurum', name: 'Aurum Royale', body: '#e0a92e', trim: '#3a2a08', flame: '#fff0b8', unlock: { kind: 'level', level: 4 } },
  { id: 'ember', name: 'Ember Nova', body: '#ff6b3d', trim: '#3a1408', flame: '#ffd29e', unlock: { kind: 'achievement', achievementId: 'race-winner' } },
];

export interface CosmeticDef {
  id: string;
  kind: 'title' | 'frame' | 'emote' | 'arena-theme' | 'victory-effect';
  name: string;
  unlock: Unlock;
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'title-newcomer', kind: 'title', name: 'Newcomer', unlock: { kind: 'default' } },
  { id: 'title-wordsmith', kind: 'title', name: 'Wordsmith', unlock: { kind: 'achievement', achievementId: 'words-25' } },
  { id: 'title-grammarian', kind: 'title', name: 'Grammar Ace', unlock: { kind: 'achievement', achievementId: 'race-winner' } },
  { id: 'title-architect', kind: 'title', name: 'Sentence Architect', unlock: { kind: 'achievement', achievementId: 'sentence-10' } },
  { id: 'title-scholar', kind: 'title', name: 'Scholar', unlock: { kind: 'achievement', achievementId: 'bagrut-first' } },
  { id: 'title-cup', kind: 'title', name: 'Cup Champion', unlock: { kind: 'achievement', achievementId: 'cup-champion' } },
  { id: 'title-tournament', kind: 'title', name: 'Tournament Champion', unlock: { kind: 'achievement', achievementId: 'tournament-champion' } },
  { id: 'title-lexicon', kind: 'title', name: 'Lexicon Keeper', unlock: { kind: 'achievement', achievementId: 'words-100' } },
  { id: 'title-syntax', kind: 'title', name: 'Syntax Sage', unlock: { kind: 'achievement', achievementId: 'grammar-5' } },
  { id: 'title-explorer', kind: 'title', name: 'World Explorer', unlock: { kind: 'achievement', achievementId: 'explorer-5' } },
  { id: 'title-steady', kind: 'title', name: 'Steady Learner', unlock: { kind: 'achievement', achievementId: 'days-7' } },
  { id: 'title-devoted', kind: 'title', name: 'Devoted Scholar', unlock: { kind: 'achievement', achievementId: 'days-30' } },
  { id: 'frame-azure', kind: 'frame', name: 'Azure Ring', unlock: { kind: 'default' } },
  { id: 'frame-gilded', kind: 'frame', name: 'Gilded Crest', unlock: { kind: 'level', level: 5 } },
  { id: 'frame-arcane', kind: 'frame', name: 'Arcane Halo', unlock: { kind: 'achievement', achievementId: 'combo-master' } },
  { id: 'frame-verdant', kind: 'frame', name: 'Verdant Ring', unlock: { kind: 'achievement', achievementId: 'words-50' } },
  { id: 'frame-runic', kind: 'frame', name: 'Runic Circle', unlock: { kind: 'achievement', achievementId: 'grammar-15' } },
  { id: 'frame-prism', kind: 'frame', name: 'Prism Halo', unlock: { kind: 'achievement', achievementId: 'explorer-8' } },
  { id: 'arena-skyforge', kind: 'arena-theme', name: 'Skyforge Arena', unlock: { kind: 'default' } },
  { id: 'arena-nightbloom', kind: 'arena-theme', name: 'Nightbloom Court', unlock: { kind: 'level', level: 6 } },
  { id: 'fx-starburst', kind: 'victory-effect', name: 'Starburst', unlock: { kind: 'default' } },
  { id: 'fx-aurora', kind: 'victory-effect', name: 'Aurora Cascade', unlock: { kind: 'achievement', achievementId: 'win-streak-3' } },
];

/** Predefined quick-chat phrases. Free-text chat between players is intentionally not supported. */
export const QUICK_CHAT_PHRASES = [
  { id: 'glhf', en: 'Good luck, have fun!', he: 'בהצלחה, תהנו!' },
  { id: 'nice', en: 'Nice one!', he: 'יפה מאוד!' },
  { id: 'wow', en: 'Wow!', he: 'וואו!' },
  { id: 'close', en: 'That was close!', he: 'היה קרוב!' },
  { id: 'gg', en: 'Good game!', he: 'משחק טוב!' },
  { id: 'thanks', en: 'Thanks!', he: 'תודה!' },
  { id: 'rematch', en: 'Rematch?', he: 'עוד סיבוב?' },
] as const;
export type QuickChatId = (typeof QUICK_CHAT_PHRASES)[number]['id'];
export const QUICK_CHAT_IDS = QUICK_CHAT_PHRASES.map((p) => p.id) as [QuickChatId, ...QuickChatId[]];

export function isUnlocked(
  unlock: Unlock,
  ctx: { level: number; achievements: ReadonlySet<string> },
): boolean {
  switch (unlock.kind) {
    case 'default':
      return true;
    case 'level':
      return ctx.level >= unlock.level;
    case 'achievement':
      return ctx.achievements.has(unlock.achievementId);
  }
}
