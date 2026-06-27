import { useEffect } from "react";
import { Stars } from "@react-three/drei";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { GalaxyView } from "./GalaxyView";
import { JourneyView, JourneySteering } from "./JourneyView";
import { CameraRig } from "./CameraRig";

/**
 * The God-view composition root. Owns the continuous-zoom rig and the world layers
 * (galaxy -> system -> planet -> continent -> city), all driven by the AUTHORITATIVE
 * sim state. Fog is enforced inside the layers (see GalaxyView): we never render
 * what the sim hides.
 *
 * The camera lives in ONE continuous space — the player zooms smoothly across
 * scales and clicks to frame; selection + zoom tier flow to the HUD via the
 * selection store. Lighting that follows the camera is in App; star illumination
 * comes from each system's star (see SystemView).
 */
export function WorldView() {
  const game = useSim((s) => s.game);
  const select = useSelection((s) => s.select);

  // Open framed on the cradle planet so the player starts at home, mid-zoom.
  const cradleId = game.cradlePlanetId;
  useEffect(() => {
    select(cradleId, "planet");
  }, [cradleId, select]);

  return (
    <>
      {/* Deep-space backdrop; the actual fog is per-entity, state-driven. */}
      <color attach="background" args={["#05060a"]} />
      <Stars radius={200} depth={80} count={2500} factor={3} saturation={0} fade speed={0.4} />

      {/* Soft fill so unlit/back faces of low-poly bodies still read. */}
      <ambientLight intensity={0.35} />
      <hemisphereLight color="#9fb4ff" groundColor="#0a0c14" intensity={0.3} />

      <GalaxyView game={game} />

      {/* In-flight expeditions: the visible ship + trail (only when one is flying). */}
      <JourneyView game={game} />
      {/* Key-based light steering (no render); active only while a journey is enroute. */}
      <JourneySteering game={game} />

      <CameraRig game={game} />
    </>
  );
}
