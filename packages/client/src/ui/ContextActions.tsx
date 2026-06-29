import { launchBlocker, systemInSensorRange } from "@meteor/sim-core";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";

/**
 * [discoverability] The contextual ACTION bar — the missing "what can I do with this?" prompt.
 * When you select a system or planet in the God-view it surfaces the one obvious next action:
 *   - a SYSTEM (not home) → "Fly here" (launch an expedition).
 *   - a PLANET in a fogged system → "Fly to <system>" first.
 *   - a discovered, unscanned PLANET → "Survey" (scan to reveal its biome).
 *   - a scanned, unsettled PLANET → "Settle".
 * When an action is gated, it shows WHY (out of range / research orbital launch / out of fuel),
 * so the player is never stuck wondering how to chart or travel. Dispatches the real commands.
 */

const BLOCK_MSG: Record<string, string> = {
  notLaunched: "Research Orbital Launch first",
  outOfRange: "Beyond ship range — research more range",
  notEnoughFuel: "Not enough fuel",
  alreadyEnroute: "An expedition is already underway",
  isHome: "",
  noTarget: "",
};

interface Act {
  key: string;
  label: string;
  onClick?: () => void;
  hint?: string;
}

export function ContextActions() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const selectedId = useSelection((s) => s.selectedId);
  const selectedKind = useSelection((s) => s.selectedKind);

  if (!selectedId || !selectedKind) return null;

  const acts: Act[] = [];

  if (selectedKind === "system") {
    const sys = game.systems[selectedId];
    if (sys && sys.id !== game.homeSystemId) {
      const block = launchBlocker(game, sys.id);
      if (block === null) {
        acts.push({ key: "fly", label: `🚀 Fly to ${sys.name}`, onClick: () => dispatch({ type: "launchJourney", targetSystemId: sys.id }) });
      } else {
        acts.push({ key: "fly", label: `🚀 Fly to ${sys.name}`, hint: BLOCK_MSG[block] ?? "Can't reach yet" });
      }
    }
  } else if (selectedKind === "planet") {
    const p = game.planets[selectedId];
    const sys = p ? game.systems[p.systemId] : undefined;
    if (p && sys) {
      const reachable = sys.id === game.homeSystemId || (game.orbitalLaunched && sys.distanceFromHome <= game.maxRange);
      if (!sys.discovered) {
        const block = launchBlocker(game, sys.id);
        if (block === null) acts.push({ key: "fly", label: `🚀 Fly to ${sys.name}`, onClick: () => dispatch({ type: "launchJourney", targetSystemId: sys.id }) });
        else acts.push({ key: "fly", label: `🚀 Reach ${sys.name}`, hint: BLOCK_MSG[block] ?? "Can't reach yet" });
      } else if (!p.scanned) {
        if (systemInSensorRange(game, sys.id)) acts.push({ key: "scan", label: `🔬 Survey ${p.name}`, onClick: () => dispatch({ type: "scanPlanet", planetId: p.id }) });
        else acts.push({ key: "scan", label: `🔬 Survey ${p.name}`, hint: "Out of sensor range" });
      } else if (!p.settled) {
        if (reachable) acts.push({ key: "settle", label: `🚩 Settle ${p.name}`, onClick: () => dispatch({ type: "settlePlanet", planetId: p.id }) });
        else acts.push({ key: "settle", label: `🚩 Settle ${p.name}`, hint: "Beyond ship range" });
      } else {
        acts.push({ key: "done", label: `✓ ${p.name} settled` });
      }
    }
  }

  if (acts.length === 0) return null;

  return (
    <div
      data-testid="context-actions"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(var(--hud-nav-h, 58px) + 84px + env(safe-area-inset-bottom, 0px))",
        transform: "translateX(-50%)",
        zIndex: 46,
        display: "flex",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      {acts.map((a) => {
        const enabled = a.onClick !== undefined;
        return (
          <div key={a.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <button
              type="button"
              data-testid={`context-act-${a.key}`}
              disabled={!enabled}
              onClick={a.onClick}
              style={{
                appearance: "none",
                minHeight: 44,
                padding: "10px 18px",
                font: '700 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif',
                color: enabled ? "#fff" : "#9aa3b8",
                background: enabled ? "#2f66ea" : "rgba(16,22,36,0.92)",
                border: `1px solid ${enabled ? "#5b8cff" : "#3a4668"}`,
                borderRadius: 22,
                boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
                cursor: enabled ? "pointer" : "not-allowed",
                backdropFilter: "blur(6px)",
              }}
            >
              {a.label}
            </button>
            {a.hint ? (
              <span style={{ font: "600 11px/1.2 system-ui, sans-serif", color: "#ffb454", background: "rgba(10,14,22,0.82)", border: "1px solid #2a3a5e", borderRadius: 10, padding: "2px 8px" }}>
                {a.hint}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
