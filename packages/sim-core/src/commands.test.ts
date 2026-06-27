import { describe, expect, it } from "vitest";
import { createInitialState } from "./worldgen.js";
import { applyCommand } from "./commands.js";

describe("commands: slice-2 governor + defense wiring", () => {
  it("setSystemPolicy updates the system's policy (pure)", () => {
    const s = createInitialState(1);
    const next = applyCommand(s, { type: "setSystemPolicy", systemId: "sys-home", resource: "research" });
    expect(next.systems["sys-home"]!.policy).toBe("research");
    expect(s.systems["sys-home"]!.policy).toBe("minerals"); // input untouched
  });

  it("setSystemPolicy ignores unknown systems", () => {
    const s = createInitialState(1);
    const next = applyCommand(s, { type: "setSystemPolicy", systemId: "nope", resource: "energy" });
    expect(next).toEqual(s);
  });

  it("setEmpirePolicy updates the empire-wide policy (pure)", () => {
    const s = createInitialState(1);
    const next = applyCommand(s, { type: "setEmpirePolicy", resource: "energy" });
    expect(next.empirePolicy).toBe("energy");
    expect(s.empirePolicy).toBe("minerals");
  });

  it("buildDefense raises target defense and logs", () => {
    const s = createInitialState(1);
    s.stockpiles.alloy = 100;
    s.stockpiles.energy = 100;
    const next = applyCommand(s, { type: "buildDefense", targetId: "planet-cradle" });
    expect(next.planets["planet-cradle"]!.defense).toBeGreaterThan(0);
    expect(next.log.at(-1)!.message).toContain("Reinforced");
  });

  it("buildDefense is a no-op when unaffordable (no log spam)", () => {
    const s = createInitialState(1);
    s.stockpiles.alloy = 0;
    s.stockpiles.energy = 0;
    const before = s.log.length;
    const next = applyCommand(s, { type: "buildDefense", targetId: "planet-cradle" });
    expect(next.planets["planet-cradle"]!.defense).toBe(0);
    expect(next.log.length).toBe(before);
  });
});
