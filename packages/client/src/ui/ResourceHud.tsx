import { COMMON_RESOURCES, RARE_RESOURCES, type ResourceId } from "@meteor/shared";
import { useSim } from "../sim/store";
import type { GameState } from "@meteor/shared";
import { heading, MUTED_TEXT, panel, subtle } from "./theme";
import { useIsPhone } from "./CollapsiblePanel";

/**
 * Resource HUD: stockpiles + per-second rates for the common resources. Rates come
 * straight from the authoritative economy system (units/sec); a negative rate (e.g.
 * minerals consumed by refining) is tinted so the player sees the drain.
 *
 * A static, queryable readout (a `<dl>`); intentionally NOT aria-live — the numbers
 * change ~2×/sec and would spam screen readers.
 *
 * On PHONES the full card eats ~40% of the screen, so it collapses to a single thin
 * CHIP BAR (abbreviation + value + a rate caret) — no title/authority/heading rows — to
 * keep the game visible. Desktop keeps the full card.
 */

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rateColorOf(rate: number): string {
  return rate > 0.001 ? "#6fdc8c" : rate < -0.001 ? "#ff8a8a" : MUTED_TEXT;
}

/** Rare resources worth showing — ones you actually have or are producing (e.g. oremetal from a
 *  settled rock world). Hidden until then so the readout stays clean early. */
function activeRares(game: GameState): ResourceId[] {
  return RARE_RESOURCES.filter((r) => (game.stockpiles[r] ?? 0) > 0 || Math.abs(game.rates[r] ?? 0) > 0.001);
}

export function ResourceHud() {
  const game = useSim((s) => s.game);
  const isPhone = useIsPhone();
  const rares = activeRares(game);

  if (isPhone) {
    return (
      <section className="hud-panel hud-resbar" role="region" aria-label="Resources">
        {[...COMMON_RESOURCES, ...rares].map((r) => {
          const value = Math.floor(game.stockpiles[r] ?? 0);
          const rate = game.rates[r] ?? 0;
          const active = Math.abs(rate) > 0.001;
          return (
            <span
              key={r}
              className="hud-reschip"
              aria-label={`${r} ${value}, ${rate >= 0 ? "+" : ""}${rate.toFixed(1)} per second`}
            >
              <span className="hud-reschip__abbr" aria-hidden="true">{cap(r)}</span>
              <b aria-hidden="true">{value}</b>
              {active && (
                <span aria-hidden="true" style={{ color: rateColorOf(rate), fontSize: 10 }}>
                  {rate > 0 ? "▲" : "▼"}
                </span>
              )}
            </span>
          );
        })}
      </section>
    );
  }

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
          const rateColor = rateColorOf(rate);
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

      {rares.length > 0 && (
        <>
          <div style={{ ...heading, marginTop: 8 }}>Rare · from settled worlds</div>
          <dl style={{ margin: 0 }}>
            {rares.map((r) => {
              const rate = game.rates[r] ?? 0;
              return (
                <div key={r} style={{ display: "flex", justifyContent: "space-between", lineHeight: 1.6 }}>
                  <dt style={{ textTransform: "capitalize" }}>{r}</dt>
                  <dd style={{ margin: 0 }}>
                    <b>{Math.floor(game.stockpiles[r] ?? 0)}</b>{" "}
                    <span style={{ color: rate === 0 ? MUTED_TEXT : rateColorOf(rate), fontSize: 11 }}>
                      {rate > 0 ? "+" : ""}
                      {rate.toFixed(1)}/s
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
    </section>
  );
}
