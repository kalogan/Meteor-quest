import { useId } from "react";
import { useSettings, type ReducedMotion } from "../../sim/settings";
import { clearSave } from "../../sim/persist";
import { MenuDialog } from "./MenuDialog";

const SPEEDS = [1, 2, 3] as const;
const MOTION_OPTIONS: { value: ReducedMotion; label: string }[] = [
  { value: "auto", label: "Match system" },
  { value: "on", label: "Reduce motion" },
  { value: "off", label: "Full motion" },
];

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/**
 * Settings dialog, openable from the title screen and the pause menu. Every control
 * is bound to the persisted `useSettings` store (writes go straight through `.set`),
 * so changes survive New Game and relaunch.
 *
 * The reducedMotion override is applied app-wide via
 * `document.documentElement.dataset.reducedMotion` (see applyReducedMotion + shell.css):
 *   - "on"  → force-disable transitions/animations under the shell.
 *   - "off" → opt out even if the OS prefers reduced motion.
 *   - "auto"→ remove the attribute, leaving the prefers-reduced-motion media query in charge.
 *
 * `onAfterResetSave` lets the host bounce to the title after wiping the save (a save
 * can't be resumed once cleared).
 */
export function applyReducedMotion(mode: ReducedMotion): void {
  if (typeof document === "undefined") return;
  if (mode === "auto") {
    delete document.documentElement.dataset.reducedMotion;
  } else {
    document.documentElement.dataset.reducedMotion = mode;
  }
}

export function SettingsPanel({
  onClose,
  onAfterResetSave,
}: {
  onClose: () => void;
  onAfterResetSave?: () => void;
}) {
  const s = useSettings();
  const motionId = useId();
  const speedLabelId = useId();
  const autosaveId = useId();
  const masterId = useId();
  const musicId = useId();
  const sfxId = useId();
  const muteId = useId();

  const setMotion = (value: ReducedMotion) => {
    s.set("reducedMotion", value);
    applyReducedMotion(value);
  };

  return (
    <MenuDialog title="Settings" onClose={onClose} onScrimClose={onClose}>
      <div className="shell-settings-list">
        {/* Reduced motion */}
        <div className="shell-field">
          <div className="shell-field__row">
            <label className="shell-field__label" htmlFor={motionId}>
              Motion
            </label>
            <select
              id={motionId}
              className="shell-select"
              value={s.reducedMotion}
              onChange={(e) => setMotion(e.target.value as ReducedMotion)}
            >
              {MOTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <span className="shell-field__hint">Reduce animation for comfort / accessibility.</span>
        </div>

        {/* Default speed */}
        <div className="shell-field">
          <div className="shell-field__row">
            <span className="shell-field__label" id={speedLabelId}>
              New-game speed
            </span>
            <div className="shell-seg" role="group" aria-labelledby={speedLabelId}>
              {SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  className="shell-seg__btn"
                  aria-pressed={s.defaultSpeed === spd}
                  onClick={() => s.set("defaultSpeed", spd)}
                >
                  {spd}×
                </button>
              ))}
            </div>
          </div>
          <span className="shell-field__hint">Starting time scale when a new game begins.</span>
        </div>

        {/* Autosave */}
        <div className="shell-field">
          <div className="shell-field__row">
            <label className="shell-field__label" htmlFor={autosaveId}>
              Autosave
            </label>
            <span className="shell-switch">
              <input
                id={autosaveId}
                type="checkbox"
                role="switch"
                checked={s.autosave}
                aria-checked={s.autosave}
                onChange={(e) => s.set("autosave", e.target.checked)}
              />
            </span>
          </div>
        </div>

        {/* Volumes */}
        <div className="shell-field">
          <div className="shell-field__row">
            <label className="shell-field__label" htmlFor={masterId}>
              Master volume
            </label>
            <span className="shell-field__value" aria-hidden="true">
              {pct(s.master)}
            </span>
          </div>
          <input
            id={masterId}
            className="shell-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.master}
            aria-valuetext={pct(s.master)}
            onChange={(e) => s.set("master", Number(e.target.value))}
          />
        </div>

        <div className="shell-field">
          <div className="shell-field__row">
            <label className="shell-field__label" htmlFor={musicId}>
              Music volume
            </label>
            <span className="shell-field__value" aria-hidden="true">
              {pct(s.music)}
            </span>
          </div>
          <input
            id={musicId}
            className="shell-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.music}
            aria-valuetext={pct(s.music)}
            onChange={(e) => s.set("music", Number(e.target.value))}
          />
        </div>

        <div className="shell-field">
          <div className="shell-field__row">
            <label className="shell-field__label" htmlFor={sfxId}>
              SFX volume
            </label>
            <span className="shell-field__value" aria-hidden="true">
              {pct(s.sfx)}
            </span>
          </div>
          <input
            id={sfxId}
            className="shell-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.sfx}
            aria-valuetext={pct(s.sfx)}
            onChange={(e) => s.set("sfx", Number(e.target.value))}
          />
        </div>

        {/* Mute */}
        <div className="shell-field">
          <div className="shell-field__row">
            <label className="shell-field__label" htmlFor={muteId}>
              Mute all
            </label>
            <span className="shell-switch">
              <input
                id={muteId}
                type="checkbox"
                role="switch"
                checked={s.muted}
                aria-checked={s.muted}
                onChange={(e) => s.set("muted", e.target.checked)}
              />
            </span>
          </div>
        </div>
      </div>

      <div className="shell-settings-footer">
        <button type="button" className="shell-btn" onClick={() => s.reset()}>
          Reset settings
        </button>
        <button
          type="button"
          className="shell-btn shell-btn--danger"
          onClick={() => {
            clearSave();
            onAfterResetSave?.();
          }}
        >
          Reset save
        </button>
      </div>

      <button type="button" className="shell-btn shell-btn--primary shell-dialog-close" onClick={onClose}>
        Done
      </button>
    </MenuDialog>
  );
}
