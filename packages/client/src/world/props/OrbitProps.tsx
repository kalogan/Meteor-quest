/**
 * [tech props] Orbital tech-prop family. Each component is a low-poly ORBITAL structure
 * that rings a settled world once its tech is unlocked, built in the same faceted-metal
 * language as Ship.tsx (flat-shaded meshStandardMaterial for solids, meshBasicMaterial
 * for glows). Each is CENTERED on the origin within ~a unit sphere; the placement layer
 * scales/positions/rotates the wrapping group. One tint-emissive accent per prop gives
 * each host world a colour identity; everything else uses the shared metal constants.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { PropProps } from "./types";
import { METAL_LIGHT, METAL_MID, METAL_DARK, STRUT, WARM, COOLANT } from "./materials";

/**
 * Shipyard — an open orbital DRYDOCK: a rectangular lattice cage of thin struts cradling
 * a partially-built faceted hull, with tint-emissive work lights blinking along the frame.
 */
export function Shipyard({ tint, reducedMotion }: PropProps) {
  const lightA = useRef<Mesh>(null);
  const lightB = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lightA.current)
      lightA.current.scale.setScalar(reducedMotion ? 1 : 0.7 + Math.abs(Math.sin(t * 3)) * 0.6);
    if (lightB.current)
      lightB.current.scale.setScalar(reducedMotion ? 1 : 0.7 + Math.abs(Math.sin(t * 3 + 1.6)) * 0.6);
  });
  // rails (top/bottom) and uprights forming an open cage along X
  const rails: [number, number][] = [
    [0.55, 0.55],
    [0.55, -0.55],
    [-0.55, 0.55],
    [-0.55, -0.55],
  ];
  const uprights = [-0.85, -0.28, 0.28, 0.85];
  return (
    <group>
      {/* longitudinal rails */}
      {rails.map(([y, z], i) => (
        <mesh key={`rail-${i}`} position={[0, y, z]}>
          <boxGeometry args={[1.9, 0.07, 0.07]} />
          <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
        </mesh>
      ))}
      {/* uprights / ribs */}
      {uprights.map((x, i) => (
        <group key={`rib-${i}`} position={[x, 0, 0]}>
          <mesh position={[0, 0, 0.55]}>
            <boxGeometry args={[0.07, 1.1, 0.07]} />
            <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, 0, -0.55]}>
            <boxGeometry args={[0.07, 1.1, 0.07]} />
            <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[0.07, 0.07, 1.1]} />
            <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, -0.55, 0]}>
            <boxGeometry args={[0.07, 0.07, 1.1]} />
            <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
          </mesh>
        </group>
      ))}
      {/* partially-built hull cradled inside */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.22, 1.2, 8]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      <mesh position={[0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.22, 0.4, 8]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      {/* tint-emissive work lights blinking along the frame */}
      <mesh ref={lightA} position={[0.85, 0.55, 0.55]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color={tint} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={lightB} position={[-0.85, -0.55, 0.55]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color={tint} transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * CommandStation — a central faceted hub with 4 radial arms ending in pods, slowly yawing,
 * wrapped by a tint-emissive sensor ring.
 */
export function CommandStation({ tint, reducedMotion }: PropProps) {
  const rig = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (rig.current) rig.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime * 0.3;
  });
  const arms = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  return (
    <group ref={rig}>
      {/* central faceted hub */}
      <mesh>
        <icosahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      {/* radial arms + pods */}
      {arms.map((a, i) => (
        <group key={`arm-${i}`} rotation={[0, a, 0]}>
          <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.7, 6]} />
            <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0.95, 0, 0]}>
            <icosahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading />
          </mesh>
        </group>
      ))}
      {/* tint-emissive sensor ring around the hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.04, 6, 12]} />
        <meshBasicMaterial color={tint} transparent opacity={0.75} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * SenateRing — a grand habitation TORUS with a small central hub joined by 4 spokes and
 * tint-emissive window lights around the ring; the most impressive of the set.
 */
export function SenateRing({ tint, reducedMotion }: PropProps) {
  const rig = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (rig.current) rig.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime * 0.15;
  });
  const spokes = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const windows = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
  return (
    <group ref={rig} rotation={[Math.PI / 2, 0, 0]}>
      {/* grand faceted habitation ring */}
      <mesh>
        <torusGeometry args={[0.85, 0.16, 8, 12]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      {/* inner structural ring */}
      <mesh>
        <torusGeometry args={[0.85, 0.07, 6, 12]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {/* central hub */}
      <mesh>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      {/* spokes from hub to ring */}
      {spokes.map((a, i) => (
        <mesh key={`spoke-${i}`} position={[Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0]} rotation={[0, 0, a]}>
          <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
          <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
        </mesh>
      ))}
      {/* tint-emissive window lights around the ring */}
      {windows.map((a, i) => (
        <mesh key={`win-${i}`} position={[Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0]}>
          <boxGeometry args={[0.09, 0.09, 0.09]} />
          <meshBasicMaterial color={tint} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * WarpGate — a vertical faceted RING GATE framing a pulsing tint energy field, anchored by
 * heavy struts at the base.
 */
export function WarpGate({ tint, reducedMotion }: PropProps) {
  const field = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (field.current) {
      const s = reducedMotion ? 1 : 0.9 + Math.sin(t * 3) * 0.1;
      field.current.scale.set(s, s, 1);
    }
  });
  const struts: number[] = [-0.4, 0.4];
  return (
    <group>
      {/* vertical faceted ring gate */}
      <mesh>
        <torusGeometry args={[0.7, 0.12, 8, 14]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      {/* energy field disc inside the ring */}
      <mesh ref={field} position={[0, 0, 0]}>
        <circleGeometry args={[0.62, 16]} />
        <meshBasicMaterial color={tint} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* heavy struts at the base */}
      {struts.map((x, i) => (
        <mesh key={`strut-${i}`} position={[x, -0.95, 0]}>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color={STRUT} metalness={0.45} roughness={0.55} flatShading />
        </mesh>
      ))}
      {/* base crossbeam with a warm hazard cap */}
      <mesh position={[0, -1.1, 0]}>
        <boxGeometry args={[1.1, 0.16, 0.22]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, -1.1, 0.14]}>
        <boxGeometry args={[0.9, 0.06, 0.04]} />
        <meshStandardMaterial color={WARM} metalness={0.3} roughness={0.6} flatShading />
      </mesh>
    </group>
  );
}

/**
 * SensorSat — a compact satellite: a box bus with two flat COOLANT solar wings and a dish
 * on an arm pointing outward, a tint emitter at the dish, gently drifting.
 */
export function SensorSat({ tint, reducedMotion }: PropProps) {
  const rig = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (rig.current) {
      rig.current.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.6) * 0.3;
      rig.current.rotation.x = reducedMotion ? 0 : Math.sin(t * 0.4) * 0.12;
    }
  });
  return (
    <group ref={rig}>
      {/* central box bus */}
      <mesh>
        <boxGeometry args={[0.4, 0.4, 0.5]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      {/* two flat solar wings */}
      <mesh position={[0.65, 0, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.8, 0.02, 0.35]} />
        <meshStandardMaterial color={COOLANT} metalness={0.3} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-0.65, 0, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.8, 0.02, 0.35]} />
        <meshStandardMaterial color={COOLANT} metalness={0.3} roughness={0.5} flatShading />
      </mesh>
      {/* arm + dish pointing outward (+Z) */}
      <mesh position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 6]} />
        <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0, 0, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.26, 0.28, 8, 1, true]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading side={2} />
      </mesh>
      {/* tint emitter at the dish focus */}
      <mesh position={[0, 0, 0.7]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color={tint} transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * SurveyNet — a constellation of small survey sats around a faint central node, linked by
 * thin tint-emissive beams suggesting a network; the cluster slowly counter-rotates.
 */
export function SurveyNet({ tint, reducedMotion }: PropProps) {
  const rig = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (rig.current) rig.current.rotation.y = reducedMotion ? 0 : -clock.elapsedTime * 0.25;
  });
  const sats: [number, number, number][] = [
    [0.8, 0.1, 0.2],
    [-0.3, 0.5, -0.7],
    [-0.75, -0.15, 0.3],
    [0.25, -0.55, -0.55],
    [0.1, 0.65, 0.6],
  ];
  return (
    <group ref={rig}>
      {/* faint shared central node */}
      <mesh>
        <icosahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {sats.map((p, i) => {
        const len = Math.hypot(p[0], p[1], p[2]);
        const my = Math.atan2(p[0], p[2]);
        const mx = -Math.asin(p[1] / len);
        return (
          <group key={`sat-${i}`}>
            {/* tiny survey sat with a stub antenna */}
            <mesh position={p}>
              <icosahedronGeometry args={[0.12, 0]} />
              <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading />
            </mesh>
            <mesh position={[p[0], p[1] + 0.18, p[2]]}>
              <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
              <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
            </mesh>
            {/* thin tint-emissive beam from node to sat */}
            <mesh position={[p[0] / 2, p[1] / 2, p[2] / 2]} rotation={[mx, my, 0]}>
              <boxGeometry args={[0.02, 0.02, len]} />
              <meshBasicMaterial color={tint} transparent opacity={0.55} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
