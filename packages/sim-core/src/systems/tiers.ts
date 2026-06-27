import type { GameState, TierId } from "@meteor/shared";

/**
 * Territory thresholds for authority promotion. A tier unlocks only when the player
 * has BOTH the enabling tech (research.ts) AND enough territory (here). Builder #3
 * may tune these numbers; keep them pure functions of state.
 */
export function territoryAllowsTier(state: GameState, tier: TierId): boolean {
  const settledPlanets = Object.values(state.planets).filter((p) => p.settled).length;
  const continents = Object.values(state.continents).length;
  const discoveredSystems = Object.values(state.systems).filter((s) => s.discovered).length;
  switch (tier) {
    case "city":
      return true;
    case "continent":
      return Object.values(state.cities).length >= 3;
    case "planet":
      return continents >= 2;
    case "system":
      return settledPlanets >= 2;
    case "galaxy":
      return discoveredSystems >= 3;
    default:
      return false;
  }
}
