import { EventPrompts } from "./EventPrompts";
import { ResourceHud } from "./ResourceHud";
import { SpeedControls } from "./SpeedControls";
import { TechPanel } from "./TechPanel";
import { TierControlPanel } from "./TierControlPanel";

/**
 * The 2D UI overlay — the seat of command. It renders authoritative sim state and
 * dispatches Commands (optimistic-cosmetic; never mutates game state). Layout:
 *
 *   top-left   ResourceHud      stockpiles + per-second rates
 *   left       TechPanel        the tech tree (prereq + resource gated)
 *   top-right  SpeedControls    pause / 1× / 2× / 3×
 *   right      TierControlPanel the abstraction-zoom payoff: its controls CHANGE
 *                               with game.authorityTier (city focus → continent →
 *                               planet policy → system travel/scan/settle)
 *   bottom     EventPrompts     fortify / evacuate / ignore on active threats
 *
 * Mounted by App.tsx (do not edit App here). `inset:0 pointerEvents:none` lets the
 * God-view receive clicks; each panel re-enables pointer events on itself.
 */
export function Hud() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <ResourceHud />
      <TechPanel />
      <SpeedControls />
      <TierControlPanel />
      <EventPrompts />
    </div>
  );
}
