import { create } from "zustand";

/**
 * [HUD action bar] Which heavy panels are OPEN, plus a registry of the panels available to the
 * icon bar. Panels self-register while mounted (a panel that conditionally renders nothing — e.g.
 * the expedition panel before launch — isn't registered, so its icon doesn't appear), keeping the
 * bar in lock-step with what's on screen without duplicating each panel's visibility rules.
 *
 * Open is a SET so desktop can have several panels open side-by-side; phones keep it to one at a
 * time (the nav bar calls `selectOnly` there). Cosmetic UI state only.
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
  /** Ids of the panels currently open (a docked panel each on desktop; one sheet on phone). */
  openIds: string[];
  panels: Record<string, MobilePanelMeta>;
  isOpen: (id: string) => boolean;
  open: (id: string) => void;
  close: (id: string) => void;
  /** Toggle one panel's open state (desktop: independent, multiple allowed). */
  toggle: (id: string) => void;
  /** Open exactly this one (or close all when null) — the phone single-sheet behavior. */
  selectOnly: (id: string | null) => void;
  register: (meta: MobilePanelMeta) => void;
  unregister: (id: string) => void;
}

export const useMobileNav = create<MobileNavState>((set, get) => ({
  openIds: [],
  panels: {},
  isOpen: (id) => get().openIds.includes(id),
  open: (id) => set((s) => (s.openIds.includes(id) ? s : { openIds: [...s.openIds, id] })),
  close: (id) => set((s) => ({ openIds: s.openIds.filter((x) => x !== id) })),
  toggle: (id) =>
    set((s) => (s.openIds.includes(id) ? { openIds: s.openIds.filter((x) => x !== id) } : { openIds: [...s.openIds, id] })),
  selectOnly: (id) => set({ openIds: id === null ? [] : [id] }),
  register: (meta) => set((s) => ({ panels: { ...s.panels, [meta.id]: meta } })),
  unregister: (id) =>
    set((s) => {
      if (!(id in s.panels) && !s.openIds.includes(id)) return s;
      const panels = { ...s.panels };
      delete panels[id];
      // If the panel that just went away was open, drop it too.
      return { panels, openIds: s.openIds.filter((x) => x !== id) };
    }),
}));

/** The registered panels in nav order. */
export function navPanels(panels: Record<string, MobilePanelMeta>): MobilePanelMeta[] {
  return Object.values(panels).sort((a, b) => a.order - b.order);
}
