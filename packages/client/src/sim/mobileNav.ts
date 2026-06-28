import { create } from "zustand";

/**
 * [mobile HUD] Which heavy panel is open in the phone BOTTOM SHEET, plus a registry of the
 * panels currently available to the icon nav bar. Panels self-register while mounted (a panel
 * that conditionally renders nothing — e.g. the expedition panel before launch — simply isn't
 * registered, so its icon doesn't appear), keeping the nav in lock-step with what's on screen
 * without duplicating each panel's visibility rules. Cosmetic UI state only.
 */
export interface MobilePanelMeta {
  id: string;
  label: string;
  /** A short glyph shown in the nav bar (emoji — no icon dependency). */
  icon: string;
  /** Sort order in the nav bar (lower = leftmost). */
  order: number;
}

interface MobileNavState {
  /** The panel currently slid up as a sheet, or null when the game is unobstructed. */
  active: string | null;
  panels: Record<string, MobilePanelMeta>;
  setActive: (id: string | null) => void;
  register: (meta: MobilePanelMeta) => void;
  unregister: (id: string) => void;
}

export const useMobileNav = create<MobileNavState>((set) => ({
  active: null,
  panels: {},
  setActive: (id) => set({ active: id }),
  register: (meta) => set((s) => ({ panels: { ...s.panels, [meta.id]: meta } })),
  unregister: (id) =>
    set((s) => {
      if (!(id in s.panels)) return s;
      const panels = { ...s.panels };
      delete panels[id];
      // If the panel that just went away was the open one, close the sheet.
      return { panels, active: s.active === id ? null : s.active };
    }),
}));

/** The registered panels in nav order. */
export function navPanels(panels: Record<string, MobilePanelMeta>): MobilePanelMeta[] {
  return Object.values(panels).sort((a, b) => a.order - b.order);
}
