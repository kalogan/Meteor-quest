/**
 * Injected clock. The sim advances by an explicit dt handed to `step`; it never
 * reads wall-clock. The client owns the real requestAnimationFrame loop and feeds
 * elapsed seconds in, so tests can drive time deterministically.
 */
export interface Clock {
  /** Seconds since the previous frame. */
  dt: number;
}

/** Fixed sim tick length in seconds. The economy accrues per tick. */
export const TICK_SECONDS = 0.5;
