import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import type { Group, Mesh } from "three";
import type { GameState, Journey } from "@meteor/shared";
import { useSim } from "../sim/store";
import { PALETTE } from "./palette";
import {
  journeyHeading,
  journeyPosition,
  systemPosition,
} from "./layout";

/**
 * [journey] The VISIBLE expedition. For each in-flight (`enroute`) journey we render
 * a stylized low-poly craft at `journey.pos`, nose pointed along `journey.heading`,
 * with a pulsing engine glow and a fading trail drawn from its origin system to its
 * current position. Purely cosmetic: we READ `game.journeys`, never write — the sim
 * owns the motion (autopilot + steering commands), this just draws where it says.
 *
 * Nothing here mounts when there are no enroute journeys, so the galaxy stays clean
 * until an expedition launches.
 */

/** Reused scratch so per-frame orientation work allocates nothing. */
const FORWARD = new Vector3(0, 0, 1);
const _dir = new Vector3();
const _quat = new Quaternion();

/** The low-poly craft + engine + trail for one expedition. */
function ExpeditionShip({ game, journey }: { game: GameState; journey: Journey }) {
  const hull = useRef<Group>(null);
  const glow = useRef<Mesh>(null);

  // Current world position + origin anchor (for the trail) in the shared galaxy frame.
  const pos = journeyPosition(journey);
  const origin = useMemo(() => {
    const sys = game.systems[journey.originSystemId];
    return sys ? systemPosition(sys) : pos;
    // pos drifts every tick; pin the origin to the (static) system id.
  }, [journey.originSystemId, game.systems]);

  // Heading as a stable orientation: rotate the craft's +Z nose onto the heading.
  const heading = journeyHeading(journey);
  const orient = useMemo(() => {
    _dir.set(heading[0], heading[1], heading[2]);
    return _quat.setFromUnitVectors(FORWARD, _dir).clone();
  }, [heading[0], heading[1], heading[2]]);

  // The fading trail: a streak from the origin system to the ship's current pos.
  const trailPts = useMemo(
    () => new Float32Array([...origin, ...pos]),
    [origin[0], origin[1], origin[2], pos[0], pos[1], pos[2]],
  );

  // Low fuel reads as a dimmer, redder engine — light tension you can SEE.
  const lowFuel = journey.fuel <= 0;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (glow.current) {
      // Engine flicker: a quick throb so the craft reads as "under thrust".
      const flick = lowFuel ? 0.4 : 0.85 + Math.sin(t * 12) * 0.15;
      glow.current.scale.setScalar(flick);
    }
    if (hull.current) {
      // A gentle roll so the silhouette stays alive without fully spinning.
      hull.current.rotation.z = Math.sin(t * 1.4) * 0.18;
    }
  });

  const engineColor = lowFuel ? PALETTE.threat : PALETTE.glow;

  return (
    <group>
      {/* Fading trail from where it set out to where it is now. */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPts, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={PALETTE.glow}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </line>

      {/* The craft, positioned at the ship and oriented along its heading. */}
      <group position={pos} quaternion={orient}>
        <group ref={hull}>
          {/* Nose cone (low-poly): points down +Z, the heading. */}
          <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.28, 0.8, 6]} />
            <meshStandardMaterial
              color="#c9d4e8"
              metalness={0.5}
              roughness={0.4}
              flatShading
            />
          </mesh>
          {/* Body — a stubby low-poly fuselage. */}
          <mesh position={[0, 0, -0.1]}>
            <icosahedronGeometry args={[0.34, 0]} />
            <meshStandardMaterial
              color="#8a97b4"
              metalness={0.4}
              roughness={0.5}
              flatShading
            />
          </mesh>
          {/* Engine bell at the tail. */}
          <mesh position={[0, 0, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.22, 0.3, 6]} />
            <meshStandardMaterial color="#566079" metalness={0.6} roughness={0.4} flatShading />
          </mesh>

          {/* Engine glow — additive plume just behind the bell. */}
          <mesh ref={glow} position={[0, 0, -0.78]}>
            <sphereGeometry args={[0.26, 10, 10]} />
            <meshBasicMaterial color={engineColor} transparent opacity={0.7} depthWrite={false} />
          </mesh>
          <pointLight
            position={[0, 0, -0.8]}
            color={engineColor}
            intensity={lowFuel ? 0.6 : 2.2}
            distance={6}
          />
        </group>
      </group>
    </group>
  );
}

/** All in-flight expeditions. Renders nothing when there are no enroute journeys. */
export function JourneyView({ game }: { game: GameState }) {
  const enroute = useMemo(
    () => Object.values(game.journeys).filter((j) => j.status === "enroute"),
    [game.journeys],
  );
  if (enroute.length === 0) return null;
  return (
    <group name="journeys">
      {enroute.map((j) => (
        <ExpeditionShip key={j.id} game={game} journey={j} />
      ))}
    </group>
  );
}

/** The first enroute journey, if any — the one the camera follows / steering binds to. */
export function activeJourney(game: GameState): Journey | null {
  for (const j of Object.values(game.journeys)) {
    if (j.status === "enroute") return j;
  }
  return null;
}

/**
 * [journey] LIGHT STEERING input. While an expedition is enroute, Arrow Left/Right
 * (and A/D) dispatch `steerJourney(journeyId, ∓1)` — Left/A nudges the heading one
 * way, Right/D the other. We deliberately use KEYS, not pointer-drag: drag belongs to
 * the orbit camera (CameraControls), so the player can still freely orbit/zoom while
 * nudging the flight. Held keys repeat each frame the OS fires keydown; releasing the
 * key sends a single neutral `turn: 0` so the autopilot resumes its self-correcting
 * course (no sticky turn).
 *
 * Renders nothing and binds nothing when there is no enroute journey, so it never
 * swallows keys outside a flight. Steering arrives as commands in the deterministic
 * tick stream; we never mutate state.
 */
export function JourneySteering({ game }: { game: GameState }) {
  const dispatch = useSim((s) => s.dispatch);
  const journey = activeJourney(game);
  const journeyId = journey?.id ?? null;

  // Latest turn pushed this key-session, so we only re-send on a CHANGE (held keys
  // fire keydown repeatedly; we ignore the OS auto-repeat to avoid command spam).
  const lastTurn = useRef(0);

  useEffect(() => {
    if (!journeyId) return;
    lastTurn.current = 0;

    const turnFor = (key: string): number | null => {
      if (key === "ArrowLeft" || key === "a" || key === "A") return -1;
      if (key === "ArrowRight" || key === "d" || key === "D") return 1;
      return null;
    };

    const onDown = (e: KeyboardEvent) => {
      const turn = turnFor(e.key);
      if (turn === null) return;
      e.preventDefault();
      if (turn === lastTurn.current) return; // ignore OS auto-repeat
      lastTurn.current = turn;
      dispatch({ type: "steerJourney", journeyId, turn });
    };

    const onUp = (e: KeyboardEvent) => {
      const turn = turnFor(e.key);
      if (turn === null) return;
      // Only release if THIS direction was the one held (a still-held other key keeps steering).
      if (turn !== lastTurn.current) return;
      lastTurn.current = 0;
      dispatch({ type: "steerJourney", journeyId, turn: 0 });
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [journeyId, dispatch]);

  return null;
}
