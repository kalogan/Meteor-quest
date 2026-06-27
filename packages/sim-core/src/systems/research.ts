import { getContentPack, tierRank, RESOURCE_IDS, type ResourceId, type TierId } from "@meteor/shared";
import type { City, GameState, TechNode } from "@meteor/shared";
import { TICK_SECONDS } from "../clock.js";
import { territoryAllowsTier } from "./tiers.js";
import { effectiveFocus } from "./economy.js";

/**
 * MINIMAL research (slice scaffold — builder #2/#3 deepen). Research points accrue
 * from `rates.research`; on completion the node's effects are applied. Tier-unlock
 * effects only promote authority when the TERRITORY threshold is also met
 * (tech AND territory — see tiers.ts).
 */
export function findTech(id: string): TechNode | undefined {
  return getContentPack().tech.find((t) => t.id === id);
}

/** Can research on `techId` begin? (prereqs met + biome-gated resource available). */
export function canResearch(state: GameState, techId: string): boolean {
  const node = findTech(techId);
  if (!node) return false;
  if (state.research.unlocked.includes(techId)) return false;
  if (!node.prereqs.every((p) => state.research.unlocked.includes(p))) return false;
  if (node.requiredResource && (state.stockpiles[node.requiredResource] ?? 0) <= 0) return false;
  return true;
}

export function applyTechEffects(state: GameState, node: TechNode): void {
  for (const eff of node.effects) {
    switch (eff.kind) {
      case "unlockRefining":
        if (!state.refining.includes(eff.resource)) state.refining.push(eff.resource);
        break;
      case "shipRange":
        state.maxRange += eff.delta;
        break;
      case "sensorRange":
        state.sensorRange += eff.delta;
        break;
      case "orbitalLaunch":
        state.orbitalLaunched = true;
        break;
      case "unlockTier":
        if (territoryAllowsTier(state, eff.tier) && tierRank(eff.tier) > tierRank(state.authorityTier)) {
          promoteTo(state, eff.tier);
        } else {
          // Tech unlocked but territory not yet sufficient; promotion pends (re-checked on growth).
          state.log.push({ tick: state.tick, message: `${node.name} researched — ${eff.tier} governance ready when territory grows.` });
        }
        break;
      case "productionMultiplier":
        // Derived in economy from unlocked tech; no state to set here.
        break;
    }
  }
}

/**
 * The resource a governor should adopt when it first takes over a tier: the most common
 * focus its cities were already producing, with ties broken toward `research` (progression-
 * friendly). Empty input → research.
 */
function dominantFocus(focuses: ResourceId[]): ResourceId {
  const count = new Map<ResourceId, number>();
  for (const f of focuses) count.set(f, (count.get(f) ?? 0) + 1);
  const order: ResourceId[] = ["research", ...RESOURCE_IDS.filter((r) => r !== "research")];
  let best: ResourceId = "research";
  let bestN = -1;
  for (const r of order) {
    const n = count.get(r) ?? 0;
    if (n > bestN) { bestN = n; best = r; }
  }
  return best;
}

/**
 * When authority promotes to `tier`, the governor at that tier takes over production from
 * the cities (see economy.effectiveFocus). Seed its policy from what those cities were
 * ALREADY producing (captured in `focusByCity`, pre-promotion), so production continues
 * seamlessly instead of snapping to the worldgen default and silently flat-lining research.
 * The player can still change the governor policy afterward.
 */
function seedGovernorOnPromotion(state: GameState, tier: TierId, focusByCity: Record<string, ResourceId>): void {
  const focusesWhere = (pred: (c: City) => boolean): ResourceId[] =>
    Object.values(state.cities).filter(pred).map((c) => focusByCity[c.id]).filter((f): f is ResourceId => Boolean(f));
  const planetOf = (c: City) => {
    const cont = state.continents[c.continentId];
    return cont ? state.planets[cont.planetId] : undefined;
  };
  if (tier === "continent") {
    for (const cont of Object.values(state.continents)) {
      const fs = cont.cityIds.map((id) => focusByCity[id]).filter((f): f is ResourceId => Boolean(f));
      if (fs.length) cont.policy = dominantFocus(fs);
    }
  } else if (tier === "planet") {
    for (const planet of Object.values(state.planets)) {
      const fs = focusesWhere((c) => planetOf(c)?.id === planet.id);
      if (fs.length) planet.policy = dominantFocus(fs);
    }
  } else if (tier === "system") {
    for (const sys of Object.values(state.systems)) {
      const fs = focusesWhere((c) => planetOf(c)?.systemId === sys.id);
      if (fs.length) sys.policy = dominantFocus(fs);
    }
  } else if (tier === "galaxy") {
    const fs = Object.values(state.cities).map((c) => focusByCity[c.id]).filter((f): f is ResourceId => Boolean(f));
    if (fs.length) state.empirePolicy = dominantFocus(fs);
  }
}

/**
 * Promote authority to `tier`: capture what each city is producing UNDER THE OLD TIER, set
 * the new tier, then seed the new governor from that focus so production continues seamlessly
 * (no silent research flat-line). The SINGLE promotion path — both tech-completion
 * (applyTechEffects) and territory-growth (reevaluateTierPromotion) route through here.
 */
function promoteTo(state: GameState, tier: TierId): void {
  const focusByCity: Record<string, ResourceId> = {};
  for (const c of Object.values(state.cities)) focusByCity[c.id] = effectiveFocus(state, c.id);
  state.authorityTier = tier;
  seedGovernorOnPromotion(state, tier, focusByCity);
  state.log.push({ tick: state.tick, message: `Authority expanded to ${tier} tier.` });
}

/** Re-check pending tier promotions after territory changes (e.g. settling a planet). */
export function reevaluateTierPromotion(state: GameState): void {
  const pack = getContentPack();
  const ladder: TierId[] = ["continent", "planet", "system", "galaxy"];
  for (const tier of ladder) {
    const techUnlocked = pack.tech.some(
      (t) => state.research.unlocked.includes(t.id) && t.effects.some((e) => e.kind === "unlockTier" && e.tier === tier),
    );
    if (techUnlocked && territoryAllowsTier(state, tier) && tierRank(tier) > tierRank(state.authorityTier)) {
      promoteTo(state, tier);
    }
  }
}

export function runResearch(state: GameState): void {
  const id = state.research.current;
  if (!id) return;
  const node = findTech(id);
  if (!node) {
    state.research.current = null;
    return;
  }
  state.research.progress += (state.rates.research ?? 0) * TICK_SECONDS;
  if (state.research.progress >= node.cost) {
    state.research.unlocked.push(node.id);
    applyTechEffects(state, node);
    state.research.current = null;
    state.research.progress = 0;
    state.log.push({ tick: state.tick, message: `Researched ${node.name}.` });
  }
}
