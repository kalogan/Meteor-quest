import { COMMON_RESOURCES } from "@meteor/shared";
import { useSim } from "../sim/store";
import { heading, panel, subtle } from "./theme";

/**
 * Resource HUD: stockpiles + per-second rates for the common resources. Rates come
 * straight from the authoritative economy system (units/sec); a negative rate (e.g.
 * minerals consumed by refining) is tinted so the player sees the drain.
 */
export function ResourceHud() {
  const game = useSim((s) => s.game);

  return (
    <div style={{ ...panel, top: 12, left: 12, minWidth: 196 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Meteor Quest</div>
      <div style={{ ...subtle, marginBottom: 8, fontSize: 12 }}>
        authority: <b style={{ opacity: 1 }}>{game.authorityTier}</b> · tick {game.tick}
      </div>
      <div style={heading}>Resources</div>
      {COMMON_RESOURCES.map((r) => {
        const rate = game.rates[r] ?? 0;
        const rateColor = rate > 0.001 ? "#6fdc8c" : rate < -0.001 ? "#ff8a8a" : "#7a8295";
        return (
          <div key={r} style={{ display: "flex", justifyContent: "space-between", lineHeight: 1.6 }}>
            <span style={{ opacity: 0.85, textTransform: "capitalize" }}>{r}</span>
            <span>
              <b>{Math.floor(game.stockpiles[r] ?? 0)}</b>{" "}
              <span style={{ color: rate === 0 ? "#7a8295" : rateColor, fontSize: 11 }}>
                {rate > 0 ? "+" : ""}
                {rate.toFixed(1)}/s
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
