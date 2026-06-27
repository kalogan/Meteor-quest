import { getContentPack, tierRank, type TierId } from "@meteor/shared";
import type { GameState, TechNode } from "@meteor/shared";
import { TICK_SECONDS } from "../clock.js";
import { territoryAllowsTier } from "./tiers.js";

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
          state.authorityTier = eff.tier;
          state.log.push({ tick: state.tick, message: `Authority expanded to ${eff.tier} tier.` });
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

/** Re-check pending tier promotions after territory changes (e.g. settling a planet). */
export function reevaluateTierPromotion(state: GameState): void {
  const pack = getContentPack();
  const ladder: TierId[] = ["continent", "planet", "system", "galaxy"];
  for (const tier of ladder) {
    const techUnlocked = pack.tech.some(
      (t) => state.research.unlocked.includes(t.id) && t.effects.some((e) => e.kind === "unlockTier" && e.tier === tier),
    );
    if (techUnlocked && territoryAllowsTier(state, tier) && tierRank(tier) > tierRank(state.authorityTier)) {
      state.authorityTier = tier;
      state.log.push({ tick: state.tick, message: `Authority expanded to ${tier} tier.` });
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
