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

/**
 * [tech props] The catalogue of 3D structures a researched tech can plant in the
 * world. Content tags a tech with one of these `kind`s (see `TechProp`); the client
 * renderer maps each kind to a procedural low-poly component (props/registry). Kept
 * here — in the shared vocabulary — so content authoring and the renderer agree on
 * the exact set (the schema validates `kind` against it; the registry implements it).
 *
 * The natural placement of each is noted, but the split is authored per-tech (each
 * tech's `placement`), not inferred from the kind.
 */
export const PROP_KINDS = [
  // ground structures
  "foundry", // heavy industry — smelting block + stack
  "refinery", // refined-output — tanks + pipework
  "solar_array", // power grid — tilted photovoltaic panels
  "reactor", // fusion — domed core + cooling towers
  "capitol", // federal administration — civic dome
  "gov_spire", // planetary government — tall admin spire
  "antenna", // basic sensors — radio mast
  "dish_array", // deep sensors — steerable dish on a frame
  "biodome", // bio-labs — glass dome over greenery
  "launchpad", // rocketry — gantry + a waiting rocket
  // orbital structures
  "shipyard", // orbital launch — open drydock scaffold
  "command_station", // system command — hub station with arms
  "senate_ring", // galactic senate — grand torus ring
  "warp_gate", // warp fundamentals — energized ring gate
  "sensor_sat", // long-range array — satellite with a dish
  "survey_net", // galactic survey — cluster of survey sats
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** Where a tech prop sits relative to its planet. */
export const PROP_PLACEMENTS = ["ground", "orbit"] as const;
export type PropPlacement = (typeof PROP_PLACEMENTS)[number];
