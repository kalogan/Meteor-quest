import { describe, expect, it } from "vitest";
import { createInitialState } from "../worldgen.js";
import { tick, tickN } from "../engine.js";
import { applyCommand } from "../commands.js";
import {
  maybeSpawnEvent,
  resolveDueEvents,
  playerDefense,
  demoteIfUnsupported,
  eventResponse,
  setEventResponse,
  type SimEvent,
} from "./threats.js";
import type { ActiveEvent, GameState } from "@meteor/shared";

/** A launched empire so threats can spawn (pre-launch is intentionally calm). */
function launched(seed = 1): GameState {
  const s = createInitialState(seed);
  s.orbitalLaunched = true;
  return s;
}

/** Run until at least one event has spawned (or give up after `max` ticks). */
function tickUntilEvent(s: GameState, max = 500): GameState {
  let cur = s;
  for (let i = 0; i < max && cur.events.length === 0; i++) cur = tick(cur);
  return cur;
}

describe("threats: determinism", () => {
  it("same seed ⇒ identical event timeline", () => {
    const a = tickN(launched(123), 300);
    const b = tickN(launched(123), 300);
    expect(a.events).toEqual(b.events);
    expect(a.log).toEqual(b.log);
  });

  it("pre-launch state spawns no events", () => {
    const s = createInitialState(5); // not launched
    const after = tickN(s, 300);
    expect(after.events.length).toBe(0);
  });

  it("a launched empire eventually faces a seeded threat", () => {
    const after = tickUntilEvent(launched(2));
    expect(after.events.length).toBeGreaterThan(0);
  });
});

describe("threats: defense formula", () => {
  it("defense rises with tech, settled planets, and authority tier", () => {
    const s = launched(1);
    const base = playerDefense(s);
    s.research.unlocked.push("basic_industry");
    expect(playerDefense(s)).toBeCloseTo(base + 0.5, 5);
    s.authorityTier = "continent";
    expect(playerDefense(s)).toBeCloseTo(base + 0.5 + 2.0, 5);
  });
});

describe("threats: resolution + mitigation", () => {
  function pirateEvent(s: GameState, severity: number): GameState {
    const evt: ActiveEvent = {
      id: "evt-test",
      kind: "pirateRaid",
      targetId: s.cradlePlanetId,
      resolvesAtTick: s.tick, // due immediately
      severity,
      mitigated: false,
    };
    s.events.push(evt);
    return s;
  }

  it("a weak threat is repelled by base defense (no resource loss)", () => {
    const s = pirateEvent(launched(1), 0.5); // below baseline defense (1)
    const minerals = s.stockpiles.minerals;
    resolveDueEvents(s);
    expect(s.events.length).toBe(0);
    expect(s.stockpiles.minerals).toBe(minerals);
  });

  it("an unmitigated strong pirate raid drains minerals", () => {
    const s = pirateEvent(launched(1), 5);
    s.stockpiles.minerals = 100;
    resolveDueEvents(s);
    expect(s.stockpiles.minerals).toBeLessThan(100);
  });

  it("fortify boosts defense enough to flip a loss into a repel", () => {
    // base defense = 1 + 1.0×(1 settled cradle) = 2.0. Severity 3 → loss without help.
    const lose = pirateEvent(launched(1), 3);
    lose.stockpiles.minerals = 100;
    resolveDueEvents(lose);
    const lossDrain = 100 - lose.stockpiles.minerals;
    expect(lossDrain).toBeGreaterThan(0);

    const win = pirateEvent(launched(1), 3);
    win.stockpiles.minerals = 100;
    setEventResponse(win.events[0]!, "fortify"); // ×1.75 → 3.5 >= 3 → repelled
    resolveDueEvents(win);
    expect(win.stockpiles.minerals).toBe(100); // repelled, no loss
  });

  it("setEventResponse records the response and marks mitigated", () => {
    const s = pirateEvent(launched(1), 2);
    setEventResponse(s.events[0]!, "evacuate");
    expect(eventResponse(s.events[0]!)).toBe("evacuate");
    expect((s.events[0] as SimEvent).mitigated).toBe(true);
  });

  it("respondToEvent command wires the response through", () => {
    let s = pirateEvent(launched(1), 2);
    s = applyCommand(s, { type: "respondToEvent", eventId: "evt-test", response: "fortify" });
    expect(eventResponse(s.events[0]!)).toBe("fortify");
  });
});

describe("threats: planet destruction + authority demotion", () => {
  /** Settle a second planet so the empire holds at system tier. */
  function twoPlanetSystemTier(seed = 1): GameState {
    const s = launched(seed);
    // Settle a neighbor planet to reach 2 settled planets.
    const neighbor = s.planets["planet-neighbor-0"]!;
    neighbor.settled = true;
    s.authorityTier = "system"; // territory (2 settled) supports system tier
    return s;
  }

  it("an unmitigated meteor unsettles its target colony (territory loss)", () => {
    const s = twoPlanetSystemTier();
    const target = "planet-neighbor-0";
    const evt: SimEvent = {
      id: "evt-meteor",
      kind: "meteor",
      targetId: target,
      resolvesAtTick: s.tick,
      severity: 100, // far above any defense → guaranteed loss
      mitigated: false,
    };
    s.events.push(evt);
    resolveDueEvents(s);
    expect(s.planets[target]!.settled).toBe(false);
  });

  it("losing a planet demotes authority below the unsupported tier", () => {
    const s = twoPlanetSystemTier();
    expect(s.authorityTier).toBe("system");
    s.planets["planet-neighbor-0"]!.settled = false; // now only 1 settled planet
    demoteIfUnsupported(s);
    // system tier needs 2 settled planets; with 1 it must contract.
    expect(s.authorityTier).not.toBe("system");
  });

  it("evacuating a meteor SAVES the colony (no territory loss)", () => {
    const s = twoPlanetSystemTier();
    const target = "planet-neighbor-0";
    const evt: SimEvent = {
      id: "evt-meteor2",
      kind: "meteor",
      targetId: target,
      resolvesAtTick: s.tick,
      severity: 100,
      mitigated: false,
      response: "evacuate",
    };
    s.events.push(evt);
    resolveDueEvents(s);
    expect(s.planets[target]!.settled).toBe(true); // saved by evacuation
  });

  it("the cradle is never destroyed (run-ending guard)", () => {
    const s = launched(1);
    const evt: SimEvent = {
      id: "evt-meteor-cradle",
      kind: "supernova",
      targetId: s.cradlePlanetId,
      resolvesAtTick: s.tick,
      severity: 100,
      mitigated: false,
    };
    s.events.push(evt);
    resolveDueEvents(s);
    expect(s.planets[s.cradlePlanetId]!.settled).toBe(true);
  });
});

describe("threats: spawn caps", () => {
  it("never exceeds the active-event cap", () => {
    const after = tickN(launched(42), 500);
    expect(after.events.length).toBeLessThanOrEqual(3);
  });

  it("maybeSpawnEvent is a no-op pre-launch", () => {
    const s = createInitialState(1);
    s.tick = 10;
    maybeSpawnEvent(s);
    expect(s.events.length).toBe(0);
  });
});
