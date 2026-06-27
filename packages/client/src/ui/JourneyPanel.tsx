import type { GameState, Journey, StarSystem } from "@meteor/shared";
import { fuelCost, travelBlocker } from "@meteor/sim-core";
import { useSim } from "../sim/store";
import { CollapsiblePanel, isPhoneViewport } from "./CollapsiblePanel";
import { button, journeyFuelLoad, subtle } from "./theme";

/**
 * [journey] Expedition command — the launch + in-transit beats of "watch-it-fly"
 * travel (God-view, light steering). One coherent panel because both beats are the
 * same loop (pick a reachable world → launch → watch it fly → arrive/abort); the
 * tier-gated TierControlPanel.SystemTierView keeps the older instant `travelToSystem`,
 * while this panel owns the visible `Journey`.
 *
 *   LAUNCH view  — lists reachable systems (in-range targets) with the fuel the trip
 *                  loads and a "Launch expedition" button. Disabled with a spoken
 *                  reason when not orbital-launched / out of range / short on fuel.
 *   IN-TRANSIT   — one card per enroute journey: destination, distance remaining +
 *                  rough ETA, fuel (warns when low), a steer hint (← →, the world
 *                  layer owns the actual input), and an Abort button.
 *   ARRIVAL cue  — a brief "Arrived at <system>" line read from the log (the sim
 *                  deletes a journey the tick it arrives, so the cue lives in the log;
 *                  the existing scan/settle flow takes the hand-off from there).
 *
 * Optimistic-cosmetic: it reads authoritative state and dispatches Commands only.
 */

type Vec3 = { x: number; y: number; z: number };

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Within this radius of the target counts as arrived (mirrors ARRIVE_RADIUS). The
 *  ETA uses each journey's own `speed`, so JOURNEY_SPEED need not be restated. */
const ARRIVE_RADIUS = 6;

/** Warn the player when a journey's tank drops below this fraction of a full load. */
const LOW_FUEL_FRACTION = 0.25;

const OK_GREEN = "#6fdc8c";
const WARN_AMBER = "#ffb86b";
const DANGER_RED = "#ff8a8a";

/** Spoken reason a launch is blocked (null = launchable). Combines the sim's travel
 *  gate with the journey's heavier fuel load (tank = fuelCost × margin). */
function launchReason(game: GameState, sys: StarSystem): string | null {
  const block = travelBlocker(game, sys.id);
  if (block === "notLaunched") return "Research Orbital Launch to leave the cradle";
  if (block === "outOfRange") return "Out of range — extend ship range first";
  if (block === "noSystem") return "Unknown system";
  // `travelBlocker` flags fuel against the bare trip cost; the tank actually loads the
  // margined cost, so re-check against that heavier figure even when the sim's lighter
  // gate passes.
  const load = journeyFuelLoad(fuelCost(game, sys.id));
  if ((game.stockpiles.fuel ?? 0) < load) return `Need ${Math.ceil(load)} fuel for the tank`;
  if (Object.values(game.journeys).some((j) => j.status === "enroute" && j.targetSystemId === sys.id)) {
    return "An expedition is already enroute here";
  }
  return null;
}

/** The systems the player could launch toward right now (in-range, not home). */
function reachableTargets(game: GameState): StarSystem[] {
  return Object.values(game.systems)
    .filter((s) => s.id !== game.homeSystemId)
    .filter((s) => game.orbitalLaunched && s.distanceFromHome <= game.maxRange)
    .sort((a, b) => a.distanceFromHome - b.distanceFromHome);
}

/** The most recent "Expedition arrived at …" log line, if it is still the latest beat. */
function latestArrival(game: GameState): string | null {
  for (let i = game.log.length - 1; i >= 0 && i >= game.log.length - 4; i--) {
    const m = game.log[i]?.message ?? "";
    const hit = m.match(/^Expedition arrived at (.+)\.$/);
    if (hit) return hit[1] ?? null;
  }
  return null;
}

function LaunchRow({ sys }: { sys: StarSystem }) {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);

  const reason = launchReason(game, sys);
  const enabled = reason === null;
  const load = Math.ceil(journeyFuelLoad(fuelCost(game, sys.id)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 600 }}>
          {sys.name}
          {sys.discovered ? <span style={{ ...subtle, fontSize: 10 }}> · charted</span> : null}
        </span>
        <span style={{ ...subtle, fontSize: 11 }}>{Math.round(sys.distanceFromHome)} ly</span>
      </div>
      <div style={{ ...subtle, fontSize: 11, marginTop: 2 }}>tank loads {load} fuel</div>
      <button
        type="button"
        disabled={!enabled}
        onClick={() => enabled && dispatch({ type: "launchJourney", targetSystemId: sys.id })}
        style={{ ...button(false, enabled), marginTop: 4, width: "100%" }}
        aria-label={enabled ? `Launch expedition to ${sys.name}` : `Cannot launch to ${sys.name}: ${reason}`}
        title={enabled ? `Spend ${load} fuel` : (reason ?? undefined)}
      >
        {enabled ? "Launch expedition" : "Unavailable"}
      </button>
      {reason ? (
        <div style={{ ...subtle, fontSize: 10, marginTop: 3 }} role="note">
          {reason}
        </div>
      ) : null}
    </div>
  );
}

function TransitCard({ journey }: { journey: Journey }) {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);

  const target = game.systems[journey.targetSystemId];
  const targetName = target?.name ?? journey.targetSystemId;

  // Distance remaining + a rough ETA (straight-line; steering/detours make it longer,
  // hence "~"). The sim owns the real motion — this is a legible estimate.
  const remaining = target ? Math.max(0, distance(target.position, journey.pos) - ARRIVE_RADIUS) : 0;
  const etaTicks = journey.speed > 0 ? Math.ceil(remaining / journey.speed) : Infinity;

  // Fuel: warn when the tank is running low relative to what the remaining straight run
  // would burn (a steered detour can still strand you).
  const fuelToFinish = remaining * 0.2; // FUEL_PER_DISTANCE, mirrored
  const lowFuel = journey.fuel <= fuelToFinish * (1 + LOW_FUEL_FRACTION);
  const fuelColor = journey.fuel <= fuelToFinish ? DANGER_RED : lowFuel ? WARN_AMBER : OK_GREEN;

  return (
    <div style={{ border: "1px solid #284a6b", borderRadius: 6, padding: "8px 10px", background: "rgba(14,24,40,0.6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700 }}>→ {targetName}</span>
        <span style={{ ...subtle, fontSize: 11 }}>enroute</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 6 }}>
        <span style={subtle}>distance left</span>
        <span>{Math.round(remaining)} ly</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
        <span style={subtle}>est. arrival</span>
        <span>{Number.isFinite(etaTicks) ? `~${etaTicks} ticks` : "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
        <span style={subtle}>fuel</span>
        <span style={{ color: fuelColor, fontWeight: 600 }}>
          {Math.round(journey.fuel)}
          {lowFuel ? " · low" : ""}
        </span>
      </div>

      <div style={{ ...subtle, fontSize: 10, marginTop: 6 }} role="note">
        Steer with <kbd>←</kbd> <kbd>→</kbd> to weave (costs fuel) — autopilot still homes in.
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: "abortJourney", journeyId: journey.id })}
        style={{ ...button(false, true), marginTop: 6, width: "100%", borderColor: "#6b2740" }}
        aria-label={`Abort expedition to ${targetName}`}
        title="Recall the expedition (the trip is lost)"
      >
        Abort expedition
      </button>
    </div>
  );
}

export function JourneyPanel() {
  const game = useSim((s) => s.game);

  // Only meaningful once the player can leave the cradle.
  if (!game.orbitalLaunched) return null;

  const enroute = Object.values(game.journeys).filter((j) => j.status === "enroute");
  const targets = reachableTargets(game);
  const arrival = enroute.length === 0 ? latestArrival(game) : null;

  // Nothing to show: no flights, nowhere to fly, no fresh arrival.
  if (enroute.length === 0 && targets.length === 0 && !arrival) return null;

  return (
    <CollapsiblePanel
      title="Expedition"
      defaultOpen={!isPhoneViewport()}
      className="hud-dock hud-dock-journey"
      style={{ width: 280 }}
    >
      {arrival ? (
        <div
          role="status"
          style={{
            border: `1px solid ${OK_GREEN}`,
            borderRadius: 6,
            padding: "6px 8px",
            marginBottom: 10,
            color: OK_GREEN,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Arrived at {arrival} — scan &amp; settle below.
        </div>
      ) : null}

      {enroute.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {enroute.map((j) => (
            <TransitCard key={j.id} journey={j} />
          ))}
        </div>
      ) : (
        <>
          <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
            Launch a visible expedition to a reachable system — watch it fly, nudge its
            heading, settle on arrival.
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 10 }}>
            <span style={subtle}>ship range</span>
            <span>{Math.round(game.maxRange)} ly</span>
          </div>
          {targets.length > 0 ? (
            <div
              className="hud-scroll"
              style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto" }}
            >
              {targets.map((sys) => (
                <LaunchRow key={sys.id} sys={sys} />
              ))}
            </div>
          ) : (
            <div style={{ ...subtle, fontSize: 11 }}>
              No systems in range yet — extend ship range to open a route.
            </div>
          )}
        </>
      )}
    </CollapsiblePanel>
  );
}
