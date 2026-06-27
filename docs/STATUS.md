# Meteor Quest — Build Status (durable memory)

_Update every slice. A cold context should be able to resume from this file._

## Last known-green gate
- Commit `19d5b62` (scaffold). `bash scripts/gate.sh` GREEN.
- Counts: shared 4 tests · sim-core 4 tests · client 2 tests = **10 passing**. Product + preview build OK.

## Slices
| # | Slice | Surface | State |
|---|---|---|---|
| 1 | Scaffold + contracts + gate | root / all | ✅ done, green, pushed |
| 2 | Sim-core: economy + research (deepen) | `packages/sim-core/src` | dispatched |
| 3 | Sim-core: tiers/governors/fog/travel/threats | `packages/sim-core/src` | dispatched (with #2, same builder) |
| 4 | Content pack + golden fixtures | `packages/shared/src/content`,`schema` | dispatched |
| 5 | Client: God-view + continuous zoom | `packages/client/src/world`,`App.tsx` | dispatched |
| 6 | Client: HUD + tier-control panels | `packages/client/src/ui` | dispatched |
| 7 | Preview harness | `packages/client/src/preview` | queued (after #5) |

## Active constraints
See `docs/DESIGN.md` → "Non-negotiable constraints". Enforced by the gate
(arch-guard lint, content-lint, determinism tests).

## Seams already laid (don't recreate)
- Contracts: `@meteor/shared` `ids.ts` / `schema.ts` / `state.ts` (GameState, Command).
- Determinism: `sim-core` `rng.ts` (seeded) + `clock.ts` (injected, TICK_SECONDS).
- Data-source seam: `shared/content/index.ts` + `client/src/preview/dataSource.ts`.
- UI selection/zoom seam: `client/src/sim/selection.ts` (shared by world + ui).
- Sim store bridge + RAF loop: `client/src/sim/store.ts` + `useGameLoop.ts`.

## Review queue (needs Director taste)
- _(empty — append visual/feel/wording items here instead of blocking)_
