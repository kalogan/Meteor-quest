import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import type { Group } from "three";
import { PALETTE } from "./palette";
import { Ship } from "./Ship";
import { MiningProbe } from "./MiningProbe";

/**
 * [home fleet] A persistent, purely COSMETIC fleet that orbits the CRADLE planet in the
 * in-game God-view: the player's ship on a slow circular orbit plus the deployed mining
 * probe harvesting the surface. It exists so the hand-off from the cinematic intro is
 * seamless — the intro ends with the ship in orbit deploying a probe, and the player
 * should see that same picture when the game begins ("just like the tutorial").
 *
 * It mounts inside SystemView's cradle planet <group> (local origin = planet centre) and
 * mirrors IntroScene's orbit geometry so the two read as the same vessel/probe. Sizes are
 * RELATIVE to the planet radius `r`, so it reads at the God-view scale.
 *
 * Cosmetic only: it reads NO sim state (just the planet radius passed in) and mutates
 * nothing. All per-frame math runs over module-level scratch vectors (no allocation). With
 * `reducedMotion` the ship and probe HOLD at a fixed orbital angle — no drift — and the
 * probe's beam is present but not pulsing, consistent with the intro's reduced-motion.
 */

/** Angular speed of the orbital drift, radians/second — matches the intro's gentle pace. */
const ORBIT_SPEED = 0.32;
/** Fixed orbital angle to hold the fleet at when motion is reduced (reads as "in orbit"). */
const STATIC_ANGLE = 0.6;
/** The ship's local nose axis (+Z); we orient it along the orbital tangent. */
const FORWARD = new Vector3(0, 0, 1);
/** The probe's local "down the beam" axis (-Y); we aim it at the planet centre. */
const DOWN = new Vector3(0, -1, 0);

/** Module-level scratch so the per-frame math allocates nothing. */
const _dir = new Vector3();
const _quat = new Quaternion();
const _shipPos = new Vector3();
const _probePos = new Vector3();

export function OrbitingFleet({
  radius,
  reducedMotion,
}: {
  /** The cradle planet's display radius — everything is sized relative to this. */
  radius: number;
  reducedMotion: boolean;
}) {
  const ship = useRef<Group>(null);
  const probeRig = useRef<Group>(null);
  // Continuous orbital angle (held fixed under reduced motion).
  const angle = useRef(reducedMotion ? STATIC_ANGLE : 0);

  // Orbit geometry mirrors IntroScene: a circle in a plane tilted slightly off the
  // equator, sized relative to the planet radius so it clears the surface and shield.
  const orbitRadius = radius * 1.55;
  const orbitHeight = radius * 0.45;

  // The probe rides the same circle, trailing the ship slightly, so it reads as deployed
  // from it. Its beam reaches from the probe down to the surface.
  const probeDist = Math.hypot(orbitRadius, orbitHeight);
  const beamLen = Math.max(probeDist - radius, radius * 0.6);

  useFrame((_, delta) => {
    if (!reducedMotion) angle.current += delta * ORBIT_SPEED;
    const a = angle.current;

    if (ship.current) {
      _shipPos.set(Math.cos(a) * orbitRadius, orbitHeight, Math.sin(a) * orbitRadius);
      ship.current.position.copy(_shipPos);
      // Nose along the orbital tangent (direction of travel).
      _dir.set(-Math.sin(a) * orbitRadius, 0, Math.cos(a) * orbitRadius);
      if (_dir.lengthSq() > 1e-6) {
        _dir.normalize();
        _quat.setFromUnitVectors(FORWARD, _dir);
        ship.current.quaternion.copy(_quat);
      }
    }

    if (probeRig.current) {
      const pa = a - 0.28; // trail the ship slightly
      _probePos.set(Math.cos(pa) * orbitRadius, orbitHeight, Math.sin(pa) * orbitRadius);
      probeRig.current.position.copy(_probePos);
      // Aim the probe's local -Y (beam axis) at the planet centre (local origin).
      _dir.copy(_probePos).multiplyScalar(-1);
      if (_dir.lengthSq() > 1e-6) {
        _dir.normalize();
        _quat.setFromUnitVectors(DOWN, _dir);
        probeRig.current.quaternion.copy(_quat);
      }
    }
  });

  return (
    <>
      <group ref={ship}>
        <Ship glowColor={PALETTE.glow} reducedMotion={reducedMotion} />
      </group>
      <group ref={probeRig}>
        <MiningProbe glowColor={PALETTE.glow} beamLen={beamLen} reducedMotion={reducedMotion} />
      </group>
    </>
  );
}
