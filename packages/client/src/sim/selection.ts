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
  select: (id: string | null, kind: SelectionState["selectedKind"]) => void;
  setZoomTier: (tier: TierId) => void;
}

export const useSelection = create<SelectionState>((set) => ({
  selectedId: null,
  selectedKind: null,
  zoomTier: "planet",
  select: (selectedId, selectedKind) => set({ selectedId, selectedKind }),
  setZoomTier: (zoomTier) => set({ zoomTier }),
}));
