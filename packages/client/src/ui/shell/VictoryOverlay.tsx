import { useEffect, useState } from "react";
import { useAppPhase } from "../../sim/appPhase";
import { useSettings } from "../../sim/settings";
import { useSim } from "../../sim/store";
import { victoryStats } from "../objectives";
import { MenuDialog } from "./MenuDialog";

/**
 * [objectives] Victory overlay — the celebratory end-state.
 *
 * Shows above the running game when the sim sets `game.objectives.won` (the victory
 * objective's condition held). It reads that flag authoritatively and never mutates
 * sim state; the two actions drive the stores:
 *   - Keep playing → dismiss the overlay (the game keeps running; the win stands).
 *   - New Game     → newGame(fresh seed) at the configured speed, stay in play.
 *
 * Don't-double-fire: `won` stays true for the rest of the run, so a local `dismissed`
 * flag suppresses re-showing after "Keep playing". It resets when `won` goes false
 * again (e.g. after a New Game), so a fresh victory re-triggers the overlay.
 *
 * A11y: reuses MenuDialog (role="dialog", aria-modal, focus trap + restore, Escape).
 * Escape maps to "Keep playing" so it's never a trap. Lives in the shell so it sits
 * above the canvas + HUD while playing.
 */
function freshSeed(): number {
  return (Math.floor(Math.random() * 0x7fffffff) + 1) | 0;
}

export function VictoryOverlay() {
  const won = useSim((s) => s.game.objectives.won);
  const stats = useSim((s) => victoryStats(s.game));
  const [dismissed, setDismissed] = useState(false);

  // Reset the dismissal when the win goes away (New Game), so a new victory re-shows.
  useEffect(() => {
    if (!won) setDismissed(false);
  }, [won]);

  if (!won || dismissed) return null;

  const keepPlaying = () => setDismissed(true);

  const newGame = () => {
    const { newGame: start, dispatch } = useSim.getState();
    start(freshSeed());
    dispatch({ type: "setTimeScale", scale: useSettings.getState().defaultSpeed });
    useAppPhase.getState().setPhase("playing");
    // `won` becomes false in the fresh state, so the effect above clears `dismissed`.
  };

  return (
    <div className="shell-root">
      <MenuDialog title="Victory!" onClose={keepPlaying} onScrimClose={keepPlaying}>
        <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.5, color: "var(--shell-text)" }}>
          You founded a galactic civilization! From a single cradle world you climbed the
          authority ladder and spread across the stars.
        </p>
        <ul
          style={{ listStyle: "none", margin: "0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--shell-muted)" }}>Worlds settled</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stats.settledWorlds}</span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--shell-muted)" }}>Systems discovered</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stats.discoveredSystems}</span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--shell-muted)" }}>Technologies unlocked</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stats.techUnlocked}</span>
          </li>
        </ul>
        <div className="shell-actions">
          <button type="button" className="shell-btn shell-btn--primary" onClick={keepPlaying}>
            Keep playing
          </button>
          <button type="button" className="shell-btn" onClick={newGame}>
            New Game
          </button>
        </div>
      </MenuDialog>
    </div>
  );
}
