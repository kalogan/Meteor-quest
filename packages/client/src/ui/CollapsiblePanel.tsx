import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { panel } from "./theme";

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
 */
export function CollapsiblePanel({
  title,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
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
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const headerId = useId();
  const regionId = useId();

  return (
    <section
      role="region"
      aria-labelledby={headerId}
      className={["hud-panel", "hud-collapsible", className].filter(Boolean).join(" ")}
      style={{ ...panel, ...style }}
    >
      <button
        type="button"
        id={headerId}
        className="hud-collapsible__header"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={toggle}
      >
        <span className="hud-collapsible__title">{title}</span>
        <span className="hud-collapsible__chevron" aria-hidden="true">
          ▶
        </span>
      </button>
      <div id={regionId} className="hud-collapsible__region" hidden={!open}>
        <div className="hud-collapsible__body">{children}</div>
      </div>
    </section>
  );
}

/** True when the viewport is in the phone layout band. Used to seed default-open
 *  (collapsed on mobile, expanded on desktop). Read once at mount; resizing across
 *  the breakpoint is an edge case the explicit toggle already covers. */
export function isPhoneViewport(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 720px)").matches;
}
