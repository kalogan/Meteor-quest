import { BufferGeometry, Float32BufferAttribute } from "three";

/**
 * [surface dive] Shared terrain math for the landed surface: a deterministic height field
 * over the tangent patch + a flat-shaded mesh built from it. Factored out of SurfaceView so
 * a walkable avatar (preview Tier 2) can sample the SAME ground the patch renders.
 */

/** FNV-1a string hash → uint32, for a stable per-planet seed. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — deterministic from a uint32 seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A deterministic height field over the tangent patch: low relief (bilinear value noise over
 * a small control grid) minus an edge dome that curves the rim down into a horizon. Returns
 * a sampler `(x, z) => y` in the patch's local frame.
 */
export function makeHeightField(seed: string, size: number, relAmp: number, domeAmp: number) {
  const rng = mulberry32(hashStr(seed) ^ 0x5ee5);
  const N = 6; // control-grid resolution
  const ctrl: number[] = Array.from({ length: (N + 1) * (N + 1) }, () => rng() * 2 - 1);
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

/** Flat-shaded (non-indexed) grid mesh from the height field; normals point +Y (up). */
export function buildTerrainGeometry(heightAt: (x: number, z: number) => number, size: number, segs: number): BufferGeometry {
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
      v(x0, z0); v(x0, z1); v(x1, z1); // CCW-from-above → +Y normals
      v(x0, z0); v(x1, z1); v(x1, z0);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
