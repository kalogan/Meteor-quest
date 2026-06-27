import { useSelection } from "../sim/selection";

/**
 * [surface dive] The Descend / Pull-up control. Appears whenever something on a planet is
 * focused (planet / continent / city). Clicking drops the camera to a landed surface pose
 * (or back out to the planet) via selection.requestFrame — the discoverable companion to
 * "just keep zooming in", which enters the surface on its own.
 */
export function SurfaceControl() {
  const selectedKind = useSelection((s) => s.selectedKind);
  const nearSurface = useSelection((s) => s.nearSurface);
  const requestFrame = useSelection((s) => s.requestFrame);

  const onPlanet = selectedKind === "planet" || selectedKind === "continent" || selectedKind === "city";
  if (!onPlanet) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(18px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 40,
      }}
    >
      <button
        data-testid="surface-toggle"
        onClick={() => requestFrame(nearSurface ? "planet" : "surface")}
        aria-label={nearSurface ? "Pull up from the surface" : "Descend to the surface"}
        style={{
          appearance: "none",
          minHeight: 44,
          padding: "10px 20px",
          font: '700 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif',
          color: "#fff",
          background: "rgba(16, 22, 36, 0.92)",
          border: "1px solid #3a4668",
          borderRadius: 22,
          boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
          cursor: "pointer",
          backdropFilter: "blur(6px)",
        }}
      >
        {nearSurface ? "↑ Pull up" : "↓ Descend to surface"}
      </button>
    </div>
  );
}
