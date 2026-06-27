import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type { CameraControlsImpl } from "@react-three/drei";
import type { GameState } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import {
  framingDistance,
  galaxyCenter,
  resolveWorldPosition,
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

  // Track the last reported tier so we only push the store on a change.
  const lastTier = useRef<string | null>(null);

  // Fly to the selected entity whenever selection changes.
  useEffect(() => {
    const cc = controls.current;
    if (!cc) return;

    // Deselecting (click empty space) zooms ALL the way out to the galaxy band,
    // framing the whole galaxy — the top of the continuous zoom (galaxy map view).
    if (!selectedId || !selectedKind) {
      const [gx, gy, gz] = galaxyCenter(game);
      const gd = framingDistance("galaxy");
      cc.setLookAt(gx + gd * 0.2, gy + gd * 0.45, gz + gd * 0.85, gx, gy, gz, true);
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
      true,
    );
    // Intentionally framing only when the SELECTION changes (not every sim tick);
    // `game` is read fresh on each run for the latest positions.
  }, [selectedId, selectedKind]);

  // Each frame, classify the live distance into a tier and report changes.
  useFrame(() => {
    const cc = controls.current;
    if (!cc) return;
    const dist = cc.distance;
    if (!Number.isFinite(dist) || dist <= 0) return;
    const tier = tierForDistance(dist);
    if (tier !== lastTier.current) {
      lastTier.current = tier;
      setZoomTier(tier);
    }
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
