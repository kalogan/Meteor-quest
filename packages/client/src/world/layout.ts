import type { TierId } from "@meteor/shared";
import type { GameState, Planet, StarSystem } from "@meteor/shared";

/**
 * Spatial layout + the continuous-zoom scale model. This file is the bridge from
 * authoritative sim data (orbits, galaxy positions) to deterministic 3D positions,
 * and from "camera distance to target" to an authority/zoom TIER.
 *
 * One continuous space: galaxy-space holds systems; each system holds its planets
 * on orbits; each planet holds its continents/cities on its surface. The camera
 * never teleports between scenes — it dollies along one axis and the active TIER
 * is read off the distance.
 */

/** Galaxy-space scale factor: sim positions are large; shrink to a comfy stage. */
export const GALAXY_SCALE = 0.18;

/** Planet display radius (scene units) — cradle is rendered a touch larger. */
export const PLANET_RADIUS = 1.4;
export const CRADLE_RADIUS = 1.9;

export function planetRadius(planet: Planet, isCradle: boolean): number {
  return isCradle ? CRADLE_RADIUS : PLANET_RADIUS;
}

/** World position of a system in galaxy space. */
export function systemPosition(sys: StarSystem): [number, number, number] {
  return [sys.position.x * GALAXY_SCALE, sys.position.y * GALAXY_SCALE, sys.position.z * GALAXY_SCALE];
}

/** World position of a planet relative to its star, from its deterministic orbit. */
export function planetOffset(planet: Planet): [number, number, number] {
  const r = planet.orbit.radius;
  const a = planet.orbit.angle;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

/**
 * The zoom ladder: camera distance (to its focus target) maps to an authority
 * TIER. Ordered far -> near. The rig frames a target then settles at one of these
 * distances; while the player dollies freely, we read the nearest band as the
 * active zoomTier and push it to the selection store.
 */
export interface ZoomBand {
  tier: TierId;
  /** Camera-to-target distance the rig settles at when framing this tier. */
  distance: number;
}

export const ZOOM_BANDS: ZoomBand[] = [
  { tier: "galaxy", distance: 120 },
  { tier: "system", distance: 34 },
  { tier: "planet", distance: 8 },
  { tier: "continent", distance: 3.6 },
  { tier: "city", distance: 1.7 },
];

/** Classify a live camera distance into the closest zoom tier. */
export function tierForDistance(distance: number): TierId {
  let bestTier: TierId = "planet";
  let bestDelta = Infinity;
  for (const band of ZOOM_BANDS) {
    const delta = Math.abs(Math.log(distance) - Math.log(band.distance));
    if (delta < bestDelta) {
      bestTier = band.tier;
      bestDelta = delta;
    }
  }
  return bestTier;
}

/** The settle distance the rig uses when framing a given entity kind. */
export function framingDistance(kind: "system" | "planet" | "continent" | "city"): number {
  const band = ZOOM_BANDS.find((b) => b.tier === kind);
  return band ? band.distance : 8;
}

/** Golden-spiral unit-sphere point (mirrors PlanetView's continent/city layout). */
function spherePoint(i: number, total: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / Math.max(1, total - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

/**
 * Resolve any selected entity (system/planet/continent/city) to a single world
 * position the camera can frame — walking up the sim graph from the entity to its
 * planet, system, and galaxy-space anchor, summing the same offsets the renderers
 * use. Returns null if the selection can't be located (e.g. fogged / missing).
 */
export function resolveWorldPosition(
  game: GameState,
  id: string,
  kind: "system" | "planet" | "continent" | "city",
): [number, number, number] | null {
  if (kind === "system") {
    const s = game.systems[id];
    return s && s.discovered ? systemPosition(s) : null;
  }

  // Find the planet at the root of continent/city/planet selections.
  let planet: Planet | undefined;
  let surfaceLocal: [number, number, number] = [0, 0, 0];

  if (kind === "planet") {
    planet = game.planets[id];
  } else if (kind === "continent") {
    const cont = game.continents[id];
    planet = cont ? game.planets[cont.planetId] : undefined;
    if (planet && cont) {
      const idx = planet.continentIds.indexOf(cont.id);
      const total = Math.max(2, planet.continentIds.length);
      const [nx, ny, nz] = spherePoint(Math.max(0, idx), total);
      const r = planetRadius(planet, planet.id === game.cradlePlanetId);
      surfaceLocal = [nx * r, ny * r, nz * r];
    }
  } else {
    const city = game.cities[id];
    const cont = city ? game.continents[city.continentId] : undefined;
    planet = cont ? game.planets[cont.planetId] : undefined;
    if (planet && cont) {
      const idx = planet.continentIds.indexOf(cont.id);
      const total = Math.max(2, planet.continentIds.length);
      const [nx, ny, nz] = spherePoint(Math.max(0, idx), total);
      const r = planetRadius(planet, planet.id === game.cradlePlanetId);
      surfaceLocal = [nx * r, ny * r, nz * r];
    }
  }

  if (!planet) return null;
  const system = game.systems[planet.systemId];
  if (!system || !system.discovered) return null;

  const sp = systemPosition(system);
  const po = planetOffset(planet);
  return [
    sp[0] + po[0] + surfaceLocal[0],
    sp[1] + po[1] + surfaceLocal[1],
    sp[2] + po[2] + surfaceLocal[2],
  ];
}
