import { create } from "zustand";

/**
 * [surface dive] The single home for the surface dive / roam TASTE KNOBS. SurfaceView +
 * CameraRig read these instead of hardcoded constants, so the Director can tune the whole
 * landed experience live from the preview harness (preview/SurfaceTuner) without code edits.
 * In the shipped game nothing mutates it → the defaults are what players get.
 *
 * Radius-relative values are MULTIPLES of the planet radius (so they scale per-world); a few
 * (segs, hazeOpacity, structureCount) are absolute. Defaults equal the values these knobs
 * had when they were inlined — exposing them changes nothing until you move a slider.
 */
export interface SurfaceConfig {
  /** Terrain. */
  arenaSize: number; // × radius — patch width (roam room before the rim)
  relief: number; // × radius — low-relief amplitude
  dome: number; // × radius — edge-dome strength → how the horizon curves
  segs: number; // mesh grid resolution (perf vs smoothness)
  /** Look. */
  hazeOpacity: number; // 0..1 — horizon atmosphere band
  structureScale: number; // × radius — colony building size
  structureCount: number; // max structures placed on the patch
  /** Landed camera pose. */
  eyeHeight: number; // × radius — camera height above the ground
  standBack: number; // × radius — how far behind the surface point the eye sits
  lookAhead: number; // × radius — how far ahead the gaze targets
  lookDrop: number; // × radius — how much the gaze dips below eye level
  /** Roam. */
  roamSpeed: number; // × radius / second — WASD / pan move speed
  pitchMin: number; // × radius — min camera height (clamps look-up)
  pitchMax: number; // × radius — max camera height (clamps look-down / bird's-eye)
}

export const SURFACE_DEFAULTS: SurfaceConfig = {
  arenaSize: 14,
  relief: 0.1,
  dome: 0.16,
  segs: 44,
  hazeOpacity: 0.22,
  structureScale: 0.2,
  structureCount: 6,
  eyeHeight: 0.22,
  standBack: 0.15,
  lookAhead: 1.3,
  lookDrop: 0.04,
  roamSpeed: 1.7,
  pitchMin: 0.08,
  pitchMax: 0.62,
};

interface SurfaceConfigState extends SurfaceConfig {
  set: (patch: Partial<SurfaceConfig>) => void;
  reset: () => void;
}

export const useSurfaceConfig = create<SurfaceConfigState>((set) => ({
  ...SURFACE_DEFAULTS,
  set: (patch) => set(patch),
  reset: () => set({ ...SURFACE_DEFAULTS }),
}));
