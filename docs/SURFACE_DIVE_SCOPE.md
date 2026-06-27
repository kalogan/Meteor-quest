# Surface dive — scope for "move around on it"

_Scoping doc. Captures the path from the current cosmetic surface dive toward an
explorable / walkable surface, the ambition tiers, the architecture touchpoints, the
risks, and a recommended phased path. No implementation beyond Tier 0 yet — this is the
decision surface for what to build next._

## Tier 0 — what exists today (shipped, verified)
A purely **cosmetic camera view** (commits `7bf97a9`). `world/SurfaceView.tsx` renders one
**static tangent terrain patch** at the focused planet's surface point; `world/CameraRig.tsx`
lands the camera in a fixed horizon-facing pose; the colony's unlocked structures are
scattered ahead. **No movement, no avatar, zero sim coupling.** That decoupling (a view
layer over the deterministic sim, like the journey/God-view) is the key asset: we can build
on it without touching `sim-core`.

## The one design rule to hold
Keep the surface a **cosmetic "visit" layer that NEVER gates gameplay.** You can always play
the whole game from the God-view. The moment walking becomes *required* to do something, it
stops being additive and becomes a second game bolted onto a 4X. This tension is the main
reason to stay at Tier 1–2.

## Ambition tiers

### Tier 1 — Roam camera (small, ~1 slice) — RECOMMENDED FIRST
Glide the camera *across* the surface (drag / WASD / touch to translate along the ground,
free look) instead of a fixed pose. You "fly low" over your colony. No avatar, no collision.
The real work is the terrain becoming a **moving window**: recenter / regenerate the patch as
the camera moves so there's always ground under it (today it's one fixed patch). De-risks the
hardest problem both higher tiers share.

### Tier 2 — Walkable avatar (medium, ~2–3 slices)
A controllable character / rover with a third-person follow-cam, WASD movement **constrained
to terrain height** (sample `heightAt`), light collision with structures, and movement
feedback. Needs an avatar model + controller + camera-rig branch + input (incl. touch).
Internally still does Tier 1's moving-window first.

### Tier 3 — Explorable place (large, weeks) — NOT recommended yet
Chunked / streamed terrain so you can walk far, your cities/continents as walkable districts,
click-a-structure-to-inspect/manage, ambient life / weather. A mini-game that starts to
*compete* with the God-view for attention. Defer until Tier 1–2 has been played and the
surface has earned the right to be a destination.

## Architecture touchpoints (Tier 1–2)
- **`world/SurfaceView.tsx`** — biggest change: static patch → **moving terrain window**.
  Recenter on a roam position; regenerate geometry only on threshold crossings; keep it
  seeded/deterministic so it doesn't shimmer or pop.
- **`world/CameraRig.tsx`** — a "surface roam" branch alongside the existing journey-follow
  branch (translate-along-ground + look in Tier 1; follow an avatar in Tier 2). The
  follow-loop pattern (`following.current`, smoothed eye/target) is the template to copy.
- **`sim/selection.ts`** — widen the surface state from a boolean to a small
  `{ active, pos }` so the roam position has a home. STILL camera-only view state — never
  read or written by the sim.
- **`world/SurfaceAvatar.tsx`** (Tier 2 only) + an input hook — reuse the `JourneySteering`
  keyboard pattern; add a touch scheme.
- **Preview `Surface` mode** already exists — the harness to build + tune against.

## Risks & unknowns (grounded in what bit us building Tier 0)
1. **Green-but-broken visuals.** Every Tier-0 surface bug (flipped winding → terrain lit
   from below; planet sphere showing through; degenerate camera vector; preview reset
   clobbering tech) passed the gate and only showed in screenshots. Roam adds *motion* bugs
   (jitter, terrain pop-in, camera clipping into hills) the gate can't catch → screenshot /
   ▶︎ runtime verification is mandatory.
2. **Performance.** Regenerating terrain on a moving window must be throttled / LOD'd or it
   hitches — especially mobile. Needs an explicit budget (regenerate at most on N-unit moves;
   cap segment count).
3. **Touch / mobile + accessibility.** Roam/walk controls need a touch scheme and a
   reduced-motion fallback (the rest of the game honors reduced motion).
4. **Determinism boundary.** Must stay cosmetic — roam position is view state, never saved to
   or read by the sim. (Same discipline as `selection` / `zoomTier`.)

## Recommended path
1. **Tier 1 (roam camera)** as one slice — most of the "move around on it" feeling at a
   fraction of Tier 2's cost, and it de-risks the moving-terrain-window that both tiers need.
   First slice = moving terrain window + roam-camera branch + drag/WASD/touch + reduced-motion
   fallback, tuned in the preview Surface mode, verified by ▶︎ screenshots at desktop + 390px.
2. If it feels good → **Tier 2 (avatar)** as a clean follow-on.
3. Hold **Tier 3** until Tier 1–2 has been played.

## Decision needed
- **Ambition:** Tier 1 (recommended) / Tier 2 / Tier 3 / stop at this doc.
- **Design role:** cosmetic visit layer (recommended) / let it gate some actions.

## Taste knobs already exposed (Tier 0, for reference)
dome & relief amplitude, patch size, haze intensity, structure scale/placement, landed
camera height/pitch (`SurfaceView.tsx` + `CameraRig.tsx` `frameToLevel`).
