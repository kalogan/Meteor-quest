import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { GameState, Planet } from "@meteor/shared";
import { useSim } from "../../sim/store";
import { IntroScene, type IntroStage } from "../../world/IntroScene";
import { DEFAULT_INTRO_STEPS, IntroOverlay, type IntroStep } from "./IntroOverlay";
import "./intro.css";

/**
 * [intro] The cinematic onboarding, end to end — the reusable module the shell and the
 * preview both mount. It composes:
 *   - a full-screen <Canvas> with the 3D IntroScene (cradle + ship fly-in, scripted
 *     camera), no HUD;
 *   - a black "curtain" div faded opacity 1 → 0 over the first ~1.2s ("emerges from
 *     blackness");
 *   - the stepped IntroOverlay card (Next / Begin, always-Skip, Escape = skip).
 *
 * It also derives a 3D STAGE from the active onboarding step and feeds it to IntroScene,
 * so the cinematic extends past the fly-in: the last two steps of the (default) sequence
 * drive "orbit" (ship circles the world) then "mining" (a probe deploys and harvests).
 * The overlay reports its step via onStepChange; the scene eases between stages.
 *
 * Purely cosmetic: it READS the cradle planet from the sim (or takes one via `planet`)
 * and never advances or mutates game state — the loop is frozen during phase 'intro'.
 * `onFinish` fires when the player clicks Begin or Skip (or presses Escape); the host
 * routes it (in-game → phase 'playing'; preview → replay).
 *
 * Reduced motion: the curtain lifts immediately and the scene snaps to its final
 * framing (IntroScene handles the camera/ship), while the overlay shows at once.
 */

/**
 * Map an active step index to a 3D stage. The extended sequence ends with an orbit step
 * then a mining step; everything before is the fly-in. We key off distance from the END
 * of the step list (rather than fixed indices) so a custom `steps` set still lines up,
 * and we only enable orbit/mining when there are enough steps to carry those beats — a
 * short custom set stays entirely in the fly-in.
 */
function stageForStep(index: number, stepCount: number): IntroStage {
  if (stepCount < 6) return "flyin";
  if (index >= stepCount - 1) return "mining";
  if (index >= stepCount - 2) return "orbit";
  return "flyin";
}

function reducedMotionNow(): boolean {
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

export function IntroCinematic({
  onFinish,
  planet,
  game,
  steps,
}: {
  onFinish: () => void;
  /** Explicit planet to feature; defaults to the store's cradle (the common case). */
  planet?: Planet;
  /** Explicit state for the scene; defaults to the live sim state. */
  game?: GameState;
  steps?: IntroStep[];
}) {
  const storeGame = useSim((s) => s.game);
  const sceneGame = game ?? storeGame;
  const cradle = planet ?? sceneGame.planets[sceneGame.cradlePlanetId];

  const activeSteps = steps ?? DEFAULT_INTRO_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const onStepChange = useCallback((i: number) => setStepIndex(i), []);
  const stage = stageForStep(stepIndex, activeSteps.length);

  const reduced = reducedMotionNow();
  // The black curtain starts down and lifts on the next frame (immediately if reduced).
  const [lifted, setLifted] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setLifted(true);
      return;
    }
    const raf = requestAnimationFrame(() => setLifted(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Defensive: if the world somehow has no cradle, don't trap the player on a black
  // screen — hand straight off to the game.
  useEffect(() => {
    if (!cradle) onFinish();
  }, [cradle, onFinish]);
  if (!cradle) return null;

  return (
    <div className="intro-root" data-testid="intro-cinematic">
      <div className="intro-canvas">
        <Canvas
          data-testid="intro-canvas"
          frameloop="always"
          camera={{ position: [12, 3, 18], fov: 50, near: 0.1, far: 2000 }}
        >
          <IntroScene game={sceneGame} planet={cradle} reducedMotion={reduced} stage={stage} />
        </Canvas>
      </div>

      {/* "Emerge from blackness": a black div faded 1 → 0 over the first beat. */}
      <div
        className={`intro-curtain${lifted ? " intro-curtain--lifted" : ""}`}
        aria-hidden="true"
      />

      <IntroOverlay steps={steps} onFinish={onFinish} onStepChange={onStepChange} />
    </div>
  );
}
