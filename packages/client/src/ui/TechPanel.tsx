import type { GameState, TechNode } from "@meteor/shared";
import { getContentPack } from "@meteor/shared";
import { canResearch, findTech } from "@meteor/sim-core";
import { useState } from "react";
import { useSim } from "../sim/store";
import { CollapsiblePanel, isPhoneViewport } from "./CollapsiblePanel";
import { PanelSearch } from "./PanelSearch";
import { button, subtle } from "./theme";

/**
 * Tech tree: every node with its prereqs + requiredResource gating. A node greys
 * out when `canResearch` is false (prereqs unmet, or its biome-unique resource
 * isn't yet in the stockpile — the exploration gate). Shows current research with a
 * live progress bar.
 */

/** The biome whose unique resource is `res` — i.e. the world you must settle to get it. */
function biomeYielding(res: string): string | undefined {
  return getContentPack().biomes.find((b) => b.uniqueResource === res)?.name;
}

function whyLocked(state: GameState, node: TechNode): string | null {
  if (state.research.unlocked.includes(node.id)) return null;
  const missingPrereqs = node.prereqs.filter((p) => !state.research.unlocked.includes(p));
  if (missingPrereqs.length > 0) {
    const names = missingPrereqs.map((id) => findTech(id)?.name ?? id);
    return `needs ${names.join(", ")}`;
  }
  if (node.requiredResource && (state.stockpiles[node.requiredResource] ?? 0) <= 0) {
    // Name the world to settle — rare resources come from settling that biome ("explore to claim").
    const world = biomeYielding(node.requiredResource);
    return world ? `needs ${node.requiredResource} — settle a ${world}` : `needs ${node.requiredResource}`;
  }
  return null;
}

export function TechPanel() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const pack = getContentPack();
  const [query, setQuery] = useState("");

  const current = game.research.current ? findTech(game.research.current) : null;
  const progressPct = current && current.cost > 0 ? Math.min(100, (game.research.progress / current.cost) * 100) : 0;

  const q = query.trim().toLowerCase();
  const visible = q
    ? pack.tech.filter((node) => node.name.toLowerCase().includes(q) || node.category.toLowerCase().includes(q))
    : pack.tech;

  return (
    <CollapsiblePanel
      title="Research"
      defaultOpen={!isPhoneViewport()}
      className="hud-dock hud-dock-tech"
      mobileId="research"
      mobileLabel="Research"
      mobileIcon="🔬"
      mobileOrder={2}
      style={{ width: 280, maxHeight: "calc(100vh - 24px)", overflowY: "auto" }}
    >
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

      <PanelSearch value={query} onChange={setQuery} placeholder="Search tech…" testid="research-search" />

      <div className="hud-scroll" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.length === 0 ? <div style={{ ...subtle, fontSize: 11 }}>No tech matches.</div> : null}
        {visible.map((node) => {
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
                // State is shown via explicit colors + the cost button's enabled
                // styling and the "needs …" hint — NOT opacity. Opacity composites
                // text toward the backdrop and fails WCAG contrast (see theme.ts).
                background: active
                  ? "rgba(43,108,255,0.12)"
                  : unlocked
                    ? "rgba(111,220,140,0.08)"
                    : "transparent",
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
                    type="button"
                    disabled={!researchable}
                    onClick={() => researchable && dispatch({ type: "startResearch", techId: node.id })}
                    style={button(false, researchable)}
                    aria-label={`Research ${node.name} — cost ${node.cost}${locked ? `; ${locked}` : ""}`}
                    title={locked ?? `Cost ${node.cost} research`}
                  >
                    <span aria-hidden="true">{node.cost} ⚲</span>
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
    </CollapsiblePanel>
  );
}
