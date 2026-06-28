import { useMobileNav, navPanels } from "../sim/mobileNav";
import { useIsPhone } from "./CollapsiblePanel";

/**
 * [HUD action bar] The unified panel selector — a bottom icon bar on phones, a centered bottom
 * pill on desktop. One icon per available heavy panel (panels self-register, so this stays in
 * lock-step with what's on screen). On PHONE, tapping opens that panel as a sheet and closes any
 * other (one at a time). On DESKTOP, tapping toggles that panel independently, so you can have
 * several open side-by-side above the bar. Tapping an open icon closes it; the game stays visible.
 *
 * Accessibility: a labelled nav landmark; each icon is a real button with aria-pressed (open
 * state) and a text label (never icon-only), meeting button-name + touch-target requirements.
 */
export function MobileNav() {
  const openIds = useMobileNav((s) => s.openIds);
  const toggle = useMobileNav((s) => s.toggle);
  const selectOnly = useMobileNav((s) => s.selectOnly);
  const panels = useMobileNav((s) => s.panels);
  const isPhone = useIsPhone();
  const items = navPanels(panels);

  if (items.length === 0) return null;

  return (
    <nav className="hud-mobile-nav" aria-label="Game panels">
      {items.map((p) => {
        const isActive = openIds.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            className="hud-mobile-nav__btn"
            data-testid={`mobile-nav-${p.id}`}
            aria-pressed={isActive}
            onClick={() => (isPhone ? selectOnly(isActive ? null : p.id) : toggle(p.id))}
          >
            <span className="hud-mobile-nav__icon" aria-hidden="true">{p.icon}</span>
            <span className="hud-mobile-nav__label">{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
