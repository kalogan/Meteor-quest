import type { GameState, TechNode } from "@meteor/shared";
import { getContentPack } from "@meteor/shared";
import { canResearch, findTech } from "@meteor/sim-core";
import { useSim } from "../sim/store";
import { button, heading, panel, subtle } from "./theme";

/**
 * Tech tree: every node with its prereqs + requiredResource gating. A node greys
 * out when `canResearch` is false (prereqs unmet, or its biome-unique resource
 * isn't yet in the stockpile — the exploration gate). Shows current research with a
 * live progress bar.
 */

function whyLocked(state: GameState, node: TechNode): string | null {
  if (state.research.unlocked.includes(node.id)) return null;
  const missingPrereqs = node.prereqs.filter((p) => !state.research.unlocked.includes(p));
  if (missingPrereqs.length > 0) {
    const names = missingPrereqs.map((id) => findTech(id)?.name ?? id);
    return `needs ${names.join(", ")}`;
  }
  if (node.requiredResource && (state.stockpiles[node.requiredResource] ?? 0) <= 0) {
    return `needs ${node.requiredResource} (explore to claim it)`;
  }
  return null;
}

export function TechPanel() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const pack = getContentPack();

  const current = game.research.current ? findTech(game.research.current) : null;
  const progressPct = current && current.cost > 0 ? Math.min(100, (game.research.progress / current.cost) * 100) : 0;

  return (
    <div style={{ ...panel, top: 12, left: 220, width: 280, maxHeight: "calc(100vh - 24px)", overflowY: "auto" }}>
      <div style={heading}>Research</div>

      {current ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600 }}>{current.name}</span>
            <span style={{ ...subtle, fontSize: 11 }}>
              {Math.floor(game.research.progress)}/{current.cost}
            </span>
          </div>
          <div style={{ height: 6, background: "#1a2236", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "#2b6cff", transition: "width 0.2s" }} />
          </div>
          <div style={{ ...subtle, fontSize: 11, marginTop: 4 }}>research: +{(game.rates.research ?? 0).toFixed(1)}/s</div>
        </div>
      ) : (
        <div style={{ ...subtle, fontSize: 11, marginBottom: 12 }}>No active research — pick a tech below.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pack.tech.map((node) => {
          const unlocked = game.research.unlocked.includes(node.id);
          const active = game.research.current === node.id;
          const researchable = canResearch(game, node.id);
          const locked = whyLocked(game, node);

          return (
            <div
              key={node.id}
              style={{
                border: "1px solid #1d2740",
                borderRadius: 5,
                padding: "6px 8px",
                opacity: unlocked ? 0.55 : researchable || active ? 1 : 0.45,
                background: active ? "rgba(43,108,255,0.12)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  {node.name}
                  <span style={{ ...subtle, fontWeight: 400 }}> · {node.category}</span>
                </span>
                {unlocked ? (
                  <span style={{ color: "#6fdc8c", fontSize: 11 }}>done</span>
                ) : active ? (
                  <span style={{ color: "#5b8cff", fontSize: 11 }}>active</span>
                ) : (
                  <button
                    disabled={!researchable}
                    onClick={() => researchable && dispatch({ type: "startResearch", techId: node.id })}
                    style={button(false, researchable)}
                    title={locked ?? `Cost ${node.cost} research`}
                  >
                    {node.cost} ⚲
                  </button>
                )}
              </div>
              {!unlocked && locked ? (
                <div style={{ ...subtle, fontSize: 10, marginTop: 3, color: "#c9a14a" }}>{locked}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
