import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/**
 * [surface — avatar] A low-poly SPACE-SUIT figure for the walkable surface (preview Tier 2).
 * Authored in a LOCAL frame: feet on y=0, ~1 unit tall, facing +Z. The controller places +
 * rotates the parent group; this just draws the suit and swings the limbs while walking.
 *
 * `speedRef` carries the avatar's current horizontal speed (no re-render) so the legs/arms
 * swing proportionally; idle = still. Reduced motion holds the pose. `accent` tints the suit
 * stripe + visor glow so it picks up the world's colour.
 */
export function SurfaceAvatar({
  speedRef,
  accent,
  reducedMotion,
}: {
  speedRef: MutableRefObject<number>;
  accent: string;
  reducedMotion: boolean;
}) {
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const phase = useRef(0);

  useFrame((_, dt) => {
    if (reducedMotion) return;
    const sp = speedRef.current;
    phase.current += dt * (3 + sp * 2.4);
    const swing = Math.min(1, sp / 3) * 0.7; // amplitude scales with speed, capped
    const a = Math.sin(phase.current) * swing;
    if (legL.current) legL.current.rotation.x = a;
    if (legR.current) legR.current.rotation.x = -a;
    if (armL.current) armL.current.rotation.x = -a * 0.7;
    if (armR.current) armR.current.rotation.x = a * 0.7;
  });

  const SUIT = "#eef1f7";
  const PANEL = "#b8c2d6";
  const METAL = "#6f7d9e";

  return (
    <group>
      {/* Legs (swing from the hip). */}
      <group ref={legL} position={[-0.12, 0.46, 0]}>
        <mesh position={[0, -0.23, 0]}>
          <cylinderGeometry args={[0.085, 0.075, 0.46, 6]} />
          <meshStandardMaterial color={SUIT} roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0, -0.47, 0.03]}>
          <boxGeometry args={[0.14, 0.08, 0.2]} />
          <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.3} flatShading />
        </mesh>
      </group>
      <group ref={legR} position={[0.12, 0.46, 0]}>
        <mesh position={[0, -0.23, 0]}>
          <cylinderGeometry args={[0.085, 0.075, 0.46, 6]} />
          <meshStandardMaterial color={SUIT} roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0, -0.47, 0.03]}>
          <boxGeometry args={[0.14, 0.08, 0.2]} />
          <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.3} flatShading />
        </mesh>
      </group>

      {/* Torso (puffy suit) + chest panel + accent stripe. */}
      <mesh position={[0, 0.66, 0]}>
        <boxGeometry args={[0.34, 0.42, 0.26]} />
        <meshStandardMaterial color={SUIT} roughness={0.75} flatShading />
      </mesh>
      <mesh position={[0, 0.66, 0.14]}>
        <boxGeometry args={[0.2, 0.18, 0.04]} />
        <meshStandardMaterial color={PANEL} roughness={0.5} metalness={0.2} flatShading />
      </mesh>
      <mesh position={[0, 0.55, 0.135]}>
        <boxGeometry args={[0.22, 0.03, 0.03]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
      </mesh>

      {/* Life-support backpack. */}
      <mesh position={[0, 0.68, -0.18]}>
        <boxGeometry args={[0.28, 0.34, 0.16]} />
        <meshStandardMaterial color={PANEL} roughness={0.6} metalness={0.2} flatShading />
      </mesh>

      {/* Arms (swing from the shoulder). */}
      <group ref={armL} position={[-0.24, 0.82, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.4, 6]} />
          <meshStandardMaterial color={SUIT} roughness={0.75} flatShading />
        </mesh>
      </group>
      <group ref={armR} position={[0.24, 0.82, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.4, 6]} />
          <meshStandardMaterial color={SUIT} roughness={0.75} flatShading />
        </mesh>
      </group>

      {/* Neck ring + helmet + visor. */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.08, 8]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshStandardMaterial color={SUIT} roughness={0.5} metalness={0.1} flatShading />
      </mesh>
      {/* Visor — a dark reflective curved face on the front of the helmet. */}
      <mesh position={[0, 1.04, 0.1]} rotation={[0.1, 0, 0]}>
        <sphereGeometry args={[0.135, 12, 12, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.32, Math.PI * 0.42]} />
        <meshStandardMaterial color="#101a2e" roughness={0.15} metalness={0.6} emissive={accent} emissiveIntensity={0.18} flatShading />
      </mesh>
      {/* Helmet lamp. */}
      <mesh position={[0, 1.18, 0.12]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#fff6df" />
      </mesh>
    </group>
  );
}
