import { RESOURCE_IDS, getContentPack, type ResourceId } from "@meteor/shared";
import type { City, Continent, GameState, Planet, StarSystem } from "@meteor/shared";
import type { GalaxyConfig } from "@meteor/shared";
import { createRng, type Rng } from "./rng.js";

/** Zeroed resource record. */
export function zeroResources(): Record<ResourceId, number> {
  return Object.fromEntries(RESOURCE_IDS.map((r) => [r, 0])) as Record<ResourceId, number>;
}

/**
 * [slice 2] Galaxy-generation defaults. Content may supply `galaxy` on the pack
 * (GalaxyConfigSchema); when absent these sane values apply so the slice-1 base
 * stays green. ~7 systems keeps the map readable; radius/minSeparation scatter
 * deterministically without overlap.
 */
export const DEFAULT_GALAXY: GalaxyConfig = {
  systemCount: 7,
  radius: 260,
  minSeparation: 45,
};

/** Resolve the galaxy config from content, falling back to {@link DEFAULT_GALAXY}. */
export function galaxyConfig(): GalaxyConfig {
  return getContentPack().galaxy ?? DEFAULT_GALAXY;
}

/** All biomes the worldgen can assign to scattered planets (kept stable + small). */
const SCATTER_BIOMES: Planet["biome"][] = ["rock", "ice", "water", "sand"];

/**
 * Deterministically place one additional system in galaxy space, rejecting
 * positions that fall within `minSeparation` of any already-placed system. Pure:
 * draws only from the supplied forked RNG. Falls back to the last candidate after a
 * bounded number of attempts so generation always terminates.
 */
function scatterPosition(
  rng: Rng,
  radius: number,
  minSeparation: number,
  placed: StarSystem["position"][],
): StarSystem["position"] {
  let candidate: StarSystem["position"] = { x: 0, y: 0, z: 0 };
  for (let attempt = 0; attempt < 32; attempt++) {
    // Sample within a sphere of `radius` (galaxy is a thin disc → small y spread).
    const r = radius * Math.cbrt(rng.next());
    const theta = rng.range(0, Math.PI * 2);
    candidate = {
      x: r * Math.cos(theta),
      y: rng.range(-radius * 0.12, radius * 0.12),
      z: r * Math.sin(theta),
    };
    const ok = placed.every(
      (p) => Math.hypot(candidate.x - p.x, candidate.y - p.y, candidate.z - p.z) >= minSeparation,
    );
    if (ok) return candidate;
  }
  return candidate;
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
    defense: 0,
  };

  systems["sys-home"] = {
    id: "sys-home",
    name: "Sol Cradle",
    position: { x: 0, y: 0, z: 0 },
    distanceFromHome: 0,
    planetIds: [cradleId],
    discovered: true,
    policy: "minerals",
    defense: 0,
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
      defense: 0,
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
    policy: "minerals",
    defense: 0,
  };

  // ── A second GUARANTEED-near system, so every seed is winnable via the OBVIOUS path ──
  // Without this, only Vega (cradle + 2 planets = 3 worlds) is reliably reachable with the
  // ungated tech (deep sensors ~130 + warp range ~190); the 4th world for victory then
  // depended on a random scatter landing in reach (≈8% of seeds had none, and most others
  // only via an opaque silicate→long-range-sensor detour). This sits inside that envelope
  // (≤ deep-sensor reach AND ≤ warp range) and well clear of Vega, so settling cradle +
  // Vega's 2 + these reaches the 4-world goal by simply teching sensors+warp and expanding.
  const nearBiomes: Planet["biome"][] = ["sand", "rock"];
  const nearPlanetIds: string[] = [];
  nearBiomes.forEach((biome, idx) => {
    const pid = `planet-frontier-${idx}`;
    planets[pid] = {
      id: pid,
      name: `Frontier Reach ${idx + 1}`,
      systemId: "sys-near",
      biome,
      orbit: { radius: 6 + idx * 4, angle: rng.range(0, Math.PI * 2) },
      continentIds: [],
      scanned: false,
      settled: false,
      policy: "minerals",
      defense: 0,
    };
    nearPlanetIds.push(pid);
  });
  // Opposite side of the disc from Vega (+ seeded jitter) so the two near systems read as
  // distinct places; distance 108–120 keeps it inside the ungated sensor/range envelope.
  const vegaAngle = Math.atan2(20, 90);
  const nearAngle = vegaAngle + Math.PI + rng.range(-0.6, 0.6);
  const nearDist = 108 + rng.range(0, 12);
  const nearPos = { x: Math.cos(nearAngle) * nearDist, y: rng.range(-10, 10), z: Math.sin(nearAngle) * nearDist };
  systems["sys-near"] = {
    id: "sys-near",
    name: "Proxima Reach",
    position: nearPos,
    distanceFromHome: Math.hypot(nearPos.x, nearPos.y, nearPos.z),
    planetIds: nearPlanetIds,
    discovered: false,
    policy: "minerals",
    defense: 0,
  };

  // ── Scatter the rest of the galaxy (deterministic, separation-respecting) ─────
  // Home + the slice-1 neighbor are kept EXACTLY as above so slice-1 progression +
  // tests still hold; we only ADD further systems out in galaxy space. systemCount
  // counts the home system, so we add (systemCount - 1) beyond it. The neighbor is
  // one of those, so any remainder is scattered fresh.
  const cfg = galaxyConfig();
  const galaxyRng = rng.fork(7777);
  const placed: StarSystem["position"][] = [
    systems["sys-home"].position,
    systems["sys-neighbor"].position,
    systems["sys-near"].position,
  ];
  // -3: home, the slice-1 neighbor, and the guaranteed near system already exist
  // among the systemCount budget; scatter the remainder freely.
  const extraCount = Math.max(0, cfg.systemCount - 3);
  for (let i = 0; i < extraCount; i++) {
    const sysId = `sys-${i}`;
    const sysRng = galaxyRng.fork(i + 1);
    const position = scatterPosition(sysRng, cfg.radius, cfg.minSeparation, placed);
    placed.push(position);
    const distanceFromHome = Math.hypot(position.x, position.y, position.z);

    // 1–2 planets per scattered system, each with a deterministic biome + orbit.
    const planetCount = 1 + sysRng.int(2);
    const planetIds: string[] = [];
    for (let p = 0; p < planetCount; p++) {
      const pid = `planet-${i}-${p}`;
      planets[pid] = {
        id: pid,
        name: `Frontier ${i + 1}-${p + 1}`,
        systemId: sysId,
        biome: sysRng.pick(SCATTER_BIOMES),
        orbit: { radius: 5 + p * 4, angle: sysRng.range(0, Math.PI * 2) },
        continentIds: [],
        scanned: false,
        settled: false,
        policy: "minerals",
        defense: 0,
      };
      planetIds.push(pid);
    }

    systems[sysId] = {
      id: sysId,
      name: `Frontier ${i + 1}`,
      position,
      distanceFromHome,
      planetIds,
      discovered: false,
      policy: "minerals",
      defense: 0,
    };
  }

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
    empirePolicy: "minerals",
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
    journeys: {},
    objectives: { completed: [], won: false },
    log: [{ tick: 0, message: "The cradle awakens. Build your way to the stars." }],
  };
}
