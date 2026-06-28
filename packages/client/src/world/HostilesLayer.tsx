import { useMemo } from "react";
import { DoubleSide } from "three";
import type { RoamingHostile } from "@meteor/shared";
import { useSim } from "../sim/store";
import { GALAXY_SCALE } from "./layout";
import { BeastMesh } from "./hostiles/BeastMesh";
import { PirateMesh } from "./hostiles/PirateMesh";

/**
 * [hostiles] Galaxy-space markers for roaming space beasts & pirates. Each discovered hostile
 * renders its kind's silhouette at its galaxy position (same GALAXY_SCALE frame as systems +
 * journeys), sized by threat, with a threat ring that brightens when it has pinned an expedition.
 * Cosmetic — reads sim state, never mutates it.
 */

const TINT: Record<RoamingHostile["kind"], string> = { beast: "#ff5db1", pirate: "#ff8a3d" };

function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined") {
    const flag = document.documentElement.dataset.reducedMotion;
    if (flag === "on") return true;
    if (flag === "off") return false;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

function HostileMarker({ hostile, reducedMotion }: { hostile: RoamingHostile; reducedMotion: boolean }) {
  const pos: [number, number, number] = [
    hostile.pos.x * GALAXY_SCALE,
    hostile.pos.y * GALAXY_SCALE,
    hostile.pos.z * GALAXY_SCALE,
  ];
  const tint = TINT[hostile.kind];
  const scale = 2.2 + Math.min(2.4, hostile.threat * 0.4); // nastier = bigger
  const engaged = hostile.engagedJourneyId !== undefined;

  return (
    <group position={pos} name={`hostile:${hostile.id}`}>
      <group scale={scale}>
        {hostile.kind === "beast" ? (
          <BeastMesh tint={tint} reducedMotion={reducedMotion} />
        ) : (
          <PirateMesh tint={tint} reducedMotion={reducedMotion} />
        )}
      </group>
      {/* Threat ring — brighter when it has pinned an expedition. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 1.5, scale * 1.7, 40]} />
        <meshBasicMaterial color={tint} transparent opacity={engaged ? 0.85 : 0.4} side={DoubleSide} />
      </mesh>
    </group>
  );
}

export function HostilesLayer() {
  const hostiles = useSim((s) => s.game.hostiles);
  const reducedMotion = prefersReducedMotion();
  const list = useMemo(() => Object.values(hostiles).filter((h) => h.discovered), [hostiles]);

  return (
    <group name="hostiles">
      {list.map((h) => (
        <HostileMarker key={h.id} hostile={h} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}
