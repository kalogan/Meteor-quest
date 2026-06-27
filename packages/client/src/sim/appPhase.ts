import { create } from "zustand";

/**
 * App phase — the game-shell state machine. The shell (App + menus) routes on this;
 * the game loop only ticks while `playing` (so title/intro/pause freeze the sim). Not
 * persisted: every launch opens on the title screen.
 *
 * `intro` plays the cinematic onboarding after New Game (the ship emerging from the
 * dark toward the cradle, with stepped instructions) before handing off to `playing`.
 */
export type AppPhase = "title" | "intro" | "playing" | "paused";

interface AppPhaseStore {
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;
}

export const useAppPhase = create<AppPhaseStore>((set) => ({
  phase: "title",
  setPhase: (phase) => set({ phase }),
}));
