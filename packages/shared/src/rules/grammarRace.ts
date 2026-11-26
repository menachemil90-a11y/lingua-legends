/**
 * Grammar Race physics — pure and deterministic, shared by host and client renderer.
 *
 * Balance intent (see docs/GAME_DESIGN.md):
 *  - A correct answer adds a boost impulse that decays smoothly.
 *  - Three correct answers in a row trigger a short turbo.
 *  - A wrong answer wipes the accumulated boost and stalls the engine briefly,
 *    which costs more distance than one correct answer gains, so guessing fast loses.
 */

export const GRAMMAR_RACE = {
  trackLength: 1000,
  cruiseSpeed: 6,
  boostImpulse: 5,
  boostDecaySec: 4,
  maxBoost: 20,
  turboStreak: 3,
  turboBoost: 9,
  turboMs: 2_500,
  stallMs: 1_200,
  stallSpeed: 2,
  /** Pause after an answer before the next question appears. */
  feedbackMs: 650,
  countdownMs: 3_500,
  maxRaceMs: 150_000,
  /** After the first finisher, others get this long to finish. */
  finishGraceMs: 12_000,
  tickMs: 100,
  disconnectGraceMs: 30_000,
  questionMs: 12_000,
} as const;

export type GrammarRaceConfig = typeof GRAMMAR_RACE;

export interface RacerPhysics {
  distance: number;
  boost: number;
  turboUntil: number;
  stallUntil: number;
  streak: number;
  finishedAtMs: number | null;
}

export function newRacer(): RacerPhysics {
  return { distance: 0, boost: 0, turboUntil: 0, stallUntil: 0, streak: 0, finishedAtMs: null };
}

export function racerSpeed(r: RacerPhysics, now: number, cfg: GrammarRaceConfig = GRAMMAR_RACE): number {
  if (r.finishedAtMs !== null) return 0;
  if (now < r.stallUntil) return cfg.stallSpeed;
  return cfg.cruiseSpeed + r.boost + (now < r.turboUntil ? cfg.turboBoost : 0);
}

/** Integrates one step. `raceStart` is used to stamp finish times relative to the start. */
export function stepRacer(
  r: RacerPhysics,
  now: number,
  dtMs: number,
  raceStart: number,
  cfg: GrammarRaceConfig = GRAMMAR_RACE,
): void {
  if (r.finishedAtMs !== null) return;
  const dt = dtMs / 1000;
  const speed = racerSpeed(r, now, cfg);
  r.distance += speed * dt;
  r.boost *= Math.exp(-dt / cfg.boostDecaySec);
  if (r.boost < 0.01) r.boost = 0;
  if (r.distance >= cfg.trackLength) {
    // Interpolate the exact crossing moment within this step for fair ordering.
    const over = r.distance - cfg.trackLength;
    const backMs = speed > 0 ? (over / speed) * 1000 : 0;
    r.distance = cfg.trackLength;
    r.finishedAtMs = Math.max(0, Math.round(now + dtMs - backMs - raceStart));
  }
}

export function applyRaceAnswer(
  r: RacerPhysics,
  correct: boolean,
  now: number,
  cfg: GrammarRaceConfig = GRAMMAR_RACE,
): { turbo: boolean } {
  if (correct) {
    r.boost = Math.min(cfg.maxBoost, r.boost + cfg.boostImpulse);
    r.streak++;
    if (r.streak % cfg.turboStreak === 0) {
      r.turboUntil = now + cfg.turboMs;
      return { turbo: true };
    }
    return { turbo: false };
  }
  r.boost = 0;
  r.streak = 0;
  r.stallUntil = now + cfg.stallMs;
  return { turbo: false };
}

export function applyRaceTimeout(r: RacerPhysics): void {
  r.streak = 0;
}

/** Orders racers: finishers by time, then by distance. Returns ids in finishing order. */
export function racePositions(racers: { playerId: string; distance: number; finishedAtMs: number | null }[]): string[] {
  return racers
    .slice()
    .sort((x, y) => {
      if (x.finishedAtMs !== null && y.finishedAtMs !== null) return x.finishedAtMs - y.finishedAtMs;
      if (x.finishedAtMs !== null) return -1;
      if (y.finishedAtMs !== null) return 1;
      return y.distance - x.distance;
    })
    .map((r) => r.playerId);
}
