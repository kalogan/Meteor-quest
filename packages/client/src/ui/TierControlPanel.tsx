import type { ResourceId } from "@meteor/shared";
import { getContentPack, tierRank } from "@meteor/shared";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { CollapsiblePanel, isPhoneViewport } from "./CollapsiblePanel";
import { button, FOCUSABLE_RESOURCES, heading, subtle } from "./theme";

/**
 * The signature payoff: ONE panel whose controls change with `game.authorityTier`.
 * As authority rises you stop steering individual cities and start setting broad
 * policy — the lower tiers fold into governors.
 *
 *   city      → per-city focus selectors (the manual micro)
 *   continent → continent policy; cities shown as governed/auto (read-only)
 *   planet    → planet-wide policy; continents + cities all auto
 *   system    → per-system output policy (setSystemPolicy); planets governed/auto,
 *               plus the expansion micro (travel / scan / settle)
 *   galaxy    → a single empire policy (setEmpirePolicy); every system below is auto
 *
 * `useSelection` scopes the panel to the clicked entity where it makes sense, so
 * diving the camera into one city/continent narrows the controls to it.
 */

/** A row of resource buttons that calls back with the chosen resource. */
function FocusPicker({
  value,
  onPick,
  disabled,
}: {
  value: ResourceId;
  onPick: (r: ResourceId) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }} role="group">
      {FOCUSABLE_RESOURCES.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onPick(r)}
          aria-pressed={value === r}
          aria-label={`Focus ${r}`}
          style={{ ...button(value === r, !disabled), textTransform: "capitalize" }}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function CityTierView() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const { selectedId, selectedKind } = useSelection();

  // Scope to the selected city (or all cities on a selected continent) when relevant.
  let cities = Object.values(game.cities);
  let scopeLabel = "All cities";
  const selCity = selectedId ? game.cities[selectedId] : undefined;
  const selCont = selectedId ? game.continents[selectedId] : undefined;
  if (selectedKind === "city" && selCity) {
    cities = [selCity];
    scopeLabel = "Selected city";
  } else if (selectedKind === "continent" && selCont) {
    cities = selCont.cityIds.map((id) => game.cities[id]).filter((c): c is NonNullable<typeof c> => Boolean(c));
    scopeLabel = `${selCont.name} · cities`;
  }

  return (
    <>
      <div style={heading}>City Focus · {scopeLabel}</div>
      <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
        Authority sits at city tier — set each city's output by hand.
      </div>
      <div className="hud-scroll" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
        {cities.map((city) => (
          <div key={city.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>{city.name}</span>
              <span style={{ ...subtle, fontSize: 11 }}>{city.productivity.toFixed(1)}/s</span>
            </div>
            <FocusPicker
              value={city.focus}
              onPick={(r) => dispatch({ type: "setCityFocus", cityId: city.id, resource: r })}
            />
          </div>
        ))}
      </div>
    </>
  );
}

function ContinentTierView() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const { selectedId, selectedKind } = useSelection();

  let continents = Object.values(game.continents);
  let scopeLabel = "All continents";
  const selCont = selectedId ? game.continents[selectedId] : undefined;
  if (selectedKind === "continent" && selCont) {
    continents = [selCont];
    scopeLabel = "Selected continent";
  }

  return (
    <>
      <div style={heading}>Continent Policy · {scopeLabel}</div>
      <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
        Cities now follow their continent's governor — set the aggregate, not each city.
      </div>
      <div className="hud-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 340, overflowY: "auto" }}>
        {continents.map((cont) => (
          <div key={cont.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>{cont.name}</span>
              <span style={{ ...subtle, fontSize: 11 }}>{cont.cityIds.length} cities · auto</span>
            </div>
            <FocusPicker
              value={cont.policy}
              onPick={(r) => dispatch({ type: "setContinentPolicy", continentId: cont.id, resource: r })}
            />
            <div style={{ ...subtle, fontSize: 10, marginTop: 4 }}>
              governed: {cont.cityIds.map((id) => game.cities[id]?.name).filter(Boolean).join(", ")}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PlanetTierView() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const { selectedId, selectedKind } = useSelection();

  let planets = Object.values(game.planets).filter((p) => p.settled);
  let scopeLabel = "All settled worlds";
  const selPlanet = selectedId ? game.planets[selectedId] : undefined;
  if (selectedKind === "planet" && selPlanet?.settled) {
    planets = [selPlanet];
    scopeLabel = "Selected world";
  }

  return (
    <>
      <div style={heading}>Planetary Policy · {scopeLabel}</div>
      <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
        Continents and cities all run on governors — you command whole worlds now.
      </div>
      <div className="hud-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 340, overflowY: "auto" }}>
        {planets.map((planet) => (
          <div key={planet.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>{planet.name}</span>
              <span style={{ ...subtle, fontSize: 11 }}>{planet.continentIds.length} continents · auto</span>
            </div>
            <FocusPicker
              value={planet.policy}
              onPick={(r) => dispatch({ type: "setPlanetPolicy", planetId: planet.id, resource: r })}
            />
          </div>
        ))}
      </div>
    </>
  );
}

const DEFAULT_POLICY: ResourceId = FOCUSABLE_RESOURCES[0] ?? "minerals";

function SystemTierView() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const { selectedId, selectedKind } = useSelection();
  const pack = getContentPack();

  let systems = Object.values(game.systems).sort((a, b) => a.distanceFromHome - b.distanceFromHome);
  const selSystem = selectedId ? game.systems[selectedId] : undefined;
  if (selectedKind === "system" && selSystem) systems = [selSystem];

  function biomeName(id: string): string {
    return pack.biomes.find((b) => b.id === id)?.name ?? id;
  }

  // A system governs its planets: settled planets in a discovered system run on the
  // system policy (governor), echoing the planet-tier abstraction one level up.
  function settledPlanets(sys: (typeof systems)[number]) {
    return sys.planetIds
      .map((id) => game.planets[id])
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.settled));
  }

  return (
    <>
      <div style={heading}>System Command</div>
      <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
        Each system runs on its own governor — set its policy; its worlds auto-follow.
        Travel, scan, and settle to expand the empire.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={subtle}>ship range</span>
          <span>{Math.round(game.maxRange)} ly</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={subtle}>sensor range</span>
          <span>{Math.round(game.sensorRange)} ly</span>
        </div>
      </div>

      <div className="hud-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto" }}>
        {systems.map((sys) => {
          const inRange = game.orbitalLaunched && sys.distanceFromHome <= game.maxRange;
          const planets = sys.planetIds
            .map((id) => game.planets[id])
            .filter((p): p is NonNullable<typeof p> => Boolean(p));
          return (
            <div key={sys.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>
                  {sys.name}
                  {sys.id === game.homeSystemId ? <span style={subtle}> · home</span> : null}
                </span>
                {sys.discovered ? (
                  <span style={{ ...subtle, fontSize: 11 }}>{Math.round(sys.distanceFromHome)} ly</span>
                ) : (
                  <button
                    type="button"
                    disabled={!inRange}
                    onClick={() => inRange && dispatch({ type: "travelToSystem", systemId: sys.id })}
                    style={button(false, inRange)}
                    aria-label={inRange ? `Travel to ${sys.name}` : `${sys.name} out of range`}
                    title={inRange ? "Travel here" : "Out of range — extend ship range first"}
                  >
                    {inRange ? "Travel" : `${Math.round(sys.distanceFromHome)} ly`}
                  </button>
                )}
              </div>

              {sys.discovered && settledPlanets(sys).length > 0 ? (
                <div style={{ marginTop: 5, marginLeft: 8 }}>
                  <div style={{ ...subtle, fontSize: 10 }}>system policy · {settledPlanets(sys).length} worlds auto</div>
                  <FocusPicker
                    value={sys.policy ?? game.empirePolicy ?? DEFAULT_POLICY}
                    onPick={(r) => dispatch({ type: "setSystemPolicy", systemId: sys.id, resource: r })}
                  />
                </div>
              ) : null}

              {sys.discovered ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 5, marginLeft: 8 }}>
                  {planets.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12 }}>
                        {p.scanned ? (
                          <>
                            {p.name} <span style={subtle}>· {biomeName(p.biome)}</span>
                          </>
                        ) : (
                          <span style={subtle}>{p.name} · unscanned</span>
                        )}
                      </span>
                      {!p.scanned ? (
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "scanPlanet", planetId: p.id })}
                          style={button()}
                          aria-label={`Scan ${p.name}`}
                        >
                          Scan
                        </button>
                      ) : p.settled ? (
                        <span style={{ ...subtle, fontSize: 11, color: "#6fdc8c" }}>settled</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "settlePlanet", planetId: p.id })}
                          style={button(true)}
                          aria-label={`Settle ${p.name}`}
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function GalaxyTierView() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);

  const systems = Object.values(game.systems);
  const discovered = systems.filter((s) => s.discovered);

  return (
    <>
      <div style={heading}>Empire Policy</div>
      <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
        Authority sits at the galaxy. One directive cascades down every system and
        world — the whole empire runs on governors below you.
      </div>
      <FocusPicker
        value={game.empirePolicy ?? DEFAULT_POLICY}
        onPick={(r) => dispatch({ type: "setEmpirePolicy", resource: r })}
      />
      <div style={{ ...subtle, fontSize: 10, marginTop: 10 }}>
        governing {discovered.length} system{discovered.length === 1 ? "" : "s"} ·{" "}
        {Object.values(game.planets).filter((p) => p.settled).length} settled worlds · auto
      </div>
    </>
  );
}

export function TierControlPanel() {
  const authorityTier = useSim((s) => s.game.authorityTier);

  // The aggregation reaches its peak: city focus → continent → planet → system
  // policy → a single empire directive at galaxy tier.
  let body: React.ReactNode;
  if (authorityTier === "city") body = <CityTierView />;
  else if (authorityTier === "continent") body = <ContinentTierView />;
  else if (authorityTier === "planet") body = <PlanetTierView />;
  else if (authorityTier === "system") body = <SystemTierView />;
  else body = <GalaxyTierView />; // galaxy

  return (
    <CollapsiblePanel
      title={`Command · ${authorityTier}`}
      defaultOpen={!isPhoneViewport()}
      className="hud-dock hud-dock-tier"
      style={{ width: 280 }}
    >
      {body}
      {tierRank(authorityTier) >= tierRank("planet") && authorityTier !== "system" && authorityTier !== "galaxy" ? (
        <div style={{ ...subtle, fontSize: 10, marginTop: 10, fontStyle: "italic" }}>
          Lower tiers run on governors. Research System Command to expand off-world.
        </div>
      ) : null}
    </CollapsiblePanel>
  );
}
