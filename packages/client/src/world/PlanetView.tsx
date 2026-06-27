import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import type { Continent, GameState, Planet } from "@meteor/shared";
import { useSelection } from "../sim/selection";
import { PALETTE, planetColor, settleGlow } from "./palette";
import { planetRadius } from "./layout";

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
}: {
  planet: Planet;
  game: GameState;
  isCradle: boolean;
  position: [number, number, number];
}) {
  const spin = useRef<Group>(null);
  const select = useSelection((s) => s.select);
  const selectedId = useSelection((s) => s.selectedId);
  const isSelected = selectedId === planet.id;

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
      <group ref={spin}>
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
      </group>

      {/* Settled worlds wear a subtle glowing ring. */}
      {planet.settled && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.35, radius * 1.55, 48]} />
          <meshBasicMaterial color={settleGlow(planet)} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Selection halo (cosmetic, view-only). */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[radius * 1.12, 16, 16]} />
          <meshBasicMaterial color={PALETTE.glow} wireframe transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}
