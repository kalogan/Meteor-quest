import type { GameState } from "@meteor/shared";
import { runEconomy } from "./systems/economy.js";
import { runResearch } from "./systems/research.js";
import { runFog } from "./systems/fog.js";
import { runThreats } from "./systems/threats.js";

/**
 * Advance the simulation by exactly ONE fixed tick. Pure + deterministic: the same
 * state always yields the same next state (clone in, never mutate the input). The
 * client owns the real-time loop and calls `tick` once per fixed timestep (scaled by
 * state.timeScale); tests call it directly.
 *
 * System order (each pure, operating on the cloned `state`):
 *   1. economy  — recompute rates, run mine→refine, accrue stockpiles.
 *   2. research — accrue points, complete tech, apply effects (range/sensors/tiers).
 *   3. fog      — reveal systems now within (possibly grown) sensor range.
 *   4. threats  — spawn/resolve seeded events; may cost territory + demote authority.
 */
export function tick(prev: GameState): GameState {
  const state: GameState = structuredClone(prev);
  state.tick += 1;
  runEconomy(state);
  runResearch(state);
  runFog(state);
  runThreats(state);
  return state;
}

/** Convenience: advance N ticks (used by tests + fast-forward). */
export function tickN(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = tick(s);
  return s;
}
