import { useMemo, useRef, type JSX } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

/**
 * [hostiles] A purely COSMETIC low-poly SPACE PIRATE RAIDER ship. It shares the
 * project's low-poly material language (flat-shaded standard materials, low-segment
 * cones/boxes/icosahedra, an emissive engine glow + a small pointLight — see Ship.tsx /
 * MiningProbe.tsx) but reads as a MENACE rather than a friend: a dark charcoal armored
 * hull, a forward ram prow + spike, two aggressively swept-back blade fins with accent
 * trim, and a hot warm engine glow at the back. Deliberately ANGULAR and ASYMMETRIC
 * (an offset cannon pod) to contrast both the clean explorer Ship and any organic beast.
 *
 * Authored in its LOCAL frame, centered at the origin and ~1 unit in radius (the prow
 * points down +Z); the parent <group> scales/positions/orients it. It reads no sim state
 * and mutates nothing — all motion is local useFrame work over its own refs (a slow
 * menacing bob/roll + a pulsing engine glow). With `reducedMotion` it renders a static,
 * level pose with a steady glow.
 */

/** Accent color used when `tint` isn't a parseable #rrggbb hex. */
const FALLBACK_TINT = "#ff8a3d";

/** Parse "#rrggbb" → [r,g,b] in 0..255, or null if it isn't that exact form. */
function parseHex(hex: string): readonly [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
}

/** Scale an "#rrggbb" color's channels by `f` (clamped), returning a new "#rrggbb". */
function scaleHex(hex: string, f: number): string {
  const rgb = parseHex(hex) ?? parseHex(FALLBACK_TINT) ?? ([255, 138, 61] as const);
  const ch = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v * f)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(rgb[0])}${ch(rgb[1])}${ch(rgb[2])}`;
}

export function PirateMesh({
  tint,
  reducedMotion,
}: {
  tint: string;
  reducedMotion: boolean;
}): JSX.Element {
  const hull = useRef<Group>(null);
  const glow = useRef<Mesh>(null);

  // Derived shades: a brighter accent for trim/markings and a hot warm core for the
  // engine. Stable across renders for a fixed value of `tint`.
  const accent = useMemo(() => scaleHex(tint, 1), [tint]);
  const accentBright = useMemo(() => scaleHex(tint, 1.35), [tint]);
  const engineHot = useMemo(() => scaleHex(tint, 1.55), [tint]);

  // Stable transforms for the swept blade fins (mirrored) and the offset cannon pod, so
  // the silhouette is fixed (no Math.random) and arrays don't reallocate per frame.
  const fins = useMemo(
    () =>
      [
        { position: [0.42, 0.02, -0.32], rotation: [0, -0.55, 0.62] },
        { position: [-0.42, 0.02, -0.32], rotation: [0, 0.55, -0.62] },
      ] as const,
    [],
  );

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    if (hull.current) {
      // Slow, heavy, menacing drift — a long roll and a subtle bob.
      hull.current.rotation.z = Math.sin(t * 0.6) * 0.12;
      hull.current.rotation.x = Math.sin(t * 0.45 + 1.1) * 0.06;
      hull.current.position.y = Math.sin(t * 0.8) * 0.04;
    }
    if (glow.current) {
      // Throbbing engine glow.
      glow.current.scale.setScalar(0.85 + Math.sin(t * 6) * 0.18);
    }
  });

  return (
    <group ref={hull}>
      {/* Mid hull — a boxy, armored charcoal body. */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[0.5, 0.34, 1.0]} />
        <meshStandardMaterial color="#1c1f26" metalness={0.6} roughness={0.5} flatShading />
      </mesh>

      {/* Forward prow — a low-segment angular nose that ramps to the ram. */}
      <mesh position={[0, -0.01, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.26, 0.7, 4]} />
        <meshStandardMaterial color="#23262e" metalness={0.55} roughness={0.5} flatShading />
      </mesh>

      {/* Ram spike — a sharp accent-edged point jutting from the prow. */}
      <mesh position={[0, -0.02, 0.96]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.32, 4]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.25}
          metalness={0.5}
          roughness={0.4}
          flatShading
        />
      </mesh>

      {/* Dorsal blade — a raised charcoal fin along the spine for menace. */}
      <mesh position={[0, 0.26, -0.18]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.06, 0.3, 0.5]} />
        <meshStandardMaterial color="#14161b" metalness={0.6} roughness={0.5} flatShading />
      </mesh>

      {/* Accent marking stripe — a bright trim plate on the hull's top. */}
      <mesh position={[0, 0.18, 0.1]}>
        <boxGeometry args={[0.14, 0.02, 0.46]} />
        <meshStandardMaterial
          color={accentBright}
          emissive={accent}
          emissiveIntensity={0.35}
          metalness={0.4}
          roughness={0.4}
          flatShading
        />
      </mesh>

      {/* Swept-back blade wings (mirrored) — dark blades with accent leading edges. */}
      {fins.map((fin, i) => (
        <group key={i} position={[...fin.position]} rotation={[...fin.rotation]}>
          <mesh>
            <boxGeometry args={[0.55, 0.04, 0.34]} />
            <meshStandardMaterial color="#181b21" metalness={0.55} roughness={0.5} flatShading />
          </mesh>
          {/* Accent-colored edge running along the wing tip. */}
          <mesh position={[0.27, 0, 0]}>
            <boxGeometry args={[0.05, 0.05, 0.36]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.4}
              metalness={0.4}
              roughness={0.4}
              flatShading
            />
          </mesh>
        </group>
      ))}

      {/* Asymmetric cannon pod — offset to one side for an aggressive, lopsided look. */}
      <mesh position={[0.28, -0.04, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
        <meshStandardMaterial color="#2a2d35" metalness={0.6} roughness={0.45} flatShading />
      </mesh>

      {/* Rear engine bell — a flared cone opening backward. */}
      <mesh position={[0, 0, -0.66]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.24, 0.34, 8, 1, true]} />
        <meshStandardMaterial color="#2a2d35" metalness={0.65} roughness={0.4} flatShading side={2} />
      </mesh>

      {/* Hot emissive engine glow sphere at the bell mouth. */}
      <mesh ref={glow} position={[0, 0, -0.82]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshBasicMaterial color={engineHot} transparent opacity={0.8} depthWrite={false} />
      </mesh>

      {/* Warm point light cast by the engine. */}
      <pointLight position={[0, 0, -0.88]} color={engineHot} intensity={2.4} distance={6} />
    </group>
  );
}
