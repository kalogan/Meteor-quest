import { COMMON_RESOURCES, getContentPack } from "@meteor/shared";
import { canResearch } from "@meteor/sim-core";
import { useSim } from "../sim/store";

/**
 * PLACEHOLDER HUD (builder #6 replaces with the full tier-control panels: city
 * focus, continent aggregate, planet policy, system travel, tech tree, and event
 * prompts). Already wired to the authoritative store via dispatch.
 */
const panel: React.CSSProperties = {
  position: "absolute",
  background: "rgba(10,14,22,0.82)",
  border: "1px solid #1d2740",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  pointerEvents: "auto",
};

export function Hud() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const pack = getContentPack();
  const nextTech = pack.tech.find((t) => canResearch(game, t.id));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ ...panel, top: 12, left: 12, minWidth: 180 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Meteor Quest</div>
        <div style={{ opacity: 0.7, marginBottom: 6 }}>
          tier: {game.authorityTier} · tick {game.tick}
        </div>
        {COMMON_RESOURCES.map((r) => (
          <div key={r} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.8 }}>{r}</span>
            <span>
              {Math.floor(game.stockpiles[r])}{" "}
              <span style={{ opacity: 0.5 }}>({(game.rates[r] ?? 0).toFixed(1)}/s)</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{ ...panel, top: 12, right: 12 }}>
        <div style={{ marginBottom: 6, opacity: 0.7 }}>speed</div>
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => dispatch({ type: "setTimeScale", scale: s })}
            style={{
              marginRight: 4,
              fontWeight: game.timeScale === s ? 700 : 400,
              background: game.timeScale === s ? "#2b6cff" : "#1a2236",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            {s === 0 ? "❚❚" : `${s}×`}
          </button>
        ))}
      </div>

      <div style={{ ...panel, bottom: 12, left: 12 }}>
        <div style={{ opacity: 0.7, marginBottom: 4 }}>research</div>
        {game.research.current ? (
          <div>
            {game.research.current} — {Math.floor(game.research.progress)} pts
          </div>
        ) : nextTech ? (
          <button
            onClick={() => dispatch({ type: "startResearch", techId: nextTech.id })}
            style={{ background: "#1a2236", color: "#fff", border: "1px solid #2b6cff", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}
          >
            Research {nextTech.name} ({nextTech.cost})
          </button>
        ) : (
          <div style={{ opacity: 0.6 }}>nothing available</div>
        )}
      </div>
    </div>
  );
}
