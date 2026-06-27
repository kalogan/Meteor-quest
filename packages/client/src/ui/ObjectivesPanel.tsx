import { useSim } from "../sim/store";
import { CollapsiblePanel, isPhoneViewport } from "./CollapsiblePanel";
import { currentObjective, objectiveChain } from "./objectives";
import { subtle } from "./theme";

/**
 * [objectives] Objectives HUD panel — the guided arc made visible.
 *
 * It surfaces three things from authoritative sim state (read-only; never mutates):
 *   1. A prominent "Next:" hint — the CURRENT objective's title + description. The
 *      current objective is the first authored objective whose id is NOT in
 *      `game.objectives.completed` (see ./objectives). This onboards: it always tells
 *      the player the very next thing to do.
 *   2. A checklist of the whole authored chain, with completed items clearly marked
 *      (✓ + the "completed" green) and the final victory objective flagged (★).
 *   3. A small "all complete" note when the chain is exhausted.
 *
 * Contrast: completed/secondary items use EXPLICIT colors (a legible green and the
 * shared MUTED_TEXT), never opacity dimming — opacity composites text toward the
 * backdrop and fails WCAG AA (see theme.ts / hud.css).
 */

const DONE_COLOR = "#6fdc8c"; // legible green on the dark panel (matches TechPanel "done")
const VICTORY_COLOR = "#ffd479"; // warm gold for the final/victory objective

export function ObjectivesPanel() {
  const game = useSim((s) => s.game);
  const chain = objectiveChain();

  // No authored objectives: render nothing rather than an empty shell.
  if (chain.length === 0) return null;

  const completed = new Set(game.objectives.completed);
  const current = currentObjective(game);
  const doneCount = chain.filter((o) => completed.has(o.id)).length;

  return (
    <CollapsiblePanel
      title={`Objectives (${doneCount}/${chain.length})`}
      defaultOpen={!isPhoneViewport()}
      className="hud-dock hud-dock-objectives"
      style={{ width: 280, maxHeight: "calc(100vh - 24px)", overflowY: "auto" }}
    >
      {/* The "Next:" hint — the live goal, shown prominently. */}
      {current ? (
        <div
          style={{
            border: "1px solid #2b6cff",
            background: "rgba(43,108,255,0.12)",
            borderRadius: 6,
            padding: "8px 10px",
            marginBottom: 12,
          }}
        >
          <div style={{ ...subtle, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#8fb4ff" }}>
            Next{current.victory ? " · final goal" : ""}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: current.victory ? VICTORY_COLOR : undefined }}>
            {current.victory ? "★ " : ""}
            {current.title}
          </div>
          <div style={{ ...subtle, fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>{current.description}</div>
        </div>
      ) : (
        <div style={{ color: DONE_COLOR, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
          ✓ All objectives complete.
        </div>
      )}

      {/* Full checklist. role=list so completion is conveyed structurally + by label. */}
      <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {chain.map((o) => {
          const isDone = completed.has(o.id);
          const isCurrent = current?.id === o.id;
          return (
            <li
              key={o.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                fontSize: 12,
                lineHeight: 1.3,
                borderLeft: isCurrent ? "2px solid #2b6cff" : "2px solid transparent",
                paddingLeft: 6,
              }}
            >
              <span
                aria-hidden="true"
                style={{ color: isDone ? DONE_COLOR : o.victory ? VICTORY_COLOR : "#5b6680", fontWeight: 700, width: 12, flexShrink: 0 }}
              >
                {isDone ? "✓" : o.victory ? "★" : "○"}
              </span>
              <span
                style={{
                  // Completed text uses an explicit muted-but-AA color, NOT opacity.
                  color: isDone ? "#88c79a" : o.victory ? VICTORY_COLOR : undefined,
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {o.title}
                {o.victory ? <span style={{ ...subtle, fontWeight: 400 }}> · victory</span> : null}
                {/* Accessible status, since the glyph is aria-hidden. */}
                <span className="hud-visually-hidden">
                  {isDone ? " (completed)" : isCurrent ? " (current objective)" : " (locked)"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </CollapsiblePanel>
  );
}
