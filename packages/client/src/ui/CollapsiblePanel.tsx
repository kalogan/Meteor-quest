import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { panel } from "./theme";
import { useMobileNav } from "../sim/mobileNav";

/**
 * Accessible collapsible panel primitive — the single, reusable building block for
 * every heavy HUD panel (DRY). It is a landmark region with a header that is a real
 * toggle button.
 *
 * ARIA contract:
 *   - The wrapper is a `<section role="region">` named by its header (aria-labelledby),
 *     so each panel is a discoverable landmark.
 *   - The header is a real `<button>` carrying `aria-expanded` (open state) and
 *     `aria-controls` pointing at the collapsible region's id.
 *   - The collapsible region has the matching `id` and is `hidden` when collapsed
 *     (removed from the a11y tree + tab order, not just visually clipped).
 *
 * Open/closed state lives in component state; `defaultOpen` seeds it (callers pass
 * the desktop-vs-mobile default). The control is optimistic-cosmetic: it touches no
 * sim state.
 *
 * Mobile bottom-sheet mode (when `mobileId` is set and the viewport is a phone): the panel
 * registers itself in the mobile nav (so the icon bar can offer it) and renders as a bottom
 * SHEET — shown only when it is the nav's active panel, occupying the lower third so the game
 * stays visible above. The header doubles as the sheet's close control. Desktop is unchanged.
 */
export function CollapsiblePanel({
  title,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  mobileId,
  mobileLabel,
  mobileIcon = "•",
  mobileOrder = 0,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state. When provided, the panel is driven by the caller (e.g. a HUD
   *  button via a store) and internal toggle state is ignored. Omit for uncontrolled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
  /** Opt this panel into the phone bottom-sheet nav under this stable id. */
  mobileId?: string;
  /** Label + glyph + sort order for the mobile nav icon (required alongside `mobileId`). */
  mobileLabel?: string;
  mobileIcon?: string;
  mobileOrder?: number;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const headerId = useId();
  const regionId = useId();

  const isPhone = useIsPhone();
  const openIds = useMobileNav((s) => s.openIds);
  const closePanel = useMobileNav((s) => s.close);
  const register = useMobileNav((s) => s.register);
  const unregister = useMobileNav((s) => s.unregister);

  // Register in the mobile nav while mounted (i.e. while this panel is available). A panel that
  // conditionally renders nothing never registers, so its icon won't appear. NB: `title` is
  // deliberately NOT a dependency — it can change every render (e.g. a live count) and would
  // thrash the registry; mobileLabel is the stable nav label.
  useEffect(() => {
    if (mobileId === undefined) return;
    register({ id: mobileId, label: mobileLabel ?? mobileId, icon: mobileIcon, order: mobileOrder });
    return () => unregister(mobileId);
  }, [mobileId, mobileLabel, mobileIcon, mobileOrder, register, unregister]);

  // Nav-controlled panels (those with a mobileId) open ONE AT A TIME from the action bar on
  // BOTH breakpoints — a bottom SHEET on phones, a docked panel on desktop — instead of all
  // corner-docking at once (which overlapped on wide-but-short / busy screens). They render
  // only while active; otherwise they return null (still mounted → still registered in the nav).
  const navControlled = mobileId !== undefined;
  const navActive_ = mobileId !== undefined && openIds.includes(mobileId);
  const open = navControlled ? true : (controlledOpen ?? uncontrolledOpen);

  const toggle = () => {
    if (navControlled) {
      if (mobileId !== undefined) closePanel(mobileId); // the header doubles as the close control
      return;
    }
    const next = !open;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  if (navControlled && !navActive_) return null;

  const classes = [
    "hud-panel",
    "hud-collapsible",
    className,
    navControlled ? (isPhone ? "hud-collapsible--sheet" : "hud-collapsible--dock") : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      role="region"
      aria-labelledby={headerId}
      className={classes}
      style={{ ...panel, ...style }}
    >
      <button
        type="button"
        id={headerId}
        className="hud-collapsible__header"
        aria-expanded={open}
        aria-controls={regionId}
        aria-label={navControlled ? `Close ${mobileLabel ?? mobileId}` : undefined}
        onClick={toggle}
      >
        <span className="hud-collapsible__title">{title}</span>
        <span className="hud-collapsible__chevron" aria-hidden="true">
          {navControlled ? "✕" : "▶"}
        </span>
      </button>
      <div id={regionId} className="hud-collapsible__region" hidden={!open}>
        <div className="hud-collapsible__body">{children}</div>
      </div>
    </section>
  );
}

/** True when the viewport is in the phone layout band. Read once at mount; used to seed
 *  default-open (collapsed on mobile, expanded on desktop). For reactive layout, use
 *  `useIsPhone`. */
export function isPhoneViewport(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 720px)").matches;
}

/** Reactive phone-band flag — tracks the breakpoint across resize/rotation so the mobile
 *  bottom-sheet behavior switches correctly without a reload. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhoneViewport);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 720px)");
    const onChange = (): void => setPhone(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return phone;
}
