/**
 * English Conquest — turn-based strategy for 2–4 players.
 *
 * Knowledge fuels the economy (a correct answer each turn grants gold and a Focus token),
 * but territory, troop placement, forts and timing decide the war. Combat is fully
 * deterministic and previewable, so strategy — not luck — wins.
 * Pure functions: every action returns a new state; invalid actions return an error.
 */
import type { RandomFn } from '../random';

export interface Territory {
  id: string;
  name: string;
  x: number;
  y: number;
  neighbors: string[];
  /** Gold produced per turn for the owner. */
  yield: number;
}

export const CONQUEST_FACTIONS = [
  { id: 'azure', name: 'Azure Scribes', nameHe: 'סופרי התכלת', color: '#38e1ff' },
  { id: 'gilded', name: 'Gilded Wardens', nameHe: 'שומרי הזהב', color: '#f5c451' },
  { id: 'violet', name: 'Violet Loremasters', nameHe: 'חכמי הסגול', color: '#b26bff' },
  { id: 'ember', name: 'Ember Artisans', nameHe: 'אומני הגחלים', color: '#ff8a3d' },
] as const;
export type FactionId = (typeof CONQUEST_FACTIONS)[number]['id'];

const T = (id: string, name: string, x: number, y: number, yld: number, neighbors: string[]): Territory => ({ id, name, x, y, yield: yld, neighbors });

/** Original map: the Archipelago of Lexis. */
export const CONQUEST_MAP: Territory[] = [
  T('a0', 'Lexicon Peaks', 150, 120, 3, ['a1', 'b0']),
  T('a1', 'Syntax Shore', 385, 105, 1, ['a0', 'a2', 'b1']),
  T('a2', 'Verbal Vale', 615, 105, 1, ['a1', 'a3', 'b2']),
  T('a3', 'Idiom Isles', 850, 120, 3, ['a2', 'b3']),
  T('b0', 'Phonic Fen', 165, 315, 2, ['a0', 'b1', 'c0']),
  T('b1', 'Grammar Gate', 400, 300, 3, ['a1', 'b0', 'b2', 'c1']),
  T('b2', 'Clause Canyon', 600, 320, 3, ['a2', 'b1', 'b3', 'c2']),
  T('b3', 'Tense Tower', 835, 310, 2, ['a3', 'b2', 'c3']),
  T('c0', 'Fable Forest', 150, 505, 3, ['b0', 'c1']),
  T('c1', 'Prose Plains', 385, 520, 1, ['b1', 'c0', 'c2']),
  T('c2', 'Rhyme Reef', 615, 520, 1, ['b2', 'c1', 'c3']),
  T('c3', 'Accent Atoll', 850, 505, 3, ['b3', 'c2']),
];

const CAPITALS_BY_COUNT: Record<number, string[]> = {
  2: ['a0', 'c3'],
  3: ['a0', 'a3', 'c3'],
  4: ['a0', 'a3', 'c3', 'c0'],
};

export const CONQUEST = {
  startGold: 4,
  correctGold: 3,
  wrongGold: 0,
  focusMax: 2,
  focusPower: 2,
  recruitCost: 2,
  fortifyCost: 5,
  fortDefense: 2,
  actionsPerTurn: 3,
  maxRounds: 12,
  victoryTerritories: 8,
  capitalTroops: 3,
  neutralTroops: 2,
  centerNeutralTroops: 3,
} as const;

export interface ConquestPlayer {
  id: string;
  name: string;
  faction: FactionId;
  isBot: boolean;
  botTier?: string;
  gold: number;
  focus: number;
  alive: boolean;
  capital: string;
  correctAnswers: number;
  questionsAnswered: number;
}

export interface TerritoryState {
  owner: string | null;
  troops: number;
  fort: boolean;
}

export type ConquestAction =
  | { type: 'recruit'; at: string }
  | { type: 'fortify'; at: string }
  | { type: 'attack'; from: string; to: string; troops: number; useFocus: boolean }
  | { type: 'move'; from: string; to: string; troops: number }
  | { type: 'end' };

export interface LogEntry {
  round: number;
  playerId: string;
  text: string;
  kind: 'income' | 'answer' | 'recruit' | 'fortify' | 'capture' | 'repelled' | 'move' | 'eliminated' | 'victory';
}

export interface ConquestState {
  round: number;
  turn: number;
  phase: 'question' | 'actions' | 'ended';
  actionsLeft: number;
  players: ConquestPlayer[];
  territories: Record<string, TerritoryState>;
  log: LogEntry[];
  winnerId: string | null;
  endReason: 'domination' | 'elimination' | 'rounds' | null;
}

const neighborsOf = (id: string) => CONQUEST_MAP.find((t) => t.id === id)?.neighbors ?? [];
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function createConquest(players: { id: string; name: string; isBot: boolean; botTier?: string }[]): ConquestState {
  if (players.length < 2 || players.length > 4) throw new Error('Conquest needs 2–4 players');
  const capitals = CAPITALS_BY_COUNT[players.length]!;
  const territories: Record<string, TerritoryState> = {};
  for (const t of CONQUEST_MAP) {
    territories[t.id] = { owner: null, troops: t.id === 'b1' || t.id === 'b2' ? CONQUEST.centerNeutralTroops : CONQUEST.neutralTroops, fort: false };
  }
  const ps: ConquestPlayer[] = players.map((p, i) => {
    territories[capitals[i]!] = { owner: p.id, troops: CONQUEST.capitalTroops, fort: true };
    return {
      ...p,
      faction: CONQUEST_FACTIONS[i]!.id,
      gold: CONQUEST.startGold,
      focus: 0,
      alive: true,
      capital: capitals[i]!,
      correctAnswers: 0,
      questionsAnswered: 0,
    };
  });
  return startTurn({ round: 1, turn: 0, phase: 'question', actionsLeft: 0, players: ps, territories, log: [], winnerId: null, endReason: null });
}

export function currentPlayer(s: ConquestState): ConquestPlayer {
  return s.players[s.turn]!;
}

export function ownedBy(s: ConquestState, playerId: string): string[] {
  return Object.entries(s.territories)
    .filter(([, t]) => t.owner === playerId)
    .map(([id]) => id);
}

export function income(s: ConquestState, playerId: string): number {
  return ownedBy(s, playerId).reduce((sum, id) => sum + (CONQUEST_MAP.find((t) => t.id === id)?.yield ?? 0), 0);
}

/** Begins the current player's turn: collect income, then ask a question. */
export function startTurn(state: ConquestState): ConquestState {
  const s = clone(state);
  const p = currentPlayer(s);
  const gain = income(s, p.id);
  p.gold += gain;
  s.phase = 'question';
  s.actionsLeft = 0;
  s.log.push({ round: s.round, playerId: p.id, kind: 'income', text: `+${gain} gold` });
  return s;
}

export function answerQuestion(state: ConquestState, correct: boolean): ConquestState {
  if (state.phase !== 'question') return state;
  const s = clone(state);
  const p = currentPlayer(s);
  p.questionsAnswered++;
  if (correct) {
    p.correctAnswers++;
    p.gold += CONQUEST.correctGold;
    p.focus = Math.min(CONQUEST.focusMax, p.focus + 1);
  } else {
    p.gold += CONQUEST.wrongGold;
  }
  s.log.push({ round: s.round, playerId: p.id, kind: 'answer', text: correct ? `Correct: +${CONQUEST.correctGold} gold, +1 Focus` : 'Incorrect: no bonus' });
  s.phase = 'actions';
  s.actionsLeft = CONQUEST.actionsPerTurn;
  return s;
}

export interface AttackPreview {
  attackPower: number;
  defensePower: number;
  success: boolean;
  /** Troops that occupy the territory on success. */
  occupy: number;
  /** Attacking troops lost on failure. */
  losses: number;
}

export function previewAttack(s: ConquestState, from: string, to: string, troops: number, useFocus: boolean): AttackPreview {
  const def = s.territories[to]!;
  const p = currentPlayer(s);
  const attackPower = troops + (useFocus && p.focus > 0 ? CONQUEST.focusPower : 0);
  const defensePower = def.troops + (def.fort ? CONQUEST.fortDefense : 0);
  const success = attackPower > defensePower;
  return {
    attackPower,
    defensePower,
    success,
    occupy: Math.max(1, troops - Math.ceil(def.troops / 2)),
    losses: Math.ceil(troops / 2),
  };
}

export type ConquestResult = { ok: true; state: ConquestState } | { ok: false; error: string };

export function applyAction(state: ConquestState, action: ConquestAction): ConquestResult {
  if (state.phase !== 'actions') return { ok: false, error: 'Not in the action phase' };
  const s = clone(state);
  const p = currentPlayer(s);
  const own = (id: string) => s.territories[id]?.owner === p.id;
  if (action.type === 'end') return { ok: true, state: endTurn(s) };
  if (s.actionsLeft <= 0) return { ok: false, error: 'No actions left' };

  switch (action.type) {
    case 'recruit': {
      if (!own(action.at)) return { ok: false, error: 'You do not control that territory' };
      if (p.gold < CONQUEST.recruitCost) return { ok: false, error: 'Not enough gold' };
      p.gold -= CONQUEST.recruitCost;
      s.territories[action.at]!.troops++;
      s.log.push({ round: s.round, playerId: p.id, kind: 'recruit', text: `recruited at ${nameOf(action.at)}` });
      break;
    }
    case 'fortify': {
      if (!own(action.at)) return { ok: false, error: 'You do not control that territory' };
      if (s.territories[action.at]!.fort) return { ok: false, error: 'Already fortified' };
      if (p.gold < CONQUEST.fortifyCost) return { ok: false, error: 'Not enough gold' };
      p.gold -= CONQUEST.fortifyCost;
      s.territories[action.at]!.fort = true;
      s.log.push({ round: s.round, playerId: p.id, kind: 'fortify', text: `fortified ${nameOf(action.at)}` });
      break;
    }
    case 'move': {
      if (!own(action.from) || !own(action.to)) return { ok: false, error: 'Both territories must be yours' };
      if (!neighborsOf(action.from).includes(action.to)) return { ok: false, error: 'Territories are not adjacent' };
      const src = s.territories[action.from]!;
      if (action.troops < 1 || action.troops > src.troops - 1) return { ok: false, error: 'At least one troop must stay behind' };
      src.troops -= action.troops;
      s.territories[action.to]!.troops += action.troops;
      s.log.push({ round: s.round, playerId: p.id, kind: 'move', text: `moved ${action.troops} to ${nameOf(action.to)}` });
      break;
    }
    case 'attack': {
      if (!own(action.from)) return { ok: false, error: 'You do not control the attacking territory' };
      if (own(action.to)) return { ok: false, error: 'You already control that territory' };
      if (!neighborsOf(action.from).includes(action.to)) return { ok: false, error: 'Territories are not adjacent' };
      const src = s.territories[action.from]!;
      if (action.troops < 1 || action.troops > src.troops - 1) return { ok: false, error: 'At least one troop must stay behind' };
      const pv = previewAttack(s, action.from, action.to, action.troops, action.useFocus);
      if (action.useFocus && p.focus > 0) p.focus--;
      const def = s.territories[action.to]!;
      const defender = def.owner;
      src.troops -= action.troops;
      if (pv.success) {
        def.owner = p.id;
        def.troops = pv.occupy;
        s.log.push({ round: s.round, playerId: p.id, kind: 'capture', text: `captured ${nameOf(action.to)} (${pv.attackPower} vs ${pv.defensePower})` });
        if (defender) {
          const d = s.players.find((x) => x.id === defender)!;
          if (ownedBy(s, defender).length === 0) {
            d.alive = false;
            s.log.push({ round: s.round, playerId: defender, kind: 'eliminated', text: `${d.name} has been eliminated` });
          }
        }
      } else {
        src.troops += action.troops - pv.losses;
        def.troops = Math.max(1, def.troops - Math.floor(action.troops / 3));
        s.log.push({ round: s.round, playerId: p.id, kind: 'repelled', text: `was repelled at ${nameOf(action.to)} (${pv.attackPower} vs ${pv.defensePower})` });
      }
      break;
    }
  }
  s.actionsLeft--;
  const v = checkVictory(s);
  return { ok: true, state: v };
}

function nameOf(id: string): string {
  return CONQUEST_MAP.find((t) => t.id === id)?.name ?? id;
}

export function checkVictory(state: ConquestState): ConquestState {
  const s = state;
  const alive = s.players.filter((p) => p.alive);
  if (alive.length === 1) return finish(s, alive[0]!.id, 'elimination');
  for (const p of alive) {
    if (ownedBy(s, p.id).length >= CONQUEST.victoryTerritories) return finish(s, p.id, 'domination');
  }
  return s;
}

function finish(s: ConquestState, winnerId: string | null, reason: ConquestState['endReason']): ConquestState {
  s.phase = 'ended';
  s.winnerId = winnerId;
  s.endReason = reason;
  if (winnerId) s.log.push({ round: s.round, playerId: winnerId, kind: 'victory', text: 'wins the conquest' });
  return s;
}

/** Ends the turn and advances to the next living player (and the next round). */
export function endTurn(state: ConquestState): ConquestState {
  const s = clone(state);
  if (s.phase === 'ended') return s;
  let next = s.turn;
  do {
    next = (next + 1) % s.players.length;
    if (next === 0) s.round++;
  } while (!s.players[next]!.alive);
  s.turn = next;
  if (s.round > CONQUEST.maxRounds) {
    // Most territories wins; then total troops; otherwise a draw.
    const score = (id: string) => ownedBy(s, id).length * 1000 + ownedBy(s, id).reduce((a, t) => a + s.territories[t]!.troops, 0);
    const ranked = s.players.filter((p) => p.alive).sort((a, b) => score(b.id) - score(a.id));
    const top = ranked[0]!;
    const tie = ranked[1] && score(ranked[1].id) === score(top.id);
    s.round = CONQUEST.maxRounds;
    return finish(s, tie ? null : top.id, 'rounds');
  }
  return startTurn(s);
}

// ---------------------------------------------------------------------------
// Strategic bot
// ---------------------------------------------------------------------------

/** Chooses the bot's next action (call repeatedly until it returns `end`). */
export function botNextAction(s: ConquestState, random: RandomFn): ConquestAction {
  const p = currentPlayer(s);
  if (s.phase !== 'actions' || s.actionsLeft <= 0) return { type: 'end' };
  const mine = ownedBy(s, p.id);
  const threat = (id: string) =>
    neighborsOf(id)
      .map((n) => s.territories[n]!)
      .filter((t) => t.owner && t.owner !== p.id)
      .reduce((m, t) => Math.max(m, t.troops - 1), 0);

  // 1. Best profitable attack (guaranteed success).
  let best: { action: ConquestAction; score: number } | null = null;
  for (const from of mine) {
    const src = s.territories[from]!;
    if (src.troops < 2) continue;
    for (const to of neighborsOf(from)) {
      const tgt = s.territories[to]!;
      if (tgt.owner === p.id) continue;
      for (const useFocus of p.focus > 0 ? [false, true] : [false]) {
        for (let k = 1; k <= src.troops - 1; k++) {
          const pv = previewAttack(s, from, to, k, useFocus);
          if (!pv.success) continue;
          const terr = CONQUEST_MAP.find((t) => t.id === to)!;
          const leftBehind = src.troops - k;
          const exposure = Math.max(0, threat(from) - leftBehind);
          const score = terr.yield * 3 + (tgt.owner ? 4 : 0) + (to === s.players.find((x) => x.id === tgt.owner)?.capital ? 6 : 0) - k * 0.5 - (useFocus ? 1.5 : 0) - exposure * 2 + random() * 0.5;
          if (!best || score > best.score) best = { action: { type: 'attack', from, to, troops: k, useFocus }, score };
          break; // the smallest successful k for this option
        }
      }
    }
  }
  if (best && best.score > 0.5) return best.action;

  // 2. Fortify a threatened capital or high-yield border.
  const threatened = mine.filter((id) => threat(id) >= s.territories[id]!.troops + (s.territories[id]!.fort ? 2 : 0) - 1).sort((a, b) => threat(b) - threat(a));
  const fortTarget = threatened.find((id) => !s.territories[id]!.fort && (id === p.capital || (CONQUEST_MAP.find((t) => t.id === id)?.yield ?? 0) >= 3));
  if (fortTarget && p.gold >= CONQUEST.fortifyCost) return { type: 'fortify', at: fortTarget };

  // 3. Recruit on the most useful border.
  if (p.gold >= CONQUEST.recruitCost) {
    const borders = mine.filter((id) => neighborsOf(id).some((n) => s.territories[n]!.owner !== p.id));
    const target = (threatened[0] ?? borders.sort((a, b) => threat(b) - threat(a))[0] ?? mine[0])!;
    if (target) return { type: 'recruit', at: target };
  }

  // 4. Move idle interior troops to the front.
  for (const from of mine) {
    const src = s.territories[from]!;
    const interior = neighborsOf(from).every((n) => s.territories[n]!.owner === p.id);
    if (interior && src.troops > 1) {
      const to = neighborsOf(from).find((n) => neighborsOf(n).some((m) => s.territories[m]!.owner !== p.id));
      if (to) return { type: 'move', from, to, troops: src.troops - 1 };
    }
  }
  return { type: 'end' };
}
