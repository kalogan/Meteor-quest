import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type { CameraControlsImpl } from "@react-three/drei";
import { Vector3 } from "three";
import type { GameState } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import { activeJourney } from "./JourneyView";
import {
  framingDistance,
  focusSurfaceNormal,
  galaxyCenter,
  journeyHeading,
  journeyPosition,
  planetRadius,
  resolveWorldPosition,
  systemPosition,
  tierForDistance,
} from "./layout";

/**
 * The continuous-zoom rig — THE signature mechanic. One CameraControls instance
 * dollies through a single continuous space; there are no scene swaps. Two jobs:
 *
 *  1. FRAME ON SELECT — when the selection store changes, smoothly fly the camera
 *     to that entity's world position at the framing distance for its kind
 *     (system -> planet -> continent -> city), so a click "zooms into" the thing.
 *  2. REPORT THE TIER — every frame, read the live camera-to-target distance and
 *     classify it into a zoom TIER, pushing it to setZoomTier so the HUD's context
 *     panel tracks where the camera is (which may differ from authority tier).
 *
 * The player can still pan/zoom freely between frames; the tier just follows the
 * camera. We never move sim state here — selection + zoomTier are cosmetic view.
 */
export function CameraRig({ game }: { game: GameState }) {
  const controls = useRef<CameraControlsImpl | null>(null);
  const camera = useThree((s) => s.camera);

  const selectedId = useSelection((s) => s.selectedId);
  const selectedKind = useSelection((s) => s.selectedKind);
  const setZoomTier = useSelection((s) => s.setZoomTier);
  const setNearSurface = useSelection((s) => s.setNearSurface);
  const frameRequest = useSelection((s) => s.frameRequest);

  // Track the last reported tier so we only push the store on a change.
  const lastTier = useRef<string | null>(null);

  // --- Journey follow state ---------------------------------------------------
  // True while the rig is auto-framing an in-flight expedition. When it flips back
  // to false (arrival / abort / none) we re-apply the player's selection framing once
  // so control eases back to the normal view instead of stranding the camera.
  const following = useRef(false);
  // Manually-smoothed eye + target we drive each follow frame (so we don't restart
  // CameraControls' own transition every frame, which would stutter).
  const followEye = useRef(new Vector3());
  const followTarget = useRef(new Vector3());
  // Scratch vectors so per-frame follow allocates nothing.
  const _ship = useRef(new Vector3());
  const _lead = useRef(new Vector3());
  const _eye = useRef(new Vector3());
  // [surface dive] scratch for the per-frame camera-to-planet proximity test.
  const _camPos = useRef(new Vector3());
  const _tmpCenter = useRef(new Vector3());

  // Smoothly frame the current selection (or the whole galaxy when nothing is
  // selected). Shared by the selection effect and the follow-exit so the camera eases
  // back to the player's view when an expedition arrives. `enableTransition` lets the
  // exit case animate; passing it through CameraControls' transition flag.
  const frameSelection = (cc: CameraControlsImpl, enableTransition: boolean) => {
    if (!selectedId || !selectedKind) {
      const [gx, gy, gz] = galaxyCenter(game);
      const gd = framingDistance("galaxy");
      cc.setLookAt(
        gx + gd * 0.2,
        gy + gd * 0.45,
        gz + gd * 0.85,
        gx,
        gy,
        gz,
        enableTransition,
      );
      return;
    }
    const target = resolveWorldPosition(game, selectedId, selectedKind);
    if (!target) return; // fogged / unresolved: don't move
    const dist = framingDistance(selectedKind);
    const [tx, ty, tz] = target;
    // Offset the eye up-and-back from the target for a readable 3/4 angle.
    cc.setLookAt(
      tx + dist * 0.55,
      ty + dist * 0.5,
      tz + dist * 0.7,
      tx,
      ty,
      tz,
      enableTransition,
    );
  };

  // [surface dive] Fly to a landed surface pose ("surface") or back out to the focused
  // planet ("planet"), driven by the Descend / Pull-up buttons via selection.frameRequest.
  const frameToLevel = (cc: CameraControlsImpl, level: "surface" | "planet") => {
    if (!selectedId || !selectedKind || selectedKind === "system") return;
    const fn = focusSurfaceNormal(game, selectedId, selectedKind);
    const center = fn ? resolveWorldPosition(game, fn.planet.id, "planet") : null;
    if (!fn || !center) return;
    const r = planetRadius(fn.planet, fn.planet.id === game.cradlePlanetId);
    if (level === "planet") {
      const d = framingDistance("planet");
      cc.setLookAt(center[0] + d * 0.55, center[1] + d * 0.5, center[2] + d * 0.7, center[0], center[1], center[2], true);
      return;
    }
    // A landed, horizon-facing pose. Derive the surface point from the focus NORMAL (so it
    // works for a plain planet selection too, where resolveWorldPosition gives the centre)
    // — the planet's local axes equal world axes here, so the local normal is the outward
    // world normal. Stand a little above the ground and look forward along the tangent.
    const up = new Vector3(fn.normal[0], fn.normal[1], fn.normal[2]).normalize();
    const surf = new Vector3(center[0] + up.x * r, center[1] + up.y * r, center[2] + up.z * r);
    let t = new Vector3().crossVectors(up, new Vector3(0, 1, 0));
    if (t.lengthSq() < 1e-4) t = new Vector3().crossVectors(up, new Vector3(1, 0, 0));
    t.normalize();
    const eye = surf.clone().addScaledVector(up, r * 0.22).addScaledVector(t, -r * 0.15);
    const look = surf.clone().addScaledVector(t, r * 1.3).addScaledVector(up, -r * 0.04);
    cc.setLookAt(eye.x, eye.y, eye.z, look.x, look.y, look.z, true);
  };

  // React to a Descend / Pull-up request (one-shot, via the frameRequest token).
  useEffect(() => {
    const cc = controls.current;
    if (!cc || !frameRequest || following.current) return;
    frameToLevel(cc, frameRequest.level);
    // Fire only when a new frame request arrives; `game`/selection read fresh inside.
  }, [frameRequest]);

  // Fly to the selected entity whenever selection changes. While an expedition is in
  // flight the follow loop owns the camera, so we skip selection re-framing then (the
  // player's click is honored when the journey ends and follow hands control back).
  useEffect(() => {
    const cc = controls.current;
    if (!cc || following.current) return;
    frameSelection(cc, true);
    // Intentionally framing only when the SELECTION changes (not every sim tick);
    // `game` is read fresh on each run for the latest positions.
  }, [selectedId, selectedKind]);

  // Each frame: follow the active expedition (if any), then classify the live
  // distance into a tier and report changes.
  useFrame((_, delta) => {
    const cc = controls.current;
    if (!cc) return;

    // --- Journey follow -------------------------------------------------------
    const journey = activeJourney(game);
    if (journey) {
      const [jx, jy, jz] = journeyPosition(journey);
      _ship.current.set(jx, jy, jz);

      // Lead the look-target slightly toward the destination so the framing reads as
      // "heading there", not "drifting" — fall back to the heading vector if the
      // target system isn't resolvable yet.
      const targetSys = game.systems[journey.targetSystemId];
      if (targetSys) {
        const [tx, ty, tz] = systemPosition(targetSys);
        _lead.current.set(tx - jx, ty - jy, tz - jz);
      } else {
        const [hx, hy, hz] = journeyHeading(journey);
        _lead.current.set(hx, hy, hz);
      }
      if (_lead.current.lengthSq() > 1e-6) _lead.current.normalize();

      // Aim a touch ahead of the ship along the travel direction.
      const lead = 2.2;
      _lead.current.multiplyScalar(lead);
      const desiredTargetX = jx + _lead.current.x;
      const desiredTargetY = jy + _lead.current.y;
      const desiredTargetZ = jz + _lead.current.z;

      // Eye: an up-and-back 3/4 chase at a comfortable system-scale distance.
      const followDist = 14;
      _eye.current.set(
        jx + followDist * 0.45,
        jy + followDist * 0.5,
        jz + followDist * 0.6,
      );

      if (!following.current) {
        // Just entered follow: seed the smoothed values at the camera's current
        // look so we glide in from wherever the player was, not snap.
        cc.getTarget(followTarget.current);
        cc.getPosition(followEye.current);
        following.current = true;
      }

      // Critically-damped-ish lerp toward the desired chase pose (frame-rate aware).
      const k = 1 - Math.exp(-delta * 3.2);
      followEye.current.lerp(_eye.current, k);
      followTarget.current.lerp(
        _ship.current.set(desiredTargetX, desiredTargetY, desiredTargetZ),
        k,
      );
      cc.setLookAt(
        followEye.current.x,
        followEye.current.y,
        followEye.current.z,
        followTarget.current.x,
        followTarget.current.y,
        followTarget.current.z,
        false,
      );
    } else if (following.current) {
      // Expedition ended (arrived / aborted / none): ease back to the player's view.
      following.current = false;
      frameSelection(cc, true);
    }

    const dist = cc.distance;
    if (!Number.isFinite(dist) || dist <= 0) return;
    const tier = tierForDistance(dist);
    if (tier !== lastTier.current) {
      lastTier.current = tier;
      setZoomTier(tier);
    }

    // [surface dive] nearSurface = camera within ~1.6× the focused planet's radius of its
    // CENTRE (not the look-target — the landed pose looks at the horizon, so eye→target is
    // large). The store only updates on change, so this per-frame test costs no re-renders.
    let near = false;
    if (!journey && selectedId && selectedKind && selectedKind !== "system") {
      const fn = focusSurfaceNormal(game, selectedId, selectedKind);
      const center = fn ? resolveWorldPosition(game, fn.planet.id, "planet") : null;
      if (fn && center) {
        const r = planetRadius(fn.planet, fn.planet.id === game.cradlePlanetId);
        cc.getPosition(_camPos.current);
        near = _camPos.current.distanceTo(_tmpCenter.current.set(center[0], center[1], center[2])) < r * 1.6;
      }
    }
    setNearSurface(near);
  });

  return (
    <CameraControls
      ref={controls}
      camera={camera as CameraControlsImpl["camera"]}
      makeDefault
      // Allow the full continuous span from a city surface out to galaxy scale.
      minDistance={0.6}
      maxDistance={260}
      // Smooth, weighty motion — the "one continuous zoom" should feel like gliding.
      smoothTime={0.45}
      draggingSmoothTime={0.18}
      dollySpeed={0.6}
    />
  );
}
