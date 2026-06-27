import type { GameState } from "@meteor/shared";

/**
 * Save/load the AUTHORITATIVE GameState to localStorage. State is plain JSON
 * (records only, no class instances), so (de)serialization is just JSON. A version
 * tag guards against loading a save whose shape predates a breaking change — on a
 * version mismatch we discard the old save rather than crash on stale shapes.
 */
const SAVE_KEY = "meteor-quest:save";
const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  savedAt: number;
  state: GameState;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // access can throw in sandboxed/SSR contexts
  }
}

export function saveGame(state: GameState, now = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    const envelope: SaveEnvelope = { version: SAVE_VERSION, savedAt: now, state };
    store.setItem(SAVE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota or serialization failure: a failed autosave must never break the game.
  }
}

export function loadGame(): GameState | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as SaveEnvelope;
    if (env.version !== SAVE_VERSION || !env.state) return null; // stale/incompatible
    return env.state;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function clearSave(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Trailing throttle: coalesce frequent calls (the sim ticks several times a second)
 * into at most one save per `intervalMs`, always flushing the latest state. Uses
 * wall-clock — this is client-only autosave cadence, never sim logic, so determinism
 * is unaffected.
 */
export function makeThrottledSaver(intervalMs = 2000): (state: GameState) => void {
  let last = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let latest: GameState | null = null;

  const flush = () => {
    last = Date.now();
    pending = null;
    if (latest) saveGame(latest);
  };

  return (state: GameState) => {
    latest = state;
    const elapsed = Date.now() - last;
    if (elapsed >= intervalMs) {
      flush();
    } else if (!pending) {
      pending = setTimeout(flush, intervalMs - elapsed);
    }
  };
}
