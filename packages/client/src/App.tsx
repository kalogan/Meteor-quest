import { Canvas } from "@react-three/fiber";
import { WorldView } from "./world/WorldView";
import { Hud } from "./ui/Hud";
import { useGameLoop } from "./sim/useGameLoop";

/**
 * Product entry. The God-view canvas (builder #5) + the HUD/control overlay
 * (builder #6) sit over the authoritative sim, driven by the real-time loop.
 */
export function App() {
  useGameLoop();
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* Initial camera is a sensible default; the CameraRig (in WorldView) takes
          over as the default camera and drives the continuous zoom. */}
      <Canvas camera={{ position: [6, 5, 9], fov: 50, near: 0.1, far: 2000 }}>
        <WorldView />
      </Canvas>
      <Hud />
    </div>
  );
}
