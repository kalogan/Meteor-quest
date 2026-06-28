import { useMobileNav, navPanels } from "../sim/mobileNav";

/**
 * [mobile HUD] The phone BOTTOM ICON BAR. One icon per available heavy panel (panels
 * self-register, so this stays in lock-step with what's on screen). Tapping an icon slides that
 * panel up as a sheet over the lower third; tapping the active icon again closes it, so the game
 * stays visible. Hidden on desktop (CSS), where panels corner-dock instead.
 *
 * Accessibility: a labelled nav landmark; each icon is a real button with aria-pressed (open
 * state) and a text label (never icon-only), meeting button-name + touch-target requirements.
 */
export function MobileNav() {
  const active = useMobileNav((s) => s.active);
  const setActive = useMobileNav((s) => s.setActive);
  const panels = useMobileNav((s) => s.panels);
  const items = navPanels(panels);

  if (items.length === 0) return null;

  return (
    <nav className="hud-mobile-nav" aria-label="Game panels">
      {items.map((p) => {
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            type="button"
            className="hud-mobile-nav__btn"
            data-testid={`mobile-nav-${p.id}`}
            aria-pressed={isActive}
            onClick={() => setActive(isActive ? null : p.id)}
          >
            <span className="hud-mobile-nav__icon" aria-hidden="true">{p.icon}</span>
            <span className="hud-mobile-nav__label">{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
