import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import type { Group, Mesh, PerspectiveCamera } from "three";
import type { GameState, Planet } from "@meteor/shared";
import { PALETTE } from "./palette";
import { planetRadius } from "./layout";
import { PlanetView } from "./PlanetView";

/**
 * [intro] The 3D half of the cinematic onboarding. A purely COSMETIC scene mounted in
 * its own full-screen <Canvas> (no HUD): a starfield, the REAL cradle planet rendered
 * by the shipped PlanetView, and a small low-poly ship that emerges from the dark and
 * flies toward the cradle while a scripted camera eases from a distant/dark pose into a
 * close framing of the world.
 *
 * It reads sim state (the cradle planet) but NEVER advances the sim or mutates game
 * state — the loop is frozen during phase 'intro', so this is just a movie. Honors
 * reduced-motion by snapping straight to the final close framing (no fly-in).
 *
 * The starting cradle is always scanned in a fresh game, so PlanetView shows its full
 * biome-tinted, continents-and-cities treatment here.
 */

/** Total length of the scripted camera move, in seconds. */
const FLIGHT_SECONDS = 6.5;

/** Reused scratch so per-frame orientation work allocates nothing. */
const FORWARD = new Vector3(0, 0, 1);
const _dir = new Vector3();
const _quat = new Quaternion();
const _eye = new Vector3();
const _shipPos = new Vector3();

/** Smoothstep ease so the camera glides in and settles (no linear snap). */
function easeInOut(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * The low-poly craft — mirrors the JourneyView ship silhouette (nose cone, fuselage,
 * engine bell + glow) so the intro ship reads as the same vessel that flies in-game.
 * The nose points down +Z; the parent group orients it along travel.
 */
function IntroShip({ glowColor }: { glowColor: string }) {
  const glow = useRef<Mesh>(null);
  const hull = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (glow.current) glow.current.scale.setScalar(0.85 + Math.sin(t * 12) * 0.15);
    if (hull.current) hull.current.rotation.z = Math.sin(t * 1.4) * 0.16;
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

/**
 * Drives the scripted camera + ship motion every frame. The cradle sits at the origin;
 * the ship arcs from deep behind/below the camera toward a point just off the planet,
 * while the camera eases from a far, low, dark pose into a close 3/4 framing of the
 * world. With reduced motion it holds at the final framing from frame one.
 */
function IntroDirector({ radius, reducedMotion }: { radius: number; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const ship = useRef<Group>(null);
  const elapsed = useRef(0);

  // Far/dark start and close/settled end for the camera eye (cradle at origin).
  const start = useMemo(() => new Vector3(radius * 9, radius * 1.2, radius * 13), [radius]);
  const end = useMemo(() => new Vector3(radius * 2.1, radius * 1.5, radius * 3.4), [radius]);

  // The ship flies from far behind toward a hold point just off the planet.
  const shipFrom = useMemo(() => new Vector3(-radius * 7, -radius * 2.4, radius * 12), [radius]);
  const shipTo = useMemo(() => new Vector3(radius * 1.25, radius * 0.35, radius * 1.9), [radius]);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const raw = reducedMotion ? 1 : Math.min(1, elapsed.current / FLIGHT_SECONDS);
    const e = easeInOut(raw);

    // Camera eye eases start → end, always looking at the cradle.
    _eye.copy(start).lerp(end, e);
    camera.position.copy(_eye);
    camera.lookAt(0, 0, 0);

    // Ship arcs in; the front 70% of the move covers travel so it "arrives" and holds.
    if (ship.current) {
      const sp = reducedMotion ? 1 : easeInOut(Math.min(1, raw / 0.7));
      _shipPos.copy(shipFrom).lerp(shipTo, sp);
      ship.current.position.copy(_shipPos);

      // Point the nose along travel direction (toward the hold point).
      _dir.copy(shipTo).sub(shipFrom);
      if (_dir.lengthSq() > 1e-6) {
        _dir.normalize();
        _quat.setFromUnitVectors(FORWARD, _dir);
        ship.current.quaternion.copy(_quat);
      }
    }
  });

  return (
    <group ref={ship}>
      <IntroShip glowColor={PALETTE.glow} />
    </group>
  );
}

export function IntroScene({
  game,
  planet,
  reducedMotion,
}: {
  game: GameState;
  planet: Planet;
  reducedMotion: boolean;
}) {
  const isCradle = planet.id === game.cradlePlanetId;
  const radius = planetRadius(planet, isCradle);

  return (
    <>
      <color attach="background" args={[PALETTE.space]} />
      <Stars radius={200} depth={80} count={2500} factor={3} saturation={0} fade speed={0.4} />

      <ambientLight intensity={0.35} />
      <hemisphereLight color="#9fb4ff" groundColor="#0a0c14" intensity={0.3} />
      {/* A keylight off to one side so the cradle catches a rim as the camera nears. */}
      <pointLight position={[radius * 6, radius * 5, radius * 7]} intensity={60} distance={radius * 60} decay={1.6} color="#ffe9b0" />

      {/* The REAL cradle planet, at the origin — full scanned biome treatment. */}
      <PlanetView planet={planet} game={game} isCradle={isCradle} position={[0, 0, 0]} />

      <IntroDirector radius={radius} reducedMotion={reducedMotion} />
    </>
  );
}
