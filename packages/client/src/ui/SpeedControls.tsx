import { useSim } from "../sim/store";
import { button, panel, subtle } from "./theme";

const SPEEDS = [0, 1, 2, 3] as const;

function speedLabel(s: number): string {
  return s === 0 ? "Pause" : `${s}× speed`;
}

/** Pause/speed controls — dispatches setTimeScale 0/1/2/3. Each button is a real
 *  toggle: `aria-pressed` exposes the active speed, and the icon-only pause carries
 *  an `aria-label`. */
export function SpeedControls() {
  const timeScale = useSim((s) => s.game.timeScale);
  const dispatch = useSim((s) => s.dispatch);

  return (
    <section
      className="hud-panel hud-panel--speed hud-dock hud-dock-tr"
      style={{ ...panel, display: "flex", alignItems: "center", gap: 6 }}
      role="group"
      aria-label="Game speed"
    >
      <span style={{ ...subtle, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>speed</span>
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => dispatch({ type: "setTimeScale", scale: s })}
          style={{ ...button(timeScale === s), minWidth: 32 }}
          aria-pressed={timeScale === s}
          aria-label={speedLabel(s)}
          title={speedLabel(s)}
        >
          <span aria-hidden="true">{s === 0 ? "❚❚" : `${s}×`}</span>
        </button>
      ))}
    </section>
  );
}
