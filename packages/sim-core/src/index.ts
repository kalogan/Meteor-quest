export { createRng, type Rng } from "./rng.js";
export { type Clock, TICK_SECONDS } from "./clock.js";
export { createInitialState, zeroResources, galaxyConfig, DEFAULT_GALAXY } from "./worldgen.js";
export { tick, tickN } from "./engine.js";
export { applyCommand } from "./commands.js";
export { canResearch, findTech, reevaluateTierPromotion } from "./systems/research.js";
export { categoryMultipliers, effectiveFocus } from "./systems/economy.js";
export { territoryAllowsTier } from "./systems/tiers.js";
export {
  defenseConfig,
  canAffordDefense,
  localDefense,
  applyBuildDefense,
  DEFAULT_DEFENSE,
} from "./systems/defense.js";
// ── Slice systems added by the engine deepening ────────────────────────────────
export { runFog, systemInSensorRange } from "./systems/fog.js";
export { canTravel, travelBlocker, fuelCost, FUEL_PER_DISTANCE, type TravelBlock } from "./systems/travel.js";
export {
  runJourneys,
  launch,
  steer,
  abort,
  launchBlocker,
  isReachableTarget,
  journeyFuelLoad,
  JOURNEY_SPEED,
  ARRIVE_RADIUS,
  AUTOPILOT_RATE,
  MAX_STEER_RATE,
  FUEL_MARGIN,
  type LaunchBlock,
} from "./systems/journeys.js";
export {
  runThreats,
  maybeSpawnEvent,
  resolveDueEvents,
  playerDefense,
  demoteIfUnsupported,
  eventResponse,
  setEventResponse,
  type SimEvent,
  type EventResponse,
} from "./systems/threats.js";
