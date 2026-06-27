import { useMemo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { GameState, StarSystem } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import { PALETTE } from "./palette";
import { PlanetView } from "./PlanetView";
import { planetOffset, systemPosition } from "./layout";

/**
 * One star system in galaxy space: a glowing star with its planets laid out on
 * their deterministic orbits (planet.orbit). The system is only RENDERED when it
 * is discovered — fog is enforced at the galaxy layer (see GalaxyView), so by the
 * time we mount a SystemView the sim says it's revealed.
 */

function OrbitRing({ radius }: { radius: number }) {
  const points = useMemo(() => {
    const segs = 64;
    const arr: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      arr.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
    return new Float32Array(arr);
  }, [radius]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={PALETTE.orbitLine} transparent opacity={0.45} />
    </line>
  );
}

function Star({ isHome }: { isHome: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.04;
      ref.current.scale.setScalar(s);
    }
  });
  const color = isHome ? PALETTE.starHome : PALETTE.star;
  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[1.1, 2]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight color={color} intensity={isHome ? 60 : 36} distance={60} decay={1.6} />
    </group>
  );
}

export function SystemView({
  system,
  game,
}: {
  system: StarSystem;
  game: GameState;
}) {
  const select = useSelection((s) => s.select);
  const pos = systemPosition(system);
  const isHome = system.id === game.homeSystemId;

  const planets = useMemo(
    () =>
      system.planetIds
        .map((id) => game.planets[id])
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [system.planetIds, game.planets],
  );

  return (
    <group position={pos} name={`system:${system.id}`}>
      {/* The star doubles as the system's pick target. */}
      <group
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          select(system.id, "system");
        }}
      >
        <Star isHome={isHome} />
      </group>

      {planets.map((planet) => {
        const offset = planetOffset(planet);
        return (
          <group key={planet.id}>
            <OrbitRing radius={planet.orbit.radius} />
            <PlanetView
              planet={planet}
              game={game}
              isCradle={planet.id === game.cradlePlanetId}
              position={offset}
            />
          </group>
        );
      })}
    </group>
  );
}
