import { create } from 'zustand';
import type { Bracket, CefrLevel, GameModeId, OnlineModeId, PublicPlayer } from '@lingua/shared';
import type { BotTier } from '@lingua/shared';

export interface LocalMatchParams {
  kind: 'local';
  mode: OnlineModeId;
  levels: CefrLevel[];
  botTier: BotTier;
  setId?: string;
  /** Grammar Race: total racers including the player (2–4). */
  racers?: number;
  /** Adventure chapter that launched the match, if any. */
  chapterId?: string;
}

export interface OnlineMatchParams {
  kind: 'online';
  mode: OnlineModeId;
  matchId: string;
  players: PublicPlayer[];
  queue: 'ranked' | 'casual' | 'private';
}

export type Screen =
  | { id: 'lobby' }
  | { id: 'play'; mode?: GameModeId }
  | { id: 'match'; params: LocalMatchParams | OnlineMatchParams }
  | { id: 'sentence-practice'; levels?: CefrLevel[] }
  | { id: 'online'; mode: OnlineModeId; flow: 'queue' | 'room'; queue?: 'ranked' | 'casual'; bracket: Bracket; roomCode?: string }
  | { id: 'profile' }
  | { id: 'leaderboard' }
  | { id: 'friends' }
  | { id: 'settings' }
  | { id: 'customize' }
  | { id: 'placement' }
  | { id: 'practice'; focus?: 'review' | 'mix' }
  | { id: 'reading'; passageId: string; chapterId?: string }
  | { id: 'bagrut' }
  | { id: 'bagrut-task'; taskId: string }
  | { id: 'bagrut-mock'; examId: string }
  | { id: 'adventure' }
  | { id: 'real-life'; scenarioId?: string }
  | { id: 'detective'; caseId?: string }
  | { id: 'escape-room'; roomId?: string }
  | { id: 'conquest' }
  | { id: 'debate'; topicId?: string }
  | { id: 'mode-info'; mode: GameModeId };

interface NavState {
  stack: Screen[];
  current: Screen;
  go: (s: Screen) => void;
  replace: (s: Screen) => void;
  back: () => void;
  home: () => void;
}

export const useNav = create<NavState>((set, get) => ({
  stack: [],
  current: { id: 'lobby' },
  go: (s) => {
    set({ stack: [...get().stack, get().current], current: s });
    try {
      history.pushState({ depth: get().stack.length }, '');
    } catch {
      /* ignore */
    }
    window.scrollTo?.({ top: 0 });
  },
  replace: (s) => set({ current: s }),
  back: () => {
    const stack = get().stack;
    if (stack.length === 0) {
      set({ current: { id: 'lobby' } });
      return;
    }
    set({ current: stack[stack.length - 1]!, stack: stack.slice(0, -1) });
  },
  home: () => set({ stack: [], current: { id: 'lobby' } }),
}));

let popInstalled = false;
/** Browser/Android back button navigates within the game. */
export function installHistoryBridge(): void {
  if (popInstalled) return;
  popInstalled = true;
  try {
    history.replaceState({ depth: 0 }, '');
  } catch {
    /* ignore */
  }
  window.addEventListener('popstate', () => {
    const s = useNav.getState();
    if (s.current.id === 'match') {
      // Don't silently leave a running match; the match screen handles exit.
      try {
        history.pushState({ depth: s.stack.length }, '');
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent('ll:request-leave'));
      return;
    }
    s.back();
  });
}
