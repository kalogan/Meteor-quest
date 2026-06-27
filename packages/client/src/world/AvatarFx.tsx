import { useEffect, useMemo, useRef, type JSX, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

/**
 * [surface — avatar fx] A pooled, low-poly DUST/PUFF particle emitter for the walkable avatar:
 * small footstep dust ("step") + bigger landing puffs ("land"). Purely cosmetic — it reads
 * nothing external. A fixed pool of meshes is reused forever (no per-burst / per-frame alloc);
 * particles rise, settle, shrink and fade, then deactivate back into the pool.
 *
 * Wiring: the controller grabs `emitterRef.current` and calls `burst(...)` to spawn a puff at a
 * world position. `tint` is lightened toward white for the soft dust colour.
 */
export interface FxEmitter {
  /** Spawn a burst at world position (x,y,z). kind "step" = small footstep dust; "land" =
   *  bigger landing puff. strength ~0..1.5 scales count/size/spread. */
  burst(x: number, y: number, z: number, strength: number, kind: "step" | "land"): void;
}

const POOL_SIZE = 48;

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

/** Parse #rrggbb and blend toward white (255) by `amount` (0..1) → hex string. */
function lighten(tint: string, amount: number): string {
  const hex = tint.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const num = Number.parseInt(full, 16);
  const valid = Number.isFinite(num) && full.length === 6;
  const r = valid ? (num >> 16) & 0xff : 200;
  const g = valid ? (num >> 8) & 0xff : 200;
  const b = valid ? num & 0xff : 200;
  const blend = (c: number): number => Math.round(c + (255 - c) * amount);
  const toHex = (c: number): string => blend(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Module-level scratch: a freshly inactive particle (cloned into the pool, never aliased). */
function makeParticle(): Particle {
  return { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0, size: 0 };
}

export function AvatarFx({
  emitterRef,
  tint,
}: {
  emitterRef: MutableRefObject<FxEmitter | null>;
  tint: string;
}): JSX.Element {
  const meshRefs = useRef<(Mesh | null)[]>([]);
  const particles = useRef<Particle[]>([]);

  // Initialise the particle state pool once (stable identity across renders).
  if (particles.current.length === 0) {
    const pool: Particle[] = [];
    for (let i = 0; i < POOL_SIZE; i += 1) pool.push(makeParticle());
    particles.current = pool;
  }

  const dustColor = useMemo(() => lighten(tint, 0.6), [tint]);

  useEffect(() => {
    const emitter: FxEmitter = {
      burst(x, y, z, strength, kind) {
        const s = Math.max(0, Math.min(1.5, strength));
        const isLand = kind === "land";
        const count = isLand ? Math.round(8 + 6 * (s / 1.5)) : 3 + (Math.random() < 0.5 ? 0 : 1);
        const pool = particles.current;
        let spawned = 0;
        for (let i = 0; i < pool.length && spawned < count; i += 1) {
          const p = pool[i];
          if (!p || p.active) continue;
          const angle = Math.random() * Math.PI * 2;
          // Outward XZ magnitude + a small upward kick; scaled by strength.
          const outward = (isLand ? 0.9 + 1.4 * s : 0.35 + 0.5 * s) * (0.6 + Math.random() * 0.6);
          const up = (isLand ? 0.7 + 0.6 * s : 0.5 + 0.4 * s) * (0.5 + Math.random() * 0.6);
          const jitter = isLand ? 0.12 : 0.05;
          p.active = true;
          p.x = x + (Math.random() - 0.5) * jitter;
          p.y = y + Math.random() * jitter * 0.5;
          p.z = z + (Math.random() - 0.5) * jitter;
          p.vx = Math.cos(angle) * outward;
          p.vy = up;
          p.vz = Math.sin(angle) * outward;
          p.life = 0;
          p.maxLife = isLand ? 0.7 : 0.45;
          p.size = isLand ? 0.08 + Math.random() * 0.1 : 0.05 + Math.random() * 0.05;
          spawned += 1;
        }
      },
    };
    emitterRef.current = emitter;
    return () => {
      emitterRef.current = null;
    };
  }, [emitterRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const damp = Math.exp(-2 * dt);
    const pool = particles.current;
    const meshes = meshRefs.current;
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      const mesh = meshes[i];
      if (!p || !mesh) continue;
      if (!p.active) {
        if (mesh.visible) {
          mesh.visible = false;
          mesh.scale.setScalar(0);
        }
        continue;
      }
      // Integrate.
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      // Settle: gravity-ish pull + horizontal damping.
      p.vy -= 3 * dt;
      p.vx *= damp;
      p.vz *= damp;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        mesh.visible = false;
        mesh.scale.setScalar(0);
        continue;
      }
      const fade = 1 - p.life / p.maxLife;
      mesh.visible = true;
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.setScalar(p.size * fade);
    }
  });

  const slots = useMemo(() => Array.from({ length: POOL_SIZE }, (_, i) => i), []);

  return (
    <group>
      {slots.map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshRefs.current[i] = m;
          }}
          visible={false}
          scale={0}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={dustColor} transparent depthWrite={false} opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}
