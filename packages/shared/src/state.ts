import type { BiomeId, ResourceId, TierId } from "./ids.js";

/**
 * Runtime game state contract. `@meteor/sim-core` is AUTHORITATIVE: it owns all
 * transitions (tick + command reducer). `@meteor/client` renders this state and
 * dispatches Commands; it never mutates state itself (optimistic-cosmetic only).
 *
 * All maps are plain records (JSON-serializable) so state can be saved/loaded and
 * fed to the preview harness deterministically.
 */

export interface City {
  id: string;
  name: string;
  continentId: string;
  /** What this city is producing. At city tier the player sets this directly. */
  focus: ResourceId;
  /** Base output units/sec at full attention (modified by tech/spiffs). */
  productivity: number;
}

export interface Continent {
  id: string;
  name: string;
  planetId: string;
  cityIds: string[];
  /** Aggregate focus applied by the governor when authority sits at >= continent. */
  policy: ResourceId;
}

export interface Planet {
  id: string;
  name: string;
  systemId: string;
  biome: BiomeId;
  /** Orbit position used for layout/zoom; deterministic from seed. */
  orbit: { radius: number; angle: number };
  continentIds: string[];
  /** Fog: a planet's biome/resources are hidden until scanned (sensor-gated). */
  scanned: boolean;
  /** Whether the player has colonized it (claims its unique resource + spiff). */
  settled: boolean;
  /** Planet-wide aggregate focus applied when authority sits at >= planet. */
  policy: ResourceId;
}

export interface StarSystem {
  id: string;
  name: string;
  /** Galaxy-space position; distance from home gates travel by ship range. */
  position: { x: number; y: number; z: number };
  /** Distance from the home system (precomputed for range checks). */
  distanceFromHome: number;
  planetIds: string[];
  /** Revealed by sensor range; until then it's an unknown blip or hidden. */
  discovered: boolean;
}

export type EventKind = "pirateRaid" | "beast" | "meteor" | "supernova";

export interface ActiveEvent {
  id: string;
  kind: EventKind;
  /** Entity the event threatens (planet or system id). */
  targetId: string;
  /** Tick at which the event resolves if not mitigated. */
  resolvesAtTick: number;
  /** Threat strength, compared against the player's defense at the target. */
  severity: number;
  mitigated: boolean;
}

export interface ResearchState {
  unlocked: string[];
  current: string | null;
  /** Accumulated research points toward `current`. */
  progress: number;
}

export interface LogEntry {
  tick: number;
  message: string;
}

export interface GameState {
  seed: number;
  /** Sim ticks elapsed (deterministic; not wall-clock). */
  tick: number;
  /** 0 = paused; 1/2/3 = speed. Client sets via command; sim multiplies dt. */
  timeScale: number;

  stockpiles: Record<ResourceId, number>;
  /** Per-tick production rate, recomputed by the economy system each tick. */
  rates: Record<ResourceId, number>;

  research: ResearchState;
  /** Resources the player has learned to refine. */
  refining: ResourceId[];

  /** Highest unlocked authority tier (tech AND territory gated). */
  authorityTier: TierId;
  /** Ship travel range in galaxy-space units. */
  maxRange: number;
  /** Sensor reveal radius in galaxy-space units. */
  sensorRange: number;
  orbitalLaunched: boolean;

  homeSystemId: string;
  cradlePlanetId: string;
  systems: Record<string, StarSystem>;
  planets: Record<string, Planet>;
  continents: Record<string, Continent>;
  cities: Record<string, City>;

  events: ActiveEvent[];
  log: LogEntry[];
}

/** Commands the client dispatches; the sim reducer applies them authoritatively. */
export type Command =
  | { type: "setTimeScale"; scale: number }
  | { type: "setCityFocus"; cityId: string; resource: ResourceId }
  | { type: "setContinentPolicy"; continentId: string; resource: ResourceId }
  | { type: "setPlanetPolicy"; planetId: string; resource: ResourceId }
  | { type: "startResearch"; techId: string }
  | { type: "scanPlanet"; planetId: string }
  | { type: "travelToSystem"; systemId: string }
  | { type: "settlePlanet"; planetId: string }
  | { type: "respondToEvent"; eventId: string; response: "fortify" | "evacuate" | "ignore" };
