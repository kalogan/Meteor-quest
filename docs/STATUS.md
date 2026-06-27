# Meteor Quest — Build Status (durable memory)

_Update every slice. A cold context should be able to resume from this file._

## Tech props — structures per unlocked tech (tasks #28–32) — done, verified
- The world now GROWS as you research: each tech carries an authored `prop` and, once
  unlocked, that structure appears on EVERY settled world. 16 distinct procedural
  low-poly props sharing the Ship/MiningProbe material language — 10 ground (foundry,
  refinery, solar_array, reactor, capitol, gov_spire, antenna, dish_array, biodome,
  launchpad) + 6 orbit (shipyard, command_station, senate_ring, warp_gate, sensor_sat,
  survey_net). Data-driven: `prop {kind,placement,scale?}` on TechNode, kind validated
  vs shared PROP_KINDS; parseContentPack enforces one tech per prop kind.
- Seam (committed 039e81a): ids.PROP_KINDS/PROP_PLACEMENTS, TechProp schema + `prop`
  field, all 16 techs tagged, golden fixture regenerated.
- Render (ea0f5a6): `world/props/` component family + registry keyed by PROP_KIND +
  shared materials.ts. `TechPropsLayer` reads `game.research.unlocked` → resolves each
  tech.prop via content → plants GROUND props on the surface INSIDE PlanetView's spin
  group (co-rotate, read as built) and rings ORBIT props on a slow-revolving orbit
  OUTSIDE it. Per-planet seed (FNV-1a→mulberry32) drives arrangement yaw + size jitter;
  biome tint is each prop's single accent — so colonies never look copy-pasted.
  PlanetView mounts both (settled only); SystemView threads reducedMotion. Cosmetic,
  deterministic, reduced-motion aware, NO fresh-object store selectors (#185-safe).
- Preview: new "Tech props" gallery mounts every REAL component in isolation (enumerated
  from content, tints cycle biome colors). preview/main.tsx exposes `window.__sim` for
  headless in-world smokes (preview-only harness tooling). Active-tab color #2b6cff→
  #2f66ea to clear AA (was 4.47:1).
- Architect smoke: gallery 16 tiles render + console CLEAN + **axe 0 violations**;
  in-world injection (16 tech unlocked, cradle + a 2nd settled world) renders props on
  both, console CLEAN. Gate GREEN. Visual: gallery + world screenshots reviewed — 16
  coherent silhouettes, world reads alive. Taste knobs: dish_array reads a bit blobby vs
  the warp ring; ground-prop scale (0.16×r) / orbit radius (2.1×r) / ring speed (0.12).

## Home fleet in-game (task #27) — done, verified
- After the intro, the God-view showed the cradle but NO ship (a ship only appeared
  during a journey). Added a persistent cosmetic HOME FLEET — your ship orbiting the
  cradle + the deployed mining probe harvesting — mounted in SystemView on the cradle
  planet (sized to planet radius), reusing the extracted shared Ship + MiningProbe so
  it matches the tutorial's final frame. Cosmetic, reduced-motion, no #185 selectors.
- Architect smoke: New Game → Begin → in-game God-view shows the ship + probe orbiting
  the cradle (verified visually — prominent at game scale); intro unchanged; console
  CLEAN; gate GREEN. Taste knob: orbit radius/size (reads a touch large).

## Intro: orbit + mining-probe beat (task #26) — done, verified
- Extended the cinematic: after the fly-in the ship settles into orbit, then deploys a
  low-poly mining probe (antenna/dish + pulsing mining beam + resource chunks rising
  from the surface) — two new steps (Enter orbit / Deploy the mining probe), 6 total,
  before Begin. Stage derived from the active step; cosmetic; reduced-motion + mobile.
- Architect smoke caught + fixed: (1) the Begin button hover #3672ff was 4.19:1 with
  white (axe serious) → #2f66ea (~5:1); (2) the centered card hid the mining action →
  docked the intro card to the bottom so the probe/beam stay visible above it.
- Re-verified: 6 steps → orbit/mining render (probe + beam visible) → Begin → playing;
  axe 0 violations; console CLEAN; mobile card on-screen. Gate GREEN.

## Cinematic intro (task #25) — done, verified
- Replaced the off-screen-on-mobile onboarding dialog with a cinematic: fade from
  black → a ship emerges and flies toward the real cradle planet → stepped onboarding
  cards (4, click-through, Skip/Esc) → Begin hands off to play. New `intro` app-phase
  (title→New Game→intro→playing; Continue/Restart skip it). Preview gains an "Intro"
  mode (same component, replayable). Old IntroDialog + its hud.css rules deleted.
- Architect runtime-smoke: New Game→intro plays→click-through→Begin→playing HUD;
  **mobile (390px) card is centered + on-screen** (the bug, fixed); preview Intro tab
  works; **axe 0 violations**; console CLEAN (no render-loop regression). Gate GREEN.
- Taste knobs (DEFAULT_INTRO_STEPS copy, FLIGHT_SECONDS=6.5, curtain/appear timing).

## Objectives — goals + onboarding (tasks #22–24) — done, verified
- One authored 10-step chain doubles as onboarding (teach) → goals → victory
  (galaxy tier + 4 worlds). Sim evaluates conditions each tick + sets `won`; UI = an
  Objectives HUD panel (current "Next:" + checklist), a once-only intro, and a victory
  overlay in the shell. Save bumped v3.
- Architect runtime-smoke caught a GREEN-BUT-BROKEN: VictoryOverlay used
  `useSim(s => victoryStats(s.game))` — a selector returning a NEW object each render →
  React #185 infinite loop → whole app crashed on entering play. The gate (build/lint)
  passed; only the smoke caught it. Fixed (select stable game ref, compute stats in
  render). LESSON: never derive a fresh object/array inside a zustand selector.
- Re-verified: intro shows once; objectives panel renders; starting research completes
  obj_research and advances "Next:"; victory overlay fires (stats + keep playing);
  **axe 0 violations** on HUD + victory; console CLEAN. Gate GREEN (123 tests).

## Game shell + audio (tasks #19–21) — done, verified
- Front door for the loop: Title/splash (live galaxy backdrop = real WorldView) with
  New Game / Continue (hasSave) / Settings; Esc pause menu (Resume/Settings/Restart/
  Quit); Settings (reduced-motion, default speed, autosave, master/music/sfx volume,
  mute, reset save/settings). App routes on `useAppPhase`; loop ticks only while
  `playing` (title/pause freeze the sim). Procedural Web Audio engine (ambient drone +
  state-driven SFX: launch/arrival/threat/settle/ui), volumes from `useSettings`,
  AudioContext unlocked on first gesture; mounted from main.tsx.
- Seams: src/sim/settings.ts (persisted) + appPhase.ts; useGameLoop gated on phase.
- Architect smoke (axe + Playwright): title→New Game starts sim (tick 3→7), Esc pause
  FREEZES sim, settings dialog (3 sliders + 2 switches). **axe 0 violations** on
  title/pause/settings; console CLEAN (audio inits on gesture, no throws). Gate GREEN.
- No git race this round — strict per-file adds held (shell 4 commits in App+ui/shell,
  audio 1 commit in src/audio). Mitigation from the prior race worked.

## Journey — flying to a new planet (tasks #15–18) — done, verified
- Visible real-time expeditions: launch toward a reachable system → ship flies across
  galaxy space (autopilot homes; Arrow/A-D lightly steer, costing fuel) → arrival
  reveals the target for scan/settle. God-view, no piloting. Save bumped to v2.
- sim-core journey state machine (87 sim tests). World: low-poly ship + engine trail +
  camera-follow + keyboard steering (avoids orbit-drag clash). UI: launch list +
  in-transit EXPEDITION panel (dest/distance/ETA/fuel/abort), accessible + responsive.
- Architect runtime-smoke (inject in-flight save): ship renders + camera follows,
  **console CLEAN**, journey advances and ARRIVES → target system discovered
  ("Expedition arrived at Vega Reach"). Full gate GREEN (102 tests).
- LESSON (written in blood): two client builders committing concurrently hit a
  git-add RACE — one commit captured the other's staged files (crossed attribution)
  AND left a new file untracked + a file uncommitted, so HEAD imported a file not in
  git (unbuildable on fresh checkout). Targeted-add + index.lock-retry was not
  sufficient. Detected via `git status` post-fan-out; salvaged by committing the
  orphaned files (no history rewrite). MITIGATION for next time: serialize commits of
  builders sharing a package, or give each its own git worktree.

## Mobile + collapsible + WCAG pass (task #14) — done, verified
- HUD is responsive (desktop corner-docks; phone = top status strip + bottom accordion
  drawer, canvas stays visible), panels collapse/expand (collapsed-by-default on phone),
  and accessible (reusable CollapsiblePanel with aria-expanded/-controls, landmarks,
  focus-visible rings, 44px touch targets on coarse pointers, reduced-motion).
- Architect verification (axe-core + Playwright at 390/768/1366px) caught two
  green-but-broken issues the gate couldn't, both fixed:
  1. Phone drawer was off-screen — inline `position:absolute` (theme.panel) beat the
     media-query `position:static`; fixed with `!important`+`inset:auto` overrides.
  2. axe color-contrast failures (serious) from `opacity` dimming on locked tech rows /
     disabled buttons / tactical breakdown — replaced with explicit AA colors.
- Re-verified: **axe 0 violations** on phone/tablet/desktop; collapse/expand works;
  focus rings present. Gate GREEN (93 tests).

## Last known-green gate (after Slice 2)
- `bash scripts/gate.sh` GREEN. Counts: shared **13** · sim-core **78** · client **2**
  = **93 passing**. Product + preview build OK.
- Slice-2 runtime smoke (headless): game runs, **save/load round-trip RESUMES** (ran
  to tick 31, autosave@30, reload resumed→40, not reset), galaxy generated **7 systems**,
  console CLEAN. Galaxy-tier tech (Galactic Senate) present.
- BOUNDARY: the *visible* galaxy map / telegraphed threats / defense shields / tactical
  view need mid/late-game state (discovered systems, post-launch threats, built defenses)
  a quick headless smoke can't reach — they compile/build/run clean and are unit-tested
  in sim-core, but their visual feel is a Director playtest item.

## Slices
| # | Slice | State |
|---|---|---|
| 1 | Scaffold + contracts + gate | ✅ done, pushed |
| 2 | Sim-core: economy + research | ✅ done (mine→refine, governor aggregation) |
| 3 | Sim-core: tiers/governors/fog/travel/threats | ✅ done (50 sim tests) |
| 4 | Content pack + golden fixtures | ✅ done (4 biomes/9 res/14 tech, fixtures) |
| 5 | Client: God-view + continuous zoom | ✅ done (CameraControls rig, low-poly, fog) |
| 6 | Client: HUD + tier-control panels | ✅ done (tier-adaptive control) |
| 7 | Preview harness (expand) | ✅ done (World/Biomes/Tech modes, seed knob, freeze, static index.html) |
| **S2** | **Slice 2 — "Beyond the cradle system"** | |
| 8 | Contract seams (galaxy/defense/galaxy-tier) | ✅ done (additive, green-safe) |
| 9 | Sim-core: galaxy gen + system/galaxy tiers + defenses + tactical | ✅ done (78 sim tests) |
| 10 | Content: galaxy + defense config + galaxy-tier tech | ✅ done (16 tech, Galactic Senate) |
| 11 | Client: galaxy map + tactical view | ✅ done (zoom band, threat telegraph, shields) |
| 12 | Client: galaxy/system/empire + defense + tactical UI | ✅ done |
| 13 | Save/load persistence (autosave) | ✅ done (verified round-trip) |

## ALL SLICES (1 + 2) COMPLETE — verified green
- Slice 1: full gate GREEN, 65 tests, biome gallery smoke clean.
- Slice 2: full gate GREEN, **93 tests**, save/load + 7-system galaxy smoke clean.

## Slice-2 review queue (Director taste)
- **Defense balance:** `defensePerBuild=5`, `buildCost {alloy:10,energy:10}`, `fortify ×1.75`
  — a couple of builds decisively flips a frontier meteor; tune pricing/strength.
- **Galaxy camera feel:** galaxy-band framing distance (120u) / threat approach reach (16u)
  / defense-shield intensity (0.35) all tuned blind vs the real ~47u galaxy radius.
- **Threat identity:** per-kind tints are placeholder; may want distinct silhouettes.
- **Cleanup:** `src/ui/EventPrompts.tsx` is now orphaned (superseded by TacticalPanel) —
  delete when convenient.
- **Galaxy minSeparation:** content authored 40 vs sim default 45 (content wins) — confirm.

## Vertical slice status: PLAYABLE
The 3-in-1 arc is wired end-to-end: city-tier micro → research toward continent/planet
tiers (aggregation/governors) → orbital launch → sensor-gated fog reveal → settle a
biome world for its resource+spiff. Threats/catastrophes + fuel/range travel in sim.

## Active constraints
See `docs/DESIGN.md` → "Non-negotiable constraints". Gated (arch-guard, content-lint, determinism tests).

## Review queue (needs Director taste)
- **Biome flavor:** content builder retargeted **sand** spiff `materials → sensors`
  (so settling sand matters; pairs with its long-range-array gate). Confirm.
- **Visual:** large cream circle lower-left in the game God-view (a star/body rendering
  too close to camera) — looks off; needs a look pass.
- **Feel:** camera smoothing (`smoothTime` 0.45) + `ZOOM_BANDS` distances are tuned by
  guess — worth a play-pass.
- **Balance:** tech costs + spiff multipliers (1.5/2×) are placeholders.
- **HUD:** TechPanel can crowd ResourceHud on small viewports (collapse/toggle?).
- **Threats:** severity thresholds in ui `theme.ts` vs the sim's actual severity scale.
- **Threat semantics:** defense formula `1 + 0.5·tech + 1·settled + 2·tierRank`;
  fortify ×1.75 / evacuate ×0.5 + saves colonies / ignore = gamble. Cradle unkillable.

## Seams (don't recreate)
Contracts `@meteor/shared` (ids/schema/state); determinism `sim-core` rng+clock;
data-source seam `shared/content` + `client/src/preview/dataSource.ts`; UI selection
`client/src/sim/selection.ts`; sim bridge `client/src/sim/store.ts` + `useGameLoop.ts`.
