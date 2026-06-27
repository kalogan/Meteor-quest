import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Vector3, type Group, type PerspectiveCamera } from "three";
import { getContentPack } from "@meteor/shared";
import { buildTerrainGeometry, hashStr, makeHeightField, mulberry32 } from "../world/surfaceTerrain";
import { SurfaceAvatar } from "../world/SurfaceAvatar";
import { surfaceProps, type PlanetSurface } from "../world/planetSurface";
import { AvatarFx, type FxEmitter } from "../world/AvatarFx";
import { avatarSfx } from "./avatarSfx";
import { useAvatarConfig, type AvatarConfig } from "../sim/avatarConfig";
import { avatarInput, effectiveMove } from "./avatarInput";
import { AvatarTouchControls } from "./AvatarTouchControls";

/**
 * [preview Tier 2] A walkable surface sandbox — NOT wired into the shipped game. A
 * space-suited avatar walks a low-poly terrain patch under REAL per-planet gravity, with a
 * third-person camera. Move (WASD / on-screen joystick), jump (Space / button), drag to look.
 * Physics + gravity are live-tunable (useAvatarConfig); per-world gravity/grip come from
 * planetSurface, so every planet feels different.
 */

const SIZE = 22;
const HALF = SIZE * 0.42;
const AVATAR_SCALE = 1.15;
const _dir = new Vector3();

function darken(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * f);
  return `rgb(${r},${g},${b})`;
}

function AvatarScene({ biome, seed, surface, tint, accent }: {
  biome: string;
  seed: string;
  surface: PlanetSurface;
  tint: string;
  accent: string;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const avatar = useRef<Group>(null);
  const speedRef = useRef(0);

  const pos = useRef(new Vector3());
  const vel = useRef(new Vector3());
  const grounded = useRef(true);
  const heading = useRef(0);
  const camYaw = useRef(0);
  const camPitch = useRef(0.42);

  // Footstep / landing FX + SFX bookkeeping.
  const fxEmitter = useRef<FxEmitter | null>(null);
  const wasGrounded = useRef(true);
  const stepAccum = useRef(0); // metres walked since the last footstep

  const heightAt = useMemo(() => makeHeightField(seed, SIZE, 0.9, 1.6), [seed]);
  const ground = useMemo(() => buildTerrainGeometry(heightAt, SIZE, 40), [heightAt]);
  const rockTint = darken(tint, 0.55);
  const rocks = useMemo(() => {
    const rng = mulberry32(hashStr(`${seed}:rocks`));
    return Array.from({ length: 16 }, (_, i) => {
      const x = (rng() * 2 - 1) * HALF * 0.92;
      const z = (rng() * 2 - 1) * HALF * 0.92;
      return { key: i, x, y: heightAt(x, z), z, s: 0.12 + rng() * 0.32, rot: rng() * Math.PI };
    });
  }, [heightAt, seed]);

  // Reset the avatar on world change.
  useEffect(() => {
    pos.current.set(0, heightAt(0, 0), 0);
    vel.current.set(0, 0, 0);
    grounded.current = true;
  }, [heightAt]);

  // Keyboard → input seam (digital move + edge jump).
  useEffect(() => {
    const held = new Set<string>();
    const recompute = () => {
      let x = 0;
      let z = 0;
      if (held.has("w") || held.has("arrowup")) z += 1;
      if (held.has("s") || held.has("arrowdown")) z -= 1;
      if (held.has("d") || held.has("arrowright")) x += 1;
      if (held.has("a") || held.has("arrowleft")) x -= 1;
      avatarInput.keyX = x;
      avatarInput.keyZ = z;
    };
    const norm = (k: string) => (k === " " ? "space" : k);
    const down = (e: KeyboardEvent) => {
      const k = norm(e.key.toLowerCase());
      if (["w", "a", "s", "d", "space", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        if (k === "space") { avatarInput.jumpQueued = true; e.preventDefault(); }
        else { held.add(k); recompute(); }
      }
    };
    const up = (e: KeyboardEvent) => { held.delete(norm(e.key.toLowerCase())); recompute(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Drag the CANVAS (not the on-screen controls) to orbit the camera.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    const dp = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const mv = (e: PointerEvent) => {
      if (!dragging) return;
      camYaw.current -= (e.clientX - lx) * 0.005;
      camPitch.current = Math.max(0.1, Math.min(1.2, camPitch.current + (e.clientY - ly) * 0.005));
      lx = e.clientX;
      ly = e.clientY;
    };
    const upp = () => { dragging = false; };
    el.addEventListener("pointerdown", dp);
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", upp);
    return () => {
      el.removeEventListener("pointerdown", dp);
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", upp);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.045, dtRaw);
    const cfg = useAvatarConfig.getState();
    const grav = cfg.baseG * surface.gravity * cfg.gravityScale;

    // Camera-relative move from the input seam (joystick wins over keys).
    const cy = camYaw.current;
    const mv = effectiveMove();
    let mx = mv.x;
    let mz = mv.z;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const wx = mz * Math.sin(cy) + mx * Math.cos(cy);
    const wz = mz * Math.cos(cy) - mx * Math.sin(cy);

    const v = vel.current;
    const accel = cfg.moveAccel * (grounded.current ? 1 : cfg.airControl);
    v.x += wx * accel * dt;
    v.z += wz * accel * dt;
    const damp = grounded.current ? Math.exp(-(2 + cfg.friction * surface.grip) * dt) : Math.exp(-0.4 * dt);
    v.x *= damp;
    v.z *= damp;
    const hs0 = Math.hypot(v.x, v.z);
    if (hs0 > cfg.maxSpeed) { v.x = (v.x / hs0) * cfg.maxSpeed; v.z = (v.z / hs0) * cfg.maxSpeed; }

    v.y -= grav * dt;
    if (avatarInput.jumpQueued) {
      if (grounded.current) { v.y = cfg.jumpSpeed; grounded.current = false; avatarSfx.jump(); }
      avatarInput.jumpQueued = false; // consume (no buffering / double-jump)
    }

    const p = pos.current;
    p.x = Math.max(-HALF, Math.min(HALF, p.x + v.x * dt));
    p.z = Math.max(-HALF, Math.min(HALF, p.z + v.z * dt));
    p.y += v.y * dt;
    const gy = heightAt(p.x, p.z);
    const impactVy = v.y; // downward speed at the moment of contact
    if (p.y <= gy) { p.y = gy; if (v.y < 0) v.y = 0; grounded.current = true; }
    else grounded.current = false;

    // Landing: airborne → grounded transition. Strength scales with the impact speed
    // (relative to a fast fall), so a small hop puffs less than a long drop.
    if (grounded.current && !wasGrounded.current) {
      const strength = Math.max(0.2, Math.min(1.5, -impactVy / 6));
      avatarSfx.land(strength);
      fxEmitter.current?.burst(p.x, gy, p.z, strength, "land");
      stepAccum.current = 0; // don't immediately fire a footstep after touchdown
    }
    wasGrounded.current = grounded.current;

    const hs = Math.hypot(v.x, v.z);
    speedRef.current = hs;

    // Footsteps: emit dust + a tap every ~1.4 metres while walking on the ground.
    if (grounded.current && hs > 0.6) {
      stepAccum.current += hs * dt;
      if (stepAccum.current >= 1.4) {
        stepAccum.current = 0;
        const strength = Math.max(0.25, Math.min(1, hs / cfg.maxSpeed));
        avatarSfx.step();
        fxEmitter.current?.burst(p.x, gy, p.z, strength, "step");
      }
    } else if (hs <= 0.6) {
      stepAccum.current = 0;
    }
    if (hs > 0.3) heading.current = Math.atan2(v.x, v.z);
    if (avatar.current) {
      avatar.current.position.copy(p);
      avatar.current.rotation.y = heading.current;
    }

    const cp = camPitch.current;
    _dir.set(Math.sin(cy) * Math.cos(cp), Math.sin(cp), Math.cos(cy) * Math.cos(cp));
    const tx = p.x;
    const ty = p.y + AVATAR_SCALE * 0.8;
    const tz = p.z;
    const dist = 4.6;
    camera.position.set(tx - _dir.x * dist, ty + _dir.y * dist, tz - _dir.z * dist);
    camera.lookAt(tx, ty, tz);

    (window as unknown as { __avatar?: object }).__avatar = {
      x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3),
      speed: +hs.toFixed(3), gravity: +(surface.gravity * cfg.gravityScale).toFixed(3),
      grounded: grounded.current, biome,
    };
  });

  return (
    <>
      <color attach="background" args={["#05060a"]} />
      <Stars radius={120} depth={50} count={1500} factor={3} saturation={0} fade speed={0.3} />
      <hemisphereLight color="#bcd0ff" groundColor={tint} intensity={0.8} />
      <directionalLight position={[10, 14, 6]} intensity={2.4} color="#ffe6b0" />
      <ambientLight intensity={0.25} />

      <mesh geometry={ground}>
        <meshStandardMaterial color={tint} roughness={0.95} metalness={0.02} flatShading emissive={tint} emissiveIntensity={0.05} />
      </mesh>

      {/* Scattered low-poly rocks for a less-empty world. */}
      {rocks.map((rk) => (
        <mesh key={rk.key} position={[rk.x, rk.y + rk.s * 0.35, rk.z]} rotation={[rk.rot * 0.4, rk.rot, 0]} scale={rk.s}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={rockTint} roughness={1} flatShading />
        </mesh>
      ))}

      <group ref={avatar} scale={AVATAR_SCALE}>
        <SurfaceAvatar speedRef={speedRef} accent={accent} reducedMotion={false} />
      </group>

      {/* Footstep dust + landing puffs (pooled, cosmetic). */}
      <AvatarFx emitterRef={fxEmitter} tint={tint} />
    </>
  );
}

const PANEL_KNOBS: { key: keyof AvatarConfig; label: string; min: number; max: number; step: number }[] = [
  { key: "gravityScale", label: "Gravity ×", min: 0.2, max: 2.5, step: 0.05 },
  { key: "jumpSpeed", label: "Jump speed", min: 3, max: 11, step: 0.2 },
  { key: "moveAccel", label: "Move accel", min: 10, max: 60, step: 1 },
  { key: "maxSpeed", label: "Max speed", min: 2, max: 9, step: 0.1 },
  { key: "friction", label: "Friction (×grip)", min: 2, max: 18, step: 0.5 },
  { key: "airControl", label: "Air control", min: 0, max: 1, step: 0.05 },
  { key: "baseG", label: "Base gravity", min: 6, max: 36, step: 1 },
];

function BtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "#2f66ea" : "#1a2236",
    color: "#fff",
    border: active ? "1px solid #5b8cff" : "1px solid #2a3a5e",
    borderRadius: 7,
    padding: "5px 10px",
    cursor: "pointer",
    font: '700 12px/1 system-ui, sans-serif',
  };
}

export function AvatarMode({ onReturnToOrbit }: { onReturnToOrbit?: () => void }) {
  const biomes = useMemo(() => getContentPack().biomes, []);
  const [biomeId, setBiomeId] = useState(biomes[0]?.id ?? "rock");
  const biome = biomes.find((b) => b.id === biomeId) ?? biomes[0];
  const seed = `avatar:${biomeId}`;
  const surface = useMemo(() => surfaceProps(biomeId, seed), [biomeId, seed]);
  const tint = biome?.color ?? "#8a7a5a";
  const accent = "#8fe3ff";

  const cfg = useAvatarConfig();
  const setCfg = useAvatarConfig((s) => s.set);
  const resetCfg = useAvatarConfig((s) => s.reset);
  const effG = (surface.gravity * cfg.gravityScale).toFixed(2);

  return (
    <div style={{ position: "absolute", inset: 0 }} data-testid="avatar-mode">
      <Canvas data-testid="avatar-canvas" camera={{ position: [0, 4, 7], fov: 55, near: 0.1, far: 400 }}>
        <AvatarScene biome={biomeId} seed={seed} surface={surface} tint={tint} accent={accent} />
      </Canvas>

      {/* On-screen touch controls (joystick + jump). */}
      <AvatarTouchControls />

      {/* World picker + gravity/feel tuner. */}
      <div
        data-testid="avatar-panel"
        style={{
          position: "absolute", top: 12, left: 12, width: 248, maxHeight: "calc(100% - 24px)", overflowY: "auto",
          background: "rgba(10,14,22,0.92)", border: "1px solid #1d2740", borderRadius: 10, padding: 12,
          color: "#e8edf6", font: '500 13px/1.4 system-ui, sans-serif', backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ fontSize: 13 }}>Walk a world</strong>
          {onReturnToOrbit && (
            <button
              data-testid="avatar-return-orbit"
              aria-label="return to orbit"
              onClick={onReturnToOrbit}
              style={{ font: "700 12px/1 system-ui, sans-serif", color: "#fff", background: "#23304d", border: "1px solid #3a4a72", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
            >
              ↑ Return to orbit
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 10px" }}>
          {biomes.map((b) => (
            <button key={b.id} data-testid={`avatar-biome-${b.id}`} onClick={() => setBiomeId(b.id)} style={BtnStyle(b.id === biomeId)}>
              {b.name}
            </button>
          ))}
        </div>
        <div data-testid="avatar-gravity" style={{ color: "#cdd6e6" }}>
          Gravity <strong style={{ color: "#8fb4ff" }}>{effG} g</strong> · {surface.label}
        </div>
        <div style={{ color: "#aeb8cc", fontSize: 12, marginTop: 2 }}>
          Grip {surface.grip.toFixed(2)} {surface.grip < 0.6 ? "· slippery" : ""}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 4px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#8fb4ff" }}>Physics</span>
          <button
            data-testid="avatar-reset"
            onClick={() => resetCfg()}
            style={{ font: "inherit", fontWeight: 700, color: "#fff", background: "#2f66ea", border: "1px solid #5b8cff", borderRadius: 7, padding: "3px 9px", cursor: "pointer" }}
          >
            Reset
          </button>
        </div>
        {PANEL_KNOBS.map((knob) => (
          <label key={knob.key} style={{ display: "block", marginBottom: 6 }}>
            <span style={{ display: "flex", justifyContent: "space-between", color: "#cdd6e6", fontSize: 12 }}>
              <span>{knob.label}</span>
              <span style={{ color: "#aeb8cc" }}>{Number(cfg[knob.key]).toFixed(knob.step < 1 ? 2 : 0)}</span>
            </span>
            <input
              type="range"
              data-testid={`avatar-knob-${knob.key}`}
              min={knob.min}
              max={knob.max}
              step={knob.step}
              value={cfg[knob.key]}
              onChange={(e) => setCfg({ [knob.key]: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "#5b8cff" }}
            />
          </label>
        ))}
        <div style={{ color: "#7f8aa3", fontSize: 11, marginTop: 6 }}>
          WASD / joystick · Space / button to jump · drag to look. Preview-only.
        </div>
      </div>
    </div>
  );
}
