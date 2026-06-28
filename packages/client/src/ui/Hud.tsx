import { DefensePanel } from "./DefensePanel";
import { JournalPanel } from "./JournalPanel";
import { JournalToastHost } from "./JournalToastHost";
import { JourneyPanel } from "./JourneyPanel";
import { MobileNav } from "./MobileNav";
import { ObjectivesPanel } from "./ObjectivesPanel";
import { ResourceHud } from "./ResourceHud";
import { SettingsHud } from "./SettingsHud";
import { TacticalPanel } from "./TacticalPanel";
import { TechPanel } from "./TechPanel";
import { TierControlPanel } from "./TierControlPanel";
import "./hud.css";

/**
 * The 2D UI overlay — the seat of command. It renders authoritative sim state and
 * dispatches Commands (optimistic-cosmetic; never mutates game state).
 *
 * Unified ACTION-BAR model (see hud.css + MobileNav): the heavy panels (Goals / Research /
 * Command / Travel / Journal / Defense / Settings) are opened ONE AT A TIME from a single icon
 * action bar — a bottom sheet on phones, a docked panel on desktop — so they never overlap and
 * the game stays visible. The always-on ResourceHud (top-left card on desktop, thin chip bar on
 * phone) and the threat TacticalPanel sit outside the bar. Speed + audio + motion live in the
 * Settings panel.
 *
 * The container is a `complementary` landmark with `pointer-events:none` so the God-view
 * receives clicks; each panel/control re-enables pointer-events on itself. Heavy panels are
 * accessible CollapsiblePanels (header button + aria-expanded/-controls).
 *
 * Onboarding lives in the pre-game cinematic intro (see ui/intro/IntroCinematic), not the HUD.
 * Mounted by App.tsx (do not edit App here).
 */
export function Hud() {
  return (
    <aside className="hud-overlay" aria-label="Game controls">
      {/* Always-on resource readout (top-left card / phone chip bar). */}
      <div className="hud-strip">
        <ResourceHud />
      </div>

      {/* Heavy panels — each opens one-at-a-time from the action bar (sheet on phone, dock on
          desktop). They self-register their nav icon while mounted/available. */}
      <div className="hud-drawer">
        <ObjectivesPanel />
        <TechPanel />
        <TierControlPanel />
        <JourneyPanel />
        <JournalPanel />
        <DefensePanel />
        <SettingsHud />
      </div>

      {/* Threat alerts — always surfaced, never collapsed. */}
      <TacticalPanel />

      {/* The unified action bar: icons for every available panel (phone bottom bar / desktop
          centered pill). */}
      <MobileNav />

      {/* Transient "new world logged" notifications. */}
      <JournalToastHost />
    </aside>
  );
}
