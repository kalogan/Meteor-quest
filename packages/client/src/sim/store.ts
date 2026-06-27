import { create } from "zustand";
import type { Command, GameState } from "@meteor/shared";
import { applyCommand, createInitialState, tick } from "@meteor/sim-core";

/**
 * Client store: holds the AUTHORITATIVE sim state and bridges UI -> sim. The UI
 * reads `game` and calls `dispatch`; it never mutates state itself. `advance`
 * steps the sim by N fixed ticks (driven by the RAF loop in useGameLoop).
 */
interface SimStore {
  game: GameState;
  dispatch: (cmd: Command) => void;
  advance: (ticks: number) => void;
  reset: (seed: number) => void;
}

const DEFAULT_SEED = 1;

export const useSim = create<SimStore>((set) => ({
  game: createInitialState(DEFAULT_SEED),
  dispatch: (cmd) => set((s) => ({ game: applyCommand(s.game, cmd) })),
  advance: (ticks) =>
    set((s) => {
      let g = s.game;
      for (let i = 0; i < ticks; i++) g = tick(g);
      return { game: g };
    }),
  reset: (seed) => set({ game: createInitialState(seed) }),
}));
