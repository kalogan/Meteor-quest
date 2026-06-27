import { COMMON_RESOURCES } from "@meteor/shared";
import { useSim } from "../sim/store";
import { heading, MUTED_TEXT, panel, subtle } from "./theme";

/**
 * Resource HUD: stockpiles + per-second rates for the common resources. Rates come
 * straight from the authoritative economy system (units/sec); a negative rate (e.g.
 * minerals consumed by refining) is tinted so the player sees the drain.
 *
 * A static, queryable readout (a `<dl>`); intentionally NOT aria-live — the numbers
 * change ~2×/sec and would spam screen readers.
 */
export function ResourceHud() {
  const game = useSim((s) => s.game);

  return (
    <section
      className="hud-panel hud-dock hud-dock-tl"
      style={{ ...panel, minWidth: 196 }}
      role="region"
      aria-label="Resources and status"
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Meteor Quest</div>
      <div style={{ ...subtle, marginBottom: 8, fontSize: 12 }}>
        authority: <b style={{ color: "#e8edf6" }}>{game.authorityTier}</b> · tick {game.tick}
      </div>
      <div style={heading}>Resources</div>
      <dl style={{ margin: 0 }}>
        {COMMON_RESOURCES.map((r) => {
          const rate = game.rates[r] ?? 0;
          const rateColor = rate > 0.001 ? "#6fdc8c" : rate < -0.001 ? "#ff8a8a" : MUTED_TEXT;
          return (
            <div key={r} style={{ display: "flex", justifyContent: "space-between", lineHeight: 1.6 }}>
              <dt style={{ textTransform: "capitalize" }}>{r}</dt>
              <dd style={{ margin: 0 }}>
                <b>{Math.floor(game.stockpiles[r] ?? 0)}</b>{" "}
                <span style={{ color: rate === 0 ? MUTED_TEXT : rateColor, fontSize: 11 }}>
                  {rate > 0 ? "+" : ""}
                  {rate.toFixed(1)}/s
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
