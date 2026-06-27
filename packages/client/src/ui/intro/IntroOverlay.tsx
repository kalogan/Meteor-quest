import { useEffect, useId, useRef, useState } from "react";
import "./intro.css";

/**
 * [intro] The 2D half of the cinematic onboarding: a single, mobile-safe card that
 * steps through a few onboarding lines as the ship nears the cradle, then hands off to
 * the game. It sits above the intro <Canvas> (see IntroCinematic) and is purely
 * cosmetic — it never touches sim state.
 *
 * Flow: the card fades in shortly after the scene starts (so the player first SEES the
 * ship emerge), then advances on a Next button; the final step's button is "Begin".
 * Skip is always available, and Escape skips. onFinish fires on Begin OR Skip — the
 * host routes it (in-game → phase 'playing'; preview → replay).
 *
 * A11y: a labelled role="dialog", focus moved to the primary button on mount and on
 * each step (so the new copy is reachable), focus restored on unmount, real buttons
 * with >=44px touch targets, explicit AA text colors (no opacity dimming), and a live
 * step indicator. The card is centered and max-width min(440px,92vw) so it always fits
 * a 390px viewport. Reduced motion drops the fade-in (the card shows immediately).
 */

export interface IntroStep {
  title: string;
  body: string;
}

/** Default onboarding copy (Director-tunable). The last step's button is "Begin". */
export const DEFAULT_INTRO_STEPS: IntroStep[] = [
  {
    title: "Your cradle world",
    body: "This is the only home your people have ever known — a single world adrift in a hostile galaxy.",
  },
  {
    title: "Put it to work",
    body: "Your settlements mine resources and research new ideas. You decide what each one produces.",
  },
  {
    title: "Reach for the stars",
    body: "Climb the tech tree to break orbit, launch expeditions, and explore neighbouring systems.",
  },
  {
    title: "Always know your next move",
    body: "Follow the Objectives panel — it always shows the next step toward a galactic civilization.",
  },
  {
    title: "Enter orbit",
    body: "Your ship settles into a slow orbit above the world, circling it as the camera pulls back to take in the whole planet.",
  },
  {
    title: "Deploy the mining probe",
    body: "Your probe extends its antenna and fires a mining beam at the surface, drawing glowing chunks of minerals up to harvest them. Watch it work, then begin.",
  },
];

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

export function IntroOverlay({
  steps = DEFAULT_INTRO_STEPS,
  onFinish,
  onStepChange,
  /** Delay (ms) before the card fades in, so the ship is seen emerging first. */
  appearDelayMs = 1400,
}: {
  steps?: IntroStep[];
  onFinish: () => void;
  /** Notified with the active step index (0-based) on mount and each advance, so the
   *  host can drive the 3D scene's stage from the step. */
  onStepChange?: (index: number) => void;
  appearDelayMs?: number;
}) {
  const headingId = useId();
  const bodyId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

  const reduced = prefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(reduced);

  const isLast = index >= steps.length - 1;
  const step = steps[index];

  // Fade the card in after a short beat (immediately under reduced motion).
  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), appearDelayMs);
    return () => window.clearTimeout(t);
  }, [reduced, appearDelayMs]);

  // Escape = skip, from anywhere. Capture so it beats the in-game Esc=pause handler.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onFinish();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onFinish]);

  // Move focus to the primary button on mount and on each step (so a screen reader
  // lands on the freshly revealed copy), and restore focus when the overlay unmounts.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    if (visible) primaryRef.current?.focus();
  }, [visible, index]);

  // Report the active step so the host can drive the 3D scene's stage (fly-in → orbit →
  // mining). Fires on mount and on every step change.
  useEffect(() => {
    onStepChange?.(index);
  }, [index, onStepChange]);

  const onPrimary = () => {
    if (isLast) onFinish();
    else setIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  // Empty step set: nothing to onboard, just hand off (keeps `step` defined below).
  if (!step) return null;

  return (
    <div className="intro-overlay">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        aria-label="Onboarding"
        data-testid="intro-overlay"
        className={`intro-card${visible ? " intro-card--in" : ""}`}
      >
        <p className="intro-step-indicator" aria-live="polite">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id={headingId} className="intro-card__title">
          {step.title}
        </h2>
        <p id={bodyId} className="intro-card__body">
          {step.body}
        </p>

        <div className="intro-card__actions">
          <button
            ref={primaryRef}
            type="button"
            className="intro-btn intro-btn--primary"
            data-testid={isLast ? "intro-begin" : "intro-next"}
            onClick={onPrimary}
          >
            {isLast ? "Begin" : "Next"}
          </button>
          <button
            type="button"
            className="intro-btn intro-btn--ghost"
            data-testid="intro-skip"
            onClick={onFinish}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
