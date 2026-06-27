import type { Command, GameState } from "@meteor/shared";
import { canResearch, reevaluateTierPromotion } from "./systems/research.js";
import { canTravel, fuelCost } from "./systems/travel.js";
import { systemInSensorRange } from "./systems/fog.js";
import { setEventResponse } from "./systems/threats.js";

/**
 * Authoritative command reducer. Pure: clones state, applies one command, returns
 * the next state. The client dispatches these; it never mutates state directly.
 *
 * The exploration commands enforce the slice's gating:
 *   - scanPlanet : the planet's system must be discovered AND in sensor range.
 *   - travelToSystem : orbital launch + ship range + enough fuel (fuel is spent).
 *   - settlePlanet : must be scanned, reachable, not already settled; grows territory
 *     (re-checks tier promotion — tech AND territory).
 *   - respondToEvent : records fortify/evacuate/ignore for the threat system.
 */
export function applyCommand(prev: GameState, cmd: Command): GameState {
  const state: GameState = structuredClone(prev);
  switch (cmd.type) {
    case "setTimeScale":
      state.timeScale = Math.max(0, Math.min(3, cmd.scale));
      break;
    case "setCityFocus": {
      const city = state.cities[cmd.cityId];
      if (city) city.focus = cmd.resource;
      break;
    }
    case "setContinentPolicy": {
      const cont = state.continents[cmd.continentId];
      if (cont) cont.policy = cmd.resource;
      break;
    }
    case "setPlanetPolicy": {
      const planet = state.planets[cmd.planetId];
      if (planet) planet.policy = cmd.resource;
      break;
    }
    case "startResearch":
      if (canResearch(state, cmd.techId)) {
        state.research.current = cmd.techId;
        state.research.progress = 0;
      }
      break;
    case "scanPlanet": {
      const planet = state.planets[cmd.planetId];
      const system = planet ? state.systems[planet.systemId] : undefined;
      // Scanning needs the system both discovered and currently in sensor range
      // (you can't resolve a planet's biome at the edge of an old detection).
      if (planet && !planet.scanned && system?.discovered && systemInSensorRange(state, system.id)) {
        planet.scanned = true;
        state.log.push({ tick: state.tick, message: `Scanned ${planet.name}.` });
      }
      break;
    }
    case "travelToSystem": {
      const system = state.systems[cmd.systemId];
      if (system && canTravel(state, cmd.systemId)) {
        const cost = fuelCost(state, cmd.systemId);
        state.stockpiles.fuel = Math.max(0, state.stockpiles.fuel - cost);
        if (!system.discovered) system.discovered = true;
        state.log.push({ tick: state.tick, message: `Reached ${system.name} (−${cost.toFixed(0)} fuel).` });
      }
      break;
    }
    case "settlePlanet": {
      const planet = state.planets[cmd.planetId];
      const system = planet ? state.systems[planet.systemId] : undefined;
      // Settle requires a scanned planet in a reachable system (orbital launch + range).
      const reachable =
        !!system &&
        (system.id === state.homeSystemId ||
          (state.orbitalLaunched && system.distanceFromHome <= state.maxRange));
      if (planet && planet.scanned && !planet.settled && reachable) {
        planet.settled = true;
        state.log.push({ tick: state.tick, message: `Settled ${planet.name}.` });
        reevaluateTierPromotion(state);
      }
      break;
    }
    case "respondToEvent": {
      const evt = state.events.find((e) => e.id === cmd.eventId);
      if (evt) {
        setEventResponse(evt, cmd.response);
        state.log.push({ tick: state.tick, message: `Response to ${evt.kind}: ${cmd.response}.` });
      }
      break;
    }
  }
  return state;
}
