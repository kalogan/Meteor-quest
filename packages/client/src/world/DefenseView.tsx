import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { PALETTE, defenseIntensity } from "./palette";

/**
 * Defense visualization — a protective shield around a settled body or system whose
 * brightness + presence scale with its built `defense` strength (buildDefense in the
 * sim). Purely cosmetic: it READS sim state, never writes it. A body with zero
 * defense shows nothing, so the map reads where the player has actually invested.
 *
 * Two layers: a slowly-breathing translucent shell (the field) and a crisp equator
 * ring (the strength readout). Both fade in with intensity so a single point of
 * defense is a faint sheen and a stack of defense is a bright, obvious bulwark.
 */
export function DefenseShield({
  defense,
  radius,
}: {
  /** Raw defense value from the sim (Planet.defense / StarSystem.defense). */
  defense: number | undefined;
  /** Body radius in scene units; the shield sits just outside it. */
  radius: number;
}) {
  const shell = useRef<Mesh>(null);
  const intensity = defenseIntensity(defense);

  useFrame(({ clock }) => {
    if (!shell.current) return;
    // A slow breath so a strong shield feels "live" without distracting motion.
    const breath = 1 + Math.sin(clock.elapsedTime * 1.1) * 0.02 * intensity;
    shell.current.scale.setScalar(breath);
  });

  if (intensity <= 0.001) return null;

  const shellR = radius * 1.28;
  return (
    <group>
      {/* The shield field — a soft translucent shell that thickens with strength. */}
      <mesh ref={shell}>
        <sphereGeometry args={[shellR, 24, 24]} />
        <meshBasicMaterial
          color={PALETTE.defense}
          transparent
          opacity={0.06 + intensity * 0.22}
          depthWrite={false}
        />
      </mesh>
      {/* A crisp equatorial strength ring — the at-a-glance "how defended" readout. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[shellR * 1.0, shellR * 1.12, 48]} />
        <meshBasicMaterial
          color={PALETTE.defense}
          transparent
          opacity={0.25 + intensity * 0.6}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
