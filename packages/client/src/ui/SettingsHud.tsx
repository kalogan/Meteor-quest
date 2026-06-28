import { useId } from "react";
import { useSim } from "../sim/store";
import { useSettings, type ReducedMotion } from "../sim/settings";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { applyReducedMotion } from "./shell/SettingsPanel";
import { button, subtle, MUTED_TEXT } from "./theme";

/**
 * [settings] The in-game SETTINGS sheet — the live controls a player reaches for mid-run:
 * the GAME SPEED (pause/1×/2×/3×, which write straight to the running sim) plus their
 * audio + motion preferences (which live in the persisted `useSettings` store, so they
 * survive New Game / relaunch).
 *
 * It rides the shared `CollapsiblePanel` primitive, so it joins the desktop dock and the
 * phone bottom-sheet nav for free (we just pass the nav props). Distinct from the title /
 * pause `SettingsPanel` dialog: this is the always-reachable HUD surface, focused on the
 * knobs you change while playing rather than save/reset administration.
 *
 * Speed is authoritative-write (dispatches into the sim). Everything else is bound to
 * `useSettings.set`, and the motion control also mirrors the choice onto the document via
 * `applyReducedMotion` so the shell reacts immediately. Every control carries an accessible
 * name (label htmlFor + useId, or aria-label) and AA-contrast text from the theme palette.
 */

const SPEEDS = [0, 1, 2, 3] as const;

const MOTION_OPTIONS: { value: ReducedMotion; label: string }[] = [
  { value: "auto", label: "Match system" },
  { value: "on", label: "Reduce motion" },
  { value: "off", label: "Full motion" },
];

function speedLabel(scale: number): string {
  return scale === 0 ? "Pause" : `${scale}× speed`;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const sectionLabel = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
  color: MUTED_TEXT,
  margin: "0 0 6px",
};

const fieldRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 8,
};

const fieldLabel = { fontSize: 12, color: "#e8edf6" };

const selectStyle = {
  background: "#1a2236",
  color: "#e8edf6",
  border: "1px solid #3a4668",
  borderRadius: 4,
  padding: "4px 6px",
  fontSize: 12,
};

export function SettingsHud() {
  const timeScale = useSim((s) => s.game.timeScale);
  const dispatch = useSim((s) => s.dispatch);
  const s = useSettings();

  const motionId = useId();
  const masterId = useId();
  const musicId = useId();
  const sfxId = useId();
  const muteId = useId();

  const setMotion = (value: ReducedMotion) => {
    s.set("reducedMotion", value);
    applyReducedMotion(value);
  };

  const volumeField = (id: string, label: string, key: "master" | "music" | "sfx", testid: string) => (
    <div style={{ marginBottom: 8 }}>
      <div style={fieldRow}>
        <label htmlFor={id} style={fieldLabel}>
          {label}
        </label>
        <span style={{ ...subtle, fontSize: 12 }} aria-hidden="true">
          {pct(s[key])}
        </span>
      </div>
      <input
        id={id}
        data-testid={testid}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={s[key]}
        aria-valuetext={pct(s[key])}
        onChange={(e) => s.set(key, Number(e.target.value))}
        style={{ width: "100%", accentColor: "#2f66ea" }}
      />
    </div>
  );

  return (
    <CollapsiblePanel
      title="Settings"
      defaultOpen={false}
      className="hud-dock hud-dock-settings"
      mobileId="settings"
      mobileLabel="Settings"
      mobileIcon="⚙️"
      mobileOrder={7}
      style={{ width: 300, maxHeight: "70vh", overflowY: "auto" }}
    >
      <div data-testid="settings-panel">
        {/* Speed — writes straight into the running sim. */}
        <p style={sectionLabel}>Speed</p>
        <div role="group" aria-label="Game speed" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {SPEEDS.map((scale) => (
            <button
              key={scale}
              type="button"
              data-testid={`settings-speed-${scale}`}
              onClick={() => dispatch({ type: "setTimeScale", scale })}
              aria-pressed={timeScale === scale}
              aria-label={scale === 0 ? "Pause" : `${scale}× speed`}
              title={speedLabel(scale)}
              style={{ ...button(timeScale === scale), minWidth: 36 }}
            >
              <span aria-hidden="true">{scale === 0 ? "❚❚" : `${scale}×`}</span>
            </button>
          ))}
        </div>

        {/* Audio + motion — persisted player preferences. */}
        <p style={sectionLabel}>Audio</p>

        <div style={fieldRow}>
          <label htmlFor={motionId} style={fieldLabel}>
            Motion
          </label>
          <select
            id={motionId}
            data-testid="settings-motion"
            value={s.reducedMotion}
            onChange={(e) => setMotion(e.target.value as ReducedMotion)}
            style={selectStyle}
          >
            {MOTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {volumeField(masterId, "Master volume", "master", "settings-vol-master")}
        {volumeField(musicId, "Music volume", "music", "settings-vol-music")}
        {volumeField(sfxId, "SFX volume", "sfx", "settings-vol-sfx")}

        <div style={{ ...fieldRow, marginTop: 4, marginBottom: 0 }}>
          <label htmlFor={muteId} style={fieldLabel}>
            Mute all
          </label>
          <input
            id={muteId}
            data-testid="settings-mute"
            type="checkbox"
            role="switch"
            checked={s.muted}
            aria-checked={s.muted}
            onChange={(e) => s.set("muted", e.target.checked)}
            style={{ accentColor: "#2f66ea", width: 16, height: 16 }}
          />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
