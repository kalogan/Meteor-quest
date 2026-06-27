import { useEffect } from "react";
import { useAppPhase } from "../../sim/appPhase";
import { useSettings } from "../../sim/settings";
import { TitleScreen } from "./TitleScreen";
import { GameRoot } from "./GameRoot";
import { VictoryOverlay } from "./VictoryOverlay";
import { IntroCinematic } from "../intro/IntroCinematic";
import { applyReducedMotion } from "./SettingsPanel";
import "./shell.css";

/**
 * Top-level game-shell router. Routes on `useAppPhase().phase`:
 *   - "title"            → the TitleScreen (live galaxy backdrop + main menu).
 *   - "intro"            → the IntroCinematic (ship emerges toward the cradle + stepped
 *     onboarding); its Begin/Skip routes on to "playing". The sim is frozen here.
 *   - "playing"/"paused" → the GameRoot (loop + canvas + HUD, pause overlay), with the
 *     VictoryOverlay layered above it (it self-gates on `game.objectives.won`).
 *
 * GameRoot is keyed by neither phase value, so the loop/canvas mount once and persist
 * across the play↔pause toggle (no canvas remount when pausing). Mounting/unmounting
 * only happens on the title boundary, which is intended (the title runs its own
 * backdrop canvas + freezes the loop).
 *
 * On mount it also applies the persisted reducedMotion setting to the document root so
 * the override is in force from the first frame (not just after the user opens Settings).
 */
export function Shell() {
  const phase = useAppPhase((p) => p.phase);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  useEffect(() => {
    applyReducedMotion(reducedMotion);
  }, [reducedMotion]);

  if (phase === "title") return <TitleScreen />;
  if (phase === "intro") {
    // Cinematic onboarding over the (frozen) fresh world. Begin/Skip → playing.
    return <IntroCinematic onFinish={() => useAppPhase.getState().setPhase("playing")} />;
  }
  return (
    <>
      <GameRoot />
      {/* Celebratory end-state, above the game/HUD while playing (reads game.objectives.won). */}
      <VictoryOverlay />
    </>
  );
}
