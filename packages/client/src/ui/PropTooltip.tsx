import { usePropHover } from "../sim/propHover";

/**
 * [tech props] The "what built this?" tooltip — a small DOM card that follows the cursor
 * while hovering a structure in the God-view. Reads the transient propHover store (only
 * this component subscribes, so the 3D scene never re-renders on hover). Mounted once over
 * the canvas in both the game (GameRoot) and the preview.
 *
 * pointer-events:none so it never eats clicks/hover; positioned a little down-right of the
 * cursor and clamped so it stays on-screen near the right/bottom edges. Explicit AA-contrast
 * colours (no opacity dimming on text), matching the HUD/intro card language.
 */
export function PropTooltip() {
  const info = usePropHover((s) => s.info);
  const x = usePropHover((s) => s.x);
  const y = usePropHover((s) => s.y);
  if (!info) return null;

  // Offset from the cursor; flip to the left/up near the far edges so it stays visible.
  const W = 240;
  const margin = 16;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = x + margin + W > vw ? x - margin - W : x + margin;
  const top = Math.min(y + margin, vh - 96);

  return (
    <div
      data-testid="prop-tooltip"
      role="tooltip"
      style={{
        position: "fixed",
        left: Math.max(8, left),
        top: Math.max(8, top),
        width: W,
        pointerEvents: "none",
        zIndex: 50,
        background: "rgba(10, 14, 22, 0.94)",
        border: "1px solid #2a3a5e",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        padding: "10px 12px",
        color: "#e8edf6",
        font: '500 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{info.title}</div>
      <div style={{ color: "#aeb8cc", marginBottom: 6 }}>{info.blurb}</div>
      <div style={{ fontSize: 12, color: "#8fb4ff", fontWeight: 600 }}>
        Built by {info.techName} · {info.category}
      </div>
    </div>
  );
}
