import { SURFACE_DEFAULTS, useSurfaceConfig, type SurfaceConfig } from "../sim/surfaceConfig";

/**
 * [preview] Live taste-knob panel for the surface dive / roam. Edits the shared
 * `useSurfaceConfig` store that SurfaceView + CameraRig read, so the Director tunes the
 * whole landed experience in real time. Preview-only (the shipped game uses the defaults).
 */
interface Knob {
  key: keyof SurfaceConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
}

const KNOBS: Knob[] = [
  { key: "arenaSize", label: "Arena size (×r)", min: 6, max: 24, step: 0.5, group: "Terrain" },
  { key: "relief", label: "Relief (×r)", min: 0, max: 0.3, step: 0.01, group: "Terrain" },
  { key: "dome", label: "Horizon dome (×r)", min: 0, max: 0.4, step: 0.01, group: "Terrain" },
  { key: "segs", label: "Mesh detail", min: 12, max: 64, step: 4, group: "Terrain" },
  { key: "hazeOpacity", label: "Haze opacity", min: 0, max: 0.6, step: 0.02, group: "Look" },
  { key: "structureScale", label: "Structure size (×r)", min: 0.05, max: 0.4, step: 0.01, group: "Look" },
  { key: "structureCount", label: "Structure count", min: 0, max: 10, step: 1, group: "Look" },
  { key: "eyeHeight", label: "Eye height (×r)", min: 0.1, max: 0.6, step: 0.01, group: "Camera" },
  { key: "standBack", label: "Stand back (×r)", min: 0, max: 0.5, step: 0.01, group: "Camera" },
  { key: "lookAhead", label: "Look ahead (×r)", min: 0.5, max: 3, step: 0.1, group: "Camera" },
  { key: "lookDrop", label: "Gaze dip (×r)", min: -0.1, max: 0.2, step: 0.01, group: "Camera" },
  { key: "roamSpeed", label: "Roam speed (×r/s)", min: 0.5, max: 4, step: 0.1, group: "Roam" },
  { key: "pitchMin", label: "Pitch min height (×r)", min: 0.02, max: 0.3, step: 0.01, group: "Roam" },
  { key: "pitchMax", label: "Pitch max height (×r)", min: 0.3, max: 1.2, step: 0.02, group: "Roam" },
];

const BORDER = "1px solid #1d2740";

export function SurfaceTuner() {
  const cfg = useSurfaceConfig();
  const set = useSurfaceConfig((s) => s.set);
  const reset = useSurfaceConfig((s) => s.reset);

  let lastGroup = "";
  return (
    <div
      data-testid="surface-tuner"
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        width: 250,
        maxHeight: "calc(100% - 24px)",
        overflowY: "auto",
        background: "rgba(10,14,22,0.92)",
        border: BORDER,
        borderRadius: 10,
        padding: 12,
        color: "#e8edf6",
        font: '500 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
        backdropFilter: "blur(6px)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Surface knobs</strong>
        <button
          data-testid="surface-tuner-reset"
          onClick={() => reset()}
          style={{ font: "inherit", fontWeight: 700, color: "#fff", background: "#2f66ea", border: "1px solid #5b8cff", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}
        >
          Reset
        </button>
      </div>
      {KNOBS.map((knob) => {
        const showGroup = knob.group !== lastGroup;
        lastGroup = knob.group;
        const value = cfg[knob.key];
        return (
          <div key={knob.key}>
            {showGroup && (
              <div style={{ margin: "10px 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#8fb4ff" }}>
                {knob.group}
              </div>
            )}
            <label style={{ display: "block", marginBottom: 6 }}>
              <span style={{ display: "flex", justifyContent: "space-between", color: "#cdd6e6" }}>
                <span>{knob.label}</span>
                <span style={{ color: "#aeb8cc" }}>{Number(value).toFixed(knob.step < 1 ? 2 : 0)}</span>
              </span>
              <input
                type="range"
                data-testid={`knob-${knob.key}`}
                min={knob.min}
                max={knob.max}
                step={knob.step}
                value={value}
                onChange={(e) => set({ [knob.key]: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "#5b8cff" }}
              />
            </label>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontSize: 11, color: "#7f8aa3" }}>
        Defaults: arena ×{SURFACE_DEFAULTS.arenaSize}, speed ×{SURFACE_DEFAULTS.roamSpeed}. Edits are preview-only.
      </div>
    </div>
  );
}
