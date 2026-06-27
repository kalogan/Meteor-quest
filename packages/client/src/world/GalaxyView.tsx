import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { GameState, StarSystem } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import { PALETTE } from "./palette";
import { SystemView } from "./SystemView";
import { ThreatLayer } from "./ThreatView";
import { systemPosition } from "./layout";

/**
 * The galaxy layer — the fog gate. Discovered systems render fully (star + orbiting
 * planets); UNDISCOVERED systems show only as a dim blip raised from the fog, with
 * nothing inside revealed. We never read what state hides: an undiscovered system's
 * planets are never instantiated.
 *
 * Galaxy authority is deferred past slice 1, so this is intentionally light — but
 * the space is real, so the continuous zoom out to "galaxy" has somewhere to go.
 */

/** A dim, un-pickable smear marking an undiscovered system's rough location. */
function FogBlip({ system }: { system: StarSystem }) {
  const pos = systemPosition(system);
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.6, 8, 8]} />
      <meshBasicMaterial color={PALETTE.undiscovered} transparent opacity={0.55} />
    </mesh>
  );
}

export function GalaxyView({ game }: { game: GameState }) {
  const select = useSelection((s) => s.select);
  const systems = useMemo(() => Object.values(game.systems), [game.systems]);

  return (
    <group
      name="galaxy"
      onPointerMissed={() => select(null, null)}
    >
      {systems.map((system) =>
        system.discovered ? (
          <SystemView key={system.id} system={system} game={game} />
        ) : (
          <FogBlip key={system.id} system={system} />
        ),
      )}

      {/* Telegraphed incoming threats, readable from the galaxy band down. */}
      <ThreatLayer game={game} />
    </group>
  );
}

/** Re-exported so the rig can resolve a selected entity to a world position. */
export type { ThreeEvent };
