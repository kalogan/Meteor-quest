import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { TICK_SECONDS } from "@meteor/sim-core";
import type { GameState } from "@meteor/shared";
// REUSE the REAL product components — never reimplementations.
import { WorldView } from "../world/WorldView";
import { PlanetView } from "../world/PlanetView";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { biomeGallery, flightTestState, listTech } from "./dataSource";

/**
 * The preview harness — a backend-free, dual-consumer tool over the REAL product:
 *
 *  - HUMAN taste-loop: flip between modes, drive the seed knob, eyeball the real
 *    WorldView / PlanetView / content against the real components.
 *  - AGENT runtime-smoke: every control has an accessible name + a stable
 *    data-testid, the seed knob is deterministic (previewState/store.reset), and
 *    "Freeze" stops all animation so a screenshot is reproducible.
 *
 * Production-truthful: it mounts the SAME WorldView/PlanetView the game ships and
 * the SAME content pack via the seam (dataSource) — never a fork "for preview".
 */
type Mode = "world" | "biomes" | "tech" | "flight";

const MODES: { id: Mode; label: string }[] = [
  { id: "world", label: "World" },
  { id: "biomes", label: "Biomes" },
  { id: "tech", label: "Tech" },
  { id: "flight", label: "Flight" },
];

const SURFACE = "#0a0e16";
const BORDER = "1px solid #1d2740";

export function PreviewApp() {
  const [mode, setMode] = useState<Mode>("world");
  const [seed, setSeed] = useState(0);
  // "Freeze" pauses the R3F render loop so useFrame spins/pulses stop — the view
  // becomes a reproducible still for agent smoke. Live (default) for human taste.
  const [frozen, setFrozen] = useState(false);

  const reset = useSim((s) => s.reset);
  const select = useSelection((s) => s.select);

  // Reseed the AUTHORITATIVE world through the same path the product uses, so
  // seed 0 == the on-disk identity world and every seed is reproducible. Flight mode
  // installs its OWN launch-ready world, so don't stomp it with a plain reset.
  useEffect(() => {
    if (mode !== "flight") reset(seed);
  }, [seed, reset, mode]);

  const tech = useMemo(() => listTech(), []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      <header
        data-testid="harness-toolbar"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: SURFACE, borderBottom: BORDER, flexWrap: "wrap" }}
      >
        <strong style={{ marginRight: 12 }}>Preview Harness</strong>

        <div role="tablist" aria-label="Preview mode" data-testid="mode-tabs" style={{ display: "flex", gap: 8 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              data-testid={`mode-tab-${m.id}`}
              onClick={() => setMode(m.id)}
              style={tabStyle(mode === m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <span style={{ width: 1, height: 22, background: "#1d2740", margin: "0 4px" }} />

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          seed
          <input
            type="number"
            aria-label="seed"
            data-testid="seed-input"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: 72, background: "#10182a", color: "#e8eef7", border: BORDER, borderRadius: 4, padding: "3px 6px" }}
          />
        </label>
        <button
          aria-label="reset seed to identity world"
          data-testid="seed-reset"
          onClick={() => setSeed(0)}
          style={tabStyle(false)}
        >
          identity (0)
        </button>

        <button
          aria-label="freeze animation"
          aria-pressed={frozen}
          data-testid="freeze-toggle"
          onClick={() => setFrozen((f) => !f)}
          style={tabStyle(frozen)}
        >
          {frozen ? "frozen" : "live"}
        </button>
      </header>

      <main data-testid={`mode-panel-${mode}`} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {mode === "world" && <WorldMode frozen={frozen} />}
        {mode === "biomes" && <BiomeGalleryMode seed={seed} frozen={frozen} onInspect={select} />}
        {mode === "tech" && <TechMode tech={tech} />}
        {mode === "flight" && <FlightMode seed={seed} frozen={frozen} />}
      </main>
    </div>
  );
}

/** World mode: the REAL God-view, driven by the seeded authoritative sim store. */
function WorldMode({ frozen }: { frozen: boolean }) {
  return (
    <Canvas
      data-testid="world-canvas"
      frameloop={frozen ? "demand" : "always"}
      camera={{ position: [6, 5, 9], fov: 50, near: 0.1, far: 2000 }}
    >
      <WorldView />
    </Canvas>
  );
}

/**
 * Biome gallery: one tile per biome, each mounting the REAL PlanetView for a real
 * specimen planet of that biome (enumerated from content — zero per-artifact wiring).
 */
function BiomeGalleryMode({
  seed,
  frozen,
  onInspect,
}: {
  seed: number;
  frozen: boolean;
  onInspect: (id: string | null, kind: "planet") => void;
}) {
  const specimens = useMemo(() => biomeGallery(seed), [seed]);
  return (
    <div
      data-testid="biome-gallery"
      style={{ position: "absolute", inset: 0, overflow: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, alignContent: "start" }}
    >
      {specimens.map(({ biome, planet, game }) => (
        <figure
          key={biome.id}
          data-testid={`biome-cell-${biome.id}`}
          style={{ margin: 0, border: BORDER, borderRadius: 10, overflow: "hidden", background: "#070b13" }}
        >
          <div style={{ height: 200 }}>
            <Canvas frameloop={frozen ? "demand" : "always"} camera={{ position: [0, 1.2, 5.2], fov: 45 }}>
              <ambientLight intensity={0.4} />
              <hemisphereLight color="#9fb4ff" groundColor="#0a0c14" intensity={0.35} />
              <pointLight position={[4, 5, 6]} intensity={50} distance={40} decay={1.6} color="#ffe9b0" />
              <PlanetView planet={planet} game={game} isCradle={false} position={[0, 0, 0]} />
            </Canvas>
          </div>
          <figcaption style={{ padding: 12, borderTop: BORDER }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 14, height: 14, borderRadius: 7, background: biome.color }} />
              <strong>{biome.name}</strong>
              <button
                aria-label={`inspect ${biome.name}`}
                data-testid={`biome-inspect-${biome.id}`}
                onClick={() => onInspect(planet.id, "planet")}
                style={{ ...tabStyle(false), marginLeft: "auto", fontSize: 12, padding: "2px 8px" }}
              >
                inspect
              </button>
            </div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              yields {biome.uniqueResource} · +{Math.round((biome.spiff.multiplier - 1) * 100)}% {biome.spiff.category}
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Tech mode: the authored tech tree, read from the content pack via the seam. */
function TechMode({ tech }: { tech: ReturnType<typeof listTech> }) {
  return (
    <div data-testid="tech-tree" style={{ position: "absolute", inset: 0, padding: 16, overflow: "auto" }}>
      {tech.map((t) => (
        <div key={t.id} data-testid={`tech-row-${t.id}`} style={{ padding: "6px 0", borderBottom: "1px solid #141b2b" }}>
          <strong>{t.name}</strong> <span style={{ opacity: 0.6 }}>({t.category}, {t.cost})</span>
          {t.requiredResource && <span style={{ color: "#ffb454" }}> · needs {t.requiredResource}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Flight test mode — fly to a new planet WITHOUT first progressing the economy/tech.
 * It installs a launch-ready world (`flightTestState`) and drives the REAL sim over
 * time, mounting the REAL `WorldView`, so the ship + engine trail + camera-follow +
 * arrow-key steering all play out exactly as in the shipped game (production-truthful
 * — same components, same `launchJourney` command, no fork). Pick a destination and
 * watch it fly; steer with ← →.
 */
function FlightMode({ seed, frozen }: { seed: number; frozen: boolean }) {
  const game = useSim((s) => s.game);
  const setGame = useSim((s) => s.setGame);
  const dispatch = useSim((s) => s.dispatch);

  // Install / reinstall the launch-ready world on enter + seed change.
  useEffect(() => {
    setGame(flightTestState(seed));
  }, [seed, setGame]);

  // Advance the real sim over wall-clock time (no autosave — preview only).
  useFlightTicker(frozen);

  const targets = Object.values(game.systems)
    .filter((s) => s.id !== game.homeSystemId)
    .sort((a, b) => a.distanceFromHome - b.distanceFromHome);
  const active = Object.values(game.journeys)[0];

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas
        data-testid="flight-canvas"
        frameloop={frozen ? "demand" : "always"}
        camera={{ position: [6, 5, 9], fov: 50, near: 0.1, far: 4000 }}
      >
        <WorldView />
      </Canvas>

      <div
        data-testid="flight-controls"
        style={{
          position: "absolute", top: 12, left: 12, width: 264,
          maxHeight: "calc(100% - 24px)", overflow: "auto",
          background: "rgba(10,14,22,0.9)", border: BORDER, borderRadius: 8, padding: 12,
          pointerEvents: "auto",
        }}
      >
        {active ? (
          <div data-testid="flight-active">
            <strong>Flying → {systemName(game, active.targetSystemId)}</strong>
            <div style={{ color: "#aab4c8", fontSize: 13, marginTop: 6 }}>
              fuel {active.fuel.toFixed(0)} · {active.status}
            </div>
            <div style={{ color: "#aab4c8", fontSize: 12, marginTop: 6 }}>
              Steer with ← → (autopilot still homes in). The camera follows the ship.
            </div>
            <button
              data-testid="flight-abort"
              onClick={() => dispatch({ type: "abortJourney", journeyId: active.id })}
              style={{ ...tabStyle(false), marginTop: 10, width: "100%" }}
            >
              Abort
            </button>
          </div>
        ) : (
          <div>
            <strong>Flight test</strong>
            <div style={{ color: "#aab4c8", fontSize: 13, margin: "6px 0 10px" }}>
              Launch-ready world — no resources needed. Pick a destination:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {targets.map((sys) => (
                <button
                  key={sys.id}
                  data-testid={`flight-launch-${sys.id}`}
                  onClick={() => dispatch({ type: "launchJourney", targetSystemId: sys.id })}
                  style={{ ...tabStyle(false), textAlign: "left" }}
                >
                  Fly to {sys.name} <span style={{ color: "#aab4c8" }}>· {sys.distanceFromHome.toFixed(0)} ly</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function systemName(game: GameState, id: string): string {
  return game.systems[id]?.name ?? id;
}

/** Real-time tick driver for Flight mode (no autosave; preview-only). */
function useFlightTicker(frozen: boolean) {
  const last = useRef<number | null>(null);
  const acc = useRef(0);
  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (last.current === null) {
        last.current = now;
        return;
      }
      const dt = Math.min(0.25, (now - last.current) / 1000) * 2; // 2× for snappy testing
      last.current = now;
      acc.current += dt;
      let steps = 0;
      while (acc.current >= TICK_SECONDS && steps < 240) {
        acc.current -= TICK_SECONDS;
        steps++;
      }
      if (steps > 0) useSim.getState().advance(steps);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [frozen]);
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "#2b6cff" : "#1a2236",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "4px 10px",
    cursor: "pointer",
  };
}
