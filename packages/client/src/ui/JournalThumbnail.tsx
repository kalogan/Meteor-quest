import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { GameState, Planet } from "@meteor/shared";
import { PlanetView } from "../world/PlanetView";

/**
 * [journal] A small rendered portrait of one logged world — the REAL PlanetView (never a
 * fork), so the journal image matches the globe you fly to. Each portrait is its own WebGL
 * context, and mobile browsers cap concurrent contexts (~8), so the canvas is LAZY-MOUNTED
 * behind an IntersectionObserver: only portraits in/near the scroll viewport hold a live
 * context; the rest are a cheap tinted placeholder until you scroll to them. (Same fix the
 * tech-props gallery uses.)
 */
export function JournalThumbnail({
  planet,
  game,
  tint,
  size = 84,
  reducedMotion = false,
}: {
  planet: Planet;
  game: GameState;
  tint: string;
  size?: number;
  reducedMotion?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setNear(entries[0]?.isIntersecting ?? false),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const isCradle = planet.id === game.cradlePlanetId;
  return (
    <div
      ref={ref}
      data-testid={`journal-thumb-${planet.id}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: 8,
        overflow: "hidden",
        // Tinted placeholder so an un-mounted (off-screen) portrait still reads as the world.
        background: `radial-gradient(circle at 38% 34%, ${tint} 0%, #06090f 78%)`,
        border: "1px solid #243150",
      }}
    >
      {near ? (
        <Canvas camera={{ position: [0, 0.9, 4.6], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.5]}>
          <ambientLight intensity={0.45} />
          <hemisphereLight color="#9fb4ff" groundColor="#0a0c14" intensity={0.4} />
          <pointLight position={[4, 5, 6]} intensity={45} distance={40} decay={1.6} color="#ffe9b0" />
          <PlanetView planet={planet} game={game} isCradle={isCradle} position={[0, 0, 0]} reducedMotion={reducedMotion} />
        </Canvas>
      ) : null}
    </div>
  );
}
