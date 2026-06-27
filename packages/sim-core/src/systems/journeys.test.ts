import { describe, expect, it } from "vitest";
import { createInitialState } from "../worldgen.js";
import { applyCommand } from "../commands.js";
import { tick, tickN } from "../engine.js";
import { launchBlocker, journeyFuelLoad, JOURNEY_SPEED } from "./journeys.js";

/** A state where the neighbor system is a reachable, affordable journey target. */
function launchReadyState(seed = 1) {
  const s = createInitialState(seed);
  s.orbitalLaunched = true;
  s.maxRange = s.systems["sys-neighbor"]!.distanceFromHome + 10;
  s.stockpiles.fuel = 1000;
  return s;
}

/** Run ticks until no journey is enroute (or a cap), returning the final state. */
function flyToCompletion(state: ReturnType<typeof createInitialState>, cap = 200) {
  let s = state;
  for (let i = 0; i < cap; i++) {
    if (Object.keys(s.journeys).length === 0) break;
    s = tick(s);
  }
  return s;
}

describe("journeys: launch gating + fuel", () => {
  it("launch creates a journey and deducts fuel from the stockpile", () => {
    const s = launchReadyState();
    const load = journeyFuelLoad(s, "sys-neighbor");
    expect(load).toBeGreaterThan(0);
    const after = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    const journeys = Object.values(after.journeys);
    expect(journeys).toHaveLength(1);
    expect(journeys[0]!.status).toBe("enroute");
    expect(journeys[0]!.targetSystemId).toBe("sys-neighbor");
    expect(journeys[0]!.fuel).toBeCloseTo(load, 5);
    expect(after.stockpiles.fuel).toBeCloseTo(s.stockpiles.fuel - load, 5);
  });

  it("rejects a launch that is unreachable (not launched) and spends no fuel", () => {
    const s = createInitialState(1); // orbitalLaunched = false
    expect(launchBlocker(s, "sys-neighbor")).toBe("notLaunched");
    const after = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    expect(Object.keys(after.journeys)).toHaveLength(0);
    expect(after.stockpiles.fuel).toBe(s.stockpiles.fuel);
  });

  it("rejects an unaffordable launch", () => {
    const s = launchReadyState();
    s.stockpiles.fuel = 1; // far below the fuel load
    expect(launchBlocker(s, "sys-neighbor")).toBe("notEnoughFuel");
    const after = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    expect(Object.keys(after.journeys)).toHaveLength(0);
  });

  it("rejects a second journey to the same target while one is enroute", () => {
    const s = launchReadyState();
    const after1 = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    expect(launchBlocker(after1, "sys-neighbor")).toBe("alreadyEnroute");
    const after2 = applyCommand(after1, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    expect(Object.keys(after2.journeys)).toHaveLength(1);
  });
});

describe("journeys: transit + arrival", () => {
  it("advances toward the target each tick, then arrives and discovers the system", () => {
    const s = launchReadyState();
    const launched = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    const target = launched.systems["sys-neighbor"]!.position;
    const dist0 = Math.hypot(
      target.x - launched.journeys[Object.keys(launched.journeys)[0]!]!.pos.x,
      target.y - launched.journeys[Object.keys(launched.journeys)[0]!]!.pos.y,
      target.z - launched.journeys[Object.keys(launched.journeys)[0]!]!.pos.z,
    );

    // One tick should close the gap by roughly the journey speed.
    const t1 = tick(launched);
    const j1 = t1.journeys[Object.keys(t1.journeys)[0]!]!;
    const dist1 = Math.hypot(target.x - j1.pos.x, target.y - j1.pos.y, target.z - j1.pos.z);
    expect(dist1).toBeLessThan(dist0);
    expect(dist0 - dist1).toBeCloseTo(JOURNEY_SPEED, 1);

    // Fly to completion: arrives within a sane tick budget and discovers the system.
    const done = flyToCompletion(launched);
    expect(Object.keys(done.journeys)).toHaveLength(0); // arrival hands off + removes
    expect(done.systems["sys-neighbor"]!.discovered).toBe(true);
    // Within the intended 15–40 tick hop feel (launched at tick 1; allow margin).
    expect(done.tick).toBeGreaterThan(1);
    expect(done.tick).toBeLessThan(50);
  });
});

describe("journeys: steering", () => {
  it("a steered detour sets the ship back vs a straight run (extra distance/fuel)", () => {
    const STEER_TICKS = 6;
    const distToTarget = (state: ReturnType<typeof createInitialState>, jid: string) => {
      const j = state.journeys[jid]!;
      const t = state.systems["sys-neighbor"]!.position;
      return Math.hypot(t.x - j.pos.x, t.y - j.pos.y, t.z - j.pos.z);
    };

    // Straight run: fly STEER_TICKS with no steering.
    let straight = applyCommand(launchReadyState(), {
      type: "launchJourney",
      targetSystemId: "sys-neighbor",
    });
    const sjid = Object.keys(straight.journeys)[0]!;
    straight = tickN(straight, STEER_TICKS);

    // Steered run: jam steer hard off-axis each of the same ticks.
    let steered = applyCommand(launchReadyState(), {
      type: "launchJourney",
      targetSystemId: "sys-neighbor",
    });
    const stjid = Object.keys(steered.journeys)[0]!;
    for (let i = 0; i < STEER_TICKS; i++) {
      steered = applyCommand(steered, { type: "steerJourney", journeyId: stjid, turn: 1 });
      steered = tick(steered);
    }

    // Both burned the SAME fuel for the same ticks (burn ∝ distance covered), but the
    // detour is farther from target → it needs MORE remaining distance/fuel to finish.
    expect(distToTarget(steered, stjid)).toBeGreaterThan(distToTarget(straight, sjid));
    expect(steered.journeys[stjid]!.fuel).toBeCloseTo(straight.journeys[sjid]!.fuel, 5);

    // Autopilot still drags it home; the steered run finishes but later.
    const straightDone = flyToCompletion(straight);
    const steeredDone = flyToCompletion(steered);
    expect(steeredDone.systems["sys-neighbor"]!.discovered).toBe(true);
    expect(steeredDone.tick).toBeGreaterThan(straightDone.tick);
  });

  it("running out of fuel before arrival → failed (stranded), journey removed", () => {
    const s = launchReadyState();
    const flying = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    const jid = Object.keys(flying.journeys)[0]!;
    // Starve the tank: with almost no fuel it strands before reaching the target.
    flying.journeys[jid]!.fuel = 0.5;
    const after = tick(flying);
    expect(Object.keys(after.journeys)).toHaveLength(0); // stranded → removed
    expect(after.systems["sys-neighbor"]!.discovered).toBe(false);
    expect(after.log.some((l) => l.message.includes("stranded"))).toBe(true);
  });
});

describe("journeys: abort + determinism", () => {
  it("abort removes the journey and reveals nothing", () => {
    const s = launchReadyState();
    const launched = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
    const jid = Object.keys(launched.journeys)[0]!;
    const aborted = applyCommand(launched, { type: "abortJourney", journeyId: jid });
    expect(Object.keys(aborted.journeys)).toHaveLength(0);
    expect(aborted.systems["sys-neighbor"]!.discovered).toBe(false);
  });

  it("same seed + same command stream ⇒ identical state (deterministic)", () => {
    const run = () => {
      let s = launchReadyState(42);
      s = applyCommand(s, { type: "launchJourney", targetSystemId: "sys-neighbor" });
      const jid = Object.keys(s.journeys)[0]!;
      s = tickN(s, 3);
      s = applyCommand(s, { type: "steerJourney", journeyId: jid, turn: -1 });
      s = tickN(s, 30);
      return s;
    };
    expect(JSON.stringify(run())).toEqual(JSON.stringify(run()));
  });
});
