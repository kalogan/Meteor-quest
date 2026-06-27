import { create } from "zustand";
import type { TierId } from "@meteor/shared";

/**
 * Shared UI selection + zoom state — the seam between the God-view (world/, sets
 * selection on click and drives the camera) and the HUD (ui/, reads selection to
 * show the right context panel). Kept separate from the sim store: this is
 * cosmetic view state, never authoritative game state.
 */
export interface SelectionState {
  /** Currently focused entity id (system/planet/continent/city), or null. */
  selectedId: string | null;
  /** Kind of the selected entity, so panels know which controls to show. */
  selectedKind: "system" | "planet" | "continent" | "city" | null;
  /** The zoom tier the camera is currently framing (may differ from authority). */
  zoomTier: TierId;
  /**
   * [surface dive] True when the camera has descended below city tier to the planet's
   * surface — drives the SurfaceView (terrain patch + horizon) and the Descend/Surface
   * button label. Kept SEPARATE from zoomTier (which stays a TierId) so HUD tier logic is
   * untouched; the camera rig is the single writer, deriving it from the live distance.
   */
  nearSurface: boolean;
  /**
   * [surface dive] One-shot framing command for the Descend / Pull-up buttons. The rig
   * watches the token and flies to a landed surface pose ("surface") or back out to the
   * focused planet ("planet"). A counter, so repeated requests of the same level re-fire.
   */
  frameRequest: { level: "surface" | "planet"; token: number } | null;
  select: (id: string | null, kind: SelectionState["selectedKind"]) => void;
  setZoomTier: (tier: TierId) => void;
  setNearSurface: (near: boolean) => void;
  requestFrame: (level: "surface" | "planet") => void;
}

export const useSelection = create<SelectionState>((set) => ({
  selectedId: null,
  selectedKind: null,
  zoomTier: "planet",
  nearSurface: false,
  frameRequest: null,
  select: (selectedId, selectedKind) => set({ selectedId, selectedKind }),
  setZoomTier: (zoomTier) => set({ zoomTier }),
  setNearSurface: (nearSurface) =>
    set((s) => (s.nearSurface === nearSurface ? s : { nearSurface })),
  requestFrame: (level) =>
    set((s) => ({ frameRequest: { level, token: (s.frameRequest?.token ?? 0) + 1 } })),
}));
