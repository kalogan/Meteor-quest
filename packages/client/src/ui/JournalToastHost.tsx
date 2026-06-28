import { useMemo } from "react";
import { getContentPack } from "@meteor/shared";
import { useSim } from "../sim/store";
import { useJournalLog } from "../sim/journalLog";
import { JournalToast, type JournalToastItem } from "./JournalToast";

/**
 * [journal] Bridges the journal-log observer to the toast UI: maps newly-logged planet ids to
 * display items (name + biome accent) and dismisses them. Selector-stable (no fresh object fed
 * into a subscriber) so it never churns the render loop. Mounted by the in-game HUD and by the
 * preview Journal mode.
 */
export function JournalToastHost() {
  const game = useSim((s) => s.game);
  const recent = useJournalLog((s) => s.recent);
  const dismiss = useJournalLog((s) => s.dismiss);

  const biomeColor = useMemo(() => {
    const m = new Map<string, string>(getContentPack().biomes.map((b) => [b.id, b.color]));
    return (biome: string): string => m.get(biome) ?? "#8fb4ff";
  }, []);

  const items: JournalToastItem[] = recent
    .map((id) => {
      const p = game.planets[id];
      return p ? { id, name: p.name, accent: biomeColor(p.biome) } : null;
    })
    .filter((x): x is JournalToastItem => x !== null);

  return <JournalToast items={items} onDismiss={dismiss} />;
}
