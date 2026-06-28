import { create } from "zustand";
import { isPhoneViewport } from "../ui/CollapsiblePanel";

/**
 * [journal] Open/closed state for the travel Journal panel, lifted out of the panel so a
 * dedicated HUD button (in the status strip) can toggle it. Cosmetic UI state only. Defaults
 * open on desktop (it docks on the left rail) and closed on phones (where the strip button
 * pulls it up over the drawer on demand).
 */
interface JournalUiState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useJournalUi = create<JournalUiState>((set) => ({
  open: !isPhoneViewport(),
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
