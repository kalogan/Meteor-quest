import { useMemo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { GameState, StarSystem } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import { PALETTE } from "./palette";
import { PlanetView } from "./PlanetView";
import { DefenseShield } from "./DefenseView";
import { SystemThreats } from "./ThreatView";
import { OrbitingFleet } from "./OrbitingFleet";
import { planetOffset, planetRadius, systemPosition } from "./layout";

/**
 * Whether to reduce motion right now — mirrors the intro's resolution order: an explicit
 * settings override (data attribute) wins, else the OS preference. Returns a stable
 * boolean computed in render (no store selector), so it never feeds a fresh object into
 * a subscriber.
 */
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
  const selectedId = useSelection((s) => s.selectedId);
  const pos = systemPosition(system);
  const isHome = system.id === game.homeSystemId;
  // Resolved once per render; the home fleet holds still when motion is reduced.
  const reducedMotion = prefersReducedMotion();

  const planets = useMemo(
    () =>
      system.planetIds
        .map((id) => game.planets[id])
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [system.planetIds, game.planets],
  );

  // Is this system the one the player has dived into to inspect? When it's also
  // under threat we light up the tactical overlay (threats + defenses, head to head).
  const isFocused = selectedId === system.id;
  const isThreatened = useMemo(
    () =>
      game.events.some((e) => {
        if (e.mitigated) return false;
        if (e.targetId === system.id) return true;
        const p = game.planets[e.targetId];
        return p ? p.systemId === system.id : false;
      }),
    [game.events, game.planets, system.id],
  );
  const tactical = isFocused && isThreatened;

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

      {/* System-level built defense — a shield wrapping the whole star. */}
      <DefenseShield defense={system.defense} radius={1.6} />

      {planets.map((planet) => {
        const offset = planetOffset(planet);
        const isCradle = planet.id === game.cradlePlanetId;
        const r = planetRadius(planet, isCradle);
        return (
          <group key={planet.id}>
            <OrbitRing radius={planet.orbit.radius} />
            <group position={offset}>
              <PlanetView
                planet={planet}
                game={game}
                isCradle={isCradle}
                position={[0, 0, 0]}
                reducedMotion={reducedMotion}
              />
              {/* Per-planet built defense — a shield ring around settled worlds. */}
              <DefenseShield defense={planet.defense} radius={r} />
              {/* The home fleet — your ship + deployed mining probe orbiting the cradle,
                  carried over from the tutorial. Cosmetic; cradle only. */}
              {isCradle && <OrbitingFleet radius={r} reducedMotion={reducedMotion} />}
            </group>
          </group>
        );
      })}

      {/* Threats targeting this system. In the tactical dive they're the headline;
          at galaxy zoom the ThreatLayer in GalaxyView carries the long-range read. */}
      {tactical && (
        <>
          <SystemThreats game={game} systemId={system.id} />
          {/* A tactical-overview ring framing the contested system as one theater. */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[18, 18.6, 64]} />
            <meshBasicMaterial color={PALETTE.threat} transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  );
}
