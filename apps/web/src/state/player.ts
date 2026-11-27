/**
 * Local player state (guest profile). Persisted on this device only.
 *
 * Security note: values here (XP, shards, local match history) are a *local*
 * convenience for offline play. They are never trusted by the server; online
 * ratings and rewards are computed server-side (see docs/ARCHITECTURE.md).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  CHARACTERS,
  COSMETICS,
  isUnlocked,
  levelFromXp,
  VEHICLES,
  type BotTier,
  type CefrLevel,
  type GameModeId,
  type OnlineModeId,
} from '@lingua/shared';
import {
  createLearnerProfile,
  masteredTags,
  recordEvent,
  type LearnerProfile,
  type LearningEvent,
} from '@lingua/learning';
import { safeStorage, STORAGE_PREFIX, uid } from './storage';

export interface MatchRecord {
  id: string;
  mode: GameModeId;
  at: number;
  online: boolean;
  queue: 'bot' | 'solo' | 'casual' | 'ranked' | 'private';
  opponent: { nickname: string; isBot: boolean; botTier?: string; characterId: string } | null;
  result: 'win' | 'loss' | 'draw' | 'complete';
  reason?: string;
  correct: number;
  incorrect: number;
  accuracy: number;
  bestCombo: number;
  xp: number;
  shards: number;
  ratingDelta?: number;
  position?: number;
}

export interface BagrutProgress {
  notes: Record<string, string>;
  checks: Record<string, number[]>;
  completed: string[];
  mockScores: Record<string, { score: number; total: number; at: number }>;
}

export interface Loadout {
  characterId: string;
  vehicleId: string;
  titleId: string;
  frameId: string;
  arenaId: string;
  effectId: string;
}

/** Offline Champion's Cup: three knockout rounds against labelled bots of rising strength. */
export interface CupRun {
  mode: OnlineModeId;
  levels: CefrLevel[];
  tiers: BotTier[];
  /** One entry per played match (a draw replays the same round). */
  results: ('win' | 'loss' | 'draw')[];
  startedAt: number;
}

export const CUP_ROUNDS = 3;

/** A finished debate practice (checklist counts only — never a grade). */
export interface DebateRecord {
  topicId: string;
  side: 'for' | 'against';
  at: number;
  met: number;
  total: number;
}

export function cupRound(run: CupRun): number {
  return run.results.filter((r) => r === 'win').length;
}
export function cupStatus(run: CupRun): 'playing' | 'champion' | 'out' {
  if (run.results.includes('loss')) return 'out';
  return cupRound(run) >= CUP_ROUNDS ? 'champion' : 'playing';
}

export interface PlayerState {
  playerId: string;
  nickname: string;
  createdAt: number;
  onboarded: boolean;
  xp: number;
  shards: number;
  loadout: Loadout;
  achievements: string[];
  matches: MatchRecord[];
  activeDays: string[];
  counters: { sentencesSolved: number; winStreak: number; bestCombo: number; reviewSessions: number };
  learner: LearnerProfile;
  bagrut: BagrutProgress;
  adventure: Record<string, number>;
  selectedMode: GameModeId;
  cup: CupRun | null;
  cupTitles: number;
  debates: DebateRecord[];
  recordDebate: (rec: Omit<DebateRecord, 'at'>) => void;
  startCup: (run: Omit<CupRun, 'results' | 'startedAt'>) => void;
  recordCupResult: (result: 'win' | 'loss' | 'draw') => string[];
  endCup: () => void;
  setNickname: (name: string) => void;
  setOnboarded: () => void;
  setSelfLevel: (level: CefrLevel) => void;
  setLearner: (learner: LearnerProfile) => void;
  recordLearning: (events: LearningEvent[]) => void;
  recordMatch: (record: Omit<MatchRecord, 'id' | 'at'>) => { levelBefore: number; levelAfter: number; unlocked: string[] };
  equip: (patch: Partial<Loadout>) => void;
  selectMode: (mode: GameModeId) => void;
  saveBagrut: (patch: Partial<BagrutProgress>) => void;
  completeBagrutTask: (id: string) => string[];
  setAdventureStars: (chapterId: string, stars: number) => void;
  incrementCounter: (key: keyof PlayerState['counters'], by?: number) => string[];
  unlockAchievement: (id: string) => boolean;
  reset: () => void;
}

export const ACHIEVEMENTS = [
  'first-victory',
  'race-winner',
  'sentence-10',
  'words-25',
  'combo-master',
  'win-streak-3',
  'bagrut-first',
  'placement',
  'reviewer',
  'cup-champion',
  'tournament-champion',
] as const;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const NICKS = ['Swift', 'Bright', 'Brave', 'Clever', 'Lucky', 'Rapid', 'Bold', 'Noble'];
const NOUNS = ['Falcon', 'Comet', 'Lynx', 'Phoenix', 'Otter', 'Raven', 'Tiger', 'Fox'];

function randomNickname(): string {
  const a = NICKS[Math.floor(Math.random() * NICKS.length)];
  const b = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${b}${Math.floor(Math.random() * 90 + 10)}`;
}

function initial(): Omit<PlayerState, keyof PlayerActions> {
  const playerId = uid('local_');
  return {
    playerId,
    nickname: randomNickname(),
    createdAt: Date.now(),
    onboarded: false,
    xp: 0,
    shards: 0,
    loadout: {
      characterId: 'vexa',
      vehicleId: 'comet',
      titleId: 'title-newcomer',
      frameId: 'frame-azure',
      arenaId: 'arena-skyforge',
      effectId: 'fx-starburst',
    },
    achievements: [],
    matches: [],
    activeDays: [],
    counters: { sentencesSolved: 0, winStreak: 0, bestCombo: 0, reviewSessions: 0 },
    learner: createLearnerProfile(playerId),
    bagrut: { notes: {}, checks: {}, completed: [], mockScores: {} },
    adventure: {},
    selectedMode: 'word-battle',
    cup: null,
    cupTitles: 0,
    debates: [],
  };
}

type PlayerActions = Pick<
  PlayerState,
  | 'setNickname'
  | 'setOnboarded'
  | 'setSelfLevel'
  | 'setLearner'
  | 'recordLearning'
  | 'recordMatch'
  | 'equip'
  | 'selectMode'
  | 'saveBagrut'
  | 'completeBagrutTask'
  | 'setAdventureStars'
  | 'incrementCounter'
  | 'unlockAchievement'
  | 'startCup'
  | 'recordCupResult'
  | 'endCup'
  | 'recordDebate'
  | 'reset'
>;

export function sanitizeNickname(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}_ -]/gu, '').trim().slice(0, 16) || randomNickname();
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => {
      const markActive = () => {
        const d = today();
        const days = get().activeDays;
        if (!days.includes(d)) set({ activeDays: [...days, d].slice(-60) });
      };
      const unlock = (ids: string[]): string[] => {
        const have = new Set(get().achievements);
        const fresh = ids.filter((id) => !have.has(id));
        if (fresh.length) set({ achievements: [...get().achievements, ...fresh] });
        return fresh;
      };
      return {
        ...initial(),
        setNickname: (name) => set({ nickname: sanitizeNickname(name) }),
        setOnboarded: () => set({ onboarded: true }),
        setSelfLevel: (level) => set({ learner: { ...get().learner, selfReportedLevel: level } }),
        setLearner: (learner) => {
          set({ learner });
          if (learner.placement) unlock(['placement']);
        },
        recordLearning: (events) => {
          if (events.length === 0) return;
          let learner = get().learner;
          for (const ev of events) learner = recordEvent(learner, { ...ev, playerId: get().playerId });
          set({ learner });
          markActive();
          if (masteredTags(learner, 'v:').length >= 25) unlock(['words-25']);
        },
        recordMatch: (rec) => {
          const before = levelFromXp(get().xp).level;
          const record: MatchRecord = { ...rec, id: uid('m_'), at: Date.now() };
          const counters = { ...get().counters };
          if (rec.result === 'win') counters.winStreak += 1;
          else if (rec.result === 'loss') counters.winStreak = 0;
          counters.bestCombo = Math.max(counters.bestCombo, rec.bestCombo);
          set({
            matches: [record, ...get().matches].slice(0, 120),
            xp: get().xp + rec.xp,
            shards: get().shards + rec.shards,
            counters,
          });
          markActive();
          const ids: string[] = [];
          if (rec.result === 'win') ids.push('first-victory');
          if (rec.result === 'win' && rec.mode === 'grammar-race') ids.push('race-winner');
          if (counters.winStreak >= 3) ids.push('win-streak-3');
          if (rec.bestCombo >= 6) ids.push('combo-master');
          const unlocked = unlock(ids);
          return { levelBefore: before, levelAfter: levelFromXp(get().xp).level, unlocked };
        },
        equip: (patch) => set({ loadout: { ...get().loadout, ...patch } }),
        selectMode: (mode) => set({ selectedMode: mode }),
        saveBagrut: (patch) => set({ bagrut: { ...get().bagrut, ...patch } }),
        completeBagrutTask: (id) => {
          const b = get().bagrut;
          if (!b.completed.includes(id)) set({ bagrut: { ...b, completed: [...b.completed, id] } });
          markActive();
          return unlock(['bagrut-first']);
        },
        setAdventureStars: (chapterId, stars) => {
          const prev = get().adventure[chapterId] ?? 0;
          if (stars > prev) set({ adventure: { ...get().adventure, [chapterId]: stars } });
        },
        incrementCounter: (key, by = 1) => {
          const counters = { ...get().counters, [key]: get().counters[key] + by };
          set({ counters });
          const ids: string[] = [];
          if (counters.sentencesSolved >= 10) ids.push('sentence-10');
          if (counters.reviewSessions >= 1) ids.push('reviewer');
          return unlock(ids);
        },
        unlockAchievement: (id) => unlock([id]).length > 0,
        startCup: (run) => set({ cup: { ...run, results: [], startedAt: Date.now() } }),
        recordCupResult: (result) => {
          const cup = get().cup;
          if (!cup || cupStatus(cup) !== 'playing') return [];
          const next = { ...cup, results: [...cup.results, result] };
          set({ cup: next });
          if (cupStatus(next) === 'champion') {
            // A small, fixed bonus for finishing the cup — earned only by playing.
            set({ cupTitles: get().cupTitles + 1, xp: get().xp + 50, shards: get().shards + 20 });
            return unlock(['cup-champion']);
          }
          return [];
        },
        endCup: () => set({ cup: null }),
        recordDebate: (rec) => set({ debates: [...get().debates, { ...rec, at: Date.now() }].slice(-40) }),
        reset: () => set({ ...initial() }),
      };
    },
    {
      name: `${STORAGE_PREFIX}player`,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => {
        const { learner, ...rest } = s;
        // Keep the persisted learning history bounded.
        return { ...rest, learner: { ...learner, history: learner.history.slice(-300) } } as unknown as PlayerState;
      },
    },
  ),
);

export function playerLevel(xp: number) {
  return levelFromXp(xp);
}

export function unlockContext(s: Pick<PlayerState, 'xp' | 'achievements'>) {
  return { level: levelFromXp(s.xp).level, achievements: new Set(s.achievements) };
}

export function unlockedCharacters(s: Pick<PlayerState, 'xp' | 'achievements'>) {
  const ctx = unlockContext(s);
  return CHARACTERS.filter((c) => isUnlocked(c.unlock, ctx)).map((c) => c.id);
}

export function unlockedVehicles(s: Pick<PlayerState, 'xp' | 'achievements'>) {
  const ctx = unlockContext(s);
  return VEHICLES.filter((v) => isUnlocked(v.unlock, ctx)).map((v) => v.id);
}

export function unlockedCosmetics(s: Pick<PlayerState, 'xp' | 'achievements'>) {
  const ctx = unlockContext(s);
  return COSMETICS.filter((c) => isUnlocked(c.unlock, ctx)).map((c) => c.id);
}

/** Days active in the current week (Sunday-first, as in Israel). Never decreases progress. */
export function weeklyMomentum(activeDays: string[], now = new Date()): boolean[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return activeDays.includes(key);
  });
}
