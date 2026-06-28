import { useId, useMemo, useState } from "react";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { useJournalUi } from "../sim/journalUi";
import { useJournalLog } from "../sim/journalLog";
import { journalEntries, journalSummary, type JournalEntry, type JournalStatus } from "../sim/journal";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { JournalThumbnail } from "./JournalThumbnail";
import { MUTED_TEXT, subtle } from "./theme";

/**
 * [journal] The TRAVEL JOURNAL — a logbook of every world you've been to. The cradle plus
 * every planet you've charted or colonized gets a page: a rendered portrait of the world, when
 * you first logged it, and the stats a traveller jots down (where it sits, how it feels
 * underfoot, its moons, what it yields, its status). Tapping a page frames that world in the
 * God-view (the journal doubles as a "jump to where I've been" index) and opens its detail;
 * an expander on each page reveals the full stat sheet + a flavour line on demand.
 *
 * Read-only over sim state (selection + open state are cosmetic). Accessible (each page a real
 * button with a spoken summary; the expander carries aria-expanded/-controls), responsive
 * (joins the phone drawer), reduced-motion aware. Portraits are lazy-mounted (WebGL context
 * budget) by JournalThumbnail. Open/closed is driven by `useJournalUi` so the HUD strip button
 * can toggle it.
 */

function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined") {
    const flag = document.documentElement.dataset.reducedMotion;
    if (flag === "on") return true;
    if (flag === "off") return false;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

const STATUS_STYLE: Record<JournalStatus, { label: string; bg: string; border: string; fg: string }> = {
  home: { label: "Home", bg: "rgba(43,108,255,0.18)", border: "#3f6bd0", fg: "#9fc0ff" },
  colony: { label: "Colony", bg: "rgba(54,196,124,0.16)", border: "#2f8f5b", fg: "#7fe0a8" },
  charted: { label: "Charted", bg: "rgba(150,164,196,0.14)", border: "#4a5675", fg: "#c2cce0" },
};

function loggedLabel(tick: number | undefined): string {
  if (tick === undefined) return "—";
  if (tick <= 0) return "from the start";
  return `tick ${tick}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...subtle, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#e8edf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  loggedTick,
  onOpen,
  reducedMotion,
}: {
  entry: JournalEntry;
  loggedTick: number | undefined;
  onOpen: () => void;
  reducedMotion: boolean;
}) {
  const game = useSim((s) => s.game);
  const detailId = useId();
  // The world you're currently looking at opens to its page; you can still toggle any page.
  const [override, setOverride] = useState<boolean | null>(null);
  const expanded = override ?? entry.isCurrent;

  const st = STATUS_STYLE[entry.status];
  const tint = entry.biome?.color ?? "#8a93a8";
  const moonLabel = entry.moons === 1 ? "1 moon" : `${entry.moons} moons`;
  const distLabel = entry.isCradle ? "home system" : `${entry.distanceFromHome.toFixed(0)} ly`;
  const spoken =
    `${entry.planet.name}, ${st.label}. ${entry.biome?.name ?? "uncharted"} world in ${entry.system.name}, ` +
    `${entry.distanceFromHome.toFixed(0)} light-years from home, ${moonLabel}, ` +
    `${entry.surface.label} gravity. Frame this world.`;

  const spiff = entry.biome?.spiff;
  const flavor =
    `A ${entry.surface.label}-gravity ${entry.biome?.name ?? "world"} in ${entry.system.name}` +
    `${entry.moons ? `, ${moonLabel} overhead` : ", moonless"}. ` +
    (entry.isCradle
      ? "Where the journey began."
      : entry.planet.settled
        ? `Colonized for its ${entry.yields}.`
        : "Charted from orbit, not yet claimed.");

  return (
    <li style={{ listStyle: "none", border: `1px solid ${expanded ? "#3f6bd0" : "#1d2740"}`, borderRadius: 10, overflow: "hidden", background: entry.isCurrent ? "rgba(43,108,255,0.08)" : "#10182a" }}>
      <div style={{ display: "flex", gap: 10, padding: 8 }}>
        <button
          type="button"
          data-testid={`journal-entry-${entry.planet.id}`}
          onClick={onOpen}
          aria-label={spoken}
          aria-current={entry.isCurrent ? "true" : undefined}
          style={{ display: "flex", gap: 10, flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#e8edf6" }}
        >
          <JournalThumbnail planet={entry.planet} game={game} tint={tint} reducedMotion={reducedMotion} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.planet.name}
              </span>
              <span
                style={{
                  marginLeft: "auto", flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 7px",
                  borderRadius: 999, background: st.bg, border: `1px solid ${st.border}`, color: st.fg,
                }}
              >
                {entry.isCurrent ? "You are here" : st.label}
              </span>
            </span>
            <span style={{ ...subtle, display: "block", fontSize: 12, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.biome?.name ?? "Uncharted"} · {distLabel} · logged {loggedLabel(loggedTick)}
            </span>
          </span>
        </button>
        <button
          type="button"
          data-testid={`journal-expand-${entry.planet.id}`}
          aria-expanded={expanded}
          aria-controls={detailId}
          aria-label={`${expanded ? "Hide" : "Show"} details for ${entry.planet.name}`}
          onClick={() => setOverride(!expanded)}
          style={{
            flexShrink: 0, alignSelf: "flex-start", width: 26, height: 26, borderRadius: 6, cursor: "pointer",
            background: "#1a2236", border: "1px solid #3a4668", color: "#cdd6e6",
            transform: expanded && !reducedMotion ? "rotate(90deg)" : "none",
            transition: reducedMotion ? undefined : "transform 0.15s ease",
          }}
        >
          ▸
        </button>
      </div>

      <div id={detailId} hidden={!expanded} style={{ padding: "0 8px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px", paddingTop: 2 }}>
          <Stat label="System" value={entry.system.name} />
          <Stat label="From home" value={distLabel} />
          <Stat label="Orbit" value={`${entry.distanceFromStar.toFixed(1)} AU`} />
          <Stat label="Moons" value={String(entry.moons)} />
          <Stat label="Gravity" value={`${entry.surface.gravity.toFixed(2)} g · ${entry.surface.label}`} />
          <Stat label="Continents" value={String(entry.continents)} />
          <Stat label="Biome" value={entry.biome?.name ?? "—"} />
          <Stat label="Yields" value={entry.planet.settled ? (entry.yields ?? "—") : "unclaimed"} />
          <Stat label="Logged" value={loggedLabel(loggedTick)} />
          {spiff ? <Stat label="Spiff" value={`+${Math.round((spiff.multiplier - 1) * 100)}% ${spiff.category}`} /> : null}
        </div>
        <p style={{ ...subtle, fontSize: 12, lineHeight: 1.4, margin: "8px 0 0" }}>{flavor}</p>
      </div>
    </li>
  );
}

export function JournalPanel() {
  const game = useSim((s) => s.game);
  const select = useSelection((s) => s.select);
  const selectedId = useSelection((s) => s.selectedId);
  const selectedKind = useSelection((s) => s.selectedKind);
  const open = useJournalUi((s) => s.open);
  const setOpen = useJournalUi((s) => s.setOpen);
  const firstTick = useJournalLog((s) => s.firstTick);
  const reducedMotion = prefersReducedMotion();

  const currentPlanetId = selectedKind === "planet" ? selectedId : null;
  const entries = useMemo(() => journalEntries(game, currentPlanetId), [game, currentPlanetId]);
  const summary = useMemo(() => journalSummary(game, entries), [game, entries]);

  return (
    <CollapsiblePanel
      title={`Journal (${summary.worldsLogged})`}
      open={open}
      onOpenChange={setOpen}
      className="hud-dock hud-dock-journal"
      style={{ width: 320, maxHeight: "70vh", overflowY: "auto" }}
    >
      <div data-testid="journal-panel">
        {/* Voyage summary: the empire-wide tallies a logbook would keep on its flyleaf. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: MUTED_TEXT, marginBottom: 10 }}>
          <span><strong style={{ color: "#e8edf6" }}>{summary.worldsLogged}</strong> logged</span>
          <span><strong style={{ color: "#7fe0a8" }}>{summary.colonies}</strong> colonies</span>
          <span><strong style={{ color: "#e8edf6" }}>{summary.techUnlocked}</strong> tech</span>
          <span><strong style={{ color: "#e8edf6" }}>{summary.minerals}</strong> minerals</span>
        </div>

        {entries.length === 0 ? (
          <div style={{ ...subtle, fontSize: 12 }}>No worlds logged yet — chart a planet to begin your journal.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((entry) => (
              <EntryCard
                key={entry.planet.id}
                entry={entry}
                loggedTick={firstTick[entry.planet.id]}
                reducedMotion={reducedMotion}
                onOpen={() => select(entry.planet.id, "planet")}
              />
            ))}
          </ul>
        )}
      </div>
    </CollapsiblePanel>
  );
}
