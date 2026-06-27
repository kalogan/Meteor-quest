import type { ResourceId } from "@meteor/shared";
import { getContentPack, tierRank } from "@meteor/shared";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { button, FOCUSABLE_RESOURCES, heading, panel, subtle } from "./theme";

/**
 * The signature payoff: ONE panel whose controls change with `game.authorityTier`.
 * As authority rises you stop steering individual cities and start setting broad
 * policy — the lower tiers fold into governors.
 *
 *   city      → per-city focus selectors (the manual micro)
 *   continent → continent policy; cities shown as governed/auto (read-only)
 *   planet    → planet-wide policy; continents + cities all auto
 *   system    → travel / scan / settle (expansion, no more output micro)
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {FOCUSABLE_RESOURCES.map((r) => (
        <button
          key={r}
          disabled={disabled}
          onClick={() => !disabled && onPick(r)}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 340, overflowY: "auto" }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 340, overflowY: "auto" }}>
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

function SystemTierView() {
  const game = useSim((s) => s.game);
  const dispatch = useSim((s) => s.dispatch);
  const pack = getContentPack();

  const systems = Object.values(game.systems).sort((a, b) => a.distanceFromHome - b.distanceFromHome);

  function biomeName(id: string): string {
    return pack.biomes.find((b) => b.id === id)?.name ?? id;
  }

  return (
    <>
      <div style={heading}>System Command</div>
      <div style={{ ...subtle, fontSize: 11, marginBottom: 8 }}>
        Travel to systems within range, scan their worlds, then settle the scanned ones.
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

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto" }}>
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
                    disabled={!inRange}
                    onClick={() => inRange && dispatch({ type: "travelToSystem", systemId: sys.id })}
                    style={button(false, inRange)}
                    title={inRange ? "Travel here" : "Out of range — extend ship range first"}
                  >
                    {inRange ? "Travel" : `${Math.round(sys.distanceFromHome)} ly`}
                  </button>
                )}
              </div>

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
                        <button onClick={() => dispatch({ type: "scanPlanet", planetId: p.id })} style={button()}>
                          Scan
                        </button>
                      ) : p.settled ? (
                        <span style={{ ...subtle, fontSize: 11, color: "#6fdc8c" }}>settled</span>
                      ) : (
                        <button onClick={() => dispatch({ type: "settlePlanet", planetId: p.id })} style={button(true)}>
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

export function TierControlPanel() {
  const authorityTier = useSim((s) => s.game.authorityTier);

  // System tier supersedes output micro: at that point you're expanding, not steering.
  let body: React.ReactNode;
  if (authorityTier === "city") body = <CityTierView />;
  else if (authorityTier === "continent") body = <ContinentTierView />;
  else if (authorityTier === "planet") body = <PlanetTierView />;
  else body = <SystemTierView />; // system / galaxy

  return (
    <div style={{ ...panel, top: 64, right: 12, width: 280 }}>
      {body}
      {tierRank(authorityTier) >= tierRank("planet") && authorityTier !== "system" ? (
        <div style={{ ...subtle, fontSize: 10, marginTop: 10, fontStyle: "italic" }}>
          Lower tiers run on governors. Research System Command to expand off-world.
        </div>
      ) : null}
    </div>
  );
}
