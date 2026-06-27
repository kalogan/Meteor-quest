import type { GameState } from "@meteor/shared";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { button, canAfford, defenseInfo, formatCost, heading, panel, subtle } from "./theme";

/**
 * Defense-build panel: the standing-garrison economy. For each owned target
 * (settled planet / discovered system) it shows the built `defense` and a
 * "Build defense" button that dispatches `buildDefense(targetId)` — spending the
 * content `defense.buildCost` for `defense.defensePerBuild` strength. Affordability
 * is reflected in the button (the sim stays authoritative; this is cosmetic).
 *
 * Scopes to the selected planet/system when one is clicked, so diving into a world
 * narrows the panel to it; otherwise it lists every owned target.
 */

interface DefenseTarget {
  id: string;
  name: string;
  kind: "planet" | "system";
  defense: number;
}

function ownedTargets(game: GameState): DefenseTarget[] {
  const planets = Object.values(game.planets)
    .filter((p) => p.settled)
    .map((p): DefenseTarget => ({ id: p.id, name: p.name, kind: "planet", defense: p.defense ?? 0 }));
  const systems = Object.values(game.systems)
    .filter((s) => s.discovered)
    .map((s): DefenseTarget => ({ id: s.id, name: s.name, kind: "system", defense: s.defense ?? 0 }));
  return [...planets, ...systems];
}

export function DefensePanel() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const { selectedId, selectedKind } = useSelection();

  // Only meaningful once the empire has left the cradle and has things to defend.
  if (!game.orbitalLaunched) return null;

  let targets = ownedTargets(game);
  if (targets.length === 0) return null;

  let scopeLabel = "All holdings";
  if (selectedId && (selectedKind === "planet" || selectedKind === "system")) {
    const scoped = targets.filter((t) => t.id === selectedId);
    if (scoped.length > 0) {
      targets = scoped;
      scopeLabel = "Selected holding";
    }
  }

  const { buildCost, defensePerBuild } = defenseInfo();
  const affordable = canAfford(game, buildCost);

  return (
    <div style={{ ...panel, bottom: 12, right: 12, width: 224 }}>
      <div style={heading}>Defenses · {scopeLabel}</div>
      <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
        Build standing defense where the frontier is hot — {formatCost(buildCost)} → +
        {defensePerBuild} strength.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" }}>
        {targets.map((t) => (
          <div key={t.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600 }}>
                {t.name} <span style={{ ...subtle, fontSize: 10 }}>· {t.kind}</span>
              </span>
              <span style={{ fontSize: 11, color: t.defense > 0 ? "#6fdc8c" : "#7a8295" }}>
                ⛨ {t.defense.toFixed(0)}
              </span>
            </div>
            <button
              disabled={!affordable}
              onClick={() => affordable && dispatch({ type: "buildDefense", targetId: t.id })}
              style={{ ...button(false, affordable), marginTop: 4, width: "100%" }}
              title={affordable ? `Spend ${formatCost(buildCost)}` : `Need ${formatCost(buildCost)}`}
            >
              {affordable ? `Build defense (${formatCost(buildCost)})` : `Need ${formatCost(buildCost)}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
