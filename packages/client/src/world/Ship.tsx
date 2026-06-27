import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

/**
 * The shared low-poly craft — the player's vessel silhouette (nose cone, fuselage,
 * engine bell + glow). Authored in its LOCAL frame with the nose pointing down +Z; the
 * parent <group> orients it along travel. Used by BOTH the cinematic intro (IntroScene)
 * and the in-game home fleet (OrbitingFleet) so the ship reads as the same vessel from
 * the tutorial straight into the God-view.
 *
 * Cosmetic only: all motion is local useFrame work (a glow pulse + a gentle hull roll)
 * over its own refs — it reads no sim state and mutates nothing. With `reducedMotion`
 * the glow holds at a steady size and the hull sits level (no roll), matching the
 * intro's reduced-motion handling.
 */
export function Ship({
  glowColor,
  reducedMotion = false,
}: {
  glowColor: string;
  /** Hold the glow/roll static (accessibility). Defaults to animated. */
  reducedMotion?: boolean;
}) {
  const glow = useRef<Mesh>(null);
  const hull = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (glow.current) {
      glow.current.scale.setScalar(reducedMotion ? 0.9 : 0.85 + Math.sin(t * 12) * 0.15);
    }
    if (hull.current) hull.current.rotation.z = reducedMotion ? 0 : Math.sin(t * 1.4) * 0.16;
  });

  return (
    <group ref={hull}>
      <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 0.8, 6]} />
        <meshStandardMaterial color="#c9d4e8" metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color="#8a97b4" metalness={0.4} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 0, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.22, 0.3, 6]} />
        <meshStandardMaterial color="#566079" metalness={0.6} roughness={0.4} flatShading />
      </mesh>
      <mesh ref={glow} position={[0, 0, -0.78]}>
        <sphereGeometry args={[0.26, 10, 10]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 0, -0.8]} color={glowColor} intensity={2.2} distance={6} />
    </group>
  );
}
