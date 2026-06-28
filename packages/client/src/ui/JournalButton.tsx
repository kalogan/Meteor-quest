import { useSim } from "../sim/store";
import { useJournalUi } from "../sim/journalUi";
import { journalEntries } from "../sim/journal";

/**
 * [journal] Status-strip button that opens/closes the travel Journal. Lives in the always-
 * visible HUD strip so the logbook is one tap away (especially on phones, where the panel
 * otherwise hides in the drawer). Shows the count of worlds logged.
 */
export function JournalButton() {
  const game = useSim((s) => s.game);
  const open = useJournalUi((s) => s.open);
  const toggle = useJournalUi((s) => s.toggle);
  const count = journalEntries(game).length;

  return (
    <button
      type="button"
      data-testid="journal-button"
      className="hud-panel hud-panel--journal-btn"
      aria-pressed={open}
      aria-label={`${open ? "Close" : "Open"} travel journal (${count} worlds logged)`}
      onClick={toggle}
    >
      <span aria-hidden="true">📖</span>
      <span>Journal</span>
      <span className="hud-journal-count" aria-hidden="true">{count}</span>
    </button>
  );
}
