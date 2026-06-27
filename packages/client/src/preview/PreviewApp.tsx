import { useState } from "react";
import { Canvas } from "@react-three/fiber";
// REUSE the REAL product components — never reimplementations.
import { WorldView } from "../world/WorldView";
import { listBiomes, listTech } from "./dataSource";

/**
 * PLACEHOLDER preview harness shell (builder #7 expands: mode tabs, camera/viewport
 * controls, seed + knobs, per-artifact gallery). It mounts the REAL WorldView and
 * the REAL content packs via the seam, so what you see is what ships.
 */
type Mode = "world" | "biomes" | "tech";

export function PreviewApp() {
  const [mode, setMode] = useState<Mode>("world");
  const biomes = listBiomes();
  const tech = listTech();

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, padding: 8, background: "#0a0e16", borderBottom: "1px solid #1d2740" }}>
        <strong style={{ marginRight: 12 }}>Preview Harness</strong>
        {(["world", "biomes", "tech"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{ background: mode === m ? "#2b6cff" : "#1a2236", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
          >
            {m}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {mode === "world" && (
          <Canvas camera={{ position: [0, 14, 26], fov: 50 }}>
            <WorldView />
          </Canvas>
        )}
        {mode === "biomes" && (
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
            {biomes.map((b) => (
              <div key={b.id} style={{ border: "1px solid #1d2740", borderRadius: 8, padding: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: b.color, marginBottom: 8 }} />
                <strong>{b.name}</strong>
                <div style={{ opacity: 0.7, fontSize: 13 }}>
                  yields {b.uniqueResource} · +{Math.round((b.spiff.multiplier - 1) * 100)}% {b.spiff.category}
                </div>
              </div>
            ))}
          </div>
        )}
        {mode === "tech" && (
          <div style={{ padding: 16, overflow: "auto", height: "100%" }}>
            {tech.map((t) => (
              <div key={t.id} style={{ padding: "6px 0", borderBottom: "1px solid #141b2b" }}>
                <strong>{t.name}</strong> <span style={{ opacity: 0.6 }}>({t.category}, {t.cost})</span>
                {t.requiredResource && <span style={{ color: "#ffb454" }}> · needs {t.requiredResource}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
