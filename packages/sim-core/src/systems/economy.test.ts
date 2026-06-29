import { describe, expect, it } from "vitest";
import { createInitialState } from "../worldgen.js";
import { tick, tickN } from "../engine.js";
import { applyCommand } from "../commands.js";
import { categoryMultipliers, effectiveFocus, runEconomy } from "./economy.js";
import { canResearch } from "./research.js";
import type { GameState, ResourceId } from "@meteor/shared";

/** Point every city at `resource` (city-tier focus). */
function focusAll(state: GameState, resource: ResourceId): GameState {
  let s = state;
  for (const id of Object.keys(s.cities)) s = applyCommand(s, { type: "setCityFocus", cityId: id, resource });
  return s;
}

describe("economy: determinism", () => {
  it("same seed ⇒ identical economy evolution", () => {
    const a = tickN(createInitialState(99), 50);
    const b = tickN(createInitialState(99), 50);
    expect(a.stockpiles).toEqual(b.stockpiles);
    expect(a.rates).toEqual(b.rates);
  });
});

describe("economy: settled worlds yield their biome unique resource (explore-to-claim)", () => {
  it("the settled rock cradle produces oremetal from the start", () => {
    const s = tickN(createInitialState(1), 5);
    expect(s.stockpiles.oremetal).toBeGreaterThan(0);
  });

  it("a settled ice world yields cryocrystal; an unsettled one yields none", () => {
    const base = createInitialState(1);
    const ice = Object.values(base.planets).find((p) => p.biome === "ice");
    expect(ice).toBeTruthy();
    // Unsettled → no cryocrystal beyond whatever the cradle (rock) makes (which is 0).
    expect(tickN(createInitialState(1), 5).stockpiles.cryocrystal).toBe(0);
    // Settle it → cryocrystal starts flowing.
    const s = structuredClone(base);
    s.planets[ice!.id]!.settled = true;
    expect(tickN(s, 5).stockpiles.cryocrystal).toBeGreaterThan(0);
  });

  it("breaks the bootstrap deadlock: oremetal from the cradle ungates warp_basics", () => {
    // warp_basics requires oremetal; without the explore-to-claim yield it was unobtainable
    // (you couldn't travel to a rock world to get oremetal). Now the cradle supplies it.
    let s = tickN(createInitialState(1), 10);
    expect(s.stockpiles.oremetal).toBeGreaterThan(0);
    // Unlock the (ungated) propulsion prereqs, then warp_basics must become researchable.
    s = { ...s, research: { ...s.research, unlocked: [...s.research.unlocked, "basic_industry", "power_grid", "refining", "rocketry", "planetary_gov", "federal_admin", "orbital_launch"] } };
    expect(canResearch(s, "warp_basics")).toBe(true);
  });
});

describe("economy: mine → refine consumption", () => {
  it("alloy does NOT produce until refining is unlocked", () => {
    let s = focusAll(createInitialState(1), "alloy");
    s = tickN(s, 10);
    // No refining recipe yet → alloy stays at zero even though cities 'focus' it.
    expect(s.stockpiles.alloy).toBe(0);
  });

  it("once unlocked, refining alloy CONSUMES minerals as it is produced", () => {
    let s = createInitialState(1);
    s.refining = ["alloy"]; // simulate the recipe being unlocked
    s.stockpiles.minerals = 100;
    // City 0 mines minerals, city set to alloy refines from the feedstock.
    const cityIds = Object.keys(s.cities);
    s = applyCommand(s, { type: "setCityFocus", cityId: cityIds[0]!, resource: "alloy" });
    s = applyCommand(s, { type: "setCityFocus", cityId: cityIds[1]!, resource: "alloy" });
    s = applyCommand(s, { type: "setCityFocus", cityId: cityIds[2]!, resource: "minerals" });
    s = applyCommand(s, { type: "setCityFocus", cityId: cityIds[3]!, resource: "minerals" });
    const before = s.stockpiles.minerals;
    s = tick(s);
    expect(s.stockpiles.alloy).toBeGreaterThan(0);
    // Net minerals change accounts for both mining (+) and refining consumption (−).
    expect(s.rates.alloy).toBeGreaterThan(0);
    // Alloy produced must have consumed minerals: the alloy gain should be reflected
    // as a minerals draw — verify mass balance against the gross rates.
    expect(s.stockpiles.minerals).not.toBe(before + s.rates.minerals); // refining altered the raw flow
  });

  it("refining is feedstock-limited: no minerals ⇒ no alloy", () => {
    let s = createInitialState(2);
    s.refining = ["alloy"];
    s.stockpiles.minerals = 0;
    const cityIds = Object.keys(s.cities);
    for (const id of cityIds) s = applyCommand(s, { type: "setCityFocus", cityId: id, resource: "alloy" });
    s = tick(s);
    // With zero feedstock and zero mineral production this tick, alloy can't form.
    expect(s.stockpiles.alloy).toBe(0);
  });
});

describe("economy: governor aggregation (signature mechanic)", () => {
  it("at city tier each city follows its OWN focus", () => {
    const s = createInitialState(3);
    s.authorityTier = "city";
    const ids = Object.keys(s.cities);
    s.cities[ids[0]!]!.focus = "minerals";
    s.continents[s.cities[ids[0]!]!.continentId]!.policy = "research";
    expect(effectiveFocus(s, ids[0]!)).toBe("minerals");
  });

  it("raising authority to continent makes cities follow continent policy", () => {
    const s = createInitialState(3);
    const ids = Object.keys(s.cities);
    const city = s.cities[ids[0]!]!;
    city.focus = "minerals";
    s.continents[city.continentId]!.policy = "research";
    s.authorityTier = "continent";
    expect(effectiveFocus(s, ids[0]!)).toBe("research");
  });

  it("raising authority to planet makes cities follow planet policy", () => {
    const s = createInitialState(3);
    const ids = Object.keys(s.cities);
    const city = s.cities[ids[0]!]!;
    city.focus = "minerals";
    s.continents[city.continentId]!.policy = "research";
    s.planets[s.continents[city.continentId]!.planetId]!.policy = "energy";
    s.authorityTier = "planet";
    expect(effectiveFocus(s, ids[0]!)).toBe("energy");
  });

  it("aggregation actually CHANGES outputs when authority rises", () => {
    // City tier: cities follow their own (mixed) foci.
    const base = createInitialState(5);
    for (const c of Object.values(base.cities)) c.focus = "minerals";
    // Set continent policies to research so a promotion redirects all output.
    for (const cont of Object.values(base.continents)) cont.policy = "research";

    const cityState = structuredClone(base);
    cityState.authorityTier = "city";
    runEconomy(cityState);

    const contState = structuredClone(base);
    contState.authorityTier = "continent";
    runEconomy(contState);

    // At city tier all output is minerals; at continent tier governors redirect to research.
    expect(cityState.rates.minerals).toBeGreaterThan(0);
    expect(cityState.rates.research).toBe(0);
    expect(contState.rates.research).toBeGreaterThan(0);
    expect(contState.rates.minerals).toBe(0);
  });
});

describe("economy: top-of-ladder aggregation (slice 2)", () => {
  it("at system tier each city follows its SYSTEM's policy", () => {
    const s = createInitialState(3);
    const ids = Object.keys(s.cities);
    const city = s.cities[ids[0]!]!;
    city.focus = "minerals";
    s.continents[city.continentId]!.policy = "minerals";
    s.planets[s.continents[city.continentId]!.planetId]!.policy = "minerals";
    s.systems["sys-home"]!.policy = "research"; // system overrides everything below it
    s.authorityTier = "system";
    expect(effectiveFocus(s, ids[0]!)).toBe("research");
  });

  it("at galaxy tier every city follows the EMPIRE policy", () => {
    const s = createInitialState(3);
    const ids = Object.keys(s.cities);
    s.systems["sys-home"]!.policy = "research";
    s.empirePolicy = "energy"; // empire overrides the system
    s.authorityTier = "galaxy";
    expect(effectiveFocus(s, ids[0]!)).toBe("energy");
  });

  it("system/galaxy aggregation CHANGES outputs vs planet tier", () => {
    const base = createInitialState(5);
    for (const c of Object.values(base.cities)) c.focus = "minerals";
    for (const p of Object.values(base.planets)) p.policy = "minerals";
    for (const sys of Object.values(base.systems)) sys.policy = "research";
    base.empirePolicy = "energy";

    const planetState = structuredClone(base);
    planetState.authorityTier = "planet";
    runEconomy(planetState);

    const systemState = structuredClone(base);
    systemState.authorityTier = "system";
    runEconomy(systemState);

    const galaxyState = structuredClone(base);
    galaxyState.authorityTier = "galaxy";
    runEconomy(galaxyState);

    expect(planetState.rates.minerals).toBeGreaterThan(0);
    expect(systemState.rates.research).toBeGreaterThan(0);
    expect(systemState.rates.minerals).toBe(0);
    expect(galaxyState.rates.energy).toBeGreaterThan(0);
    expect(galaxyState.rates.research).toBe(0);
  });

  it("falls back gracefully when a higher-tier policy field is undefined", () => {
    const s = createInitialState(3);
    const ids = Object.keys(s.cities);
    const city = s.cities[ids[0]!]!;
    city.focus = "minerals";
    s.continents[city.continentId]!.policy = "energy";
    s.planets[s.continents[city.continentId]!.planetId]!.policy = "research";
    // system tier but no system policy set → falls back to planet policy.
    delete s.systems["sys-home"]!.policy;
    s.authorityTier = "system";
    expect(effectiveFocus(s, ids[0]!)).toBe("research");
    // galaxy tier but no empirePolicy set → falls back to system (undefined) → planet.
    delete s.empirePolicy;
    s.authorityTier = "galaxy";
    expect(effectiveFocus(s, ids[0]!)).toBe("research");
  });
});

describe("economy: category multipliers", () => {
  it("unlocked production multiplier tech boosts its category", () => {
    const s = createInitialState(7);
    const baseline = categoryMultipliers(s).materials ?? 1;
    s.research.unlocked.push("basic_industry"); // ×1.5 materials
    const boosted = categoryMultipliers(s).materials ?? 1;
    expect(boosted).toBeCloseTo(baseline * 1.5, 5);
  });

  it("settled biome spiff multiplies its category", () => {
    const s = createInitialState(7);
    // Cradle is rock (propulsion spiff ×1.5) and already settled.
    expect(categoryMultipliers(s).propulsion ?? 1).toBeGreaterThanOrEqual(1.5);
  });
});
