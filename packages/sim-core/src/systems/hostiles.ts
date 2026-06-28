import type { GameState, HostileKind, Journey, ResourceId, RoamingHostile } from "@meteor/shared";
import { createRng, type Rng } from "../rng.js";
import { playerDefense } from "./threats.js";
import { localDefense } from "./defense.js";

/**
 * [hostiles] Space beasts & pirates — roaming threats tied to EXPLORATION + TRAVEL.
 *
 *   - LURKER:  when you uncover a frontier system (fog reveal), a beast/pirate may already be
 *     there, patrolling. It blocks settling that system until driven off.
 *   - AMBUSH:  an expedition in transit can be jumped mid-flight; the hostile pins it until you
 *     respond. A patrolling lurker can also intercept a passing expedition.
 *
 * Resolution reuses the existing defense math (playerDefense + localDefense vs threat) via the
 * `engageHostile` command: FIGHT (defense vs threat), FLEE (abort the pinned expedition), or
 * PAY-OFF (spend resources to pass). Threat scales with distance from home — the deep frontier
 * bites harder. Fully deterministic (seeded RNG, no Math.random/Date.now). Spawning is gated by
 * `state.hostilesEnabled`; `runHostiles` itself runs inert when there are no hostiles, so the
 * shipped game is unchanged until the flag is switched on.
 */

export const HOSTILES = {
  /** Patrol orbit radius around the haunted system (galaxy-space units). */
  patrolRadius: 14,
  /** Patrol angular speed (rad/tick) while not engaged. */
  roamRate: 0.06,
  /** A patrolling lurker pins an expedition that passes within this distance. */
  interceptRadius: 16,
  /** Ticks a lurker waits before wandering off if never engaged. */
  expireTicks: 140,
  /** Per-tick chance an enroute expedition is ambushed (gated by hostilesEnabled). */
  ambushChancePerTick: 0.02,
  /** Lurker spawn chance on a fresh discovery: base near home → more likely at the frontier. */
  lurkerChanceNear: 0.25,
  lurkerChanceFar: 0.8,
  /** Threat range, lerped by normalized distance from home. */
  threatMin: 1.0,
  threatMax: 6.0,
  /** Distance (galaxy units) treated as "deep frontier" (threat/chance saturate here). */
  frontierRef: 260,
  /** Minerals salvaged from a destroyed hostile. */
  salvage: 30,
  /** Resources lost when you lose a stand-up fight against a lurker. */
  fightLoss: { minerals: 25 } as Partial<Record<ResourceId, number>>,
  /** Cost to pay a hostile off (it withdraws and lets you pass). */
  payoff: { minerals: 40, alloy: 10 } as Partial<Record<ResourceId, number>>,
} as const;

const SALT_LURKER = 101;
const SALT_AMBUSH = 202;

/** FNV-1a hash of a string → uint, for deterministic per-entity RNG salting. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hostileRng(state: GameState, salt: number, idHash: number): Rng {
  const seed =
    (state.seed ^ Math.imul(state.tick + 1, 0x85ebca6b) ^ Math.imul(idHash + 1, 0x9e3779b1)) >>> 0;
  return createRng(seed).fork(salt);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function distNorm(distanceFromHome: number): number {
  return clamp01(distanceFromHome / HOSTILES.frontierRef);
}

function threatFor(distanceFromHome: number, rng: Rng): number {
  const t = distNorm(distanceFromHome);
  const base = HOSTILES.threatMin + (HOSTILES.threatMax - HOSTILES.threatMin) * t;
  const jitter = (rng.next() - 0.5) * 1.0; // ±0.5
  return Math.max(0.5, +(base + jitter).toFixed(2));
}

export function hostileLabel(kind: HostileKind): string {
  return kind === "beast" ? "space beast" : "pirate raider";
}

function patrolPos(
  center: { x: number; y: number; z: number },
  angle: number,
  radius: number,
): { x: number; y: number; z: number } {
  return { x: center.x + Math.cos(angle) * radius, y: center.y, z: center.z + Math.sin(angle) * radius };
}

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Effective defense brought to bear against a hostile (empire baseline + local system/planet). */
export function hostileDefense(state: GameState, hostile: RoamingHostile): number {
  return playerDefense(state) + localDefense(state, hostile.systemId);
}

/** Will a stand-up fight repel this hostile? (deterministic threshold — shown to the player). */
export function predictFight(state: GameState, hostile: RoamingHostile): boolean {
  return hostileDefense(state, hostile) >= hostile.threat;
}

export function canAffordPayoff(state: GameState): boolean {
  return Object.entries(HOSTILES.payoff).every(
    ([r, amt]) => (state.stockpiles[r as ResourceId] ?? 0) >= (amt ?? 0),
  );
}

/** Spawn a lurker patrolling `systemId` (no-op if the system already has an un-engaged lurker). */
export function spawnLurker(state: GameState, systemId: string): RoamingHostile | null {
  const system = state.systems[systemId];
  if (!system) return null;
  if (Object.values(state.hostiles).some((h) => h.systemId === systemId && h.engagedJourneyId === undefined)) {
    return null;
  }
  const rng = hostileRng(state, SALT_LURKER, hashStr(systemId));
  const kind: HostileKind = rng.fork(1).next() < 0.5 ? "pirate" : "beast";
  const patrolAngle = rng.fork(3).next() * Math.PI * 2;
  const hostile: RoamingHostile = {
    id: `hostile-${systemId}-${state.tick}`,
    kind,
    systemId,
    pos: patrolPos(system.position, patrolAngle, HOSTILES.patrolRadius),
    patrolAngle,
    patrolRadius: HOSTILES.patrolRadius,
    threat: threatFor(system.distanceFromHome, rng.fork(2)),
    discovered: true,
    expiresAtTick: state.tick + HOSTILES.expireTicks,
  };
  state.hostiles[hostile.id] = hostile;
  state.log.push({ tick: state.tick, message: `A ${hostileLabel(kind)} lurks near ${system.name}.` });
  return hostile;
}

/** Spawn an ambusher pinning `journey` at its current position. */
export function spawnAmbush(state: GameState, journey: Journey): RoamingHostile | null {
  const system = state.systems[journey.targetSystemId] ?? state.systems[journey.originSystemId];
  const rng = hostileRng(state, SALT_AMBUSH, hashStr(journey.id));
  const kind: HostileKind = rng.fork(1).next() < 0.55 ? "pirate" : "beast"; // pirates favour the lanes
  const distance = system?.distanceFromHome ?? state.maxRange;
  const hostile: RoamingHostile = {
    id: `hostile-ambush-${journey.id}-${state.tick}`,
    kind,
    systemId: journey.targetSystemId,
    pos: { ...journey.pos },
    patrolAngle: 0,
    patrolRadius: HOSTILES.patrolRadius,
    threat: threatFor(distance, rng.fork(2)),
    discovered: true,
    engagedJourneyId: journey.id,
    expiresAtTick: state.tick + HOSTILES.expireTicks,
  };
  state.hostiles[hostile.id] = hostile;
  state.log.push({ tick: state.tick, message: `A ${hostileLabel(kind)} ambushes the expedition!` });
  return hostile;
}

/** Hook for `runFog`: a freshly-discovered system may harbour a lurker (frontier-weighted). */
export function maybeSpawnLurkerOnDiscover(state: GameState, systemId: string): void {
  if (!state.hostilesEnabled) return;
  const system = state.systems[systemId];
  if (!system) return;
  const chance =
    HOSTILES.lurkerChanceNear +
    (HOSTILES.lurkerChanceFar - HOSTILES.lurkerChanceNear) * distNorm(system.distanceFromHome);
  const roll = hostileRng(state, SALT_LURKER, hashStr(`discover:${systemId}`)).next();
  if (roll < chance) spawnLurker(state, systemId);
}

/** Is some hostile currently pinning this expedition (so it can't advance)? */
export function isJourneyEngaged(state: GameState, journeyId: string): boolean {
  return Object.values(state.hostiles).some((h) => h.engagedJourneyId === journeyId);
}

/**
 * Per-tick hostiles update: patrol orbits advance, lurkers intercept passing expeditions,
 * enroute expeditions may be ambushed (gated), and un-engaged lurkers expire. Runs after
 * journeys in the engine tick. Inert when there are no hostiles.
 */
export function runHostiles(state: GameState): void {
  const hostiles = Object.values(state.hostiles);

  // 1. Patrol + expire.
  for (const h of hostiles) {
    if (h.engagedJourneyId !== undefined) continue; // pinned to a journey, doesn't roam
    if (state.tick >= h.expiresAtTick) {
      delete state.hostiles[h.id];
      state.log.push({ tick: state.tick, message: `The ${hostileLabel(h.kind)} moved on.` });
      continue;
    }
    const system = state.systems[h.systemId];
    if (system) {
      h.patrolAngle += HOSTILES.roamRate;
      h.pos = patrolPos(system.position, h.patrolAngle, h.patrolRadius);
    }
  }

  // 2. Intercept: a patrolling lurker pins an expedition that wanders within reach.
  for (const h of Object.values(state.hostiles)) {
    if (h.engagedJourneyId !== undefined) continue;
    for (const j of Object.values(state.journeys)) {
      if (j.status !== "enroute" || isJourneyEngaged(state, j.id)) continue;
      if (dist(h.pos, j.pos) <= HOSTILES.interceptRadius) {
        h.engagedJourneyId = j.id;
        state.log.push({ tick: state.tick, message: `A ${hostileLabel(h.kind)} intercepts the expedition!` });
        break;
      }
    }
  }

  // 3. Ambush spawns (gated): an enroute expedition can be jumped mid-flight.
  if (state.hostilesEnabled) {
    for (const j of Object.values(state.journeys)) {
      if (j.status !== "enroute" || isJourneyEngaged(state, j.id)) continue;
      const roll = hostileRng(state, SALT_AMBUSH, hashStr(`ambush:${j.id}`)).next();
      if (roll < HOSTILES.ambushChancePerTick) spawnAmbush(state, j);
    }
  }
}

/**
 * Resolve an encounter. FIGHT: defense vs threat (destroy + salvage on a win; lose the pinned
 * expedition, or resources for a lurker, on a loss). FLEE: abort the pinned expedition; the
 * hostile returns to patrol. PAY-OFF: spend resources → it withdraws and you pass. Mutates the
 * cloned state — call from the reducer.
 */
export function resolveEncounter(
  state: GameState,
  hostileId: string,
  response: "fight" | "flee" | "payoff",
): void {
  const h = state.hostiles[hostileId];
  if (!h) return;
  const label = hostileLabel(h.kind);
  const journey = h.engagedJourneyId !== undefined ? state.journeys[h.engagedJourneyId] : undefined;

  if (response === "fight") {
    if (predictFight(state, h)) {
      delete state.hostiles[hostileId];
      state.stockpiles.minerals = (state.stockpiles.minerals ?? 0) + HOSTILES.salvage;
      state.log.push({ tick: state.tick, message: `Destroyed the ${label} — salvaged ${HOSTILES.salvage} minerals.` });
    } else if (journey) {
      journey.status = "failed";
      delete state.hostiles[hostileId];
      state.log.push({ tick: state.tick, message: `The ${label} overwhelmed the expedition — lost.` });
    } else {
      for (const [r, amt] of Object.entries(HOSTILES.fightLoss)) {
        const res = r as ResourceId;
        state.stockpiles[res] = Math.max(0, (state.stockpiles[res] ?? 0) - (amt ?? 0));
      }
      state.log.push({ tick: state.tick, message: `The ${label} repelled your assault.` });
    }
    return;
  }

  if (response === "flee") {
    if (journey) {
      journey.status = "failed";
      h.engagedJourneyId = undefined; // it lets the fleeing ship go, returns to patrol
      state.log.push({ tick: state.tick, message: `Expedition fled the ${label} — recalled.` });
    } else {
      state.log.push({ tick: state.tick, message: `Backed off from the ${label}.` });
    }
    return;
  }

  // payoff
  if (canAffordPayoff(state)) {
    for (const [r, amt] of Object.entries(HOSTILES.payoff)) {
      const res = r as ResourceId;
      state.stockpiles[res] = Math.max(0, (state.stockpiles[res] ?? 0) - (amt ?? 0));
    }
    delete state.hostiles[hostileId];
    state.log.push({ tick: state.tick, message: `Paid off the ${label} — it withdrew.` });
  } else {
    state.log.push({ tick: state.tick, message: `Can't afford to pay off the ${label}.` });
  }
}
