import type { ActiveEvent, EventKind, GameState } from "@meteor/shared";
import { playerDefense } from "@meteor/sim-core";
import { useSim } from "../sim/store";
import {
  button,
  canAfford,
  defenseInfo,
  formatCost,
  panel,
  severityLabel,
  subtle,
} from "./theme";

/**
 * Tactical command panel — the dive-to-mitigate beat made legible. For every live
 * threat it surfaces:
 *   - kind / target / severity,
 *   - the TELEGRAPH countdown (spawnedAtTick → resolvesAtTick) as a fuse bar,
 *   - LOCAL defense at the target (its built `defense`) + the empire baseline,
 *     measured against the threat severity so you can read win/lose at a glance,
 *   - actions: fortify / evacuate / ignore (respondToEvent) PLUS reinforce
 *     (buildDefense on the target) — invest defense where the frontier is hot.
 *
 * Supersedes the slice-1 EventPrompts card with the same three responses plus the
 * reinforce loop; dispatches Commands only (optimistic-cosmetic).
 */

const KIND_LABEL: Record<EventKind, string> = {
  pirateRaid: "Pirate Raid",
  beast: "Beast Incursion",
  meteor: "Meteor Strike",
  supernova: "Supernova Pulse",
};

const KIND_ICON: Record<EventKind, string> = {
  pirateRaid: "⚔",
  beast: "🐾",
  meteor: "☄",
  supernova: "✸",
};

function targetName(game: GameState, targetId: string): string {
  return game.planets[targetId]?.name ?? game.systems[targetId]?.name ?? targetId;
}

/** The target's own built defense (planet or system); empire baseline is separate. */
function localDefense(game: GameState, targetId: string): number {
  return game.planets[targetId]?.defense ?? game.systems[targetId]?.defense ?? 0;
}

function ticksUntil(game: GameState, evt: ActiveEvent): number {
  return Math.max(0, evt.resolvesAtTick - game.tick);
}

/** Fraction of the telegraph elapsed (0 = just spawned, 1 = resolving now). */
function fuseProgress(game: GameState, evt: ActiveEvent): number {
  const spawned = evt.spawnedAtTick ?? evt.resolvesAtTick;
  const span = evt.resolvesAtTick - spawned;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (game.tick - spawned) / span));
}

export function TacticalPanel() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);

  const pending = game.events.filter((e) => !e.mitigated);
  if (pending.length === 0) return null;

  const baseline = playerDefense(game);
  const { buildCost } = defenseInfo();
  const affordable = canAfford(game, buildCost);

  return (
    <div
      className="hud-dock hud-dock-bc"
      role="region"
      aria-label="Active threats"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {pending.map((evt) => {
        const local = localDefense(game, evt.targetId);
        const total = local + baseline;
        // Fortify is the intended win play (×1.75 in sim); show the projected figure.
        const holds = total * 1.75 >= evt.severity;
        const fuse = fuseProgress(game, evt);
        const remaining = ticksUntil(game, evt);

        return (
          <div
            key={evt.id}
            className="hud-panel"
            style={{
              ...panel,
              position: "relative",
              border: "1px solid #6b2740",
              background: "rgba(34,12,18,0.92)",
              minWidth: 380,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 700 }}>
                {KIND_ICON[evt.kind]} {KIND_LABEL[evt.kind]}
              </span>
              <span style={{ ...subtle, fontSize: 11 }}>
                {severityLabel(evt.severity)} · severity {evt.severity.toFixed(1)}
              </span>
            </div>

            <div style={{ ...subtle, fontSize: 12, margin: "4px 0 6px" }}>
              Threatening <b style={{ opacity: 1, color: "#ffb3b3" }}>{targetName(game, evt.targetId)}</b>
            </div>

            {/* Telegraph fuse: spawnedAtTick → resolvesAtTick. */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, ...subtle }}>
                <span>incoming</span>
                <span>{remaining} ticks to impact</span>
              </div>
              <div style={{ height: 4, background: "#3a2230", borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${fuse * 100}%`,
                    height: "100%",
                    background: fuse > 0.66 ? "#ff6b6b" : fuse > 0.33 ? "#ffb86b" : "#6fb6ff",
                  }}
                />
              </div>
            </div>

            {/* Defense vs severity — local + empire baseline. */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8 }}>
              <span style={subtle}>
                defense ⛨ <b style={{ opacity: 1 }}>{total.toFixed(1)}</b>{" "}
                <span style={{ opacity: 0.7 }}>({local.toFixed(0)} local + {baseline.toFixed(1)} empire)</span>
              </span>
              <span style={{ color: holds ? "#6fdc8c" : "#ff8a8a", fontWeight: 600 }}>
                {holds ? "holds if fortified" : "outmatched"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 6 }} role="group" aria-label={`Respond to ${KIND_LABEL[evt.kind]}`}>
              <button
                type="button"
                onClick={() => dispatch({ type: "respondToEvent", eventId: evt.id, response: "fortify" })}
                style={{ ...button(true), flex: 1 }}
                title="Commit defenses at the target (×1.75)"
              >
                Fortify
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "respondToEvent", eventId: evt.id, response: "evacuate" })}
                style={{ ...button(), flex: 1 }}
                title="Pull back — save the population, cede the ground"
              >
                Evacuate
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "respondToEvent", eventId: evt.id, response: "ignore" })}
                style={{ ...button(), flex: 1, borderColor: "#3a2230" }}
                title="Take the hit"
              >
                Ignore
              </button>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => affordable && dispatch({ type: "buildDefense", targetId: evt.targetId })}
                style={{ ...button(false, affordable), flex: 1.2, borderColor: "#2d5a3a" }}
                title={
                  affordable
                    ? `Reinforce ${targetName(game, evt.targetId)} — spend ${formatCost(buildCost)}`
                    : `Need ${formatCost(buildCost)} to reinforce`
                }
              >
                Reinforce
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
