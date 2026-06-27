import { create } from "zustand";

/**
 * Persisted player settings — the seam shared by the settings UI (writes) and the
 * audio engine (reads volumes) + the game loop (reads autosave/defaultSpeed). Stored
 * separately from the game save so options survive New Game / reset save.
 */
export type ReducedMotion = "auto" | "on" | "off";

export interface Settings {
  /** Accessibility: force-reduce motion regardless of the OS setting. */
  reducedMotion: ReducedMotion;
  /** Starting timeScale (1/2/3) applied when a new game begins. */
  defaultSpeed: number;
  /** Whether the running game autosaves. */
  autosave: boolean;
  /** Audio volumes, 0..1. */
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

const KEY = "meteor-quest:settings";

export const DEFAULT_SETTINGS: Settings = {
  reducedMotion: "auto",
  defaultSpeed: 1,
  autosave: true,
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  muted: false,
};

function loadSettings(): Settings {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persist(s: Settings): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota/SSR: settings persistence is best-effort */
  }
}

function pickSettings(s: SettingsStore): Settings {
  const { reducedMotion, defaultSpeed, autosave, master, music, sfx, muted } = s;
  return { reducedMotion, defaultSpeed, autosave, master, music, sfx, muted };
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...loadSettings(),
  set: (key, value) =>
    set(() => {
      const next = { ...pickSettings(get()), [key]: value } as Settings;
      persist(next);
      return next as Partial<SettingsStore>;
    }),
  reset: () =>
    set(() => {
      persist(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }),
}));

/** Effective audio gains (0..1) after master + mute. Used by the audio engine. */
export function effectiveVolumes(s: Settings): { music: number; sfx: number } {
  const m = s.muted ? 0 : s.master;
  return { music: m * s.music, sfx: m * s.sfx };
}
