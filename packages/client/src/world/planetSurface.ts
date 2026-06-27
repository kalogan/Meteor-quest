import { hashStr, mulberry32 } from "./surfaceTerrain";

/**
 * [surface — avatar] Per-planet PHYSICAL surface properties that make walking feel different
 * on every world. Gravity is the headline: a low-g ice moon is floaty and hard to stop; a
 * heavy rock world is sluggish with stubby jumps. Derived from the biome + a per-planet seed,
 * so each planet is distinct but deterministic. Cosmetic/sandbox (preview) — not sim state.
 *
 * `gravity` is in "g" units (1.0 ≈ a comfortable baseline); the avatar controller scales a
 * base acceleration by it. `slip` is ground friction loss (low-g/icy worlds slide more).
 */
export interface PlanetSurface {
  gravity: number;
  /** Ground grip 0..1 (1 = full grip, lower = slippery). */
  grip: number;
  label: string;
}

/** Baseline gravity per biome — chosen for FEEL, not realism (icy moons light, rock heavy). */
const BIOME_GRAVITY: Record<string, number> = {
  ice: 0.32,
  sand: 0.7,
  water: 1.05,
  rock: 1.55,
};

const BIOME_GRIP: Record<string, number> = {
  ice: 0.45, // slippery
  sand: 0.8,
  water: 0.9,
  rock: 1.0,
};

export function surfaceProps(biome: string, seed: string): PlanetSurface {
  const baseG = BIOME_GRAVITY[biome] ?? 1.0;
  const baseGrip = BIOME_GRIP[biome] ?? 0.9;
  const rng = mulberry32(hashStr(`${seed}:surf`));
  const gravity = +(baseG * (0.85 + rng() * 0.3)).toFixed(2); // ±15% per-world jitter
  const grip = +Math.min(1, baseGrip * (0.9 + rng() * 0.2)).toFixed(2);
  const label = gravity < 0.5 ? "floaty" : gravity < 0.85 ? "light" : gravity < 1.25 ? "normal" : "heavy";
  return { gravity, grip, label };
}
