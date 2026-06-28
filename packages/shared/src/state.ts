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
  /** [slice 2] Built defensive strength at this planet (buildDefense). Default 0. */
  defense?: number;
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
  /** [slice 2] System-wide aggregate focus applied when authority sits at >= system. */
  policy?: ResourceId;
  /** [slice 2] Built system-level defensive strength (buildDefense). Default 0. */
  defense?: number;
}

/**
 * [journey] An in-flight expedition between systems. God-view: the player launches
 * it toward a target and the autopilot flies it there in real-time, but they can
 * lightly nudge its heading en route (steerJourney). On arrival the target system is
 * revealed for scanning/settling.
 */
export interface Journey {
  id: string;
  originSystemId: string;
  targetSystemId: string;
  /** Current position in galaxy space. */
  pos: { x: number; y: number; z: number };
  /** Current unit heading vector (direction of travel). */
  heading: { x: number; y: number; z: number };
  /** Galaxy units travelled per tick. */
  speed: number;
  /** Fuel remaining for this expedition (runs out → stranded/failed). */
  fuel: number;
  status: "enroute" | "arrived" | "failed";
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
  /** [slice 2] Tick the threat appeared; with resolvesAtTick gives the telegraph
   * window the galaxy map renders an incoming threat across. */
  spawnedAtTick?: number;
}

/**
 * [hostiles] Space beasts & pirates — roaming threats tied to EXPLORATION + TRAVEL (distinct
 * from the abstract `ActiveEvent` threats that strike settled colonies). A beast/pirate spawns
 * as a LURKER when you uncover a frontier system, or AMBUSHES an expedition in transit; it
 * patrols galaxy space until engaged. Resolved through the existing defense math via the
 * `engageHostile` command (fight / flee / pay-off). Spawning is gated behind
 * `GameState.hostilesEnabled` so the shipped game is unaffected until it's switched on.
 */
export type HostileKind = "beast" | "pirate";

export interface RoamingHostile {
  id: string;
  kind: HostileKind;
  /** The system this hostile haunts (lurker) or was spawned near (ambusher). */
  systemId: string;
  /** Current galaxy-space position (same frame as systems/journeys). */
  pos: { x: number; y: number; z: number };
  /** Patrol orbit around its system (advanced each tick while not engaged). */
  patrolAngle: number;
  patrolRadius: number;
  /** Engagement strength, compared against the player's defense (like event severity). */
  threat: number;
  /** Revealed to the player (lurkers/ambushers are visible on spawn). */
  discovered: boolean;
  /** Set when it has pinned an expedition in transit — the player must respond. */
  engagedJourneyId?: string;
  /** Tick it wanders off if never engaged (frontier predators don't linger forever). */
  expiresAtTick: number;
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
  /** [slice 2] Empire-wide aggregate focus applied when authority sits at galaxy tier. */
  empirePolicy?: ResourceId;
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
  /** [hostiles] Roaming space beasts & pirates, keyed by id. Empty unless `hostilesEnabled`. */
  hostiles: Record<string, RoamingHostile>;
  /** [hostiles] When true, the fog/launch hooks may spawn beasts/pirates. Off in the shipped
   * game (the system runs inert) until the feature is switched on. */
  hostilesEnabled?: boolean;
  /** [journey] Active expeditions in flight between systems (usually 0–1 in the slice). */
  journeys: Record<string, Journey>;
  /** [objectives] Guided-goal progress: completed objective ids + whether the victory
   * objective has been met. The chain itself is authored content. */
  objectives: { completed: string[]; won: boolean };
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
  | { type: "respondToEvent"; eventId: string; response: "fortify" | "evacuate" | "ignore" }
  // ── [slice 2] galaxy tier + tactical defense ────────────────────────────────
  /** Spend resources to add defensive strength at a planet or system. */
  | { type: "buildDefense"; targetId: string }
  /** System-wide aggregate focus (governor) when authority sits at >= system. */
  | { type: "setSystemPolicy"; systemId: string; resource: ResourceId }
  /** Empire-wide aggregate focus (governor) at galaxy tier. */
  | { type: "setEmpirePolicy"; resource: ResourceId }
  // ── [journey] launch + light steering of an expedition ──────────────────────
  /** Launch an expedition toward a reachable target system. */
  | { type: "launchJourney"; targetSystemId: string }
  /** Lightly nudge an in-flight expedition's heading. `turn` ∈ [-1, 1]. */
  | { type: "steerJourney"; journeyId: string; turn: number }
  /** Abort an expedition (turn back / recall). */
  | { type: "abortJourney"; journeyId: string }
  // ── [hostiles] respond to a space beast / pirate encounter ──────────────────
  /** Resolve an encounter with a roaming hostile: fight it (defense vs threat), flee
   * (abort the pinned expedition), or pay it off (spend resources to pass). */
  | { type: "engageHostile"; hostileId: string; response: "fight" | "flee" | "payoff" };
