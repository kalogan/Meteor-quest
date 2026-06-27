import { describe, expect, it } from "vitest";
import { createInitialState } from "../worldgen.js";
import { applyCommand } from "../commands.js";
import { canTravel, travelBlocker, fuelCost } from "./travel.js";

/** A state set up so the neighbor is reachable: launched, ranged, fueled. */
function reachableState(seed = 1) {
  const s = createInitialState(seed);
  s.orbitalLaunched = true;
  s.maxRange = s.systems["sys-neighbor"]!.distanceFromHome + 10;
  s.stockpiles.fuel = 1000;
  return s;
}

describe("travel: range + fuel gating", () => {
  it("cannot travel before orbital launch", () => {
    const s = createInitialState(1);
    s.maxRange = 1000;
    s.stockpiles.fuel = 1000;
    expect(travelBlocker(s, "sys-neighbor")).toBe("notLaunched");
    expect(canTravel(s, "sys-neighbor")).toBe(false);
  });

  it("cannot travel when out of range", () => {
    const s = createInitialState(1);
    s.orbitalLaunched = true;
    s.maxRange = 1; // far short of neighbor distance
    s.stockpiles.fuel = 1000;
    expect(travelBlocker(s, "sys-neighbor")).toBe("outOfRange");
  });

  it("cannot travel without enough fuel", () => {
    const s = reachableState();
    s.stockpiles.fuel = 0;
    expect(travelBlocker(s, "sys-neighbor")).toBe("notEnoughFuel");
    expect(canTravel(s, "sys-neighbor")).toBe(false);
  });

  it("can travel when launched, in range, and fueled", () => {
    const s = reachableState();
    expect(travelBlocker(s, "sys-neighbor")).toBeNull();
    expect(canTravel(s, "sys-neighbor")).toBe(true);
  });

  it("traveling consumes fuel and discovers the system", () => {
    const s = reachableState();
    const cost = fuelCost(s, "sys-neighbor");
    expect(cost).toBeGreaterThan(0);
    const after = applyCommand(s, { type: "travelToSystem", systemId: "sys-neighbor" });
    expect(after.stockpiles.fuel).toBeCloseTo(s.stockpiles.fuel - cost, 5);
    expect(after.systems["sys-neighbor"]!.discovered).toBe(true);
  });

  it("a rejected travel command spends NO fuel", () => {
    const s = createInitialState(1); // not launched
    const after = applyCommand(s, { type: "travelToSystem", systemId: "sys-neighbor" });
    expect(after.stockpiles.fuel).toBe(s.stockpiles.fuel);
    expect(after.systems["sys-neighbor"]!.discovered).toBe(false);
  });

  it("farther systems cost more fuel (cost scales with distance)", () => {
    const s = reachableState();
    expect(fuelCost(s, "sys-neighbor")).toBeGreaterThan(fuelCost(s, "sys-home"));
  });
});
