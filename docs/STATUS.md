# Meteor Quest — Build Status (durable memory)

_Update every slice. A cold context should be able to resume from this file._

## HUD v3 — panel search + distributed resbar + desktop multi-panel (tasks #58–60) — done, verified
- SEARCH bars: reusable `ui/PanelSearch.tsx` (controlled type=search + clear button, accessible).
  Wired into Research (filter tech by name/category), Command (filter settlements by name, in the
  city-focus view), and Journal (filter worlds by planet/biome/system) — each shows a "No … match"
  line when empty. Built Research + Command via parallel builders (disjoint files), Journal + the
  component by the Architect.
- MOBILE RESBAR: full resource WORDS now (Minerals/Alloy/Energy/Research/Fuel — dropped the
  Min/Aly/… truncation) and `justify-content: space-between` so they distribute across the bar
  width. (At ~390px "Fuel" wraps to a 2nd line; one row on wider phones.)
- DESKTOP MULTI-PANEL: the action-bar nav now opens MULTIPLE panels at once (was one-at-a-time).
  `mobileNav` open state is a Set (`openIds`); the bar toggles independently on desktop, but stays
  single-select on phone (`selectOnly`, so the sheet is still one at a time). Open desktop panels
  flow in a centered, bottom-anchored ROW above the bar (`.hud-drawer` → flex row, wrap-reverse;
  `.hud-collapsible--dock` → static flow), side by side, each with its own scroll. CollapsiblePanel
  renders a nav panel only while its id is in openIds (header ✕ closes just that one).
- Verified: gate GREEN; HUD v3 smoke — DESKTOP @1400: open Research+Command+Journal → 3 docks
  side-by-side (distinct x 252/540/828), each search box present, Research search filters
  ("zzz"→"No tech matches", clear restores), header ✕ closes one (→2), **axe 0** (incl. label
  rule), console CLEAN; PHONE @390: resbar shows all 5 full words + space-between, Research sheet
  has its search, CLEAN. Screenshots reviewed (3 panels side-by-side, no overlap; distributed
  resbar).

## Unified action bar (desktop + mobile) + Settings panel (tasks #56–57) — done, verified
- UNIFIED the HUD on ALL breakpoints around ONE action bar. The heavy panels (Goals/Research/
  Command/Travel/Journal/Defense/Settings) open ONE AT A TIME from the bar — a bottom SHEET on
  phones, a docked panel on desktop — instead of corner-docking simultaneously (which OVERLAPPED
  badly on wide-but-short / busy screens; see the user's landscape screenshot). Resources stay
  always-on (top-left card desktop / chip bar phone); threats move to top-center on desktop.
- CollapsiblePanel: nav-controlled panels (those with a mobileId) now render only while active
  (else return null — still mounted → still registered), with `hud-collapsible--sheet` on phone
  / `hud-collapsible--dock` (fixed bottom-right, tall, single scroll) on desktop. The header is
  the close (✕). `MobileNav` shows on desktop too as a centered bottom PILL (icon+label buttons).
- SETTINGS panel (new `ui/SettingsHud.tsx`, built by a parallel builder): a nav item (⚙️) holding
  live game SPEED (pause/1×/2×/3×) + AUDIO/motion (reduced-motion select, master/music/sfx volume,
  mute) — the standalone top-right SpeedControls is gone (folded in here, per request). Reuses
  `applyReducedMotion` + `useSettings`; fully labelled/aria.
- CLEANUP: deleted the now-orphaned `SpeedControls.tsx`, `JournalButton.tsx`, `sim/journalUi.ts`
  (journal is a nav item on both breakpoints now; JournalPanel dropped the journalUi controlled-
  open) + their dead CSS. Preview 'HUD' mode mounts the real Hud (resize to test both layouts);
  'Journal' mode opens the nav-controlled journal via `setActive`.
- Verified: gate GREEN; unified smoke — DESKTOP @1280: centered action-bar pill (6 icons incl.
  Settings), nothing open at rest (game clear), Research opens ONE dock on the right, Settings
  replaces it (one-at-a-time), Settings speed buttons drive the sim (timeScale 0 & 2), volume
  sliders present, header ✕ closes, resource card still top-left, **axe 0**, console CLEAN;
  PHONE @390: Settings opens as a sheet with speed + volume, console CLEAN. Screenshots reviewed
  (desktop: resources top-left + right-docked Settings + bottom pill, no overlap, planet fills
  center; phone: chip bar + settings sheet + bottom bar).
- FOLLOW-UP: desktop default is no panel open (clean game view) — if players want a panel pinned,
  a "keep open"/multi-pin affordance could come later. Tactical/threats top-center desktop is new.

## Mobile HUD redesign — bottom icon nav + bottom sheet (task #54) — done, verified
- Replaced the phone ACCORDION DRAWER (which stacked every heavy panel and ate the screen) with
  a BOTTOM ICON NAV BAR + a single bottom SHEET. Tapping an icon slides that one panel up into
  the lower ~36vh (grab-handle + ✕ close header); the game stays visible above. One panel at a
  time; tap the active icon (or the sheet header) to close. Desktop is UNCHANGED (corner docks).
- `sim/mobileNav.ts`: store with `active` + a panel REGISTRY. Panels SELF-REGISTER while mounted
  (a panel that conditionally renders nothing — e.g. Expedition before launch — simply isn't
  registered, so its icon doesn't appear), so the nav stays in lock-step with what's on screen
  WITHOUT duplicating each panel's visibility rules. `unregister` closes the sheet if the active
  panel went away.
- `ui/CollapsiblePanel.tsx`: gained `mobileId`/`mobileLabel`/`mobileIcon`/`mobileOrder`. On a
  phone (reactive `useIsPhone` matchMedia hook) a panel with a mobileId registers + renders as a
  SHEET — visible only when it's the nav's active panel (`.hud-collapsible--sheet.is-open`,
  else `.is-collapsed` display:none so it stays mounted/registered); open is forced while active;
  the header doubles as the close control (✕ glyph, aria-label "Close <panel>"). Desktop path
  untouched (still honors controlled/uncontrolled open — e.g. the journal's desktop button).
- `ui/MobileNav.tsx`: the bottom bar — one labelled icon button per registered panel (never
  icon-only → button-name + 48px touch targets), aria-pressed, sorted by mobileOrder. Phone-only
  via CSS; corner docks replace it on desktop. The 6 drawer panels each pass their mobile props
  (Goals🎯/Research🔬/Command🛰️/Travel🚀/Journal📖/Defense🛡️). Top-strip Journal button hidden
  on phone (journal is a nav item there).
- hud.css: sheet (fixed, lower third, slide-up anim, grab handle, single scroll context, safe-
  area inset) + nav bar styles; removed the old accordion-drawer rules (drawer → display:contents
  so children self-position); nav hidden via a `min-width:721px` query (order-independent);
  reduced-motion disables the slide.
- Preview gains a 'HUD' mode (mounts the REAL Hud over a launched, charted world) so the full
  overlay + mobile sheet are eyeballable/smoke-testable at any viewport — resize ≤720px for the
  phone layout.
- Verified: gate GREEN; mobilehud smoke @390px — nav bar visible w/ 5 available icons, no sheet
  open at rest (game unobstructed), tapping Research opens a lower-third sheet (top >50%h,
  height ≤45%h), opening Journal closes Research (ONE at a time, aria-pressed flips), the sheet
  header ✕ closes it, **axe 0 violations**, console CLEAN; @1280px the nav is hidden + no sheets
  (desktop docks intact), console CLEAN; screenshot reviewed (game visible mid-screen, sheet +
  icon bar at the bottom).
- FOLLOW-UP DONE (task #55): the phone TOP strip is now compact. ResourceHud collapses to a thin
  CHIP BAR on phones (abbrev + value + a coloured rate caret — Min/Aly/Ene/Sci/Fuel; no title/
  authority/heading rows; full name + rate in each chip's aria-label). SpeedControls drops its
  "speed" word + tightens padding. Strip height ~360px → ~69px (real-device screenshots showed
  the old card ate ~40% of the screen). Desktop card unchanged (useIsPhone branch). Verified:
  gate GREEN; topstrip smoke @390px — 1 chip bar, 5 chips, strip 69px, no "Meteor Quest" card,
  axe 0, console CLEAN; @1280px the full card is intact + no chip bar; screenshot reviewed
  (planet fills the screen). REMAINING ideas to reclaim more view: merge chips+speed onto one
  row on wider phones, or an optional "hide HUD" peek toggle.

## Journal depth + polish — timestamps, detail, open button, toast, audio (tasks #51–53) — done, verified
- DEPTH:
  - First-logged TIMESTAMP per world. The sim has no "discovered-at" field, so `sim/journalLog.ts`
    is a thin CLIENT observer: it watches the authoritative sim and records the tick each world
    first became logged (scanned/settled/cradle). Persisted per-seed (localStorage); baseline-
    SILENT on first sight of a world set (a loaded save full of charted worlds doesn't spam),
    resets on seed-change / clock-rewind (New Game). `startJournalLog()` mounted from main.tsx +
    preview/main.tsx (like the audio engine). `rebaseline(game)` for the preview's wholesale
    setGame installs. Each page shows "logged from the start / tick N".
  - Per-page DETAIL expander: cards collapse to portrait + name + status + a one-line subtitle;
    an expander (aria-expanded/-controls) reveals the full stat grid + Logged + biome Spiff + a
    flavour line. The CURRENT (selected) world auto-opens to its page; any page can be toggled.
  - "New world logged" TOAST (`ui/JournalToast.tsx`, builder): transient aria-live cards (top-
    center, below the Journal button), auto-dismiss 4s + manual close, reduced-motion aware.
    Fed by journalLog.recent via `ui/JournalToastHost.tsx` (maps ids → name + biome accent).
- OPEN BUTTON: `sim/journalUi.ts` (open store) + CollapsiblePanel gains optional CONTROLLED
  open (`open`/`onOpenChange`, backward-compatible). `ui/JournalButton.tsx` sits in the HUD
  status strip (top-center desktop, flows in the phone strip) with a count badge + aria-pressed,
  toggling the panel. Default open desktop / closed phone.
- AUDIO: `audioEngine` gains a state-derived "logged" cue — `detectSfx` detects a planet going
  scanned false→true (deduped, baseline-silent) → a soft D5→A5 chime. +4 detectSfx unit tests.
- Built with TWO parallel builders (JournalToast; audioEngine cue+test) on disjoint files while
  the Architect owned JournalPanel/Hud/hud.css/journalLog/journalUi integration — no git race.
- Preview 'Journal' mode gains a "＋ Chart a world" demo button that scans the next discovered
  world → exercises the REAL observer→toast→audio path. hud.css: journal button styles + count
  badge; toast nudged to top:54 so it never overlaps the button.
- Verified: gate GREEN (122 client+sim tests incl. new audio tests); journal2 smoke — 5 pages
  w/ portraits + "logged" timestamps, current world auto-expands, expander toggles a non-current
  page (false→true, detail stats appear), the strip button opens/closes the panel (aria-pressed
  + visibility), "Chart a world" → a toast appears + entry count grows + dismiss works, **axe 0
  violations**, console CLEAN; screenshot reviewed (toast clears the button, detail grids + flavour
  + spiff read clearly).
- TASTE/FOLLOW-UP: in-game journal dock (left:312, 70vh) can still crowd TechPanel/Tactical on
  narrow desktops — now mitigated by the open/close button. Timestamp uses sim ticks (not wall
  clock) by design.

## Travel Journal — logbook of visited worlds (task #50) — done, verified
- A HUD JournalPanel (`ui/JournalPanel.tsx`) documents every world you've been to: the cradle
  plus every planet SCANNED or SETTLED. Each page = a rendered PORTRAIT of the world (the REAL
  PlanetView in a small lazy-mounted Canvas — `ui/JournalThumbnail.tsx`) + stats: system,
  distance-from-home (ly), orbit radius (AU = distance-from-star), MOONS, gravity (g + floaty/
  light/normal/heavy), continents, biome, yields, and a status badge (Home / Colony / Charted).
  A flyleaf summary tallies worlds-logged / colonies / tech / minerals. Tapping a page
  `select()`s that planet → the God-view CameraRig frames it (journal doubles as a "jump to
  where I've been" index); the focused world shows a "You are here" badge.
- Derivation is a pure read-only projection: `sim/journal.ts` (`journalEntries`, `journalSummary`,
  `moonCount`). NOT sim state. Stats absent from the model are derived DETERMINISTICALLY from
  the planet id: moons (0–3 weighted) via mulberry32; gravity reuses `planetSurface.surfaceProps`.
  "Minerals" is the empire stockpile (no per-planet mined history in the sim).
- WebGL context budget: portraits lazy-mount behind an IntersectionObserver (same fix as the
  tech-props gallery) so only on-screen pages hold a live context; off-screen pages are a
  tinted placeholder. Reduced-motion aware (resolved like the renderers). Collapsible + joins
  the phone drawer; docked `.hud-dock-journal` (left rail, right of Objectives).
- Preview: new 'Journal' mode (`PreviewApp.JournalMode`) installs a charted-rich world (several
  systems discovered, ~6 planets scanned, a few colonies) and mounts the REAL WorldView +
  JournalPanel (no fork). Harness now imports `ui/hud.css` so the panel is styled in preview too.
- Verified: gate GREEN (116 sim tests); journal smoke — 6 pages each with a portrait + full
  stats, tapping a page selects+frames that planet (selectedKind=planet, "You are here"),
  **axe 0 violations** on the panel, phone drawer header present, console CLEAN; screenshot
  reviewed (portraits read clearly, badges + stat grid legible).
- TASTE/FOLLOW-UPS: in-game left-rail placement (left:312, 70vh) can crowd TechPanel /
  bottom-center Tactical on narrow desktops — a dock-position pass is a Director item. Moons +
  surface gravity are cosmetic-derived (not in the sim) — promote to the model if they ever
  gate play. No cumulative "minerals mined per planet" (sim tracks only stockpiles/rates).

## Avatar polish — footstep dust + landing puff + SFX + return-to-orbit (task #49) — done, verified
- Wired two feel pieces into the Tier-2 walkable preview: `preview/avatarSfx.ts` (procedural
  Web Audio — jump blip, weighted land thud scaling with impact speed, footstep tap w/ pitch
  jitter; lazy cached AudioContext, soft master gain, try/catch-guarded) and `world/AvatarFx.tsx`
  (pooled 48-mesh cosmetic dust/puff emitter — `FxEmitter.burst(x,y,z,strength,kind)`).
- AvatarScene controller triggers: jump → sfx.jump(); airborne→grounded landing → sfx.land +
  burst("land") with strength from impact downward speed; footstep every ~1.4m walked on the
  ground → sfx.step() + burst("step"). `<AvatarFx>` mounted in the scene with an emitterRef.
- "Return to orbit" button (PreviewApp passes `onReturnToOrbit` → drops back to Surface mode).
- Built the two leaf files with parallel builders (disjoint NEW files via the FxEmitter/sfx
  contracts), Architect did the controller wiring. Verified: gate GREEN; avatar smoke — joystick
  walks (Δ2.27u, footsteps fire), JUMP works + lands clean, return-to-orbit switches to Surface,
  console CLEAN; screenshot reviewed.

## Avatar iteration — tuner + mobile controls + richer worlds (task #48) — done, verified
- `sim/avatarConfig.ts` (useAvatarConfig): live physics/gravity knobs (gravityScale, baseG,
  moveAccel, maxSpeed, friction, airControl, jumpSpeed) read each frame by the controller; the
  avatar panel gains sliders + Reset, gravity readout shows EFFECTIVE g (per-planet × scale).
- `preview/avatarInput.ts`: shared input seam (keyX/Z, touchX/Z+active, jumpQueued). Keyboard
  AND the on-screen controls both write it; controller reads it (joystick wins when engaged,
  edge-triggered jump → no double-jump).
- `preview/AvatarTouchControls.tsx` (builder): virtual joystick (move) + JUMP button → seam.
- Feel: tuned defaults (accel 30, maxSpeed 4.6, jump 6.4, airControl 0.4); grip-damped
  friction so low-grip worlds slide. Richer worlds: scattered low-poly boulders.
- Verified: gate GREEN; avatar smoke — joystick moves avatar (Δ1.45u), JUMP button jumps,
  gravity ×0.4 lowers effective g (1.72→0.69) and ~doubles jump apex (0.83→1.70), console
  CLEAN; screenshot (joystick + jump button + rocks + tuner). Built with a parallel builder
  for the touch controls (disjoint file via the input seam — no conflicts).

## Surface knobs as live configs + Tier 2 walkable avatar (tasks #46–47) — done, verified
- CONFIG EXPOSURE: every surface dive/roam tuning constant → `sim/surfaceConfig.ts`
  (useSurfaceConfig store, defaults == the inlined values, behaviour unchanged). SurfaceView
  + CameraRig read it; preview 'Surface' mode gains a 'Surface knobs' panel (SurfaceTuner) —
  14 live sliders (Terrain/Look/Camera/Roam) + Reset. Shipped game uses defaults. Terrain
  height field + mesh builder factored to `world/surfaceTerrain.ts` (shared).
- TIER 2 AVATAR (preview-only 'Avatar' mode; the shipped dive/roam stays a CAMERA): a
  low-poly SPACE-SUIT avatar (helmet+visor, life-support pack, swinging limbs — SurfaceAvatar)
  walks a terrain patch under REAL per-planet gravity, third-person orbit camera.
  - `world/planetSurface.ts`: gravity + grip per world from biome+seed (ice ~0.3g floaty +
    slippery; rock ~1.6g heavy). Each planet distinct + deterministic.
  - `preview/AvatarMode.tsx`: physics (camera-relative WASD, grip-damped friction → low-grip
    slides, gravity + Space jump, ground-follow on the shared height field) + world picker +
    gravity/grip readout. window.__avatar exposed for smokes.
- Verified: gate GREEN; surface screenshot (knobs panel at defaults, unchanged); avatar smoke
  — walks 1.27u on W; low-g ICE jump apex 3.78u vs heavy ROCK 0.67u (~5.6×); console CLEAN;
  suit + ice/rock worlds screenshots reviewed.
- FOLLOW-UPS: avatar is sandbox-only (not in the shipped loop); a real on-screen touch move
  control; gravity/grip exposed in the tuner too; tune feel (accel/friction/jump). Roam +
  avatar both stay cosmetic — never sim state.

## Surface roam — Tier 1.5 (task #45) — done, verified
- Polish on the landed roam:
  - Re-leveling now triggers on HORIZONTAL look-target translation (project out the up
    component), not just WASD — so a TOUCH two-finger pan (CameraControls truck) is grounded
    too; pure look/orbit (target fixed) is left alone. Camera+target lift together → eye
    height kept, gaze pitch preserved.
  - Soft PITCH CLAMP via height bounds (camera-only, surface-relative): orbit-look can't rise
    to a bird's-eye or dip below the ground → no jarring snap on the next move.
  - Feel: roam speed r×1.4 → r×1.7; hint → 'Move: WASD / two-finger · Look: drag'.
- Verified: gate GREEN; smoke — WASD roam, then a hard drag-up (clamp holds: grounded horizon,
  not bird's-eye), then move again (re-grounds at eye level), console CLEAN; screenshots
  reviewed (before / look / after all sane).
- REMAINING (per SURFACE_DIVE_SCOPE): Tier 2 walkable avatar (follow-cam, terrain-height
  follow, collision). Mobile note: touch can now MOVE (two-finger, grounded) + look (drag) +
  pinch-to-exit — a dedicated on-screen move control is still a possible nicety.

## Surface roam — Tier 1 (task #44) — done, verified
- Once landed (surface dive) you can now ROAM across the ground: WASD / arrow keys translate
  the camera over the surface (CameraRig: cc.forward + cc.truck) with per-frame RE-LEVELING
  to a fixed eye height so forward motion (which follows the slightly-downward gaze) never
  sinks underground. Drag / touch still look + zoom natively (CameraControls).
- `nearSurface` is now HYSTERETIC (enter < r×1.4 of planet centre, exit only > r×5) — roaming
  horizontally increases centre-distance on the flat tangent arena, so without hysteresis it
  would pop back to orbit. Dolly out far (or Pull up) still exits cleanly. Roam keys only
  captured while landed (arrows still steer an in-flight expedition).
- SurfaceView arena enlarged (radius×14, mesh segs 44) so you roam well inside the rim before
  the exit threshold lifts you. SurfaceControl shows a 'WASD/arrows to move · drag to look'
  hint while landed.
- Verified: gate GREEN; roam smoke — descend → hold W then D → camera translates across the
  surface (colony left behind into open terrain), stays landed (hysteresis held), hint shown,
  console CLEAN; before/after screenshots reviewed.
- FOLLOW-UPS (per SURFACE_DIVE_SCOPE Tier 1.5 / 2): precise TOUCH movement (two-finger pan
  re-leveling — currently desktop WASD is solid, touch can look/zoom but move is basic);
  optional polar-angle clamp so orbit-look can't go bird's-eye then snap on move; Tier 2
  walkable avatar. Roam stays cosmetic view-state (never in the sim) per the scope's rule.

## Surface dive — land on a planet (tasks #40–43) — done, verified
- Extends the continuous abstraction-zoom BELOW city tier: keep zooming in on a planet (or
  press the Descend button) → the camera settles into a landed, horizon-facing pose and a
  low-poly TERRAIN PATCH renders (biome-tinted relief doming into a curved horizon, a haze
  band at the horizon, starfield as sky, and the colony's unlocked structures planted on the
  ground ahead). Pull up / zoom out returns to orbit.
- Seam: selection.nearSurface (camera-derived; zoomTier stays a TierId so HUD tier logic is
  untouched — surface is a camera-only view, NOT an authority tier) + a one-shot frameRequest
  for Descend/Pull-up. layout: SURFACE distances + focusSurfaceNormal.
- CameraRig derives nearSurface from camera-to-planet-CENTRE distance (the landed pose looks
  at the horizon, so eye→target is large — can't key off cc.distance); flies to a basis-
  aligned landed pose (local +Z = the gaze) on request. SurfaceView builds deterministic
  seeded terrain (flat-shaded grid, edge-dome horizon), horizon haze, a warm sun + sky fill,
  and fans the unlocked ground props ahead of the camera. PlanetView hides the globe / orbit
  rings / selection halo during a dive; SurfaceControl is the Descend/Pull-up button; preview
  gains a 'Surface' mode (with a structure-rich cradle).
- LESSONS (caught only by screenshots, gate was green throughout): (1) flipped triangle
  winding → ground normals pointed DOWN → terrain lit from below (black); fixed winding.
  (2) the underlying planet sphere showed through as a giant wall → hide the globe when
  near-surface. (3) structures invisible because PreviewApp's reset effect re-installed a
  fresh world for every non-flight/intro mode, clobbering Surface mode's unlocked tech →
  excluded 'surface'. (4) degenerate camera up-vector for a plain planet selection (surf ==
  centre) → derive the surface point from the focus normal.
- Verified: gate GREEN; smoke — dive renders, Descend↔Pull-up toggles nearSurface, axe 0,
  console CLEAN (preview + real game). Taste knobs: dome/relief amplitude, patch size, haze,
  structure scale/placement, landed camera height/pitch.

## Playtest pass — balance fixes (tasks #37–39) — done, verified
- Ran a headless optimal-auto-player over many seeds against the REAL sim. Found + fixed
  two critical issues:
  1. WINNABILITY. Home system = cradle only; nearest other system ~92 but ungated tech
     reaches sensor ~130 / range ~190, so the OBVIOUS path only settles Vega (cradle+2=3
     worlds) — one short of the 4-world victory; the 4th needed luck or an opaque
     silicate→long-range-sensor detour (~8% of seeds had NO reachable 4th; competent win
     rate ~60%). FIX (worldgen): a GUARANTEED 2nd near system "Proxima Reach" (2 planets,
     distance ≤ ungated sensor envelope, far side of the disc from Vega), consuming one
     scatter slot (systemCount unchanged). Competent-player win rate 60% → **100%** over
     30 seeds, ~5 min median.
  2. GOVERNOR PROMOTION TRAP. On promotion, production switches city-focus → tier
     governor, which defaulted to minerals → research SILENTLY flat-lined (a naive run
     stalled ~166 min). Root cause: tech-completion promoted via applyTechEffects which
     bypassed the seeding. FIX: route BOTH promotion paths through one `promoteTo()` that
     seeds the new governor from the cities' current effective focus (ties→research). Plus
     a once-ever UI `GovernorHint` teaching the concept on first promotion.
- Verified: +9 sim regression tests (worldgen reach-per-seed; governor inherits focus) →
  **116 sim tests**; win-rate harness 100%; real-game smoke — hint appears on a genuine
  city→continent promotion, governors inherit Research (research keeps flowing +4.8/s),
  axe 0, dismisses, console CLEAN. Gate GREEN.
- NOTE: my FIRST harness over-claimed "40% unwinnable" — it under-modeled the optimal
  player (rare resources are focus-producible, not settle-gated). True hard-unwinnable was
  ~8%; the worldgen fix makes it 0% via the obvious path. Secondary, NOT yet actioned:
  long opening with nothing reachable until warp (~t520); raw minerals have no sink.
- Save layout: createInitialState changed (adds sys-near) — affects NEW games only;
  SAVE_VERSION not bumped (existing saves keep their old galaxy; the inherit fix is runtime
  and benefits them too).

## Tech props — mobile gallery WebGL fix (task #36) — done, verified
- BUG (mobile, reported via screenshot): the "Tech props" gallery rendered blank tiles +
  a context-lost icon. Cause: one `<Canvas>` per tile = 16 WebGL contexts; mobile browsers
  cap concurrent contexts (~8), so most failed to init (desktop tolerated 16 by eviction).
- FIX: lazy-mount each tile's canvas behind an IntersectionObserver (rootMargin 150px), so
  only the few tiles in/near view hold a live context (mobile peak ~4 vs 16); the rest are
  a placeholder until scrolled to. ALSO `gridAutoRows: max-content` on the grid — the empty
  placeholder slots were being collapsed to ~29px by the grid row track (figure overflow
  :hidden), so all 16 fit on screen at once and defeated the lazy-mount. (Tried drei `View`
  / single shared context first; its rect-tracking misaligned in this scroll-container +
  fixed-canvas layout — reverted for the simpler, predictable lazy-mount.)
- Architect smoke at 390px: 16 tiles all render on scroll, PEAK 4 live canvases, console
  CLEAN; desktop unchanged (axe 0, console CLEAN). Gate GREEN. Screenshots reviewed.

## Tech props — hover tooltip + intro foundry (tasks #33–35) — done, verified
- "What built this?" HOVER: hovering a structure in the God-view pops a cursor-following
  card (structure name + blurb + the tech that built it, e.g. "Foundry · Built by Basic
  Industry · materials"). New `sim/propHover` store written via `getState()` so hovering
  NEVER re-renders the 3D scene (only the tiny `ui/PropTooltip` subscribes); `PROP_LABELS`
  per kind; pointer handlers on each prop wrapper in TechPropsLayer; hide(kind) de-dupes
  so sliding between props doesn't flicker. Mounted over the canvas in GameRoot + preview.
  NOTE: hover is mouse-only (a deliberate choice over the accessible panel) — the data
  isn't surfaced elsewhere yet, so a keyboard/touch path is a future a11y follow-up.
- INTRO foundry: the cinematic now ends on the homeworld coming alive — the cradle's first
  foundry rises out of the lit face (eased build-in) as the ship settles into orbit; shown
  built under reduced motion. Anchored to the visible face (doesn't co-rotate during the
  short cinematic) so the hero beat stays framed regardless of step pacing.
- preview/main exposes __sim/__selection/__propHover for headless smokes (preview-only).
- Architect smoke: intro foundry renders (console CLEAN); tooltip renders correct copy,
  clears on leave, and fires on a REAL pointer-over of a framed prop (landed on the
  Foundry). Gate GREEN. Screenshots reviewed (foundry on the cradle face; tooltip card).

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
