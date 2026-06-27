import { Shell } from "./ui/shell/Shell";

/**
 * Product entry. The game shell is the front door: it routes on the app phase
 * (`useAppPhase`) between the title screen (live galaxy backdrop + main menu) and the
 * in-game root (the real-time loop + the God-view canvas (builder #5) + the HUD/control
 * overlay (builder #6), with an Esc-toggled pause menu). The sim is authoritative; the
 * shell only drives the phase/settings/save stores.
 */
export function App() {
  return <Shell />;
}
