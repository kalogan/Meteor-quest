import { useEffect, useRef, useState } from "react";
import { tierRank } from "@meteor/shared";
import { useSim } from "../sim/store";

/**
 * [onboarding] A once-ever hint shown the first time the player's authority promotes past
 * city tier. Promotion hands production from individual city focus to that tier's GOVERNOR
 * (see economy.effectiveFocus); we now seed the governor from what the cities were doing so
 * nothing silently stalls, but the player still needs to KNOW the governor exists to steer
 * the economy at higher tiers. This teaches that once, then never again (localStorage flag).
 *
 * Subscribes only to the authorityTier primitive (no fresh-object selector → no #185 risk).
 */
const SEEN_KEY = "mq:governor-hint-seen:v1";

export function GovernorHint() {
  const tier = useSim((s) => s.game.authorityTier);
  const prevTier = useRef(tier);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const rose = tierRank(tier) > tierRank(prevTier.current);
    prevTier.current = tier;
    let seen = false;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {
      seen = false;
    }
    if (rose && tier !== "city" && !seen) setShow(true);
  }, [tier]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode — just hide for this session */
    }
    setShow(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="governor-hint"
      style={{
        position: "fixed",
        top: "max(16px, env(safe-area-inset-top))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        width: "min(420px, calc(100vw - 24px))",
        boxSizing: "border-box",
        padding: "14px 16px",
        background: "rgba(10, 14, 22, 0.96)",
        border: "1px solid #3a4668",
        borderRadius: 12,
        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
        color: "#e8edf6",
        font: '500 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Your authority expanded</div>
      <div style={{ color: "#cdd6e6", marginBottom: 12 }}>
        Production is now steered by your <strong>{tier} governor</strong>, not individual cities. It keeps your
        current focus — open the control panel to point the whole {tier} at research, a rare resource, or anything
        you need next.
      </div>
      <button
        onClick={dismiss}
        style={{
          appearance: "none",
          minHeight: 40,
          padding: "9px 16px",
          font: "inherit",
          fontWeight: 700,
          color: "#fff",
          background: "#2f66ea",
          border: "1px solid #5b8cff",
          borderRadius: 9,
          cursor: "pointer",
        }}
      >
        Got it
      </button>
    </div>
  );
}
