import { create } from "zustand";

/**
 * [tech props] Transient hover state for the 3D "what built this?" tooltip. A prop in the
 * God-view sets this on pointer-over (with the cursor's screen coords); the PropTooltip
 * DOM overlay reads it and renders a label by the cursor. Purely cosmetic view state, like
 * useSelection — never authoritative game state.
 *
 * The world layer writes via `getState()` (never a hook), so hovering does NOT re-render
 * the 3D scene — only the small tooltip component subscribes. `hide(kind)` only clears if
 * the leaving prop is still the shown one, so sliding between adjacent props doesn't flicker
 * (the new prop's `show` wins over the old prop's `hide`).
 */
export interface PropHoverInfo {
  /** The prop kind (unique per structure) — also the de-dupe key for hide(). */
  kind: string;
  title: string;
  blurb: string;
  /** The tech that unlocked this structure (content tech.name). */
  techName: string;
  category: string;
}

interface PropHoverState {
  info: PropHoverInfo | null;
  /** Cursor position in viewport (client) pixels. */
  x: number;
  y: number;
  show: (info: PropHoverInfo, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: (kind: string) => void;
}

export const usePropHover = create<PropHoverState>((set, get) => ({
  info: null,
  x: 0,
  y: 0,
  show: (info, x, y) => set({ info, x, y }),
  move: (x, y) => {
    if (get().info) set({ x, y });
  },
  hide: (kind) => {
    if (get().info?.kind === kind) set({ info: null });
  },
}));
