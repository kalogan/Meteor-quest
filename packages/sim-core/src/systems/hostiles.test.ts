import { describe, expect, it } from "vitest";
import type { GameState } from "@meteor/shared";
import { createInitialState } from "../worldgen.js";
import { tick, tickN } from "../engine.js";
import { applyCommand } from "../commands.js";
import { spawnLurker, spawnAmbush } from "./hostiles.js";

/** A launched empire with generous range/sensors so systems discover + targets are reachable. */
function launched(seed = 1): GameState {
  const s = createInitialState(seed);
  s.orbitalLaunched = true;
  s.maxRange = 5000;
  s.sensorRange = 5000;
  s.stockpiles.fuel = 100000;
  return s;
}

function otherSystem(s: GameState) {
  return Object.values(s.systems).find((sys) => sys.id !== s.homeSystemId)!;
}

describe("hostiles: gating + determinism", () => {
  it("spawns nothing while hostilesEnabled is off (shipped game unaffected)", () => {
    const after = tickN(launched(7), 80);
    expect(Object.keys(after.hostiles)).toHaveLength(0);
  });

  it("same seed + enabled ⇒ identical hostiles timeline", () => {
    const run = () => {
      const s = launched(7);
      s.hostilesEnabled = true;
      return tickN(s, 80);
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a.hostiles)).toEqual(JSON.stringify(b.hostiles));
    expect(a.log).toEqual(b.log);
    expect(Object.keys(a.hostiles).length).toBeGreaterThan(0); // some did spawn
  });
});

describe("hostiles: lurker blocks settling", () => {
  it("a lurker guards its system until driven off", () => {
    const s = launched(2);
    const sys = otherSystem(s);
    sys.discovered = true;
    const planet = sys.planetIds.map((id) => s.planets[id]).find(Boolean)!;
    planet.scanned = true;
    spawnLurker(s, sys.id);
    const hid = Object.keys(s.hostiles)[0]!;

    const blocked = applyCommand(s, { type: "settlePlanet", planetId: planet.id });
    expect(blocked.planets[planet.id]!.settled).toBe(false);
    expect(blocked.log.some((l) => /guards/.test(l.message))).toBe(true);

    // Overwhelming defense → fight wins → hostile destroyed → settle now allowed.
    s.research.unlocked = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const cleared = applyCommand(s, { type: "engageHostile", hostileId: hid, response: "fight" });
    expect(cleared.hostiles[hid]).toBeUndefined();
    const settled = applyCommand(cleared, { type: "settlePlanet", planetId: planet.id });
    expect(settled.planets[planet.id]!.settled).toBe(true);
  });
});

describe("hostiles: ambush pins an expedition", () => {
  it("a pinned expedition holds position; flee aborts it", () => {
    let s = launched(3);
    s.hostilesEnabled = true;
    const target = otherSystem(s);
    s = applyCommand(s, { type: "launchJourney", targetSystemId: target.id });
    const jid = Object.keys(s.journeys)[0]!;
    expect(jid).toBeTruthy();

    spawnAmbush(s, s.journeys[jid]!);
    const posBefore = { ...s.journeys[jid]!.pos };

    const after = tick(s); // pinned → should NOT advance
    expect(after.journeys[jid]!.pos).toEqual(posBefore);

    const hid = Object.values(after.hostiles).find((h) => h.engagedJourneyId === jid)!.id;
    const fled = applyCommand(after, { type: "engageHostile", hostileId: hid, response: "flee" });
    expect(fled.journeys[jid] === undefined || fled.journeys[jid]!.status === "failed").toBe(true);
  });
});

describe("hostiles: pay-off", () => {
  it("paying off removes the hostile and spends resources", () => {
    const s = launched(4);
    const sys = otherSystem(s);
    spawnLurker(s, sys.id);
    const hid = Object.keys(s.hostiles)[0]!;
    s.stockpiles.minerals = 1000;
    s.stockpiles.alloy = 1000;
    const before = s.stockpiles.minerals;

    const paid = applyCommand(s, { type: "engageHostile", hostileId: hid, response: "payoff" });
    expect(paid.hostiles[hid]).toBeUndefined();
    expect(paid.stockpiles.minerals).toBeLessThan(before);
  });
});
