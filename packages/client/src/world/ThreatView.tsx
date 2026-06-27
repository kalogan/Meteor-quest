import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { ActiveEvent, GameState } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import { threatColor } from "./palette";
import {
  eventSystemId,
  resolveEventPosition,
  systemPosition,
  threatProgress,
} from "./layout";

/**
 * Telegraphed-threat visualization. Each active, unmitigated event that targets a
 * visible body gets an INCOMING-THREAT indicator whose progress runs from
 * `spawnedAtTick` -> `resolvesAtTick` (read off the deterministic sim tick), so a
 * looming catastrophe visibly closes in across the galaxy map. Purely cosmetic: we
 * READ `game.events`, never write. We never telegraph through fog (resolver returns
 * null for hidden systems).
 *
 * Geometry (readable at galaxy zoom): an approach line from off-system toward the
 * target, a marker that slides down that line as the threat closes, and a target
 * ring that pulses faster and brighter as resolution nears. A mitigated event drops
 * out entirely — the player can SEE their response landed.
 */

/** Where the threat approaches FROM: an off-galaxy-plane vector toward the target. */
function approachVector(seed: string): [number, number, number] {
  // Deterministic per-event so the same threat always comes from the same bearing.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) / 0xffffffff) * Math.PI * 2;
  const tilt = 0.35; // lift the approach slightly off the disc so the line reads.
  return [Math.cos(a), tilt, Math.sin(a)];
}

function ThreatMarker({
  game,
  ev,
  target,
}: {
  game: GameState;
  ev: ActiveEvent;
  target: [number, number, number];
}) {
  const ring = useRef<Mesh>(null);
  const marker = useRef<Group>(null);
  const color = threatColor(ev.kind);
  const progress = threatProgress(game, ev);

  // The approach line: a fixed launch point a galaxy-readable distance from target.
  const { launch } = useMemo(() => {
    const [vx, vy, vz] = approachVector(ev.id);
    const reach = 16; // scene units — long enough to read as "incoming" at galaxy zoom.
    return {
      launch: [
        target[0] + vx * reach,
        target[1] + vy * reach,
        target[2] + vz * reach,
      ] as [number, number, number],
    };
    // target is recomputed each render from sim positions; pin to id + coords.
  }, [ev.id, target[0], target[1], target[2]]);

  const linePts = useMemo(
    () => new Float32Array([...launch, ...target]),
    [launch, target],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // The closer the threat, the faster + harder the pulse (urgency telegraph).
    const urgency = 0.5 + progress * 1.5;
    if (ring.current) {
      const s = 1 + Math.sin(t * 4 * urgency) * 0.12 * urgency;
      ring.current.scale.setScalar(s);
    }
    if (marker.current) {
      // Slide the marker from launch -> target along the approach as it closes in.
      const p = progress;
      marker.current.position.set(
        launch[0] + (target[0] - launch[0]) * p,
        launch[1] + (target[1] - launch[1]) * p,
        launch[2] + (target[2] - launch[2]) * p,
      );
      const spin = t * 2.5;
      marker.current.rotation.set(spin, spin * 0.7, 0);
    }
  });

  // A wider ring + brighter line as resolution nears.
  const ringOuter = 1.6 + progress * 1.4;
  return (
    <group>
      {/* Approach line: the threat's incoming trajectory. */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePts, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.2 + progress * 0.55}
        />
      </line>

      {/* The closing marker — a small spiky body sliding down the approach line. */}
      <group ref={marker}>
        <mesh>
          <octahedronGeometry args={[0.5 + progress * 0.4, 0]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Target ring at the threatened body, pulsing toward resolution. */}
      <group position={target}>
        <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringOuter * 0.78, ringOuter, 40]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.35 + progress * 0.5}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/** All telegraphed threats across the galaxy map (galaxy-zoom readable). */
export function ThreatLayer({ game }: { game: GameState }) {
  // When the player has dived into a threatened system, SystemView renders that
  // system's threats in its own (tactical) frame — skip them here so they don't
  // double-draw / z-fight the long-range read.
  const focused = useSelection((s) => s.selectedId);
  const threats = useMemo(
    () =>
      game.events.filter(
        (e) => !e.mitigated && eventSystemId(game, e) !== focused,
      ),
    [game, focused],
  );
  return (
    <group name="threats">
      {threats.map((ev) => {
        const target = resolveEventPosition(game, ev);
        if (!target) return null; // fogged / unresolved: never telegraph through fog.
        return <ThreatMarker key={ev.id} game={game} ev={ev} target={target} />;
      })}
    </group>
  );
}

/**
 * The threats targeting one specific system (its own id or any of its planets),
 * rendered in the system's LOCAL frame for the tactical dive view. Same telegraph,
 * positioned relative to the system anchor so it composes inside SystemView.
 */
export function SystemThreats({
  game,
  systemId,
}: {
  game: GameState;
  systemId: string;
}) {
  const system = game.systems[systemId];
  const origin = useMemo(
    () => (system ? systemPosition(system) : ([0, 0, 0] as const)),
    [system],
  );
  const threats = useMemo(() => {
    return game.events.filter((e) => {
      if (e.mitigated) return false;
      if (e.targetId === systemId) return true;
      const p = game.planets[e.targetId];
      return p ? p.systemId === systemId : false;
    });
  }, [game.events, game.planets, systemId]);

  if (!system) return null;

  return (
    <group name="system-threats">
      {threats.map((ev) => {
        const world = resolveEventPosition(game, ev);
        if (!world) return null;
        // Re-express the world target in the system's local frame.
        const local: [number, number, number] = [
          world[0] - origin[0],
          world[1] - origin[1],
          world[2] - origin[2],
        ];
        return <ThreatMarker key={ev.id} game={game} ev={ev} target={local} />;
      })}
    </group>
  );
}
