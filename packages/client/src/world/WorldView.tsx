import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { getContentPack } from "@meteor/shared";
import type { Planet } from "@meteor/shared";
import { useSim } from "../sim/store";

/**
 * PLACEHOLDER God-view (builder #5 replaces with the continuous-zoom camera rig,
 * stylized low-poly planets, fog visualization, and the galaxy/system/planet
 * layers). It already mounts REAL sim state so the preview harness can reuse it.
 */
const pack = getContentPack();

function biomeColor(p: Planet): string {
  if (!p.scanned) return "#3a3f4b"; // fog: unknown until scanned
  return pack.biomes.find((b) => b.id === p.biome)?.color ?? "#888888";
}

function PlanetMesh({ planet, x }: { planet: Planet; x: number }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.3;
  });
  return (
    <group ref={ref} position={[x, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[planet.settled ? 1.8 : 1.3, 1]} />
        <meshStandardMaterial flatShading color={biomeColor(planet)} />
      </mesh>
    </group>
  );
}

export function WorldView() {
  const planets = useSim((s) => s.game.planets);
  const list = Object.values(planets);
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 12, 6]} intensity={1.2} />
      {list.map((p, i) => (
        <PlanetMesh key={p.id} planet={p} x={(i - (list.length - 1) / 2) * 5} />
      ))}
    </>
  );
}
