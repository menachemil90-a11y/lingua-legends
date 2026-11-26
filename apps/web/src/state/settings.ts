import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage, STORAGE_PREFIX } from './storage';

export type UiLanguage = 'he' | 'en';
export type ExplanationLanguage = 'he' | 'en' | 'both';

export interface SettingsState {
  language: UiLanguage;
  explanations: ExplanationLanguage;
  immersion: boolean;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  visualCues: boolean;
  serverUrl: string;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const defaultServer = (import.meta.env.VITE_MULTIPLAYER_URL as string | undefined) ?? 'http://localhost:2567';

function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** Hebrew is the default interface for the primary (Israeli) audience; English is one tap away. */
function defaultLanguage(): UiLanguage {
  return 'he';
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: defaultLanguage(),
      explanations: 'both',
      immersion: false,
      musicVolume: 0.35,
      sfxVolume: 0.7,
      muted: false,
      reducedMotion: prefersReducedMotion(),
      highContrast: false,
      visualCues: true,
      serverUrl: defaultServer,
      set: (patch) => set(patch),
    }),
    {
      name: `${STORAGE_PREFIX}settings`,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);

/** Effective UI language (immersion forces English). */
export function effectiveLanguage(s: Pick<SettingsState, 'language' | 'immersion'>): UiLanguage {
  return s.immersion ? 'en' : s.language;
}

export function effectiveExplanations(s: Pick<SettingsState, 'explanations' | 'immersion'>): ExplanationLanguage {
  return s.immersion ? 'en' : s.explanations;
}
