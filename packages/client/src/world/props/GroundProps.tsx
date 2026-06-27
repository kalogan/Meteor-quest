import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { PropProps } from "./types";
import { METAL_LIGHT, METAL_MID, METAL_DARK, STRUT, WARM, COOLANT, FOLIAGE } from "./materials";

/**
 * [tech props] Ten procedural GROUND structures — low-poly "tech buildings" that appear
 * on a settled world's surface once the matching technology unlocks. Each stands on the
 * XZ plane with its BASE at y=0 and grows up +Y, footprint within a unit circle and
 * height within ~1.4 (see PropProps / TechPropsLayer). They share the Ship's faceted
 * metal vocabulary (flat-shaded meshStandardMaterial + a single meshBasicMaterial glow)
 * so they read as built by the player's civilisation. Each spends the biome `tint` on
 * EXACTLY ONE emissive accent; everything else uses the shared metal constants. All
 * motion is local useFrame work that holds static when `reducedMotion` is set.
 */

/** Cool dark blue for photovoltaic glass — kept inline as it's unique to SolarArray. */
const PANEL_GLASS = "#1c2c52";

/* ------------------------------------------------------------------ */
/* 1. Foundry — blocky smelter with a chimney stack + glowing vent.    */
/* ------------------------------------------------------------------ */
export function Foundry({ tint, reducedMotion }: PropProps) {
  const vent = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (vent.current) vent.current.scale.setScalar(reducedMotion ? 1 : 0.9 + Math.sin(t * 6) * 0.12);
  });
  return (
    <group>
      {/* wide faceted base box */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.95, 0.6, 0.75]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      {/* upper housing */}
      <mesh position={[-0.15, 0.72, 0]}>
        <boxGeometry args={[0.55, 0.3, 0.55]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.5} flatShading />
      </mesh>
      {/* tall chimney/stack */}
      <mesh position={[0.28, 0.9, 0.05]}>
        <cylinderGeometry args={[0.12, 0.16, 1.0, 6]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      {/* hazard band on stack */}
      <mesh position={[0.28, 1.32, 0.05]}>
        <cylinderGeometry args={[0.13, 0.13, 0.1, 6]} />
        <meshStandardMaterial color={WARM} metalness={0.3} roughness={0.6} flatShading />
      </mesh>
      {/* glowing furnace vent (tint accent) */}
      <mesh ref={vent} position={[0, 0.22, 0.39]}>
        <boxGeometry args={[0.4, 0.22, 0.06]} />
        <meshBasicMaterial color={tint} transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Refinery — cluster of tanks linked by pipe, glowing flare tip.   */
/* ------------------------------------------------------------------ */
export function Refinery({ tint, reducedMotion }: PropProps) {
  const flare = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (flare.current) flare.current.scale.setScalar(reducedMotion ? 1 : 0.85 + Math.sin(t * 9) * 0.2);
  });
  return (
    <group>
      {/* tall tank */}
      <mesh position={[-0.32, 0.55, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 1.1, 8]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-0.32, 1.13, 0]}>
        <cylinderGeometry args={[0.26, 0.18, 0.18, 8]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      {/* medium tank */}
      <mesh position={[0.22, 0.4, 0.18]}>
        <cylinderGeometry args={[0.22, 0.22, 0.8, 8]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {/* short tank */}
      <mesh position={[0.3, 0.26, -0.3]}>
        <cylinderGeometry args={[0.18, 0.18, 0.52, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.5} flatShading />
      </mesh>
      {/* connecting pipe */}
      <mesh position={[-0.05, 0.5, 0.09]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
        <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      {/* flare stack on tall tank */}
      <mesh position={[-0.32, 1.28, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.18, 6]} />
        <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      {/* glowing flare tip (tint accent) */}
      <mesh ref={flare} position={[-0.32, 1.42, 0]}>
        <coneGeometry args={[0.07, 0.16, 6]} />
        <meshBasicMaterial color={tint} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 3. SolarArray — row of tilted PV panels on posts, glowing seam.     */
/* ------------------------------------------------------------------ */
export function SolarArray({ tint, reducedMotion }: PropProps) {
  // All panel heads track together — one tilt value driven onto each group's rotation.x.
  const heads = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const tilt = reducedMotion ? -0.55 : -0.55 + Math.sin(clock.elapsedTime * 0.5) * 0.12;
    for (const h of heads.current) if (h) h.rotation.x = tilt;
  });
  const xs = [-0.66, -0.22, 0.22, 0.66];
  return (
    <group>
      {xs.map((x, i) => (
        <group key={x}>
          {/* short post */}
          <mesh position={[x, 0.22, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.44, 6]} />
            <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
          </mesh>
          {/* tilting panel head (tracks) */}
          <group
            ref={(g) => {
              heads.current[i] = g;
            }}
            position={[x, 0.46, 0]}
            rotation={[-0.55, 0, 0]}
          >
            <mesh>
              <boxGeometry args={[0.34, 0.04, 0.46]} />
              <meshStandardMaterial color={PANEL_GLASS} metalness={0.6} roughness={0.3} flatShading />
            </mesh>
            {/* tint-emissive seam line down the panel */}
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[0.04, 0.02, 0.46]} />
              <meshBasicMaterial color={tint} transparent opacity={0.85} depthWrite={false} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Reactor — domed fusion core flanked by two cooling towers.       */
/* ------------------------------------------------------------------ */
export function Reactor({ tint, reducedMotion }: PropProps) {
  const core = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (core.current) core.current.scale.setScalar(reducedMotion ? 1 : 0.88 + Math.sin(t * 4) * 0.14);
  });
  return (
    <group>
      {/* base platform */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 0.2, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.5} flatShading />
      </mesh>
      {/* central core housing */}
      <mesh position={[0, 0.36, 0]}>
        <icosahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      {/* glowing fusion dome (tint accent) — hemisphere */}
      <mesh ref={core} position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={tint} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      {/* two tapered cooling towers, wider at base */}
      <mesh position={[-0.42, 0.55, 0]}>
        <cylinderGeometry args={[0.13, 0.22, 0.9, 8]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0.42, 0.55, 0]}>
        <cylinderGeometry args={[0.13, 0.22, 0.9, 8]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {/* coolant collars on the towers — cool energy accent (not the biome tint) */}
      <mesh position={[-0.42, 0.86, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 8]} />
        <meshStandardMaterial color={COOLANT} emissive={COOLANT} emissiveIntensity={0.4} metalness={0.2} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0.42, 0.86, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 8]} />
        <meshStandardMaterial color={COOLANT} emissive={COOLANT} emissiveIntensity={0.4} metalness={0.2} roughness={0.5} flatShading />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Capitol — civic building, wide base + central dome + spire.      */
/* ------------------------------------------------------------------ */
export function Capitol({ tint }: PropProps) {
  return (
    <group>
      {/* low wide base */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.0, 0.4, 0.7]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.4} roughness={0.55} flatShading />
      </mesh>
      {/* colonnade step */}
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.7, 0.1, 0.5]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {/* drum under dome */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.26, 0.28, 0.16, 8]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {/* prominent central dome (hemisphere) */}
      <mesh position={[0, 0.66, 0]}>
        <sphereGeometry args={[0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      {/* spire mast */}
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.24, 6]} />
        <meshStandardMaterial color={STRUT} metalness={0.5} roughness={0.5} flatShading />
      </mesh>
      {/* flag pip */}
      <mesh position={[0.05, 1.06, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <meshStandardMaterial color={WARM} metalness={0.3} roughness={0.6} flatShading />
      </mesh>
      {/* warm-lit doorway (tint accent) */}
      <mesh position={[0, 0.16, 0.36]}>
        <boxGeometry args={[0.16, 0.26, 0.04]} />
        <meshBasicMaterial color={tint} transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 6. GovSpire — tall stepped administrative tower (tallest, ~1.4).    */
/* ------------------------------------------------------------------ */
export function GovSpire({ tint }: PropProps) {
  return (
    <group>
      {/* stepped tapering stack of hex prisms */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.5, 6]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.42, 6]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.36, 6]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      <mesh position={[0, 1.26, 0]}>
        <coneGeometry args={[0.14, 0.18, 6]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.5} roughness={0.45} flatShading />
      </mesh>
      {/* antenna pip at the very top */}
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 6]} />
        <meshStandardMaterial color={STRUT} metalness={0.5} roughness={0.5} flatShading />
      </mesh>
      {/* tint-emissive window bands (single accent group) */}
      <mesh position={[0, 0.45, 0.31]}>
        <boxGeometry args={[0.34, 0.05, 0.02]} />
        <meshBasicMaterial color={tint} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.72, 0.29]}>
        <boxGeometry args={[0.26, 0.05, 0.02]} />
        <meshBasicMaterial color={tint} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.0, 0.21]}>
        <boxGeometry args={[0.18, 0.05, 0.02]} />
        <meshBasicMaterial color={tint} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Antenna — thin lattice radio mast with crossbars + nav light.    */
/* ------------------------------------------------------------------ */
export function Antenna({ tint, reducedMotion }: PropProps) {
  const light = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // blink: hard on/off-ish pulse
    if (light.current) light.current.scale.setScalar(reducedMotion ? 1 : 0.5 + (Math.sin(t * 4) > 0 ? 0.7 : 0.1));
  });
  return (
    <group>
      {/* foot */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.3, 0.12, 0.3]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {/* thin lattice tower */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.1, 1.2, 0.1]} />
        <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      {/* crossbar dish elements */}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.4} roughness={0.55} flatShading />
      </mesh>
      <mesh position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.4, 6]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.4} roughness={0.55} flatShading />
      </mesh>
      <mesh position={[0, 1.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.4} roughness={0.55} flatShading />
      </mesh>
      {/* blinking nav light at the top (tint accent) */}
      <mesh ref={light} position={[0, 1.36, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={tint} transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 8. DishArray — steerable parabolic dish on a pedestal, sweeps.      */
/* ------------------------------------------------------------------ */
export function DishArray({ tint, reducedMotion }: PropProps) {
  const yoke = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (yoke.current) {
      yoke.current.rotation.y = reducedMotion ? 0.4 : Math.sin(t * 0.3) * 0.6;
      yoke.current.rotation.x = reducedMotion ? -0.5 : -0.5 + Math.sin(t * 0.2) * 0.2;
    }
  });
  return (
    <group>
      {/* base */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.34, 0.4, 0.2, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.5} flatShading />
      </mesh>
      {/* pedestal mount */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 0.45, 6]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.45} roughness={0.5} flatShading />
      </mesh>
      {/* steerable head */}
      <group ref={yoke} position={[0, 0.68, 0]}>
        {/* parabolic dish — shallow open cone */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.5, 0.3, 10, 1, true]} />
          <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading side={2} />
        </mesh>
        {/* feed strut */}
        <mesh position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 6]} />
          <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
        </mesh>
        {/* tint emitter at dish focus */}
        <mesh position={[0, 0, 0.4]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={tint} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Biodome — green geodesic dome with trees + grow-light.           */
/* ------------------------------------------------------------------ */
export function Biodome({ tint, reducedMotion }: PropProps) {
  const grow = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (grow.current) grow.current.scale.setScalar(reducedMotion ? 1 : 0.85 + Math.sin(t * 2.5) * 0.15);
  });
  return (
    <group>
      {/* base ring */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.62, 0.66, 0.12, 10]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.45} roughness={0.55} flatShading />
      </mesh>
      {/* faceted trees inside (visible through glass) */}
      <mesh position={[-0.18, 0.32, 0.1]}>
        <coneGeometry args={[0.14, 0.36, 6]} />
        <meshStandardMaterial color={FOLIAGE} metalness={0.1} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0.2, 0.26, -0.12]}>
        <coneGeometry args={[0.11, 0.28, 6]} />
        <meshStandardMaterial color={FOLIAGE} metalness={0.1} roughness={0.8} flatShading />
      </mesh>
      {/* soft tint grow-light orb inside */}
      <mesh ref={grow} position={[0.02, 0.4, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={tint} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* transparent green geodesic dome */}
      <mesh position={[0, 0.12, 0]}>
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial
          color={FOLIAGE}
          metalness={0.2}
          roughness={0.3}
          transparent
          opacity={0.32}
          depthWrite={false}
          flatShading
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 10. Launchpad — pad + gantry tower + waiting rocket, pad lights.    */
/* ------------------------------------------------------------------ */
export function Launchpad({ tint, reducedMotion }: PropProps) {
  const exhaust = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (exhaust.current) exhaust.current.scale.setScalar(reducedMotion ? 1 : 0.7 + Math.sin(t * 7) * 0.25);
  });
  return (
    <group>
      {/* flat circular pad */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.7, 0.74, 0.1, 12]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.5} flatShading />
      </mesh>
      {/* lattice gantry tower beside the rocket */}
      <mesh position={[0.42, 0.6, 0]}>
        <boxGeometry args={[0.1, 1.0, 0.1]} />
        <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0.2, 0.7, 0]}>
        <boxGeometry args={[0.34, 0.05, 0.05]} />
        <meshStandardMaterial color={STRUT} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      {/* waiting rocket — WARM body */}
      <mesh position={[-0.1, 0.55, 0]}>
        <cylinderGeometry args={[0.13, 0.14, 0.8, 8]} />
        <meshStandardMaterial color={WARM} metalness={0.3} roughness={0.55} flatShading />
      </mesh>
      {/* rocket nose cone */}
      <mesh position={[-0.1, 1.05, 0]}>
        <coneGeometry args={[0.13, 0.28, 8]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      {/* fins */}
      <mesh position={[-0.1, 0.2, 0]}>
        <cylinderGeometry args={[0.13, 0.2, 0.16, 8]} />
        <meshStandardMaterial color={METAL_MID} metalness={0.4} roughness={0.55} flatShading />
      </mesh>
      {/* tint-emissive pad lights + faint exhaust glow at base (single tint accent) */}
      <mesh ref={exhaust} position={[-0.1, 0.06, 0]}>
        <coneGeometry args={[0.12, 0.18, 8]} />
        <meshBasicMaterial color={tint} transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </group>
  );
}
