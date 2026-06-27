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
  /** Defensive shielding — a cool protective cyan that brightens with strength. */
  defense: "#5cf2d6",
  /** Generic incoming-threat accent (used when a kind has no specific tint). */
  threat: "#ff6a4d",
} as const;

/** Per-kind threat tint so a meteor reads differently from a pirate raid. */
const THREAT_TINTS: Record<string, string> = {
  pirateRaid: "#ff8a3d",
  beast: "#ff5db1",
  meteor: "#ff6a4d",
  supernova: "#ffd24d",
};

/** Tint for an incoming threat of a given event kind. */
export function threatColor(kind: string): string {
  return THREAT_TINTS[kind] ?? PALETTE.threat;
}

/**
 * Map a raw defense value to a 0..1 intensity for shield visuals. Defense has no
 * hard cap in the contract, so we use a smooth saturating curve: each point adds
 * less than the last, and a handful of points already reads as "well defended".
 */
export function defenseIntensity(defense: number | undefined): number {
  const d = Math.max(0, defense ?? 0);
  return 1 - 1 / (1 + d * 0.35);
}

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
