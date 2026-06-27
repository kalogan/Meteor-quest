# Meteor Quest — Build Status (durable memory)

_Update every slice. A cold context should be able to resume from this file._

## Last known-green gate
- After the parallel fan-out integration. `bash scripts/gate.sh` GREEN.
- Counts: shared **13** · sim-core **50** · client **2** = **65 passing**. Product + preview build OK.
- Runtime smoke (headless Chromium, alt ports 4173/4174): game + preview both render,
  WebGL OK, console clean except a benign favicon 404 (now silenced). Sim ticks live
  (economy accrues, tech-tree gating correct, city-tier focus panel shows as designed).

## Slices
| # | Slice | State |
|---|---|---|
| 1 | Scaffold + contracts + gate | ✅ done, pushed |
| 2 | Sim-core: economy + research | ✅ done (mine→refine, governor aggregation) |
| 3 | Sim-core: tiers/governors/fog/travel/threats | ✅ done (50 sim tests) |
| 4 | Content pack + golden fixtures | ✅ done (4 biomes/9 res/14 tech, fixtures) |
| 5 | Client: God-view + continuous zoom | ✅ done (CameraControls rig, low-poly, fog) |
| 6 | Client: HUD + tier-control panels | ✅ done (tier-adaptive control) |
| 7 | Preview harness (expand) | in progress (builder dispatched) |

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
