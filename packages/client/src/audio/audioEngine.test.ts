import { describe, expect, it } from "vitest";
import { createInitialState } from "@meteor/sim-core";
import type { GameState } from "@meteor/shared";
import { detectSfx } from "./audioEngine.js";

/**
 * `detectSfx` is the pure transition→cue mapper. These tests focus on the "logged"
 * cue (a world charted into the Journal): a planet flipping `scanned` false→true.
 * We build states by cloning a real initial world and toggling `scanned` flags so the
 * fixtures stay schema-faithful without hand-rolling a partial cast.
 */

/** Deep clone via structuredClone — keeps each state independently mutable. */
function clone(state: GameState): GameState {
  return structuredClone(state);
}

/** Ids of every planet that is currently scanned, for targeted flips. */
function scannedIds(state: GameState): string[] {
  return Object.keys(state.planets).filter((id) => state.planets[id]?.scanned === true);
}

/** Ids of every planet that is currently NOT scanned, for targeted flips. */
function unscannedIds(state: GameState): string[] {
  return Object.keys(state.planets).filter((id) => state.planets[id]?.scanned !== true);
}

describe("detectSfx — logged cue", () => {
  it("returns [] on the baseline emission even with scanned planets", () => {
    const state = createInitialState(1);
    // Sanity: a fresh world has at least one scanned planet (the cradle).
    expect(scannedIds(state).length).toBeGreaterThan(0);
    expect(detectSfx(state, undefined)).toEqual([]);
  });

  it("emits exactly one 'logged' when a planet flips false→true", () => {
    const prev = createInitialState(1);
    const next = clone(prev);
    const target = unscannedIds(next)[0];
    expect(target).toBeDefined();
    next.planets[target!]!.scanned = true;
    expect(detectSfx(next, prev)).toEqual(["logged"]);
  });

  it("emits no 'logged' when no planet's scanned flag changes", () => {
    const prev = createInitialState(1);
    const next = clone(prev);
    expect(detectSfx(next, prev)).not.toContain("logged");
  });

  it("dedupes to a single 'logged' when two planets are scanned in one step", () => {
    const prev = createInitialState(1);
    const next = clone(prev);
    const targets = unscannedIds(next).slice(0, 2);
    expect(targets.length).toBe(2);
    for (const id of targets) next.planets[id]!.scanned = true;
    expect(detectSfx(next, prev).filter((c) => c === "logged")).toEqual(["logged"]);
  });
});
