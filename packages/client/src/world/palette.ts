import { getContentPack } from "@meteor/shared";
import type { Planet } from "@meteor/shared";

/**
 * Visual palette + fog helpers for the God-view. Pure (no three import) so it can
 * be unit-tested and reused by every render layer. Colors for biomes come from the
 * authored content pack (the single seam), never hardcoded per-planet.
 */
const pack = getContentPack();

/** Hex tints the renderer reaches for; biome tints are pulled from content. */
export const PALETTE = {
  /** Fog: a body whose biome is hidden until scanned. */
  unknown: "#2b2f3a",
  /** Fog: a system that exists but hasn't been discovered (an unresolved blip). */
  undiscovered: "#171a22",
  star: "#ffd27a",
  starHome: "#ffe9b0",
  orbitLine: "#3b4250",
  space: "#05060a",
  continent: "#5a6b54",
  city: "#f2d27a",
  cityFog: "#444a57",
  glow: "#8fe3ff",
} as const;

/** Biome tint for a planet, gated by fog: unscanned planets read as "unknown". */
export function planetColor(planet: Planet): string {
  if (!planet.scanned) return PALETTE.unknown;
  return pack.biomes.find((b) => b.id === planet.biome)?.color ?? "#888888";
}

/** A biome's settled-glow accent (its own tint, brightened) or the generic glow. */
export function settleGlow(planet: Planet): string {
  if (!planet.scanned) return PALETTE.glow;
  return pack.biomes.find((b) => b.id === planet.biome)?.color ?? PALETTE.glow;
}
