import type { GameState } from "@meteor/shared";
import { maybeSpawnLurkerOnDiscover } from "./hostiles.js";

/**
 * Fog of war — sensor-tech scaled reveal. Run each tick: any system within the
 * player's current sensorRange (galaxy-space distance from home) becomes
 * `discovered`. Sensor range grows via tech (sensorRange effects), so progressing
 * research auto-reveals further systems over time — no command needed.
 *
 * Discovery only reveals that a system EXISTS (its blip). A planet's biome and
 * resources stay hidden (`scanned: false`) until the player actively scans it
 * (commands.scanPlanet), which is the second, deliberate layer of fog.
 */
export function runFog(state: GameState): void {
  for (const system of Object.values(state.systems)) {
    if (system.discovered) continue;
    if (system.distanceFromHome <= state.sensorRange) {
      system.discovered = true;
      state.log.push({ tick: state.tick, message: `Sensors detected ${system.name}.` });
      // [hostiles] a freshly-uncovered frontier system may already harbour a lurker (gated).
      maybeSpawnLurkerOnDiscover(state, system.id);
    }
  }
}

/** Whether `systemId` is currently within sensor range (pure predicate, no mutation). */
export function systemInSensorRange(state: GameState, systemId: string): boolean {
  const system = state.systems[systemId];
  if (!system) return false;
  return system.distanceFromHome <= state.sensorRange;
}
