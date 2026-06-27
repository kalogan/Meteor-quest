import { create } from "zustand";

/**
 * [preview avatar] Tunable physics + feel for the walkable surface sandbox. Read by the
 * AvatarMode controller each frame (via getState) and edited live from the avatar panel.
 * Per-planet gravity/grip come from `planetSurface`; `gravityScale` multiplies gravity
 * globally so you can dial the whole solar system heavier/lighter. Preview-only.
 */
export interface AvatarConfig {
  gravityScale: number; // × the per-planet gravity (1 = as authored)
  baseG: number; // units/s² at 1.0 g
  moveAccel: number; // ground acceleration (units/s²)
  maxSpeed: number; // horizontal speed cap (units/s)
  friction: number; // ground damping coefficient, scaled by the world's grip
  airControl: number; // 0..1 — fraction of move accel while airborne
  jumpSpeed: number; // jump launch speed (units/s)
}

export const AVATAR_DEFAULTS: AvatarConfig = {
  gravityScale: 1,
  baseG: 18,
  moveAccel: 30,
  maxSpeed: 4.6,
  friction: 8,
  airControl: 0.4,
  jumpSpeed: 6.4,
};

interface AvatarConfigState extends AvatarConfig {
  set: (patch: Partial<AvatarConfig>) => void;
  reset: () => void;
}

export const useAvatarConfig = create<AvatarConfigState>((set) => ({
  ...AVATAR_DEFAULTS,
  set: (patch) => set(patch),
  reset: () => set({ ...AVATAR_DEFAULTS }),
}));
