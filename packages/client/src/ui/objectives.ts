import { getContentPack, type GameState, type Objective } from "@meteor/shared";

/**
 * [objectives] Shared client-side derivation for the objectives UI. The sim owns
 * `game.objectives.{completed,won}` authoritatively (a parallel builder fills it each
 * tick); the UI only READS it. We deliberately do NOT depend on any sim-core objective
 * helper (they may not be exported), and derive the CURRENT objective ourselves:
 *
 *   current = the first authored objective whose id is NOT in `completed`.
 *
 * The authored chain is ordered, so "first not-yet-completed" is the live goal. When
 * every objective is complete (or there are none) there is no current objective.
 */

/** The authored objective chain (ordered), or [] when the pack has none. */
export function objectiveChain(): Objective[] {
  return getContentPack().objectives ?? [];
}

/** The first authored objective whose id is not yet completed, or null when all done. */
export function currentObjective(game: GameState): Objective | null {
  const completed = new Set(game.objectives.completed);
  for (const o of objectiveChain()) {
    if (!completed.has(o.id)) return o;
  }
  return null;
}

/** A couple of celebratory stats for the victory overlay, read straight off state. */
export interface VictoryStats {
  settledWorlds: number;
  discoveredSystems: number;
  techUnlocked: number;
}

export function victoryStats(game: GameState): VictoryStats {
  return {
    settledWorlds: Object.values(game.planets).filter((p) => p.settled).length,
    discoveredSystems: Object.values(game.systems).filter((s) => s.discovered).length,
    techUnlocked: game.research.unlocked.length,
  };
}
