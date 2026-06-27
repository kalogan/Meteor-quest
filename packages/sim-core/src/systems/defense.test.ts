import { describe, expect, it } from "vitest";
import { getContentPack } from "@meteor/shared";
import { createInitialState } from "../worldgen.js";
import { applyCommand } from "../commands.js";
import {
  applyBuildDefense,
  canAffordDefense,
  defenseConfig,
  localDefense,
  DEFAULT_DEFENSE,
} from "./defense.js";
import type { GameState } from "@meteor/shared";

/** Give the empire enough feedstock to afford buildDefense. */
function funded(seed = 1): GameState {
  const s = createInitialState(seed);
  const cost = defenseConfig().buildCost;
  for (const [res, amount] of Object.entries(cost)) {
    s.stockpiles[res as keyof typeof s.stockpiles] = (amount ?? 0) * 10;
  }
  return s;
}

describe("defense: config", () => {
  it("uses content defense config when present, else the default", () => {
    const authored = getContentPack().defense;
    expect(defenseConfig()).toEqual(authored ?? DEFAULT_DEFENSE);
    expect(DEFAULT_DEFENSE.defensePerBuild).toBeGreaterThan(0);
  });
});

describe("defense: buildDefense cost + effect", () => {
  it("spends the cost and adds defensePerBuild to a planet", () => {
    const s = funded();
    const cfg = defenseConfig();
    const before = { ...s.stockpiles };
    const ok = applyBuildDefense(s, "planet-cradle");
    expect(ok).toBe(true);
    expect(s.planets["planet-cradle"]!.defense).toBe(cfg.defensePerBuild);
    for (const [res, amount] of Object.entries(cfg.buildCost)) {
      expect(s.stockpiles[res as keyof typeof s.stockpiles]).toBeCloseTo(
        (before[res as keyof typeof before] ?? 0) - (amount ?? 0),
        5,
      );
    }
  });

  it("adds defensePerBuild to a system target", () => {
    const s = funded();
    applyBuildDefense(s, "sys-home");
    expect(s.systems["sys-home"]!.defense).toBe(defenseConfig().defensePerBuild);
  });

  it("rejects when unaffordable (no spend, no defense gained)", () => {
    const s = createInitialState(1);
    s.stockpiles.alloy = 0;
    s.stockpiles.energy = 0;
    expect(canAffordDefense(s)).toBe(false);
    const ok = applyBuildDefense(s, "planet-cradle");
    expect(ok).toBe(false);
    expect(s.planets["planet-cradle"]!.defense).toBe(0);
  });

  it("rejects an unknown target", () => {
    const s = funded();
    expect(applyBuildDefense(s, "no-such-id")).toBe(false);
  });

  it("the buildDefense command is pure (clones, does not mutate input)", () => {
    const s = funded();
    const next = applyCommand(s, { type: "buildDefense", targetId: "planet-cradle" });
    expect(s.planets["planet-cradle"]!.defense).toBe(0); // input untouched
    expect(next.planets["planet-cradle"]!.defense).toBe(defenseConfig().defensePerBuild);
  });
});

describe("defense: localDefense umbrella", () => {
  it("a planet inherits its system's built defense", () => {
    const s = funded();
    s.planets["planet-cradle"]!.defense = 3;
    s.systems["sys-home"]!.defense = 4;
    // planet's own (3) + parent system's (4)
    expect(localDefense(s, "planet-cradle")).toBe(7);
    expect(localDefense(s, "sys-home")).toBe(4);
  });

  it("returns 0 for unknown ids", () => {
    expect(localDefense(funded(), "nope")).toBe(0);
  });
});
