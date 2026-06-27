import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import type { Continent, GameState, Planet } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import { PALETTE, planetColor, settleGlow } from "./palette";
import { focusSurfaceNormal, planetRadius } from "./layout";
import { GroundTechProps, OrbitTechProps } from "./TechPropsLayer";
import { SurfaceView } from "./SurfaceView";

/**
 * One low-poly planet: a flat-shaded icosahedron, its continents/cities scattered
 * across the surface (visible at close zoom), an unscanned planet rendered dim, a
 * scanned planet biome-tinted, a settled planet ringed with a subtle glow.
 *
 * Fog is strictly state-driven: continents/cities only appear when the planet is
 * scanned AND the sim actually holds them (the cradle does; unscanned worlds don't).
 */

/** Deterministic point on a unit sphere from an index (golden-spiral). */
function spherePoint(i: number, total: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / Math.max(1, total - 1)) * 2; // -1..1
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

function ContinentPatch({
  continent,
  cities,
  index,
  total,
  radius,
  onPick,
}: {
  continent: Continent;
  cities: GameState["cities"];
  index: number;
  total: number;
  radius: number;
  onPick: (id: string, kind: "continent" | "city") => void;
}) {
  const [nx, ny, nz] = spherePoint(index, total);
  const surface: [number, number, number] = [nx * radius, ny * radius, nz * radius];
  const cityList = continent.cityIds
    .map((id) => cities[id])
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  return (
    <group position={surface}>
      <mesh
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onPick(continent.id, "continent");
        }}
      >
        <sphereGeometry args={[radius * 0.32, 6, 6]} />
        <meshStandardMaterial flatShading color={PALETTE.continent} roughness={0.9} />
      </mesh>
      {cityList.map((city, ci) => {
        const [cx, cy, cz] = spherePoint(ci, Math.max(2, cityList.length));
        const off = radius * 0.34;
        return (
          <mesh
            key={city.id}
            position={[cx * off, cy * off, cz * off]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onPick(city.id, "city");
            }}
          >
            <boxGeometry args={[radius * 0.12, radius * 0.18, radius * 0.12]} />
            <meshStandardMaterial color={PALETTE.city} emissive={PALETTE.city} emissiveIntensity={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

export function PlanetView({
  planet,
  game,
  isCradle,
  position,
  reducedMotion = false,
}: {
  planet: Planet;
  game: GameState;
  isCradle: boolean;
  position: [number, number, number];
  /** Freeze cosmetic prop animations (accessibility). Defaults to animated. */
  reducedMotion?: boolean;
}) {
  const spin = useRef<Group>(null);
  const select = useSelection((s) => s.select);
  const selectedId = useSelection((s) => s.selectedId);
  const selectedKind = useSelection((s) => s.selectedKind);
  const nearSurface = useSelection((s) => s.nearSurface);
  const isSelected = selectedId === planet.id;

  // [surface dive] When the camera has descended to a planet's surface, the FOCUSED planet
  // renders a landed terrain patch (SurfaceView). Resolve which planet + where, in render
  // (primitive selectors only — no fresh object fed to a subscriber).
  const surfaceFocus =
    nearSurface && selectedId && selectedKind && selectedKind !== "system"
      ? focusSurfaceNormal(game, selectedId, selectedKind)
      : null;
  const showSurface = !!surfaceFocus && surfaceFocus.planet.id === planet.id;

  const radius = planetRadius(planet, isCradle);
  const color = planetColor(planet);

  const continents = useMemo(
    () =>
      planet.continentIds
        .map((id) => game.continents[id])
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [planet.continentIds, game.continents],
  );

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * (isCradle ? 0.15 : 0.25);
  });

  return (
    <group
      position={position}
      name={`planet:${planet.id}`}
      userData={{ pickId: planet.id, pickKind: "planet" }}
    >
      {/* The globe (sphere + continents + ground props). Hidden during a surface dive — the
          SurfaceView terrain patch replaces it as the ground you stand on. */}
      <group ref={spin} visible={!showSurface}>
        <mesh
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            select(planet.id, "planet");
          }}
        >
          <icosahedronGeometry args={[radius, planet.scanned ? 2 : 1]} />
          <meshStandardMaterial
            flatShading
            color={color}
            roughness={planet.scanned ? 0.7 : 1}
            metalness={0.05}
            emissive={planet.scanned ? color : PALETTE.unknown}
            emissiveIntensity={planet.scanned ? 0.06 : 0.02}
          />
        </mesh>

        {/* Continents + cities only exist for scanned worlds the sim populated. */}
        {planet.scanned &&
          continents.map((c, i) => (
            <ContinentPatch
              key={c.id}
              continent={c}
              cities={game.cities}
              index={i}
              total={Math.max(2, continents.length)}
              radius={radius}
              onPick={select}
            />
          ))}

        {/* [tech props] Ground structures for the empire's unlocked tech — INSIDE the spin
            group so they co-rotate with the surface and read as planted. Settled worlds only. */}
        {planet.settled && (
          <GroundTechProps
            planet={planet}
            radius={radius}
            unlocked={game.research.unlocked}
            reducedMotion={reducedMotion}
          />
        )}
      </group>

      {/* [tech props] Orbital structures ring the world — OUTSIDE the spin group so the ring
          keeps its own slow revolution, independent of the surface spin. Settled worlds only. */}
      {planet.settled && !showSurface && (
        <OrbitTechProps
          planet={planet}
          radius={radius}
          unlocked={game.research.unlocked}
          reducedMotion={reducedMotion}
        />
      )}

      {/* [surface dive] The landed terrain patch, only on the focused planet while the camera
          is at the surface. Outside the spin group so the ground stays put under the camera. */}
      {showSurface && surfaceFocus && (
        <SurfaceView
          planet={planet}
          game={game}
          radius={radius}
          normal={surfaceFocus.normal}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Settled worlds wear a subtle glowing ring (hidden at the surface — it sits at the
          ground plane and would z-fight the terrain patch). */}
      {planet.settled && !showSurface && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.35, radius * 1.55, 48]} />
          <meshBasicMaterial color={settleGlow(planet)} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Selection halo (cosmetic, view-only) — hidden during a surface dive, where the
          camera sits inside it and the wireframe would smear across the view. */}
      {isSelected && !showSurface && (
        <mesh>
          <sphereGeometry args={[radius * 1.12, 16, 16]} />
          <meshBasicMaterial color={PALETTE.glow} wireframe transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}
