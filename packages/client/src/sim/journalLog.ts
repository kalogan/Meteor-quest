import { create } from "zustand";
import type { GameState } from "@meteor/shared";
import { useSim } from "./store";

/**
 * [journal] When you FIRST logged each world — the timestamp a travelogue keeps ("charted on
 * tick 412"). The sim model has no "discovered-at" field (a planet is just scanned/settled), so
 * this is a thin CLIENT-SIDE observer: it watches the authoritative sim and records the tick a
 * planet first became logged (scanned/settled/cradle). It also queues newly-logged worlds for a
 * toast. Persisted per-seed so timestamps survive reload; baseline-silent on first sight of a
 * world set (a loaded save full of charted worlds doesn't spam toasts), exactly like the audio
 * engine's transition detector. Read-only over the sim — never feeds back into game state.
 */

const KEY = "meteor-quest:journal-log";
const MAX_TOASTS = 4;

interface Persisted {
  seed: number;
  firstTick: Record<string, number>;
}

interface JournalLogState {
  seed: number | null;
  lastTick: number;
  firstTick: Record<string, number>;
  /** Planet ids charted since the last dismissal — drives the toast stack. */
  recent: string[];
  observe: (game: GameState) => void;
  /** Force a silent baseline for `game` (no toasts) — used when a world is swapped in wholesale
   *  rather than evolved tick-by-tick (the preview harness installs worlds via setGame). */
  rebaseline: (game: GameState) => void;
  dismiss: (id: string) => void;
  tickFor: (id: string) => number | undefined;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function loadPersisted(): Persisted | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function savePersisted(seed: number, firstTick: Record<string, number>): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify({ seed, firstTick } satisfies Persisted));
  } catch {
    /* quota / disabled — timestamps just won't persist */
  }
}

/** Every world that earns a journal page right now: cradle + anything scanned or settled. */
function loggedIds(game: GameState): string[] {
  return Object.values(game.planets)
    .filter((p) => p.scanned || p.settled || p.id === game.cradlePlanetId)
    .map((p) => p.id);
}

/**
 * Build the baseline firstTick map for a (re)started/loaded game — NO toasts. Continues a saved
 * game's persisted timestamps only when we're at or past its latest stamp (so a New Game on the
 * same seed, which resets the clock, starts fresh instead of inheriting stale stamps).
 */
function baseline(game: GameState): Record<string, number> {
  const persisted = loadPersisted();
  let base: Record<string, number> = {};
  if (persisted && persisted.seed === game.seed) {
    const maxTick = Object.values(persisted.firstTick).reduce((m, t) => Math.max(m, t), 0);
    if (game.tick >= maxTick) base = { ...persisted.firstTick }; // continuing a saved game
  }
  for (const id of loggedIds(game)) {
    if (base[id] === undefined) base[id] = id === game.cradlePlanetId ? 0 : game.tick;
  }
  return base;
}

export const useJournalLog = create<JournalLogState>((set, get) => ({
  seed: null,
  lastTick: 0,
  firstTick: {},
  recent: [],

  observe: (game) => {
    const st = get();
    // Reset → rebuild baseline silently: first observation, a different seed, or the clock
    // moved backwards (New Game / load of an earlier save).
    if (st.seed === null || st.seed !== game.seed || game.tick < st.lastTick) {
      const firstTick = baseline(game);
      savePersisted(game.seed, firstTick);
      set({ seed: game.seed, lastTick: game.tick, firstTick, recent: [] });
      return;
    }

    // Same game advancing: record any newly-logged world + queue it for a toast.
    const added: string[] = [];
    const firstTick = { ...st.firstTick };
    for (const id of loggedIds(game)) {
      if (firstTick[id] === undefined) {
        firstTick[id] = game.tick;
        added.push(id);
      }
    }
    if (added.length === 0) {
      if (game.tick !== st.lastTick) set({ lastTick: game.tick });
      return;
    }
    savePersisted(game.seed, firstTick);
    set({
      lastTick: game.tick,
      firstTick,
      recent: [...st.recent, ...added].slice(-MAX_TOASTS),
    });
  },

  rebaseline: (game) => {
    const firstTick = baseline(game);
    savePersisted(game.seed, firstTick);
    set({ seed: game.seed, lastTick: game.tick, firstTick, recent: [] });
  },

  dismiss: (id) => set((s) => ({ recent: s.recent.filter((r) => r !== id) })),
  tickFor: (id) => get().firstTick[id],
}));

/**
 * Start observing the authoritative sim so the journal log stays current. Idempotent-friendly:
 * runs one immediate observation, then subscribes. Returns an unsubscribe disposer. Mounted from
 * the game + preview entry points (like the audio engine).
 */
export function startJournalLog(): () => void {
  useJournalLog.getState().observe(useSim.getState().game);
  return useSim.subscribe((next) => useJournalLog.getState().observe(next.game));
}
