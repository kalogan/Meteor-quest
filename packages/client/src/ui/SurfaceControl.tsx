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
        // Sit ABOVE the HUD action bar (phone bottom bar / desktop pill) so the button isn't
        // hidden behind it. --hud-nav-h is the phone bar height; the extra clears the desktop pill.
        bottom: "calc(var(--hud-nav-h, 58px) + 24px + env(safe-area-inset-bottom, 0px))",
        transform: "translateX(-50%)",
        zIndex: 46,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {nearSurface && (
        <div
          data-testid="surface-roam-hint"
          style={{
            padding: "5px 12px",
            font: '600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif',
            color: "#cdd6e6",
            background: "rgba(10, 14, 22, 0.82)",
            border: "1px solid #2a3a5e",
            borderRadius: 20,
            backdropFilter: "blur(6px)",
          }}
        >
          Move: WASD / two-finger · Look: drag
        </div>
      )}
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
