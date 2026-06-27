import { describe, expect, it } from "vitest";
import { getContentPack } from "@meteor/shared";
import type { GameState, ObjectiveCondition } from "@meteor/shared";
import { createInitialState } from "../worldgen.js";
import { tick, tickN } from "../engine.js";
import { applyCommand } from "../commands.js";
import {
  conditionMet,
  runObjectives,
  nextObjective,
  isObjectiveComplete,
} from "./objectives.js";

/** A fresh state with the objective chain reset (worldgen leaves it empty already). */
function fresh(seed = 1): GameState {
  const s = createInitialState(seed);
  s.objectives = { completed: [], won: false };
  return s;
}

describe("objectives: conditionMet — every leaf kind", () => {
  it("orbitalLaunched reflects state.orbitalLaunched", () => {
    const s = fresh();
    s.orbitalLaunched = false;
    expect(conditionMet(s, { kind: "orbitalLaunched" })).toBe(false);
    s.orbitalLaunched = true;
    expect(conditionMet(s, { kind: "orbitalLaunched" })).toBe(true);
  });

  it("researchStarted: current research OR any unlocked", () => {
    const s = fresh();
    s.research.current = null;
    s.research.unlocked = [];
    expect(conditionMet(s, { kind: "researchStarted" })).toBe(false);
    s.research.current = "some-tech";
    expect(conditionMet(s, { kind: "researchStarted" })).toBe(true);
    s.research.current = null;
    s.research.unlocked = ["done-tech"];
    expect(conditionMet(s, { kind: "researchStarted" })).toBe(true);
  });

  it("tier: authorityTier rank >= target rank", () => {
    const s = fresh();
    s.authorityTier = "city";
    expect(conditionMet(s, { kind: "tier", tier: "continent" })).toBe(false);
    s.authorityTier = "continent";
    expect(conditionMet(s, { kind: "tier", tier: "continent" })).toBe(true);
    // Higher tier satisfies a lower-tier requirement.
    s.authorityTier = "galaxy";
    expect(conditionMet(s, { kind: "tier", tier: "planet" })).toBe(true);
  });

  it("tech: unlocked includes techId", () => {
    const s = fresh();
    expect(conditionMet(s, { kind: "tech", techId: "orbital_launch" })).toBe(false);
    s.research.unlocked = ["orbital_launch"];
    expect(conditionMet(s, { kind: "tech", techId: "orbital_launch" })).toBe(true);
  });

  it("settledCount: number of settled planets", () => {
    const s = fresh();
    // Cradle starts settled → 1.
    expect(conditionMet(s, { kind: "settledCount", count: 1 })).toBe(true);
    expect(conditionMet(s, { kind: "settledCount", count: 2 })).toBe(false);
    s.planets["planet-neighbor-0"]!.settled = true;
    expect(conditionMet(s, { kind: "settledCount", count: 2 })).toBe(true);
  });

  it("settledInSystems: distinct systems with a settled planet", () => {
    const s = fresh();
    // Cradle (sys-home) settled → 1 distinct system.
    expect(conditionMet(s, { kind: "settledInSystems", count: 1 })).toBe(true);
    expect(conditionMet(s, { kind: "settledInSystems", count: 2 })).toBe(false);
    // Settling a SECOND home planet keeps it at 1 distinct system...
    const otherHome = Object.values(s.planets).find(
      (p) => p.systemId === "sys-home" && !p.settled,
    );
    if (otherHome) otherHome.settled = true;
    expect(conditionMet(s, { kind: "settledInSystems", count: 2 })).toBe(false);
    // ...but settling one in the neighbor system makes it 2.
    s.planets["planet-neighbor-0"]!.settled = true;
    expect(conditionMet(s, { kind: "settledInSystems", count: 2 })).toBe(true);
  });

  it("discoveredSystems: number of discovered systems", () => {
    const s = fresh();
    // sys-home starts discovered → 1.
    expect(conditionMet(s, { kind: "discoveredSystems", count: 1 })).toBe(true);
    expect(conditionMet(s, { kind: "discoveredSystems", count: 2 })).toBe(false);
    s.systems["sys-neighbor"]!.discovered = true;
    expect(conditionMet(s, { kind: "discoveredSystems", count: 2 })).toBe(true);
  });

  it("scannedCount: number of scanned planets (cradle starts scanned)", () => {
    const s = fresh();
    expect(conditionMet(s, { kind: "scannedCount", count: 1 })).toBe(true);
    expect(conditionMet(s, { kind: "scannedCount", count: 2 })).toBe(false);
    s.planets["planet-neighbor-0"]!.scanned = true;
    expect(conditionMet(s, { kind: "scannedCount", count: 2 })).toBe(true);
  });

  it("resource: stockpile >= amount", () => {
    const s = fresh();
    s.stockpiles.alloy = 5;
    expect(conditionMet(s, { kind: "resource", resource: "alloy", amount: 10 })).toBe(false);
    s.stockpiles.alloy = 10;
    expect(conditionMet(s, { kind: "resource", resource: "alloy", amount: 10 })).toBe(true);
  });

  it("all: every sub-condition must hold (AND)", () => {
    const s = fresh();
    const cond: ObjectiveCondition = {
      kind: "all",
      of: [
        { kind: "tier", tier: "galaxy" },
        { kind: "settledCount", count: 4 },
      ],
    };
    expect(conditionMet(s, cond)).toBe(false);
    s.authorityTier = "galaxy";
    expect(conditionMet(s, cond)).toBe(false); // settledCount not yet met
    let added = 0;
    for (const p of Object.values(s.planets)) {
      if (!p.settled) {
        p.settled = true;
        added += 1;
        if (added >= 3) break; // cradle (1) + 3 = 4
      }
    }
    expect(conditionMet(s, cond)).toBe(true);
  });
});

describe("objectives: runObjectives", () => {
  it("a fresh game has nothing completed and has not won", () => {
    const s = fresh();
    expect(s.objectives.completed).toEqual([]);
    expect(s.objectives.won).toBe(false);
    expect(nextObjective(s)?.id).toBe("obj_research");
  });

  it("completes a pending objective whose condition holds + logs it", () => {
    const s = fresh();
    s.research.current = "anything"; // satisfies obj_research (researchStarted)
    runObjectives(s);
    expect(isObjectiveComplete(s, "obj_research")).toBe(true);
    expect(s.log.some((l) => l.message === "Objective complete: Spark of Progress")).toBe(true);
  });

  it("the victory objective sets won + logs a victory line", () => {
    const s = fresh();
    s.authorityTier = "galaxy";
    let added = 0;
    for (const p of Object.values(s.planets)) {
      if (!p.settled) {
        p.settled = true;
        if (++added >= 3) break; // 1 cradle + 3 = 4 settled
      }
    }
    runObjectives(s);
    expect(isObjectiveComplete(s, "obj_victory")).toBe(true);
    expect(s.objectives.won).toBe(true);
    expect(s.log.some((l) => l.message.startsWith("Victory!"))).toBe(true);
  });

  it("is idempotent — re-running does not double-add or double-log", () => {
    const s = fresh();
    s.research.current = "anything";
    runObjectives(s);
    const completedAfterFirst = [...s.objectives.completed];
    const logCount = s.log.filter((l) => l.message.startsWith("Objective complete:")).length;
    runObjectives(s);
    runObjectives(s);
    expect(s.objectives.completed).toEqual(completedAfterFirst);
    expect(s.objectives.completed.filter((id) => id === "obj_research")).toHaveLength(1);
    expect(s.log.filter((l) => l.message.startsWith("Objective complete:")).length).toBe(logCount);
  });

  it("completes multiple objectives in one pass when several conditions hold", () => {
    const s = fresh();
    s.research.unlocked = ["x"]; // researchStarted
    s.authorityTier = "planet"; // tier:continent + tier:planet
    runObjectives(s);
    expect(isObjectiveComplete(s, "obj_research")).toBe(true);
    expect(isObjectiveComplete(s, "obj_continent")).toBe(true);
    expect(isObjectiveComplete(s, "obj_planet")).toBe(true);
    // Later objectives still pending.
    expect(isObjectiveComplete(s, "obj_launch")).toBe(false);
  });
});

describe("objectives: nextObjective / isObjectiveComplete helpers", () => {
  it("nextObjective returns the first not-yet-completed authored objective", () => {
    const s = fresh();
    s.objectives.completed = ["obj_research"];
    expect(nextObjective(s)?.id).toBe("obj_continent");
  });

  it("nextObjective is null once all objectives are complete", () => {
    const s = fresh();
    s.objectives.completed = getContentPack().objectives!.map((o) => o.id);
    expect(nextObjective(s)).toBeNull();
  });
});

describe("objectives: engine integration + determinism", () => {
  it("tick runs runObjectives as the final system", () => {
    const s = fresh();
    // Use a real in-progress tech so runResearch doesn't clear it before runObjectives.
    s.research.current = getContentPack().tech[0]!.id;
    const after = tick(s);
    expect(after.objectives.completed).toContain("obj_research");
    // Input not mutated (tick is pure).
    expect(s.objectives.completed).toEqual([]);
  });

  it("progress persists across ticks once recorded", () => {
    const s = fresh();
    // An already-unlocked tech satisfies researchStarted and survives runResearch.
    s.research.unlocked = [getContentPack().tech[0]!.id];
    let cur = tick(s);
    expect(cur.objectives.completed).toContain("obj_research");
    // Clear the cause; the completion must remain recorded.
    cur.research.current = null;
    cur.research.unlocked = [];
    cur = tick(cur);
    expect(cur.objectives.completed).toContain("obj_research");
  });

  it("same seed + commands ⇒ identical objectives state", () => {
    const run = (): GameState => {
      let s = createInitialState(42);
      s = applyCommand(s, { type: "startResearch", techId: getContentPack().tech[0]!.id });
      return tickN(s, 25);
    };
    const a = run();
    const b = run();
    expect(a.objectives).toEqual(b.objectives);
  });
});
