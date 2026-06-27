import { getContentPack, tierRank } from "@meteor/shared";
import type { GameState, Objective, ObjectiveCondition } from "@meteor/shared";

/**
 * Objectives — the authored goal chain (content `objectives`) that makes the slice a
 * game: early objectives onboard, middle ones are meta-goals, and the single
 * `victory` objective wins it. Evaluated against GameState each tick by the sim, so
 * progress is deterministic and persists in `state.objectives`.
 *
 * `conditionMet` reads (never mutates) state; `runObjectives` is the system: it
 * completes pending objectives whose condition holds, logs each, and flips
 * `objectives.won` when the victory objective completes. Pure — it mutates the
 * already-cloned tick state and uses no clock/RNG.
 */

// ── Aggregate counters over the world (pure reads) ─────────────────────────────
function settledPlanetCount(state: GameState): number {
  let n = 0;
  for (const p of Object.values(state.planets)) if (p.settled) n += 1;
  return n;
}

/** Distinct systems containing at least one settled planet. */
function settledSystemCount(state: GameState): number {
  const systems = new Set<string>();
  for (const p of Object.values(state.planets)) if (p.settled) systems.add(p.systemId);
  return systems.size;
}

function discoveredSystemCount(state: GameState): number {
  let n = 0;
  for (const s of Object.values(state.systems)) if (s.discovered) n += 1;
  return n;
}

function scannedPlanetCount(state: GameState): number {
  let n = 0;
  for (const p of Object.values(state.planets)) if (p.scanned) n += 1;
  return n;
}

/**
 * Whether a condition currently holds. A pure predicate over `state` — no mutation,
 * no clock/RNG. Every leaf kind plus the one-level `all` (AND) is handled
 * exhaustively (the `never` default keeps it in sync with the schema union).
 */
export function conditionMet(state: GameState, cond: ObjectiveCondition): boolean {
  switch (cond.kind) {
    case "orbitalLaunched":
      return state.orbitalLaunched;
    case "researchStarted":
      return state.research.current !== null || state.research.unlocked.length > 0;
    case "tier":
      return tierRank(state.authorityTier) >= tierRank(cond.tier);
    case "tech":
      return state.research.unlocked.includes(cond.techId);
    case "settledCount":
      return settledPlanetCount(state) >= cond.count;
    case "settledInSystems":
      return settledSystemCount(state) >= cond.count;
    case "discoveredSystems":
      return discoveredSystemCount(state) >= cond.count;
    case "scannedCount":
      return scannedPlanetCount(state) >= cond.count;
    case "resource":
      return (state.stockpiles[cond.resource] ?? 0) >= cond.amount;
    case "all":
      return cond.of.every((leaf) => conditionMet(state, leaf));
    default: {
      const _exhaustive: never = cond;
      return _exhaustive;
    }
  }
}

/** The authored objective chain (content `objectives`; empty if none authored). */
function authoredObjectives(): Objective[] {
  return getContentPack().objectives ?? [];
}

/**
 * Complete every pending (not-yet-completed) authored objective whose condition now
 * holds: push its id, log "Objective complete: <title>", and if it is the `victory`
 * objective set `objectives.won` (+ a victory log). Idempotent — already-completed
 * objectives are skipped, so re-running never double-adds. Mutates the cloned state;
 * call as the final system in the tick.
 */
export function runObjectives(state: GameState): void {
  const completed = state.objectives.completed;
  for (const obj of authoredObjectives()) {
    if (completed.includes(obj.id)) continue;
    if (!conditionMet(state, obj.condition)) continue;
    completed.push(obj.id);
    state.log.push({ tick: state.tick, message: `Objective complete: ${obj.title}` });
    if (obj.victory && !state.objectives.won) {
      state.objectives.won = true;
      state.log.push({ tick: state.tick, message: `Victory! ${obj.title}` });
    }
  }
}

/** First authored objective not yet completed — the "current" goal for the HUD. */
export function nextObjective(state: GameState): Objective | null {
  for (const obj of authoredObjectives()) {
    if (!state.objectives.completed.includes(obj.id)) return obj;
  }
  return null;
}

/** Whether objective `id` is recorded complete. */
export function isObjectiveComplete(state: GameState, id: string): boolean {
  return state.objectives.completed.includes(id);
}
