# Meteor Quest — Build Status (durable memory)

_Update every slice. A cold context should be able to resume from this file._

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
