# Meteor Quest — Vertical Slice Design (locked)

Exploration + resource-management game. Signature mechanic: **one continuous zoom**
(Hegemony-style) where the player's *authority* aggregates upward as the empire
scales — you grow the way you choose, and discovery alters how you play.

## Locked decisions

| Axis | Decision |
|---|---|
| Stack | Browser 3D, React-Three-Fiber, TS pnpm monorepo |
| Time | Real-time fixed tick + pause/speed (deterministic; injected clock/RNG) |
| The slice | 3-in-1 arc: grow cradle → zoom out → launch → explore → settle one world |
| Zoom model | Authority **aggregates** upward; lower tiers run on **governors**; dive down to override |
| Tier gate | tech milestone **AND** territory threshold (both) |
| Biome payoff | unique **resource** (gates tech) **+** category **spiff** (multiplier) |
| Fog of war | **sensor-tech scaled** reveal |
| Conflict | environmental pressure + rare catastrophes (meteor/supernova) + light threats (pirates/beasts), resolved through the same zoom (tactical overview); God-view, no piloting |
| Economy | stockpiles + a mine→refine layer that gets automated/abstracted as you zoom up |
| Travel | fuel/range constrained, ship-tier gated, God-view |
| World | home system + 1 neighbor (reachable only after fuel/range tech) |
| Content | tiny but complete: ~4 biomes, ~9 resources, ~11 tech |
| Look | stylized low-poly |

## The unified zoom / authority tiers

```
GALAXY    — deferred past slice 1
SYSTEM    — direct expansion/travel; planets revealed by sensor range
PLANET    — set planet-wide output policy
CONTINENT — set continent output (aggregate; cities auto-follow via governor)
CITY      — direct city output + the mine→refine micro
TACTICAL  — dive here when threatened: commit defenses
```

Camera roams freely, but **authority** sits at the highest unlocked tier; lower
tiers are governor-automated and can be dived into to override. Promotion needs the
tech AND the territory threshold (see `sim-core/systems/tiers.ts`).

## The arc (≈20–30 min)

1. Cradle (city tier): mine→refine→stockpile + research, manually.
2. First zoom: research *Federal Administration* + own enough cities → continent tier. Micro abstracts away.
3. Planet tier + *Orbital Launch* → leave the cradle.
4. Explore: sensor tech reveals home system, then the neighbor as range grows. A pirate raid + a meteor warning demonstrate dive-to-tactical / mitigate-or-lose.
5. Settle: scan a neighbor biome world, settle it, claim its resource + spiff → unlocks a previously-gated tech.

## Non-negotiable constraints (gated)

- **Core is engine-agnostic.** `@meteor/shared` + `@meteor/sim-core` may not import
  three/react/DOM (ESLint arch-guard).
- **Sim is authoritative + deterministic.** All state transitions live in sim-core
  (`tick` + `applyCommand`), pure functions of state. No `Math.random`/`Date.now`/
  `new Date` in core — use injected RNG/clock. Same seed ⇒ same galaxy.
- **Client is optimistic-cosmetic.** It renders sim state and dispatches Commands;
  it never mutates game state.
- **Content is data.** Biomes/resources/tech are authored JSON, validated by the
  shared schema (same schema for product + preview). New artifacts appear by data.
- **Every system ships tests.** Record counts.

## The gate

`bash scripts/gate.sh` — typecheck · lint+arch-guards · content-lint · tests · build,
each timeout-wrapped, real exit codes. Must be GREEN before advancing a slice.

---

## Slice 2 — "Beyond the cradle system"

Builds on the slice-1 base (do not regress it). Four themes:

1. **Procedural galaxy.** Worldgen generates N seeded star systems (content `galaxy`
   config: systemCount/radius/minSeparation) scattered in galaxy space, each with
   planets/biomes, explored through the existing sensor/range fog. Home + the slice-1
   neighbor become part of the larger map.
2. **Top of the authority ladder.** The aggregation now reaches its peak:
   `system` tier → `StarSystem.policy` governs its planets; `galaxy` tier →
   `GameState.empirePolicy` governs all systems. Governors run everything below the
   player's authority; promotion still needs tech AND territory.
3. **Deeper tactical defense.** `buildDefense(targetId)` spends resources (content
   `defense` config) to raise `Planet.defense` / `StarSystem.defense`. Threats now
   **telegraph** (`spawnedAtTick`→`resolvesAtTick`) across the galaxy map, and
   resolution weighs **local** defense (the target's built defense) + empire baseline
   + the tactical response — so you invest defense where the frontier is hot. Dive to
   a threatened system for the tactical view. Still God-view, still light, but real
   agency beyond a single stat check.
4. **Persistence.** Save/load the authoritative `GameState` to localStorage
   (versioned, throttled autosave, load-on-boot, new-game) so the longer galaxy game
   survives a refresh.

**Contract delta (all additive / green-safe):** `Planet.defense?`,
`StarSystem.policy?`+`defense?`, `GameState.empirePolicy?`, `ActiveEvent.spawnedAtTick?`;
Commands `buildDefense` / `setSystemPolicy` / `setEmpirePolicy`; optional content
`GalaxyConfigSchema` + `DefenseConfigSchema`. Optional everywhere so the slice-1 base
stays green; sim-core populates + reads them with defaults.

---

## Journey — flying to a new planet (visible real-time travel)

Replaces the abstract "pay fuel → instantly discovered" with a **visible expedition**.
God-view, **watch-it-fly with light steering** (no piloting/cockpit):

- The player launches an expedition toward a **reachable** system (orbital launch +
  ship range + fuel) → a `Journey` is created with a position, heading, speed, fuel.
- Each tick the autopilot advances the ship toward the target (heading self-corrects
  to the bearing); the player can **lightly nudge** the heading (`steerJourney`,
  `turn ∈ [-1,1]`) — enough to weave/detour, not enough to fully fly it. Steering a
  longer path costs more fuel (light tension).
- **Arrival** (within an arrive-radius of the target) → `status: "arrived"`, the
  target system is **discovered**, and the existing scan/settle flow takes over.
- **Out of fuel / abort** → `status: "failed"` (stranded / recalled).
- The world renders the ship (low-poly craft + engine trail) at `journey.pos`, the
  camera **follows** the journey, and fog peels near arrival. Steering input must not
  clash with the orbit-drag camera (use keys / an on-screen control).

**Contract delta:** `Journey` interface, `GameState.journeys`, Commands
`launchJourney` / `steerJourney` / `abortJourney`. Deterministic (sim owns the
motion; steering arrives as commands in the tick stream). Save version bumped (v2)
since the state shape changed.

---

## Objectives — goals + onboarding (making it a game)

One authored chain of objectives serves three jobs: the **early** ones onboard
(teach a mechanic, with a "Next: …" nudge), the **middle** ones are meta-goals, and
the **final** one (`victory: true`) wins the game. Authored as DATA in content, so the
guided arc is tunable without code.

- **Condition** (data, evaluated against GameState each tick by the sim): leaf kinds
  `orbitalLaunched` / `researchStarted` / `tier` / `tech` / `settledCount` /
  `settledInSystems` / `discoveredSystems` / `scannedCount` / `resource`, plus a
  one-level `all` (AND) for the compound victory.
- The sim's `runObjectives` marks each pending objective complete when its condition
  holds, and sets `objectives.won` when the `victory` objective completes. Pure +
  deterministic; progress persists.
- The chain (onboarding → goals → victory): research → continent tier → planet tier →
  orbital launch → discover a neighbour → scan a world → settle a world → system tier
  → settle across two systems → **(victory)** galaxy tier + 4 worlds.
- UI: an Objectives HUD panel (current + checklist + hint), a first-time intro, and a
  victory overlay in the shell when `won`.

**Contract delta (additive):** `ObjectiveSchema`/`ObjectiveConditionSchema` + optional
`ContentPack.objectives`; `GameState.objectives {completed[], won}`. Save bumped (v3).
