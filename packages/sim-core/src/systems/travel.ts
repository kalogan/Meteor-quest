import type { GameState } from "@meteor/shared";

/**
 * Travel — fuel/range constrained, ship-tier gated (God-view; no piloting). To
 * reach a system the player must have:
 *   1. launched to orbit (orbitalLaunch tech),
 *   2. enough ship RANGE to cover its distance from home, and
 *   3. enough FUEL stockpiled to pay the trip.
 *
 * Fuel cost scales with distance so the far neighbor costs more than a near one.
 */

/** Fuel consumed per galaxy-space unit travelled. */
export const FUEL_PER_DISTANCE = 0.2;

/** Fuel required to travel to `systemId` (round figure used by the UI + reducer). */
export function fuelCost(state: GameState, systemId: string): number {
  const system = state.systems[systemId];
  if (!system) return Infinity;
  return system.distanceFromHome * FUEL_PER_DISTANCE;
}

export type TravelBlock = "noSystem" | "notLaunched" | "outOfRange" | "notEnoughFuel" | null;

/** Why a travel command would be rejected (null = allowed). Pure predicate. */
export function travelBlocker(state: GameState, systemId: string): TravelBlock {
  const system = state.systems[systemId];
  if (!system) return "noSystem";
  if (!state.orbitalLaunched) return "notLaunched";
  if (system.distanceFromHome > state.maxRange) return "outOfRange";
  if ((state.stockpiles.fuel ?? 0) < fuelCost(state, systemId)) return "notEnoughFuel";
  return null;
}

/** Can the player travel to `systemId` right now? (range + fuel + launch gates). */
export function canTravel(state: GameState, systemId: string): boolean {
  return travelBlocker(state, systemId) === null;
}
