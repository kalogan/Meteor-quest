import { describe, expect, it } from "vitest";
import { createInitialState } from "./worldgen.js";
import { tickN } from "./engine.js";
import { applyCommand } from "./commands.js";

describe("determinism", () => {
  it("same seed produces identical initial state", () => {
    expect(createInitialState(42)).toEqual(createInitialState(42));
  });

  it("ticking is a pure function of state", () => {
    const a = tickN(createInitialState(7), 20);
    const b = tickN(createInitialState(7), 20);
    expect(a).toEqual(b);
    // original is untouched (no mutation)
    expect(createInitialState(7).tick).toBe(0);
  });
});

describe("economy + research loop", () => {
  it("cities accrue their focus resource over time", () => {
    const s0 = createInitialState(1);
    const s1 = tickN(s0, 10);
    expect(s1.stockpiles.minerals).toBeGreaterThan(s0.stockpiles.minerals);
  });

  it("research completes and unlocks a tech", () => {
    let s = createInitialState(1);
    // Point both cities at research so it accrues fast, then research basic_industry.
    for (const id of Object.keys(s.cities)) s = applyCommand(s, { type: "setCityFocus", cityId: id, resource: "research" });
    s = applyCommand(s, { type: "startResearch", techId: "basic_industry" });
    s = tickN(s, 200);
    expect(s.research.unlocked).toContain("basic_industry");
  });
});
