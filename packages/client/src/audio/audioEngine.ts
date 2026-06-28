import { effectiveVolumes, useSettings, type Settings } from "../sim/settings.js";
import { useSim } from "../sim/store.js";
import type { GameState } from "@meteor/shared";

/**
 * Procedural audio engine for Meteor Quest — PURE Web Audio API, no samples, no deps.
 *
 * Two buses fed by `effectiveVolumes(settings)`:
 *   - MUSIC: a slowly-evolving generative drone/pad (a few detuned oscillators →
 *     lowpass whose cutoff is wobbled by a slow LFO → a soft feedback-delay "bloom").
 *   - SFX:   short synthesized state cues (launch / arrival / threat / settle / uiClick),
 *     each a tiny oscillator-through-envelope voice.
 *
 * Autoplay policy: the AudioContext is created lazily and resumed ONLY on the first
 * real user gesture (pointerdown/keydown). Until then the engine is completely silent
 * and throws nothing. SFX requested while still locked are dropped (cosmetic).
 *
 * The Architect mounts this from main.tsx via `startAudioEngine()`. Nothing runs on
 * import beyond defining things.
 */

// ── Web Audio typing shim (Safari prefix; keep it dependency-free) ─────────────
type AudioContextCtor = typeof AudioContext;
interface AudioGlobals {
  AudioContext?: AudioContextCtor;
  webkitAudioContext?: AudioContextCtor;
}

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const g = window as unknown as AudioGlobals;
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

// ── SFX catalogue ──────────────────────────────────────────────────────────────
export type SfxName = "launch" | "arrival" | "threat" | "settle" | "uiClick" | "logged";

/** Tunable mix/feel knobs — Director taste lives here. */
const MUSIC = {
  /** Root frequency of the drone (a low A2-ish hum). */
  rootHz: 110,
  /** Detune offsets (cents-ish, applied as ratios) for the stacked voices. */
  voices: [
    { ratio: 1, detune: -5, type: "sine" as OscillatorType },
    { ratio: 1, detune: +7, type: "sine" as OscillatorType },
    { ratio: 1.5, detune: -3, type: "triangle" as OscillatorType }, // a fifth
    { ratio: 2.01, detune: +4, type: "sine" as OscillatorType }, // shimmer octave
  ],
  /** Lowpass cutoff sweep range (Hz) and LFO rate (Hz) for the slow "breathing". */
  filterBaseHz: 320,
  filterDepthHz: 260,
  lfoHz: 0.05,
  /** Internal pad headroom before the music bus gain. Keeps the drone gentle. */
  padGain: 0.18,
  /** Feedback-delay "bloom" for a cheap reverb-ish tail. */
  delaySeconds: 0.33,
  delayFeedback: 0.35,
  delayWet: 0.25,
};

const SFX = {
  /** Internal headroom before the sfx bus gain. */
  voiceGain: 0.22,
};

// ── Engine state ─────────────────────────────────────────────────────────────
interface MusicNodes {
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  filter: BiquadFilterNode;
  pad: GainNode;
}

interface Engine {
  ctx: AudioContext;
  musicBus: GainNode;
  sfxBus: GainNode;
  master: GainNode;
  music: MusicNodes | null;
}

/**
 * Start the audio engine. Idempotent: a second call while one is live is a no-op and
 * returns that instance's disposer. Wires the gesture-unlock listener + store/settings
 * subscriptions and starts the music bed once the context is unlocked.
 *
 * @returns dispose() — stops oscillators, tears down the context, and unsubscribes.
 */
export function startAudioEngine(): () => void {
  // Guard: no Web Audio (SSR / old browser) → silent no-op disposer.
  const maybeCtor = getAudioContextCtor();
  if (maybeCtor === null) return () => {};
  // Non-null binding so the nested closures don't re-widen to `| null`.
  const Ctor: AudioContextCtor = maybeCtor;

  // Idempotency: reuse the live singleton's disposer.
  if (live !== null) return live.dispose;

  let engine: Engine | null = null;
  let unlocked = false;
  let disposed = false;

  // ── Lazy context + bus graph (built on first unlock) ────────────────────────
  function ensureEngine(): Engine | null {
    if (engine !== null) return engine;
    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return null; // construction can throw in locked-down environments
    }
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    const musicBus = ctx.createGain();
    const sfxBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);

    engine = { ctx, musicBus, sfxBus, master, music: null };
    applyVolumes(engine, useSettings.getState());
    return engine;
  }

  // ── Volume application (effectiveVolumes already folds master + mute) ───────
  function applyVolumes(e: Engine, s: Settings): void {
    const { music, sfx } = effectiveVolumes(s);
    const now = e.ctx.currentTime;
    // Short ramps avoid zipper noise / clicks on slider drags.
    e.musicBus.gain.setTargetAtTime(clamp01(music), now, 0.05);
    e.sfxBus.gain.setTargetAtTime(clamp01(sfx), now, 0.02);
  }

  // ── Generative music bed ────────────────────────────────────────────────────
  function startMusic(e: Engine): void {
    if (e.music !== null) return;
    const { ctx } = e;
    const now = ctx.currentTime;

    const pad = ctx.createGain();
    pad.gain.value = 0;
    // Gentle fade-in so the drone blooms rather than pops.
    pad.gain.setTargetAtTime(MUSIC.padGain, now, 1.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = MUSIC.filterBaseHz;
    filter.Q.value = 1.2;

    // Slow LFO breathes the cutoff up and down.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = MUSIC.lfoHz;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = MUSIC.filterDepthHz;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);

    // Feedback delay → cheap reverb-ish tail.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = MUSIC.delaySeconds;
    const feedback = ctx.createGain();
    feedback.gain.value = MUSIC.delayFeedback;
    const wet = ctx.createGain();
    wet.gain.value = MUSIC.delayWet;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);

    filter.connect(pad);
    pad.connect(delay);
    pad.connect(e.musicBus);
    wet.connect(e.musicBus);

    const oscillators: OscillatorNode[] = [];
    for (const v of MUSIC.voices) {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = MUSIC.rootHz * v.ratio;
      osc.detune.value = v.detune;
      osc.connect(filter);
      osc.start();
      oscillators.push(osc);
    }
    lfo.start();

    e.music = { oscillators, lfo, filter, pad };
  }

  function stopMusic(e: Engine): void {
    const m = e.music;
    if (m === null) return;
    const now = e.ctx.currentTime;
    try {
      m.pad.gain.cancelScheduledValues(now);
      m.pad.gain.setTargetAtTime(0, now, 0.2);
      for (const osc of m.oscillators) osc.stop(now + 0.6);
      m.lfo.stop(now + 0.6);
    } catch {
      /* already stopped */
    }
    e.music = null;
  }

  // ── SFX voices (short synthesized cues) ─────────────────────────────────────
  function playSfx(name: SfxName): void {
    if (!unlocked || engine === null) return;
    const e = engine;
    if (e.ctx.state !== "running") return;
    try {
      switch (name) {
        case "launch":
          blip(e, { from: 220, to: 740, dur: 0.45, type: "sawtooth", peak: 0.9 });
          break;
        case "arrival":
          chime(e, [660, 880, 1320], 0.6);
          break;
        case "threat":
          alert(e);
          break;
        case "settle":
          chime(e, [330, 440, 550], 0.9, "triangle");
          break;
        case "logged":
          // A soft "page/stamp" pair (D5→A5) for charting a new world in the Journal.
          chime(e, [587, 880], 0.5);
          break;
        case "uiClick":
          blip(e, { from: 900, to: 900, dur: 0.045, type: "square", peak: 0.5 });
          break;
        default:
          break;
      }
    } catch {
      /* never let a cosmetic cue throw into the app */
    }
  }

  /** A single enveloped oscillator that optionally sweeps pitch (launch/uiClick). */
  function blip(
    e: Engine,
    opts: { from: number; to: number; dur: number; type: OscillatorType; peak: number },
  ): void {
    const { ctx } = e;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, t);
    if (opts.to !== opts.from) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(SFX.voiceGain * opts.peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(gain);
    gain.connect(e.sfxBus);
    osc.start(t);
    osc.stop(t + opts.dur + 0.05);
  }

  /** A warm arpeggiated chime (arrival/settle): stacked tones with staggered onsets. */
  function chime(e: Engine, freqs: number[], dur: number, type: OscillatorType = "sine"): void {
    const { ctx } = e;
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const t = t0 + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(SFX.voiceGain * 0.6, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(e.sfxBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  }

  /** A low two-pulse alert (threat): detuned square pulses with a quick wobble. */
  function alert(e: Engine): void {
    const { ctx } = e;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(98, t + 0.16);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(SFX.voiceGain * 0.8, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      osc.connect(gain);
      gain.connect(e.sfxBus);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  }

  // ── Gesture unlock ──────────────────────────────────────────────────────────
  function unlock(): void {
    if (unlocked || disposed) return;
    const e = ensureEngine();
    if (e === null) return;
    unlocked = true;
    removeGestureListeners();
    const resume = e.ctx.state === "suspended" ? e.ctx.resume() : Promise.resolve();
    resume
      .then(() => {
        if (!disposed) startMusic(e);
      })
      .catch(() => {
        /* resume can reject if the gesture was stale; stay silent */
      });
  }

  function removeGestureListeners(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
  }

  // ── Settings subscription: live volume changes ──────────────────────────────
  const unsubSettings = useSettings.subscribe((s) => {
    if (engine !== null) applyVolumes(engine, s);
  });

  // ── Sim subscription: derive SFX from state transitions ─────────────────────
  const unsubSim = useSim.subscribe((next, prev) => {
    if (disposed) return;
    detectSfx(next.game, prev.game).forEach(playSfx);
  });

  // ── Dispose ─────────────────────────────────────────────────────────────────
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    removeGestureListeners();
    unsubSettings();
    unsubSim();
    if (engine !== null) {
      stopMusic(engine);
      const e = engine;
      // Close after the music tail has faded.
      window.setTimeout(() => {
        e.ctx.close().catch(() => {
          /* already closed */
        });
      }, 700);
    }
    engine = null;
    if (live !== null && live.dispose === dispose) live = null;
  }

  live = { dispose };
  return dispose;
}

// ── Singleton bookkeeping (module-level; not started on import) ─────────────────
let live: { dispose: () => void } | null = null;

// ── Pure transition → SFX detection (exported for testability/reuse) ───────────
/**
 * Compare two game states and return the SFX cues their transition implies. Robust to
 * undefined fields and the no-prev (initial) case.
 *
 *   launch  — a NEW key appeared in `journeys`.
 *   arrival — a journey key was REMOVED *and* the latest log line reads "arrived"
 *             (removal also covers stranded/recalled, which are NOT arrivals).
 *   threat  — a NEW event id appeared in `events`.
 *   settle  — a new log line containing "Settled" appeared.
 *   logged  — a planet became `scanned` that wasn't before (charted into the Journal);
 *             deduped to one cue even if several worlds were scanned in the same tick.
 */
export function detectSfx(next: GameState, prev: GameState | undefined): SfxName[] {
  const cues: SfxName[] = [];
  if (next === undefined) return cues;
  if (prev === undefined) return cues; // first emission: establish a baseline silently

  const prevJourneys = prev.journeys ?? {};
  const nextJourneys = next.journeys ?? {};
  const prevKeys = Object.keys(prevJourneys);
  const nextKeys = Object.keys(nextJourneys);

  // launch: any journey key present now that wasn't before.
  if (nextKeys.some((k) => !(k in prevJourneys))) cues.push("launch");

  // arrival: a journey key disappeared AND the newest log line says "arrived".
  const removed = prevKeys.some((k) => !(k in nextJourneys));
  if (removed && latestLogMatches(next, prev, /arrived/i)) cues.push("arrival");

  // threat: a new ActiveEvent id appeared.
  const prevEventIds = new Set((prev.events ?? []).map((e) => e.id));
  if ((next.events ?? []).some((e) => !prevEventIds.has(e.id))) cues.push("threat");

  // settle: a new log line containing "Settled".
  if (newLogMatches(next, prev, /Settled/)) cues.push("settle");

  // logged: a planet became `scanned` that wasn't before (charted into the Journal).
  // Deduped: at most one "logged" per tick no matter how many worlds were scanned.
  const prevPlanets = prev.planets ?? {};
  const nextPlanets = next.planets ?? {};
  for (const id of Object.keys(nextPlanets)) {
    if (nextPlanets[id]?.scanned === true && prevPlanets[id]?.scanned !== true) {
      cues.push("logged");
      break;
    }
  }

  return cues;
}

/** True if any log entry added since `prev` matches `re`. */
function newLogMatches(next: GameState, prev: GameState, re: RegExp): boolean {
  const prevLen = (prev.log ?? []).length;
  const nextLog = next.log ?? [];
  for (let i = prevLen; i < nextLog.length; i++) {
    const entry = nextLog[i];
    if (entry !== undefined && re.test(entry.message)) return true;
  }
  return false;
}

/** True if the newest log line (and only it, if it's new) matches `re`. */
function latestLogMatches(next: GameState, prev: GameState, re: RegExp): boolean {
  const nextLog = next.log ?? [];
  if (nextLog.length <= (prev.log ?? []).length) return false; // no new line
  const last = nextLog[nextLog.length - 1];
  return last !== undefined && re.test(last.message);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
