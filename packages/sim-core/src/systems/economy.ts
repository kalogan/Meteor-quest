import { getContentPack, type ResourceId, type TechCategory } from "@meteor/shared";
import type { GameState } from "@meteor/shared";
import { TICK_SECONDS } from "../clock.js";
import { zeroResources } from "../worldgen.js";

/**
 * Economy: a mine→refine layer over the signature authority-aggregation. Cities
 * mine/produce a focus resource; the focus a city ACTUALLY follows depends on who
 * holds authority (governors take over the lower tiers as the player zooms up —
 * see {@link effectiveFocus}). Refined resources (e.g. alloy) only produce once the
 * player has unlocked their recipe, and consume their raw input as they're made.
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

/** raw → 1 unit consumed per 1 unit produced (mine→refine chain), from content. */
function refinedInputOf(resource: ResourceId): ResourceId | undefined {
  const def = getContentPack().resources.find((r) => r.id === resource);
  return def?.kind === "refined" ? def.refinedFrom : undefined;
}

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

/**
 * The resource a city actually produces, given who holds authority. THIS is the
 * signature aggregation: as authority rises, governors at higher tiers override the
 * city's own focus with their aggregate policy.
 *  - city tier      → city follows its own `focus`
 *  - continent tier → city follows its continent's `policy`
 *  - planet+        → city follows its planet's `policy`
 */
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

/**
 * Recompute per-tick rates and accrue them into stockpiles for ONE tick.
 *
 * Refined resources (kind: "refined") only produce once their recipe is unlocked
 * (state.refining). When produced, they consume an equal amount of their raw input
 * — so a city set to "alloy" without unlocked refining (or without minerals to feed
 * it) produces nothing. The mine→refine chain is therefore a real material flow.
 */
export function runEconomy(state: GameState): void {
  const mult = categoryMultipliers(state);
  const rates = zeroResources();

  // 1. Gross production demand per resource (before refine gating/feedstock limits).
  for (const city of Object.values(state.cities)) {
    const res = effectiveFocus(state, city.id);
    const m = mult[CATEGORY_OF_RESOURCE[res]] ?? 1;
    rates[res] += city.productivity * m;
  }

  // 2. Refined resources: gate on unlocked recipe + available raw feedstock.
  //    Consume the raw input (minerals → alloy) as they're refined.
  for (const r of Object.keys(rates) as ResourceId[]) {
    const input = refinedInputOf(r);
    if (!input) continue; // raw/abstract: produced directly.
    if (rates[r] <= 0) continue;
    if (!state.refining.includes(r)) {
      rates[r] = 0; // recipe not unlocked yet.
      continue;
    }
    // Feedstock available this tick = current stockpile + this tick's gross input rate.
    const inputAvailablePerSec = state.stockpiles[input] / TICK_SECONDS + rates[input];
    const refined = Math.min(rates[r], Math.max(0, inputAvailablePerSec));
    rates[r] = refined;
    rates[input] -= refined; // raw is consumed by refining (net rate can go negative).
  }

  state.rates = rates;
  for (const r of Object.keys(rates) as ResourceId[]) {
    state.stockpiles[r] = Math.max(0, state.stockpiles[r] + rates[r] * TICK_SECONDS);
  }
}
