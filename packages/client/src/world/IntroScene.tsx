import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import type { Group, PerspectiveCamera } from "three";
import type { GameState, Planet } from "@meteor/shared";
import { PALETTE } from "./palette";
import { planetRadius } from "./layout";
import { PlanetView } from "./PlanetView";
import { MiningProbe } from "./MiningProbe";
import { Ship } from "./Ship";

/**
 * The cinematic runs in three scripted STAGES, derived from the active onboarding step
 * (IntroCinematic maps step → stage):
 *   - "flyin"  — steps 1–4: the ship arcs from the dark and holds just off the planet.
 *   - "orbit"  — step 5: the ship settles into a slow circular ORBIT around the cradle
 *     and the camera frames the planet + orbiting ship.
 *   - "mining" — step 6: a mining probe deploys near the ship and harvests the surface
 *     (antenna, beam, rising resource chunks).
 * Stages advance by easing a 0→1 transition value, never snapping.
 */
export type IntroStage = "flyin" | "orbit" | "mining";

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

/** Seconds to ease from the fly-in hold into the orbit pose (camera + ship). */
const ORBIT_EASE_SECONDS = 2.2;
/** Angular speed of the orbit drift, radians/second (gentle). */
const ORBIT_SPEED = 0.32;

/** Reused scratch so per-frame orientation work allocates nothing. */
const FORWARD = new Vector3(0, 0, 1);
/** The probe's local "down the beam" axis; we aim it at the planet centre. */
const DOWN = new Vector3(0, -1, 0);
const _dir = new Vector3();
const _quat = new Quaternion();
const _eye = new Vector3();
const _shipPos = new Vector3();
const _orbitPos = new Vector3();
const _camOrbit = new Vector3();

/** Smoothstep ease so the camera glides in and settles (no linear snap). */
function easeInOut(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * Drives the scripted camera + ship motion every frame. The cradle sits at the origin;
 * the ship arcs from deep behind/below the camera toward a point just off the planet,
 * while the camera eases from a far, low, dark pose into a close 3/4 framing of the
 * world. With reduced motion it holds at the final framing from frame one.
 */
function IntroDirector({
  radius,
  reducedMotion,
  stage,
}: {
  radius: number;
  reducedMotion: boolean;
  stage: IntroStage;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const ship = useRef<Group>(null);
  const probeRig = useRef<Group>(null);
  const elapsed = useRef(0);
  // 0 = full fly-in framing, 1 = full orbit framing; eased across the stage change so
  // the move never snaps. Persists across frames; the probe deploys once it's settled.
  const orbitBlend = useRef(reducedMotion ? 1 : 0);
  // Independent clock for the orbital drift so the angle is continuous once in orbit.
  const orbitAngle = useRef(0);

  const orbiting = stage === "orbit" || stage === "mining";

  // Far/dark start and close/settled end for the camera eye (cradle at origin).
  const start = useMemo(() => new Vector3(radius * 9, radius * 1.2, radius * 13), [radius]);
  const end = useMemo(() => new Vector3(radius * 2.1, radius * 1.5, radius * 3.4), [radius]);

  // The ship flies from far behind toward a hold point just off the planet.
  const shipFrom = useMemo(() => new Vector3(-radius * 7, -radius * 2.4, radius * 12), [radius]);
  const shipTo = useMemo(() => new Vector3(radius * 1.25, radius * 0.35, radius * 1.9), [radius]);

  // Orbit geometry: a circle in a plane tilted slightly off the equator, at this radius.
  const orbitRadius = radius * 1.55;
  const orbitHeight = radius * 0.45;
  // A pulled-back camera that frames the whole planet + the orbiting ship.
  const orbitCam = useMemo(() => new Vector3(radius * 0.6, radius * 2.2, radius * 4.6), [radius]);

  // The ship's position on the orbit circle for a given angle (reused scratch out).
  const orbitPointAt = (angle: number, out: Vector3) =>
    out.set(Math.cos(angle) * orbitRadius, orbitHeight, Math.sin(angle) * orbitRadius);

  useFrame((_, delta) => {
    elapsed.current += delta;

    // Ease the fly-in → orbit blend toward its target (1 when orbiting, else hold at 0).
    if (orbiting && !reducedMotion) {
      orbitBlend.current = Math.min(1, orbitBlend.current + delta / ORBIT_EASE_SECONDS);
    } else if (reducedMotion) {
      orbitBlend.current = orbiting ? 1 : 0;
    }
    const ob = easeInOut(orbitBlend.current);

    // Advance the orbital angle only once we're meaningfully in orbit (and not reduced).
    if (orbiting && !reducedMotion) orbitAngle.current += delta * ORBIT_SPEED;
    const angle = reducedMotion ? 0.6 : orbitAngle.current;

    // --- Fly-in pose (stage flyin, and the "from" end of the orbit blend) ---
    const raw = reducedMotion ? 1 : Math.min(1, elapsed.current / FLIGHT_SECONDS);
    const e = easeInOut(raw);
    _eye.copy(start).lerp(end, e); // fly-in camera eye

    // --- Orbit pose (the "to" end of the blend) ---
    _camOrbit.copy(orbitCam);

    // Camera eases between the two poses, always looking at the cradle.
    camera.position.copy(_eye).lerp(_camOrbit, ob);
    camera.lookAt(0, 0, 0);

    if (ship.current) {
      // Fly-in target position for the ship (arcs in over the first 70%).
      const sp = reducedMotion ? 1 : easeInOut(Math.min(1, raw / 0.7));
      _shipPos.copy(shipFrom).lerp(shipTo, sp);

      // Orbit target position on the circle.
      orbitPointAt(angle, _orbitPos);

      // Blend between the held fly-in point and the live orbit point.
      _shipPos.lerp(_orbitPos, ob);
      ship.current.position.copy(_shipPos);

      // Nose orientation: along fly-in travel, easing toward the orbital tangent.
      if (ob < 0.5) {
        _dir.copy(shipTo).sub(shipFrom);
      } else {
        // Tangent to the orbit circle (direction of travel).
        _dir.set(-Math.sin(angle) * orbitRadius, 0, Math.cos(angle) * orbitRadius);
      }
      if (_dir.lengthSq() > 1e-6) {
        _dir.normalize();
        _quat.setFromUnitVectors(FORWARD, _dir);
        ship.current.quaternion.copy(_quat);
      }
    }

    // The probe rig sits at a fixed offset from the orbiting ship, trailing it slightly,
    // so it reads as deployed FROM the ship. It only matters in the mining stage. We aim
    // its local -Y (the beam axis) at the planet centre so the beam strikes the surface.
    if (probeRig.current) {
      orbitPointAt(angle - 0.28, _orbitPos);
      probeRig.current.position.copy(_orbitPos);
      _dir.copy(_orbitPos).multiplyScalar(-1).normalize(); // toward origin
      if (_dir.lengthSq() > 1e-6) {
        _quat.setFromUnitVectors(DOWN, _dir);
        probeRig.current.quaternion.copy(_quat);
      }
    }
  });

  // Distance from the orbiting probe down to the planet surface (for the beam length):
  // the probe is at |orbitPos| from the centre; the surface is `radius` from the centre.
  const probeDist = Math.hypot(orbitRadius, orbitHeight);
  const probeBeamLen = probeDist - radius;

  return (
    <>
      <group ref={ship}>
        <Ship glowColor={PALETTE.glow} />
      </group>

      {/* The mining probe deploys only in the mining stage. It's parented to a rig that
          rides the orbit just behind the ship; the beam drops to the surface. */}
      {stage === "mining" && (
        <group ref={probeRig}>
          <MiningProbe
            glowColor={PALETTE.glow}
            beamLen={Math.max(probeBeamLen, radius * 0.6)}
            reducedMotion={reducedMotion}
          />
        </group>
      )}
    </>
  );
}

export function IntroScene({
  game,
  planet,
  reducedMotion,
  stage = "flyin",
}: {
  game: GameState;
  planet: Planet;
  reducedMotion: boolean;
  /** Which scripted beat to render; derived from the active onboarding step. */
  stage?: IntroStage;
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

      <IntroDirector radius={radius} reducedMotion={reducedMotion} stage={stage} />
    </>
  );
}
