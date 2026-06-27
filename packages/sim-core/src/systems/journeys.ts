import type { GameState, Journey } from "@meteor/shared";
import { FUEL_PER_DISTANCE } from "./travel.js";

/**
 * Journey — a VISIBLE real-time expedition between systems (God-view, watch-it-fly
 * with light steering; no piloting). Replaces the abstract "pay fuel → instantly
 * discovered" of travelToSystem with a ship that:
 *   - launches from the HOME system toward a reachable target with a tank of fuel,
 *   - flies itself there each tick (autopilot rotates the heading back toward the
 *     bearing-to-target so it self-homes), advancing pos += heading * speed,
 *   - burns fuel proportional to distance covered (speed * FUEL_PER_DISTANCE),
 *   - can be LIGHTLY nudged by the player (steerJourney, turn ∈ [-1,1]) — enough to
 *     weave/detour (which costs extra fuel/time), not enough to override autopilot,
 *   - on ARRIVAL discovers the target system and hands off to scan/settle,
 *   - on FUEL-OUT before arrival is stranded (status "failed").
 *
 * Pure + deterministic: motion is plain vector math; the only nondeterminism allowed
 * (steering) arrives as commands in the tick stream, never randomness.
 */

// ── Tunable constants (Director taste lives here) ──────────────────────────────
/** Galaxy units travelled per tick. ~speed: the slice neighbor (~92 units) takes
 * ~23 ticks straight — within the intended 15–40 tick feel. */
export const JOURNEY_SPEED = 4;
/** How close (galaxy units) to the target pos counts as ARRIVED. Slightly above
 * speed so a straight run lands instead of orbiting the target by a step. */
export const ARRIVE_RADIUS = 6;
/** Max radians the autopilot rotates the heading toward the bearing each tick. Kept
 * BELOW MAX_STEER_RATE so a fresh nudge isn't instantly erased — the ship visibly
 * weaves for a few ticks — yet autopilot still converges back to a straight line once
 * the player stops steering (and a never-steered launch heading stays exact). */
export const AUTOPILOT_RATE = 0.15;
/** Max radians a single full-deflection steer command (turn = ±1) rotates heading,
 * in the galaxy plane (xy). Deliberately "light", but above AUTOPILOT_RATE so a hard
 * sustained steer can build a real detour (more distance → more fuel/time). */
export const MAX_STEER_RATE = 0.25;
/** Multiplier on fuelCost(distance) loaded into the tank at launch. The straight run
 * burns ~1/margin of this; the rest is detour/steer headroom so a heavily-steered
 * path can still run dry. */
export const FUEL_MARGIN = 1.5;

type Vec3 = { x: number; y: number; z: number };

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** Unit vector toward `b` from `a`; falls back to +x if they coincide. */
function unit(v: Vec3): Vec3 {
  const len = length(v);
  if (len === 0) return { x: 1, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Rotate `from` toward `to` (both treated as directions) by at most `maxRad`
 * radians, preserving `from`'s magnitude. Uses the angle between them; if already
 * within `maxRad` it snaps to `to`'s direction. Operates in 3D via spherical-ish
 * slerp toward the target direction.
 */
function rotateToward(from: Vec3, to: Vec3, maxRad: number): Vec3 {
  const f = unit(from);
  const t = unit(to);
  const dot = Math.max(-1, Math.min(1, f.x * t.x + f.y * t.y + f.z * t.z));
  const angle = Math.acos(dot);
  if (angle <= 1e-6) return f;
  const step = Math.min(maxRad, angle);
  // Slerp from f toward t by `step` radians.
  const sinAngle = Math.sin(angle);
  if (sinAngle < 1e-6) return t; // antiparallel/parallel — just take the target dir
  const a = Math.sin(angle - step) / sinAngle;
  const b = Math.sin(step) / sinAngle;
  return unit({
    x: a * f.x + b * t.x,
    y: a * f.y + b * t.y,
    z: a * f.z + b * t.z,
  });
}

/** Reachable = orbital-launched AND target distinct from home AND within ship range. */
export function isReachableTarget(state: GameState, targetSystemId: string): boolean {
  const target = state.systems[targetSystemId];
  if (!target) return false;
  if (targetSystemId === state.homeSystemId) return false;
  if (!state.orbitalLaunched) return false;
  return target.distanceFromHome <= state.maxRange;
}

/** Fuel loaded into a journey's tank for a hop to `targetSystemId`. */
export function journeyFuelLoad(state: GameState, targetSystemId: string): number {
  const target = state.systems[targetSystemId];
  if (!target) return 0;
  const home = state.systems[state.homeSystemId];
  const origin = home?.position ?? { x: 0, y: 0, z: 0 };
  const distance = length(sub(target.position, origin));
  return distance * FUEL_PER_DISTANCE * FUEL_MARGIN;
}

export type LaunchBlock =
  | "noTarget"
  | "isHome"
  | "notLaunched"
  | "outOfRange"
  | "notEnoughFuel"
  | "alreadyEnroute"
  | null;

/** Why a launch would be rejected (null = allowed). Pure predicate. */
export function launchBlocker(state: GameState, targetSystemId: string): LaunchBlock {
  const target = state.systems[targetSystemId];
  if (!target) return "noTarget";
  if (targetSystemId === state.homeSystemId) return "isHome";
  if (!state.orbitalLaunched) return "notLaunched";
  if (target.distanceFromHome > state.maxRange) return "outOfRange";
  const load = journeyFuelLoad(state, targetSystemId);
  if ((state.stockpiles.fuel ?? 0) < load) return "notEnoughFuel";
  if (Object.values(state.journeys).some(
    (j) => j.status === "enroute" && j.targetSystemId === targetSystemId,
  )) {
    return "alreadyEnroute";
  }
  return null;
}

/**
 * Launch an expedition from the home system toward `targetSystemId`. Deducts the
 * fuel load from the stockpile (the ship carries its tank) and adds a Journey to
 * state.journeys. No-op + log if unreachable/unaffordable or one is already enroute.
 * Mutates the (already-cloned) state — call from the reducer.
 */
export function launch(state: GameState, targetSystemId: string): Journey | null {
  const block = launchBlocker(state, targetSystemId);
  const target = state.systems[targetSystemId];
  if (block !== null || !target) {
    const name = target?.name ?? targetSystemId;
    state.log.push({ tick: state.tick, message: `Launch to ${name} rejected (${block}).` });
    return null;
  }
  const home = state.systems[state.homeSystemId];
  const origin = home?.position ?? { x: 0, y: 0, z: 0 };
  const load = journeyFuelLoad(state, targetSystemId);
  state.stockpiles.fuel = Math.max(0, (state.stockpiles.fuel ?? 0) - load);

  const heading = unit(sub(target.position, origin));
  const journey: Journey = {
    id: `journey-${targetSystemId}-${state.tick}`,
    originSystemId: state.homeSystemId,
    targetSystemId,
    pos: { ...origin },
    heading,
    speed: JOURNEY_SPEED,
    fuel: load,
    status: "enroute",
  };
  state.journeys[journey.id] = journey;
  state.log.push({
    tick: state.tick,
    message: `Expedition launched toward ${target.name} (−${load.toFixed(0)} fuel).`,
  });
  return journey;
}

/**
 * Light steering: rotate the heading by `turn * MAX_STEER_RATE` radians in the
 * galaxy plane (xy). `turn` clamps to [-1, 1]. The autopilot (stronger rate) pulls
 * back toward target each tick, so steering mainly costs fuel/time. Mutates `journey`.
 */
export function steer(journey: Journey, turn: number): void {
  if (journey.status !== "enroute") return;
  const t = Math.max(-1, Math.min(1, turn));
  const angle = t * MAX_STEER_RATE;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { x, y, z } = journey.heading;
  // Rotate about the z axis (galaxy plane is xy here); keep it a unit vector.
  journey.heading = unit({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
    z,
  });
}

/**
 * Advance every enroute journey one tick: autopilot self-correct → move → burn fuel →
 * resolve arrival/fuel-out. Arrivals discover the target system and are removed
 * (hand-off to scan/settle); strandings are removed too. Mutates the cloned state —
 * call from the engine tick after fog/economy.
 */
export function runJourneys(state: GameState): void {
  for (const journey of Object.values(state.journeys)) {
    if (journey.status !== "enroute") {
      delete state.journeys[journey.id];
      continue;
    }
    const target = state.systems[journey.targetSystemId];
    if (!target) {
      journey.status = "failed";
      delete state.journeys[journey.id];
      continue;
    }

    // AUTOPILOT: rotate heading toward the current bearing-to-target.
    const toTarget = sub(target.position, journey.pos);
    journey.heading = rotateToward(journey.heading, toTarget, AUTOPILOT_RATE);

    // MOVE.
    journey.pos = {
      x: journey.pos.x + journey.heading.x * journey.speed,
      y: journey.pos.y + journey.heading.y * journey.speed,
      z: journey.pos.z + journey.heading.z * journey.speed,
    };

    // BURN fuel for the distance covered this tick.
    journey.fuel -= journey.speed * FUEL_PER_DISTANCE;

    // ARRIVAL: within the arrive-radius of the target.
    const remaining = length(sub(target.position, journey.pos));
    if (remaining <= ARRIVE_RADIUS) {
      journey.status = "arrived";
      if (!target.discovered) target.discovered = true;
      state.log.push({ tick: state.tick, message: `Expedition arrived at ${target.name}.` });
      delete state.journeys[journey.id];
      continue;
    }

    // FUEL-OUT before arrival → stranded.
    if (journey.fuel <= 0) {
      journey.fuel = 0;
      journey.status = "failed";
      state.log.push({
        tick: state.tick,
        message: `Expedition to ${target.name} ran dry — stranded.`,
      });
      delete state.journeys[journey.id];
      continue;
    }
  }
}

/** Abort an in-flight expedition: mark failed (recalled) and remove. */
export function abort(state: GameState, journeyId: string): void {
  const journey = state.journeys[journeyId];
  if (!journey) return;
  journey.status = "failed";
  const target = state.systems[journey.targetSystemId];
  state.log.push({
    tick: state.tick,
    message: `Expedition to ${target?.name ?? journey.targetSystemId} recalled.`,
  });
  delete state.journeys[journeyId];
}
