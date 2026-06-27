import { describe, expect, it } from "vitest";
import { createInitialState } from "../worldgen.js";
import { tick } from "../engine.js";
import { runFog, systemInSensorRange } from "./fog.js";

describe("fog: sensor-scaled reveal", () => {
  it("neighbor system stays hidden when out of sensor range", () => {
    const s = createInitialState(1);
    // Default sensorRange (30) < neighbor distance (~92).
    expect(s.systems["sys-neighbor"]!.discovered).toBe(false);
    const after = tick(s);
    expect(after.systems["sys-neighbor"]!.discovered).toBe(false);
  });

  it("runFog reveals a system once sensorRange covers it", () => {
    const s = createInitialState(1);
    const dist = s.systems["sys-neighbor"]!.distanceFromHome;
    s.sensorRange = dist + 1;
    runFog(s);
    expect(s.systems["sys-neighbor"]!.discovered).toBe(true);
  });

  it("growing sensor range during play auto-reveals the neighbor", () => {
    const s = createInitialState(1);
    s.sensorRange = s.systems["sys-neighbor"]!.distanceFromHome + 5;
    const after = tick(s); // runFog runs inside tick
    expect(after.systems["sys-neighbor"]!.discovered).toBe(true);
  });

  it("planet biome stays hidden (scanned=false) even after its system is discovered", () => {
    const s = createInitialState(1);
    s.sensorRange = 1000;
    const after = tick(s);
    expect(after.systems["sys-neighbor"]!.discovered).toBe(true);
    for (const pid of after.systems["sys-neighbor"]!.planetIds) {
      expect(after.planets[pid]!.scanned).toBe(false);
    }
  });

  it("systemInSensorRange is a pure predicate", () => {
    const s = createInitialState(1);
    expect(systemInSensorRange(s, "sys-home")).toBe(true);
    expect(systemInSensorRange(s, "sys-neighbor")).toBe(false);
    s.sensorRange = 1000;
    expect(systemInSensorRange(s, "sys-neighbor")).toBe(true);
  });

  it("fog reveal is deterministic across identical seeds", () => {
    const a = createInitialState(4);
    const b = createInitialState(4);
    a.sensorRange = b.sensorRange = 1000;
    expect(tick(a).systems).toEqual(tick(b).systems);
  });
});
