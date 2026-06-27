import { useEffect, useRef } from "react";
import { TICK_SECONDS } from "@meteor/sim-core";
import { useSim } from "./store.js";
import { makeThrottledSaver } from "./persist.js";
import { useAppPhase } from "./appPhase.js";
import { useSettings } from "./settings.js";

/**
 * The real-time loop. Accumulates wall-clock dt scaled by the game's timeScale and
 * advances the sim in fixed ticks. The sim only advances while the app phase is
 * `playing` (title/pause freeze it). Autosave is throttled and honors the autosave
 * setting. This is the ONLY place wall-clock time enters the system; the sim core
 * itself stays deterministic.
 */
export function useGameLoop(): void {
  const acc = useRef(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    const save = makeThrottledSaver();
    const unsubscribe = useSim.subscribe((s) => {
      if (useSettings.getState().autosave) save(s.game);
    });

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (last.current === null) {
        last.current = now;
        return;
      }
      // Freeze the sim outside of active play (title / pause menu).
      if (useAppPhase.getState().phase !== "playing") {
        last.current = now;
        acc.current = 0;
        return;
      }
      const { game, advance } = useSim.getState();
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
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, []);
}
