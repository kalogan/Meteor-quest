import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { WorldView } from "../../world/WorldView";
import { Hud } from "../Hud";
import { PropTooltip } from "../PropTooltip";
import { GovernorHint } from "../GovernorHint";
import { useGameLoop } from "../../sim/useGameLoop";
import { useAppPhase } from "../../sim/appPhase";
import { PauseMenu } from "./PauseMenu";

/**
 * The in-game root (phase 'playing' | 'paused'). Runs the real-time loop and renders
 * the God-view canvas + HUD — the same composition App.tsx had before the shell. When
 * paused it overlays the PauseMenu; the sim is frozen automatically (the loop only
 * ticks while phase==='playing'), so pausing is purely cosmetic here.
 *
 * Esc toggles playing↔paused via a window keydown listener, so it works regardless of
 * what (if anything) has focus. The listener is installed once for the lifetime of the
 * in-game root and reads/writes phase through the store.
 */
export function GameRoot() {
  useGameLoop();
  const phase = useAppPhase((p) => p.phase);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const { phase: current, setPhase } = useAppPhase.getState();
      if (current === "playing") setPhase("paused");
      else if (current === "paused") setPhase("playing");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* Initial camera is a sensible default; the CameraRig (in WorldView) takes
          over as the default camera and drives the continuous zoom. */}
      <Canvas camera={{ position: [6, 5, 9], fov: 50, near: 0.1, far: 2000 }}>
        <WorldView />
      </Canvas>
      <Hud />
      {/* [tech props] Cursor-following "what built this?" tooltip when hovering a structure. */}
      <PropTooltip />
      {/* [onboarding] Once-ever hint the first time authority promotes past city tier. */}
      <GovernorHint />
      {phase === "paused" ? (
        <div className="shell-root">
          <PauseMenu onResume={() => useAppPhase.getState().setPhase("playing")} />
        </div>
      ) : null}
    </div>
  );
}
