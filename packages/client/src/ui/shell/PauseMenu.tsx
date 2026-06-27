import { useState } from "react";
import { useAppPhase } from "../../sim/appPhase";
import { useSettings } from "../../sim/settings";
import { useSim } from "../../sim/store";
import { MenuDialog } from "./MenuDialog";
import { SettingsPanel } from "./SettingsPanel";

/**
 * Pause overlay — shown over the live game when phase==='paused' (the sim is already
 * frozen by the loop's phase gate, so this is purely the menu). Esc resume is handled
 * by the host (GameRoot) so it works whether or not the dialog has focus; the dialog's
 * own Escape also resumes for redundancy.
 *
 * Actions (stores only):
 *   - Resume  → phase "playing".
 *   - Settings→ the shared SettingsPanel.
 *   - Restart → newGame(fresh seed) at the configured speed → phase "playing".
 *   - Quit    → phase "title" (the loop freezes; the title backdrop takes over).
 *
 * A new seed each Restart keeps it from re-rolling the identical world; if you want a
 * deterministic restart, swap freshSeed() for a fixed seed.
 */
function freshSeed(): number {
  return (Math.floor(Math.random() * 0x7fffffff) + 1) | 0;
}

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const setPhase = useAppPhase((p) => p.setPhase);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const restart = () => {
    const { newGame, dispatch } = useSim.getState();
    newGame(freshSeed());
    dispatch({ type: "setTimeScale", scale: useSettings.getState().defaultSpeed });
    setPhase("playing");
  };

  if (settingsOpen) {
    return (
      <SettingsPanel
        onClose={() => setSettingsOpen(false)}
        // Wiping the save mid-game returns to the title (the running game can't be
        // resumed once its save is gone, and Restart/New Game is the clean path).
        onAfterResetSave={() => setPhase("title")}
      />
    );
  }

  return (
    <MenuDialog title="Paused" onClose={onResume} onScrimClose={onResume}>
      <div className="shell-actions">
        <button type="button" className="shell-btn shell-btn--primary" onClick={onResume}>
          Resume
        </button>
        <button type="button" className="shell-btn" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
        <button type="button" className="shell-btn" onClick={restart}>
          Restart
        </button>
        <button type="button" className="shell-btn shell-btn--danger" onClick={() => setPhase("title")}>
          Quit to title
        </button>
      </div>
    </MenuDialog>
  );
}
