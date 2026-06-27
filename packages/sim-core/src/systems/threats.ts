import { type EventKind } from "@meteor/shared";
import type { ActiveEvent, GameState } from "@meteor/shared";
import { createRng } from "../rng.js";
import { territoryAllowsTier } from "./tiers.js";
import { localDefense } from "./defense.js";

/**
 * Threats — deterministic, seeded catastrophes + light skirmishes, resolved through
 * the same zoom (dive to tactical, then fortify/evacuate/ignore). This is a LIGHT
 * demonstration, not a combat sim.
 *
 * DETERMINISM: every roll is derived from (state.seed, state.tick) via a forked RNG
 * stream — never Math.random — so the same seed always produces the same event
 * timeline.
 *
 * SPAWN RATES (per tick, only AFTER the player has launched — pre-launch the cradle
 * is safe so the early game is calm):
 *   - pirateRaid : ~4%   (mild, frequent)
 *   - beast      : ~2.5% (mild)
 *   - meteor     : ~1.5% (dangerous — can destroy a planet)
 *   - supernova  : ~0.3% (rare, very dangerous)
 * At most ONE active event of a given kind, capped at 3 total, to keep it readable.
 */

export type EventResponse = "fortify" | "evacuate" | "ignore";

/**
 * sim-core-local view of an event: same JSON shape as the shared {@link ActiveEvent}
 * plus an optional `response` recorded by the reducer. Storing it on the event keeps
 * everything JSON-serializable and structuredClone-safe without touching the shared
 * contract (extra runtime properties are permitted; the shared type simply ignores
 * the field).
 */
export interface SimEvent extends ActiveEvent {
  response?: EventResponse;
}

/** Read the chosen response off an event (defaults to "ignore"). */
export function eventResponse(evt: ActiveEvent): EventResponse {
  return (evt as SimEvent).response ?? "ignore";
}

/** Record a response on an event (used by commands.respondToEvent). */
export function setEventResponse(evt: ActiveEvent, response: EventResponse): void {
  (evt as SimEvent).response = response;
  evt.mitigated = response !== "ignore";
}

/** Salts keeping each sub-roll's RNG stream independent within a tick. */
const SALT_SPAWN = 1001;
const SALT_TARGET = 1003;
const SALT_SEVERITY = 1004;

/** Base severity range per kind: [min, max). */
const SEVERITY_RANGE: Record<EventKind, [number, number]> = {
  pirateRaid: [1, 3],
  beast: [1, 2.5],
  meteor: [3, 6],
  supernova: [6, 10],
};

/** Ticks until an unmitigated event resolves (longer for bigger threats → time to react). */
const FUSE_TICKS: Record<EventKind, number> = {
  pirateRaid: 20,
  beast: 16,
  meteor: 40,
  supernova: 60,
};

/** Per-tick spawn chance per kind (only rolled post-launch). */
const SPAWN_CHANCE: Record<EventKind, number> = {
  pirateRaid: 0.04,
  beast: 0.025,
  meteor: 0.015,
  supernova: 0.003,
};

const MAX_ACTIVE_EVENTS = 3;

/**
 * Player DEFENSE — the value compared against an event's severity.
 *
 *   defense = 1                                   (baseline militia)
 *           + 0.5 × (unlocked tech count)         (tech = capability)
 *           + 1.0 × (settled planets)             (territory = standing forces)
 *           + 2.0 × (authority tier rank)         (higher command = coordination)
 *
 * It's an EMPIRE-WIDE figure (the slice is small; no per-planet garrisons). The
 * chosen response then modifies the effective defense/severity for THIS resolution.
 */
const TIER_RANK: Record<string, number> = { city: 0, continent: 1, planet: 2, system: 3, galaxy: 4 };

export function playerDefense(state: GameState): number {
  const techCount = state.research.unlocked.length;
  const settled = Object.values(state.planets).filter((p) => p.settled).length;
  const tierRankN = TIER_RANK[state.authorityTier] ?? 0;
  return 1 + 0.5 * techCount + 1.0 * settled + 2.0 * tierRankN;
}

/** Targets an event can threaten: settled planets + discovered systems. */
function candidateTargets(state: GameState): string[] {
  const planetIds = Object.values(state.planets)
    .filter((p) => p.settled)
    .map((p) => p.id);
  const systemIds = Object.values(state.systems)
    .filter((s) => s.discovered)
    .map((s) => s.id);
  return [...planetIds, ...systemIds];
}

function labelOf(kind: EventKind): string {
  switch (kind) {
    case "pirateRaid":
      return "Pirate raid";
    case "beast":
      return "Beast incursion";
    case "meteor":
      return "Meteor strike";
    case "supernova":
      return "Supernova";
  }
}

/** Is this kind capable of unsettling/destroying a planet on a loss? */
function isPlanetDestroyer(kind: EventKind): boolean {
  return kind === "meteor" || kind === "supernova";
}

/** Spawn at most one new event this tick (deterministic from seed+tick). */
export function maybeSpawnEvent(state: GameState): void {
  // Pre-launch cradle is safe: keeps the early game calm + early tests stable.
  if (!state.orbitalLaunched) return;
  if (state.events.length >= MAX_ACTIVE_EVENTS) return;

  const base = createRng((state.seed ^ Math.imul(state.tick + 1, 0x85ebca6b)) >>> 0);

  // Try kinds in priority order; spawn the first whose roll succeeds and which has
  // no live instance of that kind already (avoids stacking duplicates).
  const order: EventKind[] = ["pirateRaid", "beast", "meteor", "supernova"];
  for (let i = 0; i < order.length; i++) {
    const kind = order[i] as EventKind;
    if (state.events.some((e) => e.kind === kind)) continue;
    const roll = base.fork(SALT_SPAWN + i).next();
    if (roll >= SPAWN_CHANCE[kind]) continue;

    const targets = candidateTargets(state);
    if (targets.length === 0) return;
    const targetId = base.fork(SALT_TARGET + i).pick(targets);

    const [lo, hi] = SEVERITY_RANGE[kind];
    const severity = lo + base.fork(SALT_SEVERITY + i).next() * (hi - lo);

    const evt: SimEvent = {
      id: `evt-${kind}-${state.tick}`,
      kind,
      targetId,
      spawnedAtTick: state.tick,
      resolvesAtTick: state.tick + FUSE_TICKS[kind],
      severity,
      mitigated: false,
    };
    state.events.push(evt);
    state.log.push({
      tick: state.tick,
      message: `${labelOf(kind)} threatens ${targetId} (severity ${severity.toFixed(1)}).`,
    });
    return; // one spawn per tick.
  }
}

/**
 * Resolve every event whose fuse has elapsed. Outcome compares (modified) defense
 * against (modified) severity:
 *   - fortify : defense ×1.75 (commit defenses — the intended "win" play).
 *   - evacuate: severity ×0.5 AND, for planet-destroyers, the planet is SAVED from
 *               loss even on a defeat (you bleed resources, not territory).
 *   - ignore  : raw defense vs severity (gamble that the baseline holds).
 *
 * defense >= severity → repelled. Otherwise a planet-destroyer (meteor/supernova)
 * unsettles its target planet (territory loss) unless evacuated; lesser threats /
 * evacuated destroyers only drain resources. A territory loss can demote authority.
 */
export function resolveDueEvents(state: GameState): void {
  const due = state.events.filter((e) => e.resolvesAtTick <= state.tick);
  if (due.length === 0) return;

  const baseDefense = playerDefense(state);
  let territoryLost = false;

  for (const evt of due) {
    const response = eventResponse(evt);
    // Defending value at the target = empire baseline + the TARGET's LOCAL built
    // defense (planet.defense / system.defense, a planet inheriting its system's
    // defense). So investing defense on a frontier world actually repels threats
    // there. The response modifier then scales the combined total.
    let defense = baseDefense + localDefense(state, evt.targetId);
    let severity = evt.severity;
    let evacuated = false;

    if (response === "fortify") defense *= 1.75;
    else if (response === "evacuate") {
      severity *= 0.5;
      evacuated = true;
    }

    const repelled = defense >= severity;
    if (repelled) {
      state.log.push({
        tick: state.tick,
        message: `${labelOf(evt.kind)} at ${evt.targetId} repelled (defense ${defense.toFixed(1)} vs ${severity.toFixed(1)}).`,
      });
      continue;
    }

    if (isPlanetDestroyer(evt.kind) && !evacuated) {
      const planet = state.planets[evt.targetId];
      if (planet && planet.settled && planet.id !== state.cradlePlanetId) {
        planet.settled = false;
        territoryLost = true;
        state.log.push({ tick: state.tick, message: `${labelOf(evt.kind)} devastated ${planet.name}; the colony is lost.` });
        continue;
      }
      if (planet && planet.id === state.cradlePlanetId) {
        // The cradle endures (losing it would end the run); model as a heavy hit.
        const drain = Math.min(state.stockpiles.energy, severity * 5);
        state.stockpiles.energy = Math.max(0, state.stockpiles.energy - drain);
        state.log.push({ tick: state.tick, message: `${labelOf(evt.kind)} battered the cradle; reserves drained.` });
        continue;
      }
    }

    // Non-destroyer loss, or evacuated destroyer: resource damage only.
    const drain = Math.min(state.stockpiles.minerals, severity * 3);
    state.stockpiles.minerals = Math.max(0, state.stockpiles.minerals - drain);
    const note = evacuated ? "evacuated; colony saved but" : "unmitigated;";
    state.log.push({ tick: state.tick, message: `${labelOf(evt.kind)} at ${evt.targetId} ${note} ${drain.toFixed(0)} minerals lost.` });
  }

  const resolvedIds = new Set(due.map((e) => e.id));
  state.events = state.events.filter((e) => !resolvedIds.has(e.id));

  if (territoryLost) demoteIfUnsupported(state);
}

/**
 * After a territory loss, drop authority to the highest tier the (smaller) territory
 * still supports. reevaluateTierPromotion only promotes UP; this complements it by
 * contracting DOWN.
 */
export function demoteIfUnsupported(state: GameState): void {
  const ladder = ["galaxy", "system", "planet", "continent", "city"] as const;
  for (const tier of ladder) {
    if ((TIER_RANK[tier] ?? 0) > (TIER_RANK[state.authorityTier] ?? 0)) continue;
    if (territoryAllowsTier(state, tier)) {
      if (tier !== state.authorityTier) {
        state.authorityTier = tier;
        state.log.push({ tick: state.tick, message: `Authority contracted to ${tier} tier after territory loss.` });
      }
      return;
    }
  }
}

/** Tick entry point: spawn then resolve (new threats announced, due ones land). */
export function runThreats(state: GameState): void {
  maybeSpawnEvent(state);
  resolveDueEvents(state);
}
