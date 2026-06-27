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
      <Canvas camera={{ position: [0, 14, 26], fov: 50 }}>
        <WorldView />
      </Canvas>
      <Hud />
    </div>
  );
}
