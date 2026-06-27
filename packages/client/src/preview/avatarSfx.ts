/**
 * Procedural Web Audio sound effects for the walkable-avatar preview sandbox.
 *
 * Self-contained: depends only on the Web Audio API. All sounds are synthesized
 * at call time through a shared, low-volume master gain so nothing is ever loud.
 *
 * The AudioContext is created lazily on the first sound (so it isn't constructed
 * before a user gesture) and cached for subsequent calls. Every entry point is
 * wrapped in try/catch so a playback failure never throws to the caller.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Lazily create (and resume) the shared AudioContext + master gain. */
function ensureAudio(): { ctx: AudioContext; master: GainNode } | null {
  try {
    if (ctx === null) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor === undefined) {
        return null;
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      // Fire-and-forget; resuming requires a user gesture upstream.
      void ctx.resume();
    }
    if (master === null) {
      return null;
    }
    return { ctx, master };
  } catch {
    return null;
  }
}

/** Build a short white-noise buffer for percussive bursts. */
function makeNoiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(audio.sampleRate * seconds));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const avatarSfx = {
  /** Short, soft upward whoosh/blip. */
  jump(): void {
    const audio = ensureAudio();
    if (audio === null) {
      return;
    }
    try {
      const { ctx: c, master: out } = audio;
      const now = c.currentTime;
      const dur = 0.16;

      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(gain);
      gain.connect(out);

      osc.start(now);
      osc.stop(now + dur);
      osc.onended = (): void => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Never throw to the caller.
    }
  },

  /** Soft low thud whose weight scales with impact strength (~0..1.5). */
  land(strength = 1): void {
    const audio = ensureAudio();
    if (audio === null) {
      return;
    }
    try {
      const { ctx: c, master: out } = audio;
      const now = c.currentTime;
      const dur = 0.18;
      const amp = clamp(strength, 0.2, 1.4);
      // Lower pitch as strength grows: ~120Hz light -> ~70Hz heavy.
      const baseFreq = 120 - clamp(strength, 0, 1.5) * 33;

      // Low sine body.
      const osc = c.createOscillator();
      const oscGain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, now);
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.exponentialRampToValueAtTime(0.9 * amp, now + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(oscGain);
      oscGain.connect(out);

      // Short filtered noise burst for the "impact" transient.
      const noiseDur = 0.05;
      const noise = c.createBufferSource();
      noise.buffer = makeNoiseBuffer(c, noiseDur);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500;
      const noiseGain = c.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.6 * amp, now + 0.005);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDur);
      noise.connect(lp);
      lp.connect(noiseGain);
      noiseGain.connect(out);

      osc.start(now);
      osc.stop(now + dur);
      noise.start(now);
      noise.stop(now + noiseDur);

      osc.onended = (): void => {
        osc.disconnect();
        oscGain.disconnect();
      };
      noise.onended = (): void => {
        noise.disconnect();
        lp.disconnect();
        noiseGain.disconnect();
      };
    } catch {
      // Never throw to the caller.
    }
  },

  /** Tiny, subtle footstep tap with slight per-call pitch jitter. */
  step(): void {
    const audio = ensureAudio();
    if (audio === null) {
      return;
    }
    try {
      const { ctx: c, master: out } = audio;
      const now = c.currentTime;
      const dur = 0.05;

      const noise = c.createBufferSource();
      noise.buffer = makeNoiseBuffer(c, dur);

      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      // Jitter the center frequency so repeated steps don't sound identical.
      bp.frequency.value = 900 + (Math.random() * 2 - 1) * 250;
      bp.Q.value = 1.2;

      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(out);

      noise.start(now);
      noise.stop(now + dur);
      noise.onended = (): void => {
        noise.disconnect();
        bp.disconnect();
        gain.disconnect();
      };
    } catch {
      // Never throw to the caller.
    }
  },
};
