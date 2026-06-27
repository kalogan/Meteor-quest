import type { ActiveEvent, EventKind, GameState } from "@meteor/shared";
import { useSim } from "../sim/store";
import { button, panel, severityLabel, subtle } from "./theme";

/**
 * Event prompts: when `game.events` holds unmitigated threats, surface a card per
 * threat with the kind/target/severity and the three responses the sim accepts —
 * fortify / evacuate / ignore (respondToEvent). This is the dive-to-mitigate beat:
 * a meteor warning or pirate raid the player must answer or lose ground.
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

function ticksUntil(game: GameState, evt: ActiveEvent): number {
  return Math.max(0, evt.resolvesAtTick - game.tick);
}

export function EventPrompts() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);

  const pending = game.events.filter((e) => !e.mitigated);
  if (pending.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {pending.map((evt) => (
        <div
          key={evt.id}
          style={{
            ...panel,
            position: "relative",
            border: "1px solid #6b2740",
            background: "rgba(34,12,18,0.92)",
            minWidth: 360,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700 }}>
              {KIND_ICON[evt.kind]} {KIND_LABEL[evt.kind]}
            </span>
            <span style={{ ...subtle, fontSize: 11 }}>
              {severityLabel(evt.severity)} · severity {evt.severity}
            </span>
          </div>
          <div style={{ ...subtle, fontSize: 12, margin: "4px 0 8px" }}>
            Threatening <b style={{ opacity: 1, color: "#ffb3b3" }}>{targetName(game, evt.targetId)}</b> · resolves in{" "}
            {ticksUntil(game, evt)} ticks
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => dispatch({ type: "respondToEvent", eventId: evt.id, response: "fortify" })}
              style={{ ...button(true), flex: 1 }}
              title="Commit defenses at the target"
            >
              Fortify
            </button>
            <button
              onClick={() => dispatch({ type: "respondToEvent", eventId: evt.id, response: "evacuate" })}
              style={{ ...button(), flex: 1 }}
              title="Pull back — save the population, cede the ground"
            >
              Evacuate
            </button>
            <button
              onClick={() => dispatch({ type: "respondToEvent", eventId: evt.id, response: "ignore" })}
              style={{ ...button(), flex: 1, borderColor: "#3a2230" }}
              title="Take the hit"
            >
              Ignore
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
