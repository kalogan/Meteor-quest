import { DefensePanel } from "./DefensePanel";
import { JournalButton } from "./JournalButton";
import { JournalPanel } from "./JournalPanel";
import { JournalToastHost } from "./JournalToastHost";
import { JourneyPanel } from "./JourneyPanel";
import { MobileNav } from "./MobileNav";
import { ObjectivesPanel } from "./ObjectivesPanel";
import { ResourceHud } from "./ResourceHud";
import { SpeedControls } from "./SpeedControls";
import { TacticalPanel } from "./TacticalPanel";
import { TechPanel } from "./TechPanel";
import { TierControlPanel } from "./TierControlPanel";
import "./hud.css";

/**
 * The 2D UI overlay — the seat of command. It renders authoritative sim state and
 * dispatches Commands (optimistic-cosmetic; never mutates game state).
 *
 * Responsive model (see hud.css):
 *   Desktop (> 720px): panels are corner-docked (the original feel) — ResourceHud
 *     top-left, TechPanel beside it, SpeedControls top-right, TierControlPanel below
 *     it, JourneyPanel below that, DefensePanel bottom-right, TacticalPanel
 *     bottom-center.
 *   Phone (<= 720px): docking is dropped. A top STATUS STRIP holds resources + a
 *     Journal button + speed (always visible, non-overlapping), and a bottom DRAWER
 *     stacks the heavy panels (research / command / expedition / journal / defense) as
 *     an accordion — each collapses so the canvas stays visible. Threat alerts sit just
 *     above the drawer.
 *
 * The container is a `complementary` landmark with `pointer-events:none` so the
 * God-view receives clicks; each panel re-enables pointer-events on itself. Heavy
 * panels are accessible CollapsiblePanels (header button + aria-expanded/-controls),
 * default expanded on desktop and collapsed on phones.
 *
 * Onboarding lives in the pre-game cinematic intro (see ui/intro/IntroCinematic), not
 * the HUD, so the playing surface stays unobstructed.
 *
 * Mounted by App.tsx (do not edit App here).
 */
export function Hud() {
  return (
    <aside className="hud-overlay" aria-label="Game controls">
      {/* Top status strip (phone) / docked corners (desktop). */}
      <div className="hud-strip">
        <ResourceHud />
        <JournalButton />
        <SpeedControls />
      </div>

      {/* Heavy panels: accordion drawer (phone) / docked corners (desktop). */}
      <div className="hud-drawer">
        <ObjectivesPanel />
        <TechPanel />
        <TierControlPanel />
        <JourneyPanel />
        <JournalPanel />
        <DefensePanel />
      </div>

      {/* Threat alerts — always surfaced, never collapsed. */}
      <TacticalPanel />

      {/* Phone bottom icon bar — picks which heavy panel slides up as a sheet. Hidden on desktop. */}
      <MobileNav />

      {/* Transient "new world logged" notifications. */}
      <JournalToastHost />
    </aside>
  );
}
