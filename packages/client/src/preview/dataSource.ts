import { getContentPack, type Biome, type Planet, type TechNode } from "@meteor/shared";
import { createInitialState } from "@meteor/sim-core";
import type { GameState } from "@meteor/shared";

/**
 * THE SEAM (preview half). The harness loads content + state through the SAME
 * validate+resolve path the product uses (getContentPack / createInitialState) —
 * never a fork "for preview". New biomes/tech appear here automatically because we
 * enumerate from the resolved data, not a hand-maintained registry.
 */
export function listBiomes(): Biome[] {
  return getContentPack().biomes;
}

export function listTech(): TechNode[] {
  return getContentPack().tech;
}

/** Identity seed reproduces the exact on-disk world; vary the seed to explore. */
export function previewState(seed = 0): GameState {
  return createInitialState(seed);
}

/** One biome paired with a REAL planet that renders it (for the 3D gallery). */
export interface BiomeSpecimen {
  biome: Biome;
  /** A real Planet record, fed verbatim to the REAL PlanetView. */
  planet: Planet;
  /** The seeded state the planet belongs to (PlanetView reads continents from it). */
  game: GameState;
}

/**
 * Enumerate every biome from CONTENT and pair each with a REAL planet that renders
 * it. We never fork PlanetView or hand-author per-biome props: we take the seeded
 * world's richest real planet (the cradle — scanned, with continents/cities) as the
 * template and re-tint a clone to each biome. So the gallery shows exactly the
 * product's PlanetView treatment (scanned LOD, biome tint via palette, surface
 * detail) for every authored biome, with zero per-artifact wiring. New biomes in
 * content appear here automatically.
 */
export function biomeGallery(seed = 0): BiomeSpecimen[] {
  const game = previewState(seed);
  const template = game.planets[game.cradlePlanetId];
  if (!template) return [];
  return listBiomes().map((biome) => {
    // A scanned specimen so the real PlanetView shows the biome's full treatment.
    const planet: Planet = {
      ...template,
      id: `specimen:${biome.id}`,
      name: biome.name,
      biome: biome.id,
      scanned: true,
      settled: template.settled,
    };
    // Register the specimen in a per-biome state clone so PlanetView's lookups
    // (continents/cities by id) resolve against real records, not undefined.
    const specimenGame: GameState = {
      ...game,
      planets: { ...game.planets, [planet.id]: planet },
    };
    return { biome, planet, game: specimenGame };
  });
}
