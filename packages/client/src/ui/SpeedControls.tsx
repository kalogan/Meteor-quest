import { useSim } from "../sim/store";
import { button, panel, subtle } from "./theme";

const SPEEDS = [0, 1, 2, 3] as const;

/** Pause/speed controls — dispatches setTimeScale 0/1/2/3. */
export function SpeedControls() {
  const timeScale = useSim((s) => s.game.timeScale);
  const dispatch = useSim((s) => s.dispatch);

  return (
    <div style={{ ...panel, top: 12, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ ...subtle, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>speed</span>
      {SPEEDS.map((s) => (
        <button
          key={s}
          onClick={() => dispatch({ type: "setTimeScale", scale: s })}
          style={{ ...button(timeScale === s), minWidth: 32 }}
          title={s === 0 ? "Pause" : `${s}× speed`}
        >
          {s === 0 ? "❚❚" : `${s}×`}
        </button>
      ))}
    </div>
  );
}
