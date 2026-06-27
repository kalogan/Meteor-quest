/**
 * Stable domain identifiers. These are the vocabulary every package shares.
 * Keep them few and explicit (the slice is "tiny but complete").
 */

/** Common, cross-biome resources. */
export const COMMON_RESOURCES = ["minerals", "alloy", "energy", "research", "fuel"] as const;

/** Biome-unique rare resources (one per biome) that gate certain tech. */
export const RARE_RESOURCES = ["cryocrystal", "silicate", "biogel", "oremetal"] as const;

export const RESOURCE_IDS = [...COMMON_RESOURCES, ...RARE_RESOURCES] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

/** Planet biome archetypes. */
export const BIOME_IDS = ["ice", "sand", "water", "rock"] as const;
export type BiomeId = (typeof BIOME_IDS)[number];

/** Tech categories a biome spiff can boost. */
export const TECH_CATEGORIES = [
  "energy",
  "materials",
  "biotech",
  "propulsion",
  "sensors",
  "administration",
] as const;
export type TechCategory = (typeof TECH_CATEGORIES)[number];

/**
 * Authority tiers, ordered low -> high. The player's *authority* sits at the
 * highest unlocked tier; lower tiers run on governors and can be dived into.
 * (Galaxy is deferred past slice 1 but reserved here for forward-compat.)
 */
export const TIER_IDS = ["city", "continent", "planet", "system", "galaxy"] as const;
export type TierId = (typeof TIER_IDS)[number];

export function tierRank(t: TierId): number {
  return TIER_IDS.indexOf(t);
}
