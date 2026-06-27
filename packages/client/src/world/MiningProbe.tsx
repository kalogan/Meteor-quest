import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group, Mesh } from "three";

/**
 * [intro] A purely COSMETIC low-poly mining probe for the cinematic intro's "mining"
 * stage. It reuses the IntroShip material language (cool metals + a glow accent) so it
 * reads as part of the same fleet, and it visibly "works for you":
 *   - a small faceted body with solar-vane fins,
 *   - an articulated antenna/dish arm that extends and points down at the surface,
 *   - an active, pulsing MINING BEAM (a thin tapered cone from the probe to the world),
 *   - low-poly resource CHUNKS that rise up the beam from the surface to the probe and
 *     loop — so you SEE minerals being harvested.
 *
 * It reads no sim state and mutates nothing — all motion is local useFrame work over
 * pre-allocated scratch. With `reducedMotion` it renders fully deployed and static: the
 * antenna is already extended and the beam is present, just not pulsing/animating, and
 * the chunks sit frozen along the beam (so the meaning survives without motion).
 *
 * Geometry is authored in the probe's LOCAL frame with the beam pointing down -Y toward
 * the surface; the parent <group> places/orients the whole rig in the scene. `beamLen`
 * is the distance from the probe down to the planet surface (in world units).
 */

/** Number of resource chunks travelling up the beam at once. */
const CHUNK_COUNT = 5;
/** Reused scratch so the per-frame chunk placement allocates nothing. */
const _chunkPos = new Vector3();

export function MiningProbe({
  glowColor,
  beamLen,
  reducedMotion,
}: {
  glowColor: string;
  /** Distance from the probe down to the planet surface, in world units. */
  beamLen: number;
  reducedMotion: boolean;
}) {
  const beam = useRef<Mesh>(null);
  const dish = useRef<Group>(null);
  const chunkRefs = useRef<(Mesh | null)[]>([]);
  const elapsed = useRef(0);

  // A stable [0..CHUNK_COUNT) index list to render the chunk meshes from.
  const chunks = useMemo(() => Array.from({ length: CHUNK_COUNT }, (_, i) => i), []);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;

    // Beam: a steady pulse in width + brightness so it reads as an active tool.
    if (beam.current) {
      const pulse = reducedMotion ? 1 : 0.82 + Math.sin(t * 5) * 0.18;
      beam.current.scale.set(pulse, 1, pulse);
      const mat = beam.current.material as { opacity?: number };
      if (mat) mat.opacity = reducedMotion ? 0.32 : 0.22 + (pulse - 0.64) * 0.4;
    }

    // Antenna arm: a slow sweep as it tracks the surface (held extended if reduced).
    if (dish.current) {
      dish.current.rotation.x = reducedMotion ? 0.32 : 0.32 + Math.sin(t * 0.9) * 0.12;
    }

    // Resource chunks ride up the beam, surface → probe, then loop. The beam runs from
    // y=0 (probe local origin) down to y=-beamLen (surface), so "up" is rising y.
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const mesh = chunkRefs.current[i];
      if (!mesh) continue;
      const offset = i / CHUNK_COUNT; // even spacing along the beam
      const frac = reducedMotion ? offset : (offset + t * 0.35) % 1; // 0 surface → 1 probe
      const y = -beamLen + frac * beamLen;
      // A slight taper-in toward the probe + a tiny wobble so it feels harvested.
      const wob = reducedMotion ? 0 : Math.sin(t * 6 + i) * 0.04 * (1 - frac);
      _chunkPos.set(wob, y, wob * 0.6);
      mesh.position.copy(_chunkPos);
      const s = 0.5 + frac * 0.7; // smaller near the surface, fuller near the probe
      mesh.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* Probe body — faceted hull + a small upper sensor node. */}
      <mesh>
        <icosahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial color="#aab6d0" metalness={0.55} roughness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.16, 0.18, 0.16]} />
        <meshStandardMaterial color="#6f7d9e" metalness={0.5} roughness={0.45} flatShading />
      </mesh>

      {/* Solar vanes — two thin angled fins, the probe's "wings". */}
      <mesh position={[0.34, 0.04, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.34, 0.02, 0.2]} />
        <meshStandardMaterial color="#2b4a8a" metalness={0.3} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[-0.34, 0.04, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.34, 0.02, 0.2]} />
        <meshStandardMaterial color="#2b4a8a" metalness={0.3} roughness={0.6} flatShading />
      </mesh>

      {/* Articulated antenna/dish arm — pivots at the probe, extends down toward the
          surface and carries the mining dish + emitter at its tip. */}
      <group ref={dish} position={[0, -0.18, 0]}>
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.36, 6]} />
          <meshStandardMaterial color="#56607a" metalness={0.6} roughness={0.4} flatShading />
        </mesh>
        {/* The dish, opening downward at the arm's tip. */}
        <mesh position={[0, -0.4, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.17, 0.16, 8, 1, true]} />
          <meshStandardMaterial
            color="#c9d4e8"
            metalness={0.5}
            roughness={0.35}
            flatShading
            side={2}
          />
        </mesh>
        {/* Emitter glow at the dish mouth. */}
        <mesh position={[0, -0.46, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>

      {/* The mining beam: a tapered cone, narrow at the probe and wider where it meets
          the surface. Centered at -beamLen/2 and as tall as the gap. */}
      <mesh ref={beam} position={[0, -beamLen / 2, 0]}>
        <coneGeometry args={[0.22, beamLen, 10, 1, true]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.28}
          depthWrite={false}
          side={2}
        />
      </mesh>

      {/* A soft light cast onto the planet where the beam lands. */}
      <pointLight position={[0, -beamLen, 0]} color={glowColor} intensity={1.8} distance={beamLen * 2.5} />

      {/* Resource chunks rising up the beam (positions set each frame above). */}
      {chunks.map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            chunkRefs.current[i] = m;
          }}
        >
          <icosahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial
            color={glowColor}
            emissive={glowColor}
            emissiveIntensity={0.5}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}
