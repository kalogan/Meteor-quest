import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { getContentPack, type GameState, type Planet, type PropKind, type TechProp } from "@meteor/shared";
import { PROP_COMPONENTS } from "./props/registry";
import { biomePropTint, planetColor } from "./palette";

/**
 * [surface dive] The closest view — a low-poly TERRAIN PATCH the camera lands on when it
 * descends below city tier (CameraRig.nearSurface). Built in the planet's LOCAL frame and
 * anchored at the focus surface point (normal), oriented so local +Y is "up from the
 * ground". It reads as standing on the world: gentle biome-tinted relief that domes DOWN at
 * the edges into a curved horizon, an atmospheric haze band ringing that horizon, and the
 * colony's unlocked structures scaled up onto the surface.
 *
 * Purely cosmetic + deterministic (seeded from the planet id) — reads only the planet + the
 * resolved content pack, allocates its geometry once in useMemo, and holds still under
 * reduced motion (the structures it hosts honor it themselves).
 */

const UP = new Vector3(0, 1, 0);
const pack = getContentPack();

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic height field over the tangent patch: low relief minus an edge dome. */
function makeHeightField(seed: string, size: number, radius: number) {
  const rng = mulberry32(hashStr(seed) ^ 0x5ee5);
  const N = 6; // control-grid resolution
  const ctrl: number[] = Array.from({ length: (N + 1) * (N + 1) }, () => rng() * 2 - 1);
  const relAmp = radius * 0.1;
  const domeAmp = radius * 0.16; // gentle edge curve → a distant horizon, not a falling cliff
  const half = size / 2;
  const g = (a: number, b: number) =>
    ctrl[Math.min(N, Math.max(0, b)) * (N + 1) + Math.min(N, Math.max(0, a))] ?? 0;
  return (x: number, z: number): number => {
    const u = ((x + half) / size) * N;
    const v = ((z + half) / size) * N;
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const rel =
      (g(i, j) * (1 - fu) + g(i + 1, j) * fu) * (1 - fv) +
      (g(i, j + 1) * (1 - fu) + g(i + 1, j + 1) * fu) * fv;
    const d = Math.min(1.3, Math.hypot(x, z) / half);
    return rel * relAmp - d * d * domeAmp;
  };
}

/** Flat-shaded (non-indexed) grid mesh from the height field. */
function buildGeometry(heightAt: (x: number, z: number) => number, size: number, segs: number): BufferGeometry {
  const pos: number[] = [];
  const step = size / segs;
  const half = size / 2;
  const v = (x: number, z: number) => pos.push(x, heightAt(x, z), z);
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < segs; j++) {
      const x0 = -half + i * step;
      const x1 = x0 + step;
      const z0 = -half + j * step;
      const z1 = z0 + step;
      // Wind CCW-from-above so vertex normals point +Y (up) — else the ground lights from below.
      v(x0, z0); v(x0, z1); v(x1, z1); // tri 1
      v(x0, z0); v(x1, z1); v(x1, z0); // tri 2
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Vertical haze band ringing the horizon: bright at the ground, fading up. */
function buildHaze(radius: number, size: number, tint: string): BufferGeometry {
  const segs = 48;
  const r = size * 0.46; // just inside the patch rim, so it sits AT the horizon line
  const h = radius * 0.8;
  const pos: number[] = [];
  const colors: number[] = [];
  const top = hexToRgb(tint);
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    // quad (x0,0)-(x1,0)-(x1,h)-(x0,h) as two tris; alpha encoded in the green-ish? we use
    // vertex colors only (alpha from material opacity + a fade baked into brightness).
    const lo = [top.r, top.g, top.b];
    const hi = [top.r * 0.15, top.g * 0.18, top.b * 0.25];
    pos.push(x0, -radius * 0.05, z0, x1, -radius * 0.05, z1, x1, h, z1);
    colors.push(...lo, ...lo, ...hi);
    pos.push(x0, -radius * 0.05, z0, x1, h, z1, x0, h, z0);
    colors.push(...lo, ...hi, ...hi);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geo;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** Unlocked tech structures placed on the patch (a legible "colony"). */
function unlockedGroundProps(game: GameState): { kind: PropKind }[] {
  const owned = new Set(game.research.unlocked);
  return pack.tech
    .filter((t) => t.prop && (t.prop as TechProp).placement === "ground" && owned.has(t.id))
    .map((t) => ({ kind: (t.prop as TechProp).kind }));
}

export function SurfaceView({
  planet,
  game,
  radius,
  normal,
  reducedMotion,
}: {
  planet: Planet;
  game: GameState;
  radius: number;
  /** Unit LOCAL surface normal the patch is anchored at. */
  normal: [number, number, number];
  reducedMotion: boolean;
}) {
  const size = radius * 6.4;
  const tint = planetColor(planet);
  const accent = biomePropTint(planet);

  // Orient the patch as a full basis (local +Y = surface normal, local +Z = the camera's
  // gaze direction — the SAME tangent CameraRig looks along), so "forward (+Z)" is straight
  // ahead of the landed camera and structures placed there are reliably in view.
  const orient = useMemo(() => {
    const n = new Vector3(normal[0], normal[1], normal[2]).normalize();
    let f = new Vector3().crossVectors(n, UP);
    if (f.lengthSq() < 1e-4) f = new Vector3().crossVectors(n, new Vector3(1, 0, 0));
    f.normalize();
    const right = new Vector3().crossVectors(n, f).normalize();
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, n, f));
    const pos = n.multiplyScalar(radius);
    return { quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number], position: [pos.x, pos.y, pos.z] as [number, number, number] };
  }, [normal, radius]);

  const heightAt = useMemo(() => makeHeightField(planet.id, size, radius), [planet.id, size, radius]);
  const ground = useMemo(() => buildGeometry(heightAt, size, 30), [heightAt, size]);
  const haze = useMemo(() => buildHaze(radius, size, accent), [radius, size, accent]);

  // Scatter the colony's structures across the central, flatter part of the patch.
  const structures = useMemo(() => {
    const props = unlockedGroundProps(game);
    if (props.length === 0) return [];
    const rng = mulberry32(hashStr(planet.id) ^ 0xc0ffee);
    // Place them in the forward arc (+Z = camera gaze), fanned out in X, so the colony reads
    // as "ahead of you" when you land.
    const n = Math.min(6, props.length);
    return props.slice(0, n).map((p, i) => {
      // A row of buildings on the near ground, just ahead of and below the camera's eyeline.
      const z = size * 0.045 + (size * 0.12 * i) / Math.max(1, n - 1);
      const x = (i - (n - 1) / 2) * size * 0.08 + (rng() - 0.5) * size * 0.02;
      return { key: `${p.kind}:${i}`, kind: p.kind, x, z, y: heightAt(x, z), scale: radius * 0.2 * (0.9 + rng() * 0.2) };
    });
  }, [game.research.unlocked, planet.id, size, radius, heightAt]);

  return (
    <group position={orient.position} quaternion={orient.quaternion}>
      {/* The ground. */}
      <mesh geometry={ground}>
        <meshStandardMaterial color={tint} roughness={0.95} metalness={0.02} flatShading emissive={tint} emissiveIntensity={0.05} />
      </mesh>

      {/* Horizon atmosphere band (cosmetic; never eats picks). */}
      <mesh geometry={haze} raycast={() => null}>
        <meshBasicMaterial vertexColors transparent opacity={0.22} depthWrite={false} side={2} />
      </mesh>

      {/* Local lighting so the patch + structures read at the landed angle: a sky fill + a
          warm low sun grazing across the relief. */}
      <hemisphereLight color="#bcd0ff" groundColor={tint} intensity={0.85} />
      <directionalLight position={[size * 0.5, radius * 1.6, size * 0.3]} intensity={2.4} color="#ffe6b0" />
      <pointLight position={[-size * 0.2, radius * 0.9, size * 0.1]} intensity={10} distance={size * 4} decay={1.4} color="#ffd9a0" />

      {/* The colony's structures, planted on the relief. */}
      {structures.map((s) => {
        const Comp = PROP_COMPONENTS[s.kind];
        return (
          <group key={s.key} position={[s.x, s.y, s.z]} scale={s.scale}>
            <Comp tint={accent} reducedMotion={reducedMotion} />
          </group>
        );
      })}
    </group>
  );
}
