import { describe, expect, it } from "vitest";
import { createInitialState } from "../worldgen.js";
import { applyCommand } from "../commands.js";
import { canResearch, findTech, reevaluateTierPromotion, applyTechEffects } from "./research.js";
import { territoryAllowsTier } from "./tiers.js";
import type { GameState } from "@meteor/shared";

describe("research: gating", () => {
  it("blocks tech whose prereqs are unmet", () => {
    const s = createInitialState(1);
    expect(canResearch(s, "refining")).toBe(false); // needs basic_industry
    s.research.unlocked.push("basic_industry");
    expect(canResearch(s, "refining")).toBe(true);
  });

  it("biome-gated tech needs its required resource AVAILABLE", () => {
    const s = createInitialState(1);
    // fusion prereqs: power_grid + refining (both via basic_industry).
    s.research.unlocked.push("basic_industry", "refining", "power_grid");
    // fusion requires cryocrystal (an ice-world resource not yet claimed).
    expect(findTech("fusion")!.requiredResource).toBe("cryocrystal");
    expect(canResearch(s, "fusion")).toBe(false);
    s.stockpiles.cryocrystal = 5;
    expect(canResearch(s, "fusion")).toBe(true);
  });

  it("already-unlocked tech cannot be re-researched", () => {
    const s = createInitialState(1);
    s.research.unlocked.push("basic_industry");
    expect(canResearch(s, "basic_industry")).toBe(false);
  });
});

describe("tiers: promotion requires BOTH tech AND territory", () => {
  /** Give the empire the continent-tier tech without satisfying territory. */
  function withFederalAdmin(s: GameState): GameState {
    s.research.unlocked.push("basic_industry", "federal_admin");
    return s;
  }

  it("continent tier needs the tech AND >=3 cities", () => {
    const s = createInitialState(1);
    // Worldgen makes 4 cities, so territory is already satisfied here; strip it down.
    for (const id of Object.keys(s.cities).slice(2)) delete s.cities[id];
    expect(Object.values(s.cities).length).toBe(2);
    withFederalAdmin(s);
    expect(territoryAllowsTier(s, "continent")).toBe(false);
    reevaluateTierPromotion(s);
    expect(s.authorityTier).toBe("city"); // tech alone is not enough
  });

  it("territory alone (no tech) does not promote", () => {
    const s = createInitialState(1); // 4 cities ⇒ territory ok for continent
    expect(territoryAllowsTier(s, "continent")).toBe(true);
    reevaluateTierPromotion(s); // no federal_admin unlocked
    expect(s.authorityTier).toBe("city");
  });

  it("tech + territory together promote to continent", () => {
    const s = createInitialState(1); // 4 cities
    withFederalAdmin(s);
    reevaluateTierPromotion(s);
    expect(s.authorityTier).toBe("continent");
  });

  it("applyTechEffects pends promotion when territory is short, then promotes on growth", () => {
    const s = createInitialState(1);
    for (const id of Object.keys(s.cities).slice(1)) delete s.cities[id]; // 1 city
    s.research.unlocked.push("basic_industry", "federal_admin");
    applyTechEffects(s, findTech("federal_admin")!);
    expect(s.authorityTier).toBe("city"); // pended
    // Grow territory: add cities back, then re-evaluate.
    s.cities["c-a"] = { id: "c-a", name: "A", continentId: "cont-0", focus: "minerals", productivity: 1 };
    s.cities["c-b"] = { id: "c-b", name: "B", continentId: "cont-0", focus: "minerals", productivity: 1 };
    s.cities["c-c"] = { id: "c-c", name: "C", continentId: "cont-0", focus: "minerals", productivity: 1 };
    reevaluateTierPromotion(s);
    expect(s.authorityTier).toBe("continent");
  });
});

describe("research: settling re-checks promotion (territory growth)", () => {
  it("settling a planet triggers reevaluateTierPromotion via the settle command", () => {
    let s = createInitialState(1);
    // Unlock system-tier tech chain (administration ladder).
    s.research.unlocked.push("basic_industry", "federal_admin", "planetary_gov", "system_command");
    s.authorityTier = "planet";
    // Make the neighbor reachable + scanned so settle succeeds.
    s.orbitalLaunched = true;
    s.maxRange = s.systems["sys-neighbor"]!.distanceFromHome + 10;
    s.planets["planet-neighbor-0"]!.scanned = true;
    s.planets["planet-neighbor-0"]!.settled = false;
    // Need 2 settled planets for system tier; cradle is 1, settle neighbor → 2.
    s = applyCommand(s, { type: "settlePlanet", planetId: "planet-neighbor-0" });
    expect(s.planets["planet-neighbor-0"]!.settled).toBe(true);
    expect(territoryAllowsTier(s, "system")).toBe(true);
    expect(s.authorityTier).toBe("system");
  });
});
