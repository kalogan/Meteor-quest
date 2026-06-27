import { useMemo } from "react";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { journalEntries, journalSummary, type JournalEntry, type JournalStatus } from "../sim/journal";
import { CollapsiblePanel, isPhoneViewport } from "./CollapsiblePanel";
import { JournalThumbnail } from "./JournalThumbnail";
import { MUTED_TEXT, subtle } from "./theme";

/**
 * Resolve reduced-motion the same way the renderers do (SystemView/PlanetView): an explicit
 * settings override (data attribute) wins, else the OS preference. A render-stable boolean —
 * no store selector, so it never feeds a fresh object into a subscriber.
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

/**
 * [journal] The TRAVEL JOURNAL — a logbook of every world you've been to. The cradle plus
 * every planet you've charted or colonized gets a page: a rendered portrait of the world and
 * the stats a traveller jots down (where it sits, how it feels underfoot, its moons, what it
 * yields, its status). Tapping a page frames that world in the God-view, so the journal
 * doubles as a "jump to where I've been" index.
 *
 * Read-only over sim state (selection is cosmetic). Accessible (each page a real button with a
 * spoken summary), responsive (joins the phone drawer), reduced-motion aware. Portraits are
 * lazy-mounted (WebGL context budget) by JournalThumbnail.
 */

const STATUS_STYLE: Record<JournalStatus, { label: string; bg: string; border: string; fg: string }> = {
  home: { label: "Home", bg: "rgba(43,108,255,0.18)", border: "#3f6bd0", fg: "#9fc0ff" },
  colony: { label: "Colony", bg: "rgba(54,196,124,0.16)", border: "#2f8f5b", fg: "#7fe0a8" },
  charted: { label: "Charted", bg: "rgba(150,164,196,0.14)", border: "#4a5675", fg: "#c2cce0" },
};

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
  onOpen,
  reducedMotion,
}: {
  entry: JournalEntry;
  onOpen: () => void;
  reducedMotion: boolean;
}) {
  const game = useSim((s) => s.game);
  const st = STATUS_STYLE[entry.status];
  const tint = entry.biome?.color ?? "#8a93a8";
  const moonLabel = entry.moons === 1 ? "1 moon" : `${entry.moons} moons`;
  const spoken =
    `${entry.planet.name}, ${st.label}. ${entry.biome?.name ?? "uncharted"} world in ${entry.system.name}, ` +
    `${entry.distanceFromHome.toFixed(0)} light-years from home, ${moonLabel}, ` +
    `${entry.surface.label} gravity. Frame this world.`;

  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button"
        data-testid={`journal-entry-${entry.planet.id}`}
        onClick={onOpen}
        aria-label={spoken}
        aria-current={entry.isCurrent ? "true" : undefined}
        style={{
          display: "flex",
          gap: 10,
          width: "100%",
          textAlign: "left",
          padding: 8,
          borderRadius: 9,
          cursor: "pointer",
          background: entry.isCurrent ? "rgba(43,108,255,0.10)" : "#10182a",
          border: entry.isCurrent ? "1px solid #3f6bd0" : "1px solid #1d2740",
          color: "#e8edf6",
        }}
      >
        <JournalThumbnail planet={entry.planet} game={game} tint={tint} reducedMotion={reducedMotion} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.planet.name}
            </span>
            <span
              style={{
                marginLeft: "auto",
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: st.bg,
                border: `1px solid ${st.border}`,
                color: st.fg,
              }}
            >
              {entry.isCurrent ? "You are here" : st.label}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
            <Stat label="System" value={entry.system.name} />
            <Stat label="From home" value={entry.isCradle ? "home system" : `${entry.distanceFromHome.toFixed(0)} ly`} />
            <Stat label="Orbit" value={`${entry.distanceFromStar.toFixed(1)} AU`} />
            <Stat label="Moons" value={String(entry.moons)} />
            <Stat label="Gravity" value={`${entry.surface.gravity.toFixed(2)} g · ${entry.surface.label}`} />
            <Stat label="Continents" value={String(entry.continents)} />
            <Stat label="Biome" value={entry.biome?.name ?? "—"} />
            <Stat label="Yields" value={entry.planet.settled ? (entry.yields ?? "—") : "unclaimed"} />
          </div>
        </div>
      </button>
    </li>
  );
}

export function JournalPanel() {
  const game = useSim((s) => s.game);
  const select = useSelection((s) => s.select);
  const selectedId = useSelection((s) => s.selectedId);
  const selectedKind = useSelection((s) => s.selectedKind);
  const reducedMotion = prefersReducedMotion();

  const currentPlanetId = selectedKind === "planet" ? selectedId : null;
  const entries = useMemo(() => journalEntries(game, currentPlanetId), [game, currentPlanetId]);
  const summary = useMemo(() => journalSummary(game, entries), [game, entries]);

  return (
    <CollapsiblePanel
      title={`Journal (${summary.worldsLogged})`}
      defaultOpen={!isPhoneViewport()}
      className="hud-dock hud-dock-journal"
      style={{ width: 320, maxHeight: "70vh", overflowY: "auto" }}
    >
      <div data-testid="journal-panel">
        {/* Voyage summary: the empire-wide tallies a logbook would keep on its flyleaf. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 12px",
            fontSize: 12,
            color: MUTED_TEXT,
            marginBottom: 10,
          }}
        >
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
