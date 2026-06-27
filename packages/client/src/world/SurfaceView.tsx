import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { getContentPack, type GameState, type Planet, type PropKind, type TechProp } from "@meteor/shared";
import { PROP_COMPONENTS } from "./props/registry";
import { biomePropTint, planetColor } from "./palette";
import { buildTerrainGeometry, hashStr, makeHeightField, mulberry32 } from "./surfaceTerrain";
import { useSurfaceConfig } from "../sim/surfaceConfig";

/**
 * [surface dive] The closest view — a low-poly TERRAIN PATCH the camera lands on when it
 * descends below city tier (CameraRig.nearSurface). Built in the planet's LOCAL frame and
 * anchored at the focus surface point (normal), oriented so local +Y is "up from the
 * ground". It reads as standing on the world: gentle biome-tinted relief that domes DOWN at
 * the edges into a curved horizon, an atmospheric haze band ringing that horizon, and the
 * colony's unlocked structures scaled up onto the surface.
 *
 * All shape/look knobs come from `useSurfaceConfig` (defaults = the previously-inlined
 * values) so the preview harness can tune them live. Purely cosmetic + deterministic
 * (seeded from the planet id).
 */

const UP = new Vector3(0, 1, 0);
const pack = getContentPack();

/** Vertical haze band ringing the horizon: bright at the ground, fading up. */
function buildHaze(radius: number, size: number, tint: string): BufferGeometry {
  const segs = 48;
  const r = size * 0.46; // just inside the patch rim, so it sits AT the horizon line
  const h = radius * 0.8;
  const pos: number[] = [];
  const colors: number[] = [];
  const top = hexToRgb(tint);
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    const lo = [top.r, top.g, top.b];
    const hi = [top.r * 0.15, top.g * 0.18, top.b * 0.25];
    pos.push(x0, -radius * 0.05, z0, x1, -radius * 0.05, z1, x1, h, z1);
    colors.push(...lo, ...lo, ...hi);
    pos.push(x0, -radius * 0.05, z0, x1, h, z1, x0, h, z0);
    colors.push(...lo, ...hi, ...hi);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geo;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** Unlocked tech structures placed on the patch (a legible "colony"). */
function unlockedGroundProps(game: GameState): { kind: PropKind }[] {
  const owned = new Set(game.research.unlocked);
  return pack.tech
    .filter((t) => t.prop && (t.prop as TechProp).placement === "ground" && owned.has(t.id))
    .map((t) => ({ kind: (t.prop as TechProp).kind }));
}

export function SurfaceView({
  planet,
  game,
  radius,
  normal,
  reducedMotion,
}: {
  planet: Planet;
  game: GameState;
  radius: number;
  /** Unit LOCAL surface normal the patch is anchored at. */
  normal: [number, number, number];
  reducedMotion: boolean;
}) {
  const cfg = useSurfaceConfig();
  const size = radius * cfg.arenaSize;
  const tint = planetColor(planet);
  const accent = biomePropTint(planet);

  // Orient the patch as a full basis (local +Y = surface normal, local +Z = the camera's
  // gaze direction — the SAME tangent CameraRig looks along), so "forward (+Z)" is straight
  // ahead of the landed camera and structures placed there are reliably in view.
  const orient = useMemo(() => {
    const n = new Vector3(normal[0], normal[1], normal[2]).normalize();
    let f = new Vector3().crossVectors(n, UP);
    if (f.lengthSq() < 1e-4) f = new Vector3().crossVectors(n, new Vector3(1, 0, 0));
    f.normalize();
    const right = new Vector3().crossVectors(n, f).normalize();
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, n, f));
    const pos = n.multiplyScalar(radius);
    return { quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number], position: [pos.x, pos.y, pos.z] as [number, number, number] };
  }, [normal, radius]);

  const heightAt = useMemo(
    () => makeHeightField(planet.id, size, radius * cfg.relief, radius * cfg.dome),
    [planet.id, size, radius, cfg.relief, cfg.dome],
  );
  const ground = useMemo(() => buildTerrainGeometry(heightAt, size, cfg.segs), [heightAt, size, cfg.segs]);
  const haze = useMemo(() => buildHaze(radius, size, accent), [radius, size, accent]);

  // Scatter the colony's structures across the central, flatter part of the patch.
  const structures = useMemo(() => {
    const props = unlockedGroundProps(game);
    if (props.length === 0) return [];
    const rng = mulberry32(hashStr(planet.id) ^ 0xc0ffee);
    const n = Math.min(cfg.structureCount, props.length);
    return props.slice(0, n).map((p, i) => {
      const z = size * 0.045 + (size * 0.12 * i) / Math.max(1, n - 1);
      const x = (i - (n - 1) / 2) * size * 0.08 + (rng() - 0.5) * size * 0.02;
      return { key: `${p.kind}:${i}`, kind: p.kind, x, z, y: heightAt(x, z), scale: radius * cfg.structureScale * (0.9 + rng() * 0.2) };
    });
  }, [game.research.unlocked, planet.id, size, radius, heightAt, cfg.structureCount, cfg.structureScale]);

  return (
    <group position={orient.position} quaternion={orient.quaternion}>
      {/* The ground. */}
      <mesh geometry={ground}>
        <meshStandardMaterial color={tint} roughness={0.95} metalness={0.02} flatShading emissive={tint} emissiveIntensity={0.05} />
      </mesh>

      {/* Horizon atmosphere band (cosmetic; never eats picks). */}
      <mesh geometry={haze} raycast={() => null}>
        <meshBasicMaterial vertexColors transparent opacity={cfg.hazeOpacity} depthWrite={false} side={2} />
      </mesh>

      {/* Local lighting so the patch + structures read at the landed angle: a sky fill + a
          warm low sun grazing across the relief. */}
      <hemisphereLight color="#bcd0ff" groundColor={tint} intensity={0.85} />
      <directionalLight position={[size * 0.5, radius * 1.6, size * 0.3]} intensity={2.4} color="#ffe6b0" />
      <pointLight position={[-size * 0.2, radius * 0.9, size * 0.1]} intensity={10} distance={size * 4} decay={1.4} color="#ffd9a0" />

      {/* The colony's structures, planted on the relief. */}
      {structures.map((s) => {
        const Comp = PROP_COMPONENTS[s.kind];
        return (
          <group key={s.key} position={[s.x, s.y, s.z]} scale={s.scale}>
            <Comp tint={accent} reducedMotion={reducedMotion} />
          </group>
        );
      })}
    </group>
  );
}
