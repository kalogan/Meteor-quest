import { useEffect, useRef, type CSSProperties, type JSX } from "react";
import { PANEL_BG, MUTED_TEXT } from "./theme";

/**
 * [journal] Transient "new world logged" toast stack for the travel Journal. When the player
 * charts a new world, a small card slides in near the top-center, announces the world was logged,
 * then auto-dismisses after 4s. This component is PURELY PROP-DRIVEN: the parent owns the list of
 * items and the dismissal — we only render and schedule the auto-dismiss timers.
 *
 * Placed top-center (not bottom) so it clears the bottom-docked HUD panels.
 */

export interface JournalToastItem {
  /** planet id (stable key) */
  id: string;
  /** planet name, e.g. "Vega Reach II" */
  name: string;
  /** hex tint, e.g. the biome color "#7fc8ff" */
  accent: string;
}

/**
 * Reduced-motion preference. Mirrors the rest of the codebase: an explicit
 * `data-reduced-motion` flag on <html> overrides, otherwise fall back to the media query.
 */
function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined") {
    const flag = document.documentElement.dataset.reducedMotion;
    if (flag === "on") return true;
    if (flag === "off") return false;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

const AUTO_DISMISS_MS = 4000;

const containerStyle: CSSProperties = {
  position: "fixed",
  // Sit just below the top-center Journal button so a new-world toast reads as dropping from it
  // (and never overlaps the button row).
  top: 54,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 50,
  pointerEvents: "none",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "center",
};

const cardStyle: CSSProperties = {
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 220,
  maxWidth: 320,
  boxSizing: "border-box",
  background: PANEL_BG,
  border: "1px solid #243150",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#e8edf6",
  backdropFilter: "blur(4px)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  font: '500 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
};

const closeButtonStyle: CSSProperties = {
  appearance: "none",
  flex: "0 0 auto",
  width: 24,
  height: 24,
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  font: "inherit",
  fontSize: 16,
  lineHeight: 1,
  color: "#fff",
  background: "transparent",
  border: "1px solid #3a4668",
  borderRadius: 6,
  cursor: "pointer",
};

export function JournalToast({
  items,
  onDismiss,
}: {
  items: JournalToastItem[];
  onDismiss: (id: string) => void;
}): JSX.Element {
  // Track active timers per id so re-renders don't double-schedule.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    // Ensure a timer exists for every currently-present item.
    for (const item of items) {
      if (!timers.has(item.id)) {
        timers.set(
          item.id,
          setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS),
        );
      }
    }
    // Cleanup clears ALL timers and empties the map so the next run re-schedules honestly.
    return () => {
      for (const handle of timers.values()) {
        clearTimeout(handle);
      }
      timers.clear();
    };
  }, [items, onDismiss]);

  const reduced = prefersReducedMotion();
  const cardTransition: CSSProperties = reduced
    ? {}
    : { transition: "opacity 200ms ease, transform 200ms ease" };

  return (
    <div role="status" aria-live="polite" aria-atomic="false" style={containerStyle}>
      {items.map((item) => (
        <div key={item.id} data-testid="journal-toast" style={{ ...cardStyle, ...cardTransition }}>
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
            📖
          </span>
          <span
            aria-hidden="true"
            style={{
              flex: "0 0 auto",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: item.accent,
            }}
          />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontWeight: 700 }}>New world logged</span>
            <span style={{ color: MUTED_TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
          </span>
          <button
            type="button"
            aria-label={`dismiss ${item.name} notification`}
            data-testid="journal-toast-close"
            onClick={() => onDismiss(item.id)}
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
