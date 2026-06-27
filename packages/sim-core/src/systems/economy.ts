import { getContentPack, type ResourceId, type TechCategory } from "@meteor/shared";
import type { GameState } from "@meteor/shared";
import { TICK_SECONDS } from "../clock.js";
import { zeroResources } from "../worldgen.js";

/**
 * MINIMAL economy (slice scaffold — builder #2 deepens: refining chains, storage
 * caps, logistics). Demonstrates the signature aggregation: which "focus" a city
 * actually follows depends on the player's authority tier (governors take over the
 * lower tiers as you zoom up).
 */

const CATEGORY_OF_RESOURCE: Record<ResourceId, TechCategory> = {
  minerals: "materials",
  alloy: "materials",
  silicate: "materials",
  oremetal: "propulsion",
  energy: "energy",
  cryocrystal: "energy",
  fuel: "propulsion",
  biogel: "biotech",
  research: "administration",
};

/** Product of all unlocked production multipliers + settled biome spiffs, per category. */
export function categoryMultipliers(state: GameState): Record<TechCategory, number> {
  const pack = getContentPack();
  const mult: Record<string, number> = {};
  for (const node of pack.tech) {
    if (!state.research.unlocked.includes(node.id)) continue;
    for (const eff of node.effects) {
      if (eff.kind === "productionMultiplier") mult[eff.category] = (mult[eff.category] ?? 1) * eff.factor;
    }
  }
  for (const planet of Object.values(state.planets)) {
    if (!planet.settled) continue;
    const biome = pack.biomes.find((b) => b.id === planet.biome);
    if (biome) mult[biome.spiff.category] = (mult[biome.spiff.category] ?? 1) * biome.spiff.multiplier;
  }
  return mult as Record<TechCategory, number>;
}

/** The resource a city actually produces, given who holds authority (governor logic). */
export function effectiveFocus(state: GameState, cityId: string): ResourceId {
  const city = state.cities[cityId];
  if (!city) return "minerals";
  const rank = ["city", "continent", "planet", "system", "galaxy"].indexOf(state.authorityTier);
  if (rank >= 2) {
    const planet = state.planets[state.continents[city.continentId]?.planetId ?? ""];
    if (planet) return planet.policy;
  }
  if (rank >= 1) return state.continents[city.continentId]?.policy ?? city.focus;
  return city.focus;
}

/** Recompute per-tick rates and accrue them into stockpiles for ONE tick. */
export function runEconomy(state: GameState): void {
  const mult = categoryMultipliers(state);
  const rates = zeroResources();
  for (const city of Object.values(state.cities)) {
    const res = effectiveFocus(state, city.id);
    const m = mult[CATEGORY_OF_RESOURCE[res]] ?? 1;
    rates[res] += city.productivity * m;
  }
  state.rates = rates;
  for (const r of Object.keys(rates) as ResourceId[]) {
    state.stockpiles[r] += rates[r] * TICK_SECONDS;
  }
}
