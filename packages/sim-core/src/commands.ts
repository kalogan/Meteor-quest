import type { Command, GameState } from "@meteor/shared";
import { canResearch, reevaluateTierPromotion } from "./systems/research.js";

/**
 * Authoritative command reducer. Pure: clones state, applies one command, returns
 * the next state. The client dispatches these; it never mutates state directly.
 * MINIMAL scaffold — builder #3 deepens scan/travel/settle/events with fuel costs,
 * sensor-range checks, and proper colonization.
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
      if (planet && system?.discovered) {
        planet.scanned = true;
        state.log.push({ tick: state.tick, message: `Scanned ${planet.name}.` });
      }
      break;
    }
    case "travelToSystem": {
      const system = state.systems[cmd.systemId];
      if (system && state.orbitalLaunched && system.distanceFromHome <= state.maxRange) {
        system.discovered = true;
        state.log.push({ tick: state.tick, message: `Reached ${system.name}.` });
      }
      break;
    }
    case "settlePlanet": {
      const planet = state.planets[cmd.planetId];
      if (planet && planet.scanned && !planet.settled) {
        planet.settled = true;
        state.log.push({ tick: state.tick, message: `Settled ${planet.name}.` });
        reevaluateTierPromotion(state);
      }
      break;
    }
    case "respondToEvent": {
      const evt = state.events.find((e) => e.id === cmd.eventId);
      if (evt) evt.mitigated = true;
      break;
    }
  }
  return state;
}
