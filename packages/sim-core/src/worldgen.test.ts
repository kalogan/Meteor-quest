import { describe, expect, it } from "vitest";
import { getContentPack } from "@meteor/shared";
import { createInitialState, galaxyConfig, DEFAULT_GALAXY } from "./worldgen.js";

describe("worldgen: galaxy generation", () => {
  it("uses content galaxy config when present, else the default", () => {
    // galaxyConfig prefers authored content; DEFAULT_GALAXY is the fallback.
    const authored = getContentPack().galaxy;
    expect(galaxyConfig()).toEqual(authored ?? DEFAULT_GALAXY);
    // The default is a sane, self-consistent fallback regardless.
    expect(DEFAULT_GALAXY.systemCount).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_GALAXY.radius).toBeGreaterThan(DEFAULT_GALAXY.minSeparation);
  });

  it("generates systemCount systems (incl. home + slice-1 neighbor)", () => {
    const s = createInitialState(1);
    expect(Object.keys(s.systems).length).toBe(galaxyConfig().systemCount);
    // Slice-1 anchors are preserved exactly.
    expect(s.systems["sys-home"]).toBeDefined();
    expect(s.systems["sys-neighbor"]).toBeDefined();
    expect(s.homeSystemId).toBe("sys-home");
    expect(s.cradlePlanetId).toBe("planet-cradle");
  });

  it("is deterministic: same seed ⇒ identical galaxy", () => {
    expect(createInitialState(42)).toEqual(createInitialState(42));
    expect(createInitialState(42).systems).toEqual(createInitialState(42).systems);
  });

  it("different seeds scatter systems to different positions", () => {
    const a = createInitialState(1);
    const b = createInitialState(2);
    // Home + neighbor are fixed; the scattered frontier systems differ.
    expect(a.systems["sys-0"]!.position).not.toEqual(b.systems["sys-0"]!.position);
  });

  it("scattered systems respect minSeparation from every other system", () => {
    const s = createInitialState(7);
    const cfg = galaxyConfig();
    const positions = Object.values(s.systems).map((sys) => sys.position);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        expect(d).toBeGreaterThanOrEqual(cfg.minSeparation);
      }
    }
  });

  it("scattered systems sit within (roughly) the galaxy radius", () => {
    const s = createInitialState(3);
    const cfg = galaxyConfig();
    for (const sys of Object.values(s.systems)) {
      if (sys.id === "sys-home" || sys.id === "sys-neighbor") continue;
      const d = Math.hypot(sys.position.x, sys.position.y, sys.position.z);
      expect(d).toBeLessThanOrEqual(cfg.radius * 1.05);
    }
  });

  it("every system + planet carries initialized slice-2 fields", () => {
    const s = createInitialState(9);
    for (const sys of Object.values(s.systems)) {
      expect(sys.policy).toBe("minerals");
      expect(sys.defense).toBe(0);
    }
    for (const p of Object.values(s.planets)) {
      expect(p.defense).toBe(0);
    }
    expect(s.empirePolicy).toBe("minerals");
  });

  it("scattered systems start hidden + unscanned (revealed via fog)", () => {
    const s = createInitialState(4);
    for (const sys of Object.values(s.systems)) {
      if (sys.id === "sys-home") continue;
      expect(sys.discovered).toBe(false);
    }
    // home + neighbor distances unchanged from slice 1.
    expect(s.systems["sys-home"]!.distanceFromHome).toBe(0);
  });
});
