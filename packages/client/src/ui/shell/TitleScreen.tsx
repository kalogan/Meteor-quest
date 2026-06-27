import { useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { WorldView } from "../../world/WorldView";
import { useAppPhase } from "../../sim/appPhase";
import { useSettings } from "../../sim/settings";
import { useSim } from "../../sim/store";
import { hasSave } from "../../sim/persist";
import { SettingsPanel } from "./SettingsPanel";

/**
 * Title / splash screen — the game's front door.
 *
 * A LIVE galaxy backdrop sits behind the menu: a non-interactive <Canvas> mounting
 * the REAL <WorldView/>. The sim is frozen here (the loop only ticks while
 * phase==='playing'), so the backdrop is the static authoritative world slowly
 * drifting under a gentle auto-rotating camera — `pointer-events:none` keeps the menu
 * clickable above it.
 *
 * Actions drive the stores only (optimistic-cosmetic):
 *   - New Game → newGame(fresh seed) → set the configured default speed → phase "intro"
 *     (the cinematic onboarding, which then routes on to "playing").
 *   - Continue → phase "playing" (the store already loaded the save on boot); disabled
 *     unless a save exists.
 *   - Settings → the shared SettingsPanel dialog.
 */
function freshSeed(): number {
  // A new world each New Game. Bounded positive int; the sim seeds deterministically
  // from it, so the same seed reproduces the same galaxy.
  return (Math.floor(Math.random() * 0x7fffffff) + 1) | 0;
}

export function TitleScreen() {
  const setPhase = useAppPhase((p) => p.setPhase);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // hasSave() reads storage; re-checked on each render (cheap) so Continue reflects
  // a just-cleared save without extra wiring.
  const canContinue = hasSave();

  const startNewGame = () => {
    const { newGame, dispatch } = useSim.getState();
    newGame(freshSeed());
    dispatch({ type: "setTimeScale", scale: useSettings.getState().defaultSpeed });
    // Hand off to the cinematic intro (the sim is frozen until 'playing'); the intro's
    // Begin/Skip routes on to 'playing'. The fresh world (incl. its cradle) is already
    // installed, so the cinematic features the player's actual starting planet.
    setPhase("intro");
  };

  const onContinue = () => {
    // The store loaded the save on boot; just enter play.
    setPhase("playing");
  };

  return (
    <div className="shell-root">
      {/* Live galaxy backdrop — non-interactive (pointer-events:none via .shell-backdrop). */}
      <div className="shell-backdrop" aria-hidden="true">
        <Canvas
          camera={{ position: [6, 5, 9], fov: 50, near: 0.1, far: 2000 }}
          frameloop="always"
        >
          <WorldView />
          <TitleDrift />
        </Canvas>
      </div>

      {/* Foreground menu. */}
      <div className="shell-center">
        <div className="shell-card" role="group" aria-label="Main menu">
          <h1 className="shell-title">Meteor Quest</h1>
          <p className="shell-tagline">Steer a fledgling civilization across a hostile galaxy.</p>
          <div className="shell-actions">
            <button type="button" className="shell-btn shell-btn--primary" onClick={startNewGame}>
              New Game
            </button>
            <button
              type="button"
              className="shell-btn"
              onClick={onContinue}
              disabled={!canContinue}
              aria-disabled={!canContinue}
              title={canContinue ? "Resume your saved game" : "No saved game found"}
            >
              Continue
            </button>
            <button type="button" className="shell-btn" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
          </div>
        </div>
      </div>

      {settingsOpen ? (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          // Resetting the save from the title just closes the dialog; Continue
          // re-evaluates hasSave() on the next render.
          onAfterResetSave={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * A gentle continuous camera drift for the title backdrop, so the frozen world still
 * feels alive. Lives inside the Canvas (needs the R3F frame loop). It nudges the
 * default camera in a slow orbit; the WorldView's CameraRig is the authoritative
 * camera in-game, but on the title the rig only re-frames on selection, leaving this
 * drift visible. Honors reduced-motion by holding still.
 */
function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement.dataset.reducedMotion === "on") {
    return true;
  }
  if (typeof document !== "undefined" && document.documentElement.dataset.reducedMotion === "off") {
    return false;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

function TitleDrift() {
  const camera = useThree((s) => s.camera);
  useFrame((_, delta) => {
    if (prefersReducedMotion()) return;
    const radius = Math.hypot(camera.position.x, camera.position.z) || 11;
    const angle = Math.atan2(camera.position.z, camera.position.x) + delta * 0.04;
    camera.position.x = Math.cos(angle) * radius;
    camera.position.z = Math.sin(angle) * radius;
    camera.lookAt(0, 0, 0);
  });
  return null;
}
