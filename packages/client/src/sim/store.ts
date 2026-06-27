import { create } from "zustand";
import type { Command, GameState } from "@meteor/shared";
import { applyCommand, createInitialState, tick } from "@meteor/sim-core";
import { clearSave, loadGame } from "./persist.js";

/**
 * Client store: holds the AUTHORITATIVE sim state and bridges UI -> sim. The UI
 * reads `game` and calls `dispatch`; it never mutates state itself. `advance`
 * steps the sim by N fixed ticks (driven by the RAF loop in useGameLoop).
 *
 * On boot it resumes a saved game if one exists (else a fresh DEFAULT_SEED world).
 * Autosave is wired by useGameLoop (the running game only) so the preview harness —
 * which calls reset() to explore seeds — never clobbers a player's save.
 */
interface SimStore {
  game: GameState;
  dispatch: (cmd: Command) => void;
  advance: (ticks: number) => void;
  /** Load a fresh world for `seed` WITHOUT clearing the save (used by the preview). */
  reset: (seed: number) => void;
  /** Start a brand-new game: clear the save and load a fresh world. */
  newGame: (seed: number) => void;
}

const DEFAULT_SEED = 1;

export const useSim = create<SimStore>((set) => ({
  game: loadGame() ?? createInitialState(DEFAULT_SEED),
  dispatch: (cmd) => set((s) => ({ game: applyCommand(s.game, cmd) })),
  advance: (ticks) =>
    set((s) => {
      let g = s.game;
      for (let i = 0; i < ticks; i++) g = tick(g);
      return { game: g };
    }),
  reset: (seed) => set({ game: createInitialState(seed) }),
  newGame: (seed) => {
    clearSave();
    set({ game: createInitialState(seed) });
  },
}));
