import { useEffect, useId, useRef, useState } from "react";
import { panel } from "./theme";

/**
 * [objectives] First-time welcome — a brief, dismissible onboarding card shown ONCE.
 *
 * It explains the premise in one short paragraph and points the player at the
 * objectives, then gets out of the way. It never blocks the game: the sim keeps
 * ticking behind it and dismissing leaves the running world untouched.
 *
 * "Seen" persists to localStorage under a settings-adjacent key, so it appears the
 * first session and never again (a New Game does not re-show it; the premise hasn't
 * changed). SSR/quota failures degrade to "show it" / "can't persist" gracefully.
 *
 * A11y: a real `role="dialog"` + `aria-modal`, labelled by its heading, focus moved
 * to the dismiss button on mount and restored on close, Escape + a real button to
 * dismiss. It mounts in the HUD overlay (optimistic-cosmetic; touches no sim state).
 */

const SEEN_KEY = "meteor-quest:intro-seen";

function hasSeenIntro(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // can't read storage → don't nag
  }
}

function markIntroSeen(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* quota/SSR: best-effort, the card simply may reappear next session */
  }
}

export function IntroDialog() {
  const [open, setOpen] = useState(() => !hasSeenIntro());
  const headingId = useId();
  const bodyId = useId();
  const dismissRef = useRef<HTMLButtonElement>(null);

  function dismiss() {
    markIntroSeen();
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dismissRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        markIntroSeen();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      className="hud-intro-card"
      style={{ ...panel, position: "fixed", inset: "auto", width: "min(420px, 92vw)" }}
    >
      <h2 id={headingId} style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>
        Welcome, Founder
      </h2>
      <p id={bodyId} style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5, color: "#e8edf6" }}>
        You begin with a single cradle world and grow it into a galactic civilization —
        research your way up the authority ladder, launch into orbit, explore neighbouring
        systems, and settle new worlds. Follow the <strong>Objectives</strong> panel: it
        always shows your next step.
      </p>
      <button
        ref={dismissRef}
        type="button"
        onClick={dismiss}
        className="hud-intro-dismiss"
      >
        Begin
      </button>
    </div>
  );
}
