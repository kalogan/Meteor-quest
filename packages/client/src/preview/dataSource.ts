import { getContentPack, type Biome, type TechNode } from "@meteor/shared";
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
