import { useEffect, useRef } from "react";
import { TICK_SECONDS } from "@meteor/sim-core";
import { useSim } from "./store.js";

/**
 * The real-time loop. Accumulates wall-clock dt scaled by the game's timeScale and
 * advances the sim in fixed ticks. timeScale 0 = paused. This is the ONLY place
 * wall-clock time enters the system; the sim core itself stays deterministic.
 */
export function useGameLoop(): void {
  const acc = useRef(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { game, advance } = useSim.getState();
      if (last.current === null) {
        last.current = now;
        return;
      }
      const dt = Math.min(0.25, (now - last.current) / 1000) * game.timeScale;
      last.current = now;
      acc.current += dt;
      let steps = 0;
      while (acc.current >= TICK_SECONDS && steps < 240) {
        acc.current -= TICK_SECONDS;
        steps++;
      }
      if (steps > 0) advance(steps);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
}
