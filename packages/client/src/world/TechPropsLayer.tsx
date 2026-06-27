import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import type { Group } from "three";
import { getContentPack, type Planet, type PropKind, type TechProp } from "@meteor/shared";
import { PROP_COMPONENTS } from "./props/registry";
import { biomePropTint } from "./palette";

/**
 * [tech props] Plants a settled world's unlocked-tech STRUCTURES on/around the planet.
 *
 * Which structures show is read straight off the empire's research: a tech contributes
 * its `prop` once `tech.id` is in `unlocked`. So the world visibly GROWS as you research
 * — the same empire-wide unlock set on every settled world (per the design), but each
 * world arranges + tints its props differently from a per-planet seed, so colonies never
 * look copy-pasted.
 *
 * Two placement modes, split by the content-authored `placement`:
 *   - GROUND props are planted on the planet surface (base on the sphere, growing along
 *     the surface normal). They are rendered by `GroundTechProps`, which the caller mounts
 *     INSIDE the planet's spin <group> so they co-rotate with the surface and read as
 *     planted (not floating).
 *   - ORBIT props ride a gently-revolving ring around the world. They are rendered by
 *     `OrbitTechProps`, mounted OUTSIDE the spin group so the ring keeps its own slow turn.
 *
 * Cosmetic + deterministic: reads only the planet + the resolved content pack, allocates
 * its transforms once in useMemo (no per-frame churn, no fresh objects in any store
 * selector), and every child component freezes under `reducedMotion`.
 */

const pack = getContentPack();
const UP = new Vector3(0, 1, 0);

/** FNV-1a string hash → uint32, for a stable per-planet seed (no Math.random shimmer). */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — deterministic per planet so a world's layout is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Golden-spiral unit-sphere point — same scatter PlanetView uses for continents. */
function spherePoint(i: number, total: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / Math.max(1, total - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

/** Resolve the tech `prop`s that should appear on a settled world right now. */
function unlockedProps(unlocked: string[], placement: TechProp["placement"]): TechProp[] {
  const owned = new Set(unlocked);
  return pack.tech
    .filter((t) => t.prop && t.prop.placement === placement && owned.has(t.id))
    .map((t) => t.prop as TechProp);
}

interface PlacedProp {
  key: string;
  kind: PropKind;
  position: [number, number, number];
  /** Quaternion as [x,y,z,w] for the wrapping group. */
  quaternion: [number, number, number, number];
  scale: number;
}

/**
 * Ground structures planted across the surface. MOUNT INSIDE the planet's spin group so
 * they co-rotate with the surface. Each prop's +Y is aligned to the surface normal so it
 * stands upright on the sphere; position, rotation and a slight size jitter come from the
 * per-planet seed, so two worlds with the same tech look arranged differently.
 */
export function GroundTechProps({
  planet,
  radius,
  unlocked,
  reducedMotion,
}: {
  planet: Planet;
  radius: number;
  unlocked: string[];
  reducedMotion: boolean;
}) {
  const tint = biomePropTint(planet);
  const placed = useMemo<PlacedProp[]>(() => {
    const props = unlockedProps(unlocked, "ground");
    const rng = mulberry32(hashStr(planet.id));
    const spin = rng() * Math.PI * 2; // per-world yaw of the whole arrangement
    const ca = Math.cos(spin);
    const sa = Math.sin(spin);
    const total = props.length + 2; // pad so we avoid clustering at the poles
    return props.map((tp, i) => {
      const [nx, ny, nz] = spherePoint(i + 1, total);
      // Rotate the scatter around Y by the seed so worlds differ.
      const rx = nx * ca + nz * sa;
      const rz = -nx * sa + nz * ca;
      const normal = new Vector3(rx, ny, rz).normalize();
      const position = normal.clone().multiplyScalar(radius * 0.98);
      const q = new Quaternion().setFromUnitVectors(UP, normal);
      const jitter = 0.88 + rng() * 0.24;
      const scale = radius * 0.16 * (tp.scale ?? 1) * jitter;
      return {
        key: `${tp.kind}:${i}`,
        kind: tp.kind,
        position: [position.x, position.y, position.z],
        quaternion: [q.x, q.y, q.z, q.w],
        scale,
      };
    });
  }, [planet.id, radius, unlocked]);

  return (
    <>
      {placed.map((p) => {
        const Comp = PROP_COMPONENTS[p.kind];
        return (
          <group key={p.key} position={p.position} quaternion={p.quaternion} scale={p.scale}>
            <Comp tint={tint} reducedMotion={reducedMotion} />
          </group>
        );
      })}
    </>
  );
}

/** Slow revolution of the orbital-structure ring, radians/second (held under reduced motion). */
const RING_SPEED = 0.12;

/**
 * Orbital structures on a gently-revolving, slightly-tilted ring around the world. MOUNT
 * OUTSIDE the planet's spin group (the ring has its own slow turn, independent of the
 * surface). Spaced evenly around the ring with a seeded phase so worlds differ; sits at a
 * larger radius than the home fleet's orbit so they don't overlap.
 */
export function OrbitTechProps({
  planet,
  radius,
  unlocked,
  reducedMotion,
}: {
  planet: Planet;
  radius: number;
  unlocked: string[];
  reducedMotion: boolean;
}) {
  const ring = useRef<Group>(null);
  const tint = biomePropTint(planet);
  const angle = useRef(0);

  const placed = useMemo<PlacedProp[]>(() => {
    const props = unlockedProps(unlocked, "orbit");
    const rng = mulberry32(hashStr(planet.id) ^ 0x9e3779b9);
    const phase = rng() * Math.PI * 2;
    const orbitR = radius * 2.1;
    const m = Math.max(1, props.length);
    return props.map((tp, i) => {
      const a = phase + (i * Math.PI * 2) / m;
      const x = Math.cos(a) * orbitR;
      const z = Math.sin(a) * orbitR;
      const y = Math.sin(a * 1.3 + phase) * orbitR * 0.14; // a soft tilt/wobble off the equator
      // Face the planet centre so the stations "look" inward; identity if degenerate.
      const dir = new Vector3(-x, -y, -z);
      const q =
        dir.lengthSq() > 1e-6
          ? new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir.normalize())
          : new Quaternion();
      const jitter = 0.9 + rng() * 0.2;
      const scale = radius * 0.2 * (tp.scale ?? 1) * jitter;
      return {
        key: `${tp.kind}:${i}`,
        kind: tp.kind,
        position: [x, y, z],
        quaternion: [q.x, q.y, q.z, q.w],
        scale,
      };
    });
  }, [planet.id, radius, unlocked]);

  useFrame((_, delta) => {
    if (!ring.current) return;
    if (!reducedMotion) angle.current += delta * RING_SPEED;
    ring.current.rotation.y = angle.current;
  });

  if (placed.length === 0) return null;

  return (
    <group ref={ring}>
      {placed.map((p) => {
        const Comp = PROP_COMPONENTS[p.kind];
        return (
          <group key={p.key} position={p.position} quaternion={p.quaternion} scale={p.scale}>
            <Comp tint={tint} reducedMotion={reducedMotion} />
          </group>
        );
      })}
    </group>
  );
}
