import { getContentPack, type ResourceId } from "@meteor/shared";
import type { DefenseConfig } from "@meteor/shared";
import type { GameState } from "@meteor/shared";

/**
 * [slice 2] Tactical-defense economy. `buildDefense(targetId)` spends a fixed
 * resource cost to add `defensePerBuild` strength to a target planet or system.
 * Content may supply a `defense` config on the pack (DefenseConfigSchema); when
 * absent these defaults apply so the slice-1 base stays green.
 */
export const DEFAULT_DEFENSE: DefenseConfig = {
  buildCost: { alloy: 10, energy: 10 },
  defensePerBuild: 5,
};

/** Resolve the defense config from content, falling back to {@link DEFAULT_DEFENSE}. */
export function defenseConfig(): DefenseConfig {
  return getContentPack().defense ?? DEFAULT_DEFENSE;
}

/** Whether the player can currently afford one buildDefense action. */
export function canAffordDefense(state: GameState): boolean {
  const cost = defenseConfig().buildCost;
  for (const [res, amount] of Object.entries(cost)) {
    if ((state.stockpiles[res as ResourceId] ?? 0) < (amount ?? 0)) return false;
  }
  return true;
}

/**
 * The defensive strength built up AT a target (used by tactical resolution).
 *  - a system: its own `system.defense`.
 *  - a planet: its own `planet.defense` PLUS its system's `system.defense`
 *    (system-level defenses umbrella the worlds inside them).
 * Returns 0 for unknown ids. Pure.
 */
export function localDefense(state: GameState, targetId: string): number {
  const system = state.systems[targetId];
  if (system) return system.defense ?? 0;
  const planet = state.planets[targetId];
  if (planet) {
    const parent = state.systems[planet.systemId];
    return (planet.defense ?? 0) + (parent?.defense ?? 0);
  }
  return 0;
}

/**
 * Apply one buildDefense action to `targetId` if affordable. Spends the cost and
 * adds `defensePerBuild` to the target's local defense. Mutates the (already-cloned)
 * state in place; returns true if it took effect. Unknown target / unaffordable → no-op.
 */
export function applyBuildDefense(state: GameState, targetId: string): boolean {
  const planet = state.planets[targetId];
  const system = state.systems[targetId];
  if (!planet && !system) return false;
  if (!canAffordDefense(state)) return false;

  const cfg = defenseConfig();
  for (const [res, amount] of Object.entries(cfg.buildCost)) {
    const r = res as ResourceId;
    state.stockpiles[r] = Math.max(0, (state.stockpiles[r] ?? 0) - (amount ?? 0));
  }
  if (planet) planet.defense = (planet.defense ?? 0) + cfg.defensePerBuild;
  else if (system) system.defense = (system.defense ?? 0) + cfg.defensePerBuild;
  return true;
}
