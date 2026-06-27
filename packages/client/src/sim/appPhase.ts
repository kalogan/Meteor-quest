import { create } from "zustand";

/**
 * App phase — the game-shell state machine. The shell (App + menus) routes on this;
 * the game loop only ticks while `playing` (so title/pause freeze the sim). Not
 * persisted: every launch opens on the title screen.
 */
export type AppPhase = "title" | "playing" | "paused";

interface AppPhaseStore {
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;
}

export const useAppPhase = create<AppPhaseStore>((set) => ({
  phase: "title",
  setPhase: (phase) => set({ phase }),
}));
