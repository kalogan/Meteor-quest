import { getContentPack, type Biome, type GameState, type Planet, type StarSystem } from "@meteor/shared";
import { hashStr, mulberry32 } from "../world/surfaceTerrain";
import { surfaceProps, type PlanetSurface } from "../world/planetSurface";

/**
 * [journal] Derive the player's TRAVEL LOG from authoritative sim state — a read-only
 * projection, never sim state itself. The journal documents every world you've been to:
 * the cradle (home) plus every planet you've charted (scanned) or colonized (settled),
 * each with the stats a traveller would jot down — where it is, what it's like underfoot,
 * how many moons hang over it, what it yields.
 *
 * Some flavour stats aren't in the sim model (moons, surface gravity), so we derive them
 * DETERMINISTICALLY from the planet id — same world, same journal entry, every time.
 */

export type JournalStatus = "home" | "colony" | "charted";

export interface JournalEntry {
  planet: Planet;
  system: StarSystem;
  biome: Biome | undefined;
  isCradle: boolean;
  /** This world is where the camera is currently focused (the player's "you are here"). */
  isCurrent: boolean;
  status: JournalStatus;
  /** Orbital radius from its star (sim units) — "distance from sun". */
  distanceFromStar: number;
  /** Galaxy-space distance of its system from home (0 at the home system). */
  distanceFromHome: number;
  moons: number;
  surface: PlanetSurface;
  continents: number;
  /** The unique resource this biome yields once settled. */
  yields: Biome["uniqueResource"] | undefined;
}

export interface JournalSummary {
  worldsLogged: number;
  colonies: number;
  techUnlocked: number;
  tier: GameState["authorityTier"];
  minerals: number;
}

/** Deterministic cosmetic moon count (0–3), weighted toward a few. Seeded by planet id. */
export function moonCount(planetId: string): number {
  const r = mulberry32(hashStr(`${planetId}:moons`))();
  if (r < 0.35) return 0;
  if (r < 0.7) return 1;
  if (r < 0.9) return 2;
  return 3;
}

function statusOf(planet: Planet, isCradle: boolean): JournalStatus {
  if (isCradle) return "home";
  if (planet.settled) return "colony";
  return "charted";
}

/**
 * Every world worth a journal page: the cradle plus any planet the player has charted
 * (scanned) or colonized (settled). Ordered home-first, then nearest-to-home, then by name —
 * the way a logbook reads (where you started, then outward).
 */
export function journalEntries(game: GameState, currentPlanetId?: string | null): JournalEntry[] {
  const pack = getContentPack();
  const biomeById = new Map(pack.biomes.map((b) => [b.id, b]));

  const entries: JournalEntry[] = [];
  for (const planet of Object.values(game.planets)) {
    const isCradle = planet.id === game.cradlePlanetId;
    if (!planet.scanned && !planet.settled && !isCradle) continue;
    const system = game.systems[planet.systemId];
    if (!system) continue;
    const biome = biomeById.get(planet.biome);
    entries.push({
      planet,
      system,
      biome,
      isCradle,
      isCurrent: planet.id === currentPlanetId,
      status: statusOf(planet, isCradle),
      distanceFromStar: planet.orbit.radius,
      distanceFromHome: system.distanceFromHome,
      moons: moonCount(planet.id),
      surface: surfaceProps(planet.biome, `planet:${planet.id}`),
      continents: planet.continentIds.length,
      yields: biome?.uniqueResource,
    });
  }

  entries.sort((a, b) => {
    if (a.isCradle !== b.isCradle) return a.isCradle ? -1 : 1;
    if (a.distanceFromHome !== b.distanceFromHome) return a.distanceFromHome - b.distanceFromHome;
    return a.planet.name.localeCompare(b.planet.name);
  });
  return entries;
}

export function journalSummary(game: GameState, entries: JournalEntry[]): JournalSummary {
  return {
    worldsLogged: entries.length,
    colonies: entries.filter((e) => e.planet.settled).length,
    techUnlocked: game.research.unlocked.length,
    tier: game.authorityTier,
    minerals: Math.floor(game.stockpiles.minerals ?? 0),
  };
}
