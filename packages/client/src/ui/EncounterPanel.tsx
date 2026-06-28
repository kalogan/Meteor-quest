import type { RoamingHostile } from "@meteor/shared";
import { HOSTILES, canAffordPayoff, hostileDefense, hostileLabel, predictFight } from "@meteor/sim-core";
import { useSim } from "../sim/store";
import { button, formatCost, MUTED_TEXT, subtle } from "./theme";

/**
 * [hostiles] Encounter readout — every discovered space beast / pirate, with your effective
 * defense vs its threat and the three responses: FIGHT (defense vs threat — outcome is shown),
 * FLEE (only while it has pinned an expedition — aborts that run), PAY-OFF (spend resources to
 * pass; disabled when unaffordable). Dispatches `engageHostile`. Read-only over sim state.
 */

const KIND_ICON: Record<RoamingHostile["kind"], string> = { beast: "🪲", pirate: "🏴‍☠️" };
const KIND_TINT: Record<RoamingHostile["kind"], string> = { beast: "#ff5db1", pirate: "#ff8a3d" };

export function EncounterPanel() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const hostiles = Object.values(game.hostiles).filter((h) => h.discovered);

  if (hostiles.length === 0) return null;

  return (
    <section
      data-testid="encounter-panel"
      aria-label="Hostile encounters"
      style={{
        position: "absolute", top: 12, right: 12, width: 270, maxHeight: "calc(100% - 24px)", overflowY: "auto",
        background: "rgba(10,14,22,0.92)", border: "1px solid #5a2740", borderRadius: 10, padding: 12,
        color: "#e8edf6", font: "500 13px/1.4 system-ui, sans-serif", backdropFilter: "blur(6px)", pointerEvents: "auto",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#ff9ec4", marginBottom: 8 }}>
        Hostiles ({hostiles.length})
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {hostiles.map((h) => {
          const def = hostileDefense(game, h);
          const win = predictFight(game, h);
          const engaged = h.engagedJourneyId !== undefined;
          const canPay = canAffordPayoff(game);
          const sysName = game.systems[h.systemId]?.name ?? "deep space";
          const tint = KIND_TINT[h.kind];
          return (
            <li
              key={h.id}
              data-testid={`encounter-${h.id}`}
              style={{ border: `1px solid ${engaged ? "#a0405e" : "#2a2740"}`, borderRadius: 8, padding: 8, background: engaged ? "rgba(255,93,177,0.08)" : "#10141f" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span aria-hidden="true">{KIND_ICON[h.kind]}</span>
                <strong style={{ color: tint, fontSize: 13, textTransform: "capitalize" }}>{hostileLabel(h.kind)}</strong>
                {engaged && (
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#ffb3cf", background: "rgba(255,93,177,0.18)", border: "1px solid #a0405e", borderRadius: 999, padding: "1px 6px" }}>
                    Ambush!
                  </span>
                )}
              </div>
              <div style={{ ...subtle, fontSize: 12 }}>near {sysName}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                <span>Threat <strong style={{ color: "#ff8a8a" }}>{h.threat.toFixed(1)}</strong></span>
                <span style={{ color: MUTED_TEXT }}>Your defense <strong style={{ color: win ? "#6fdc8c" : "#ffb454" }}>{def.toFixed(1)}</strong></span>
              </div>
              <div style={{ fontSize: 11, color: win ? "#6fdc8c" : "#ff8a8a", marginTop: 2 }}>
                {win ? "A stand-up fight would win." : "Too strong to fight head-on."}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  data-testid={`encounter-fight-${h.id}`}
                  onClick={() => dispatch({ type: "engageHostile", hostileId: h.id, response: "fight" })}
                  style={{ ...button(false), borderColor: "#a0405e" }}
                >
                  Fight
                </button>
                {engaged && (
                  <button
                    type="button"
                    data-testid={`encounter-flee-${h.id}`}
                    onClick={() => dispatch({ type: "engageHostile", hostileId: h.id, response: "flee" })}
                    style={button(false)}
                  >
                    Flee
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`encounter-payoff-${h.id}`}
                  disabled={!canPay}
                  onClick={() => canPay && dispatch({ type: "engageHostile", hostileId: h.id, response: "payoff" })}
                  style={button(false, canPay)}
                  title={`Pay ${formatCost(HOSTILES.payoff)}`}
                >
                  Pay-off
                </button>
              </div>
              {!canPay && <div style={{ ...subtle, fontSize: 10, marginTop: 3 }}>Pay-off needs {formatCost(HOSTILES.payoff)}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
