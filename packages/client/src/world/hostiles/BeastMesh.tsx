import { useMemo, useRef, type JSX } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";

/**
 * [hostiles] A purely COSMETIC low-poly SPACE BEAST — a menacing predatory deep-space
 * leviathan for the stylized 4X threat displays. It speaks the same low-poly language as
 * the friendly fleet (Ship/MiningProbe): faceted `meshStandardMaterial` with `flatShading`,
 * low-segment geometries, emissive glows, no textures — but reads as ALIEN and hostile:
 *   - a lumpy faceted body (icosahedron) that slowly writhes/breathes,
 *   - jagged spikes/tendrils jutting out at varied angles (a spiky silhouette),
 *   - a single glowing central eye/core + two smaller eyes that pulse.
 *
 * Authored at the LOCAL origin, ~1 unit in radius; the parent <group> scales/positions it.
 * It reads no sim state and mutates nothing — all motion is local useFrame work over its
 * own refs. With `reducedMotion` it renders a STATIC menacing pose (no writhe, no rotation,
 * steady eye glow) so the silhouette survives without animation.
 */

/** Parse "#rrggbb" → scale each channel by `f` → "#rrggbb". Clamped, deterministic. */
function shade(hex: string, f: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  // Fall back to a mid grey if the tint isn't a clean 6-digit hex.
  const v = m ? parseInt(m[1] ?? "888888", 16) : 0x888888;
  const r = Math.min(255, Math.round(((v >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((v >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((v & 0xff) * f));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** One spike/tendril placed on the body: its origin direction + length + thickness. */
type Spike = {
  /** Rotation (Euler XYZ) orienting the cone's +Y axis to point outward. */
  rotation: [number, number, number];
  /** Position of the spike base on the body surface. */
  position: [number, number, number];
  /** Cone height (spike length). */
  length: number;
  /** Cone base radius (spike thickness). */
  radius: number;
};

/**
 * Fixed spike arrangement for a STABLE, deterministic silhouette (no Math.random). Each
 * direction is a unit-ish vector; we derive the surface position and the rotation that
 * aims the cone (+Y) along that direction. 7 spikes of varied length for a jagged predator.
 */
const SPIKE_DIRS: ReadonlyArray<{ dir: [number, number, number]; length: number; radius: number }> = [
  { dir: [0, 1, 0], length: 0.9, radius: 0.12 }, // crown spike
  { dir: [0.85, 0.35, 0.2], length: 0.75, radius: 0.1 },
  { dir: [-0.8, 0.2, -0.4], length: 0.7, radius: 0.1 },
  { dir: [0.3, -0.4, 0.85], length: 0.65, radius: 0.09 },
  { dir: [-0.4, -0.55, 0.6], length: 0.6, radius: 0.09 },
  { dir: [-0.2, -0.85, -0.4], length: 1.05, radius: 0.11 }, // long trailing tendril
  { dir: [0.55, -0.2, -0.75], length: 0.8, radius: 0.1 },
];

/** Body radius the spikes sit on; spikes are anchored slightly inside the hull. */
const BODY_RADIUS = 0.62;

export function BeastMesh({ tint, reducedMotion }: { tint: string; reducedMotion: boolean }): JSX.Element {
  const body = useRef<Group>(null);
  const coreEye = useRef<Mesh>(null);
  const eyeMat = useRef<MeshStandardMaterial>(null);

  const spikeColor = useMemo(() => shade(tint, 0.45), [tint]);
  const bodyDark = useMemo(() => shade(tint, 0.7), [tint]);
  const eyeColor = useMemo(() => shade(tint, 1.6), [tint]);

  // Precompute each spike's surface anchor + the rotation that aims its +Y outward.
  const spikes = useMemo<Spike[]>(
    () =>
      SPIKE_DIRS.map(({ dir, length, radius }) => {
        const [x, y, z] = dir;
        const len = Math.hypot(x, y, z) || 1;
        const nx = x / len;
        const ny = y / len;
        const nz = z / len;
        // Anchor the cone base just inside the hull so it appears rooted in the body.
        const anchor = BODY_RADIUS - 0.12;
        // A cone's apex is +Y; to point its +Y along (nx,ny,nz) we rotate the +Y axis.
        // Rotate about X by the polar angle, then about Y by the azimuth.
        const polar = Math.acos(Math.max(-1, Math.min(1, ny)));
        const azim = Math.atan2(nx, nz);
        return {
          position: [nx * anchor, ny * anchor, nz * anchor],
          rotation: [polar, azim, 0],
          length,
          radius,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;

    // Body: a slow writhe (breathing scale on staggered axes) + a lazy menacing turn.
    if (body.current) {
      const bx = 1 + Math.sin(t * 1.1) * 0.06;
      const by = 1 + Math.sin(t * 0.9 + 1.7) * 0.05;
      const bz = 1 + Math.sin(t * 1.3 + 0.6) * 0.06;
      body.current.scale.set(bx, by, bz);
      body.current.rotation.y = t * 0.18;
      body.current.rotation.x = Math.sin(t * 0.5) * 0.12;
    }

    // Eye/core: a pulsing glow — swells in size and emissive intensity like a heartbeat.
    const pulse = 0.5 + Math.sin(t * 2.6) * 0.5; // 0..1
    if (coreEye.current) coreEye.current.scale.setScalar(0.92 + pulse * 0.22);
    if (eyeMat.current) eyeMat.current.emissiveIntensity = 1.4 + pulse * 1.6;
  });

  return (
    <group>
      {/* Writhing body group — faceted blob + spikes + eyes all ride this group. */}
      <group ref={body}>
        {/* Lumpy faceted hull. detail 1 gives a beast-like blob silhouette. */}
        <mesh>
          <icosahedronGeometry args={[BODY_RADIUS, 1]} />
          <meshStandardMaterial color={tint} metalness={0.2} roughness={0.7} flatShading />
        </mesh>
        {/* A smaller offset inner lump for an asymmetric, organic profile. */}
        <mesh position={[0.18, -0.1, 0.12]}>
          <icosahedronGeometry args={[BODY_RADIUS * 0.6, 0]} />
          <meshStandardMaterial color={bodyDark} metalness={0.2} roughness={0.75} flatShading />
        </mesh>

        {/* Jagged spikes / tendrils poking outward — the predator's threat silhouette. */}
        {spikes.map((s, i) => (
          <mesh key={i} position={s.position} rotation={s.rotation}>
            {/* Cone authored along +Y; height shifts so the base sits at the anchor. */}
            <coneGeometry args={[s.radius, s.length, 5]} />
            <meshStandardMaterial color={spikeColor} metalness={0.25} roughness={0.6} flatShading />
          </mesh>
        ))}

        {/* Glowing central eye/core — the menacing pulsing heart of the beast. */}
        <mesh ref={coreEye} position={[0, 0.05, BODY_RADIUS * 0.72]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial
            ref={eyeMat}
            color={eyeColor}
            emissive={eyeColor}
            emissiveIntensity={1.8}
            roughness={0.3}
            flatShading
          />
        </mesh>
        {/* Two smaller flanking eyes, steady-bright, for a multi-eyed alien stare. */}
        <mesh position={[0.26, 0.24, BODY_RADIUS * 0.6]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={1.5} flatShading />
        </mesh>
        <mesh position={[-0.26, 0.24, BODY_RADIUS * 0.6]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={1.5} flatShading />
        </mesh>
      </group>

      {/* A soft glow light tinted by the beast's core so it lights its own spikes. */}
      <pointLight position={[0, 0.1, 0.7]} color={eyeColor} intensity={1.2} distance={4} />
    </group>
  );
}
