import { describe, expect, it, beforeEach } from "vitest";
import { useSim } from "./store.js";

describe("sim store bridge", () => {
  beforeEach(() => useSim.getState().reset(1));

  it("dispatches commands authoritatively", () => {
    useSim.getState().dispatch({ type: "setTimeScale", scale: 2 });
    expect(useSim.getState().game.timeScale).toBe(2);
  });

  it("advances the sim by fixed ticks", () => {
    const t0 = useSim.getState().game.tick;
    useSim.getState().advance(5);
    expect(useSim.getState().game.tick).toBe(t0 + 5);
  });
});
