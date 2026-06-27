import { RESOURCE_IDS, type ResourceId } from "@meteor/shared";
import type { City, Continent, GameState, Planet, StarSystem } from "@meteor/shared";
import { createRng } from "./rng.js";

/** Zeroed resource record. */
export function zeroResources(): Record<ResourceId, number> {
  return Object.fromEntries(RESOURCE_IDS.map((r) => [r, 0])) as Record<ResourceId, number>;
}

/**
 * Deterministic worldgen for the slice: a home system with the cradle planet
 * (continents + cities) plus ONE neighbor system gated behind ship range/sensors.
 * Builders may extend this (more planets, richer cities) — keep it pure + seeded.
 */
export function createInitialState(seed: number): GameState {
  const rng = createRng(seed);

  const cities: Record<string, City> = {};
  const continents: Record<string, Continent> = {};
  const planets: Record<string, Planet> = {};
  const systems: Record<string, StarSystem> = {};

  // ── Home system + cradle planet ───────────────────────────────────────────
  const cradleId = "planet-cradle";
  const homeContinents: string[] = [];
  for (let c = 0; c < 2; c++) {
    const contId = `cont-${c}`;
    const cityIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const cityId = `city-${c}-${i}`;
      cities[cityId] = {
        id: cityId,
        name: `Settlement ${c + 1}-${i + 1}`,
        continentId: contId,
        focus: i === 0 ? "minerals" : "research",
        productivity: 1 + rng.next() * 0.5,
      };
      cityIds.push(cityId);
    }
    continents[contId] = {
      id: contId,
      name: `Continent ${c + 1}`,
      planetId: cradleId,
      cityIds,
      policy: "minerals",
    };
    homeContinents.push(contId);
  }

  planets[cradleId] = {
    id: cradleId,
    name: "Terra Prima",
    systemId: "sys-home",
    biome: "rock",
    orbit: { radius: 8, angle: rng.range(0, Math.PI * 2) },
    continentIds: homeContinents,
    scanned: true,
    settled: true,
    policy: "minerals",
  };

  systems["sys-home"] = {
    id: "sys-home",
    name: "Sol Cradle",
    position: { x: 0, y: 0, z: 0 },
    distanceFromHome: 0,
    planetIds: [cradleId],
    discovered: true,
  };

  // ── One neighbor system (hidden until sensors/range reach it) ──────────────
  const neighborBiomes: Planet["biome"][] = ["ice", "water"];
  const neighborPlanetIds: string[] = [];
  neighborBiomes.forEach((biome, idx) => {
    const pid = `planet-neighbor-${idx}`;
    planets[pid] = {
      id: pid,
      name: `Neighbor ${idx + 1}`,
      systemId: "sys-neighbor",
      biome,
      orbit: { radius: 6 + idx * 4, angle: rng.range(0, Math.PI * 2) },
      continentIds: [],
      scanned: false,
      settled: false,
      policy: "minerals",
    };
    neighborPlanetIds.push(pid);
  });
  systems["sys-neighbor"] = {
    id: "sys-neighbor",
    name: "Vega Reach",
    position: { x: 90, y: 0, z: 20 },
    distanceFromHome: Math.hypot(90, 0, 20),
    planetIds: neighborPlanetIds,
    discovered: false,
  };

  const stockpiles = zeroResources();
  stockpiles.minerals = 25;
  stockpiles.energy = 25;

  return {
    seed,
    tick: 0,
    timeScale: 1,
    stockpiles,
    rates: zeroResources(),
    research: { unlocked: [], current: null, progress: 0 },
    refining: [],
    authorityTier: "city",
    maxRange: 0,
    sensorRange: 30,
    orbitalLaunched: false,
    homeSystemId: "sys-home",
    cradlePlanetId: cradleId,
    systems,
    planets,
    continents,
    cities,
    events: [],
    log: [{ tick: 0, message: "The cradle awakens. Build your way to the stars." }],
  };
}
