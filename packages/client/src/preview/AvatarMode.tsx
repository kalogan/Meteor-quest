import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Vector3, type Group, type PerspectiveCamera } from "three";
import { getContentPack } from "@meteor/shared";
import { buildTerrainGeometry, makeHeightField } from "../world/surfaceTerrain";
import { SurfaceAvatar } from "../world/SurfaceAvatar";
import { surfaceProps, type PlanetSurface } from "../world/planetSurface";

/**
 * [preview Tier 2] A walkable, self-contained surface sandbox — NOT wired into the game
 * (the dive/roam in the shipped game stays a camera). A space-suited avatar walks a low-poly
 * terrain patch under REAL per-planet gravity: pick a world and the feel changes (a low-g ice
 * moon is floaty and hard to stop; a heavy rock world is sluggish with stubby jumps). WASD to
 * move (camera-relative), Space to jump, drag to orbit the third-person camera.
 */

const SIZE = 22;
const HALF = SIZE * 0.42; // arena clamp
const G0 = 18; // base gravity (units/s²) at 1.0 g
const JUMP = 6.2;
const MOVE_ACCEL = 28;
const MAX_SPEED = 4.4;
const AVATAR_SCALE = 1.15;
const _dir = new Vector3();

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

  // Physics state.
  const pos = useRef(new Vector3());
  const vel = useRef(new Vector3());
  const grounded = useRef(true);
  const heading = useRef(0);
  // Camera orbit (drag).
  const camYaw = useRef(0.0);
  const camPitch = useRef(0.42);
  // Input.
  const keys = useRef<Set<string>>(new Set());

  const heightAt = useMemo(() => makeHeightField(seed, SIZE, 0.9, 1.6), [seed]);
  const ground = useMemo(() => buildTerrainGeometry(heightAt, SIZE, 40), [heightAt]);

  // Reset the avatar to the centre whenever the world changes.
  useEffect(() => {
    pos.current.set(0, heightAt(0, 0), 0);
    vel.current.set(0, 0, 0);
    grounded.current = true;
  }, [heightAt]);

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keys.current.add(k === " " ? "space" : k);
        if (k === " ") e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase() === " " ? "space" : e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Drag to orbit the camera.
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
    const k = keys.current;
    const grav = G0 * surface.gravity;

    // Camera-relative move basis (flatten to ground).
    const cy = camYaw.current;
    const fwdX = Math.sin(cy);
    const fwdZ = Math.cos(cy);
    let mx = 0;
    let mz = 0;
    if (k.has("w") || k.has("arrowup")) { mx += fwdX; mz += fwdZ; }
    if (k.has("s") || k.has("arrowdown")) { mx -= fwdX; mz -= fwdZ; }
    if (k.has("d") || k.has("arrowright")) { mx += fwdZ; mz -= fwdX; }
    if (k.has("a") || k.has("arrowleft")) { mx -= fwdZ; mz += fwdX; }
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }

    const v = vel.current;
    // Horizontal accel (less control in the air).
    const accel = MOVE_ACCEL * (grounded.current ? 1 : 0.35);
    v.x += mx * accel * dt;
    v.z += mz * accel * dt;
    // Friction: grip damps the ground; low-grip worlds slide. Light air drag.
    const damp = grounded.current ? Math.exp(-(2 + surface.grip * 8) * dt) : Math.exp(-0.4 * dt);
    v.x *= damp;
    v.z *= damp;
    const hs = Math.hypot(v.x, v.z);
    if (hs > MAX_SPEED) { v.x = (v.x / hs) * MAX_SPEED; v.z = (v.z / hs) * MAX_SPEED; }

    // Gravity + jump.
    v.y -= grav * dt;
    if (k.has("space") && grounded.current) { v.y = JUMP; grounded.current = false; }

    // Integrate + clamp to arena.
    const p = pos.current;
    p.x = Math.max(-HALF, Math.min(HALF, p.x + v.x * dt));
    p.z = Math.max(-HALF, Math.min(HALF, p.z + v.z * dt));
    p.y += v.y * dt;
    const gy = heightAt(p.x, p.z);
    if (p.y <= gy) { p.y = gy; if (v.y < 0) v.y = 0; grounded.current = true; }
    else grounded.current = false;

    speedRef.current = hs;

    // Face the move direction.
    if (hs > 0.3) heading.current = Math.atan2(v.x, v.z);
    if (avatar.current) {
      avatar.current.position.copy(p);
      avatar.current.rotation.y = heading.current;
    }

    // Third-person follow camera (orbit yaw/pitch around the avatar's head).
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
      speed: +speedRef.current.toFixed(3), gravity: surface.gravity, grounded: grounded.current, biome,
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

      <group ref={avatar} scale={AVATAR_SCALE}>
        <SurfaceAvatar speedRef={speedRef} accent={accent} reducedMotion={false} />
      </group>
    </>
  );
}

const BTN = (active: boolean): React.CSSProperties => ({
  background: active ? "#2f66ea" : "#1a2236",
  color: "#fff",
  border: active ? "1px solid #5b8cff" : "1px solid #2a3a5e",
  borderRadius: 7,
  padding: "5px 10px",
  cursor: "pointer",
  font: '700 12px/1 system-ui, sans-serif',
});

export function AvatarMode() {
  const biomes = useMemo(() => getContentPack().biomes, []);
  const [biomeId, setBiomeId] = useState(biomes[0]?.id ?? "rock");
  const biome = biomes.find((b) => b.id === biomeId) ?? biomes[0];
  const seed = `avatar:${biomeId}`;
  const surface = useMemo(() => surfaceProps(biomeId, seed), [biomeId, seed]);
  const tint = biome?.color ?? "#8a7a5a";
  const accent = "#8fe3ff";

  return (
    <div style={{ position: "absolute", inset: 0 }} data-testid="avatar-mode">
      <Canvas data-testid="avatar-canvas" camera={{ position: [0, 4, 7], fov: 55, near: 0.1, far: 400 }}>
        <AvatarScene biome={biomeId} seed={seed} surface={surface} tint={tint} accent={accent} />
      </Canvas>

      {/* World picker + readout. */}
      <div
        data-testid="avatar-panel"
        style={{
          position: "absolute", top: 12, left: 12, width: 240,
          background: "rgba(10,14,22,0.92)", border: "1px solid #1d2740", borderRadius: 10, padding: 12,
          color: "#e8edf6", font: '500 13px/1.4 system-ui, sans-serif', backdropFilter: "blur(6px)",
        }}
      >
        <strong style={{ fontSize: 13 }}>Walk a world</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 10px" }}>
          {biomes.map((b) => (
            <button key={b.id} data-testid={`avatar-biome-${b.id}`} onClick={() => setBiomeId(b.id)} style={BTN(b.id === biomeId)}>
              {b.name}
            </button>
          ))}
        </div>
        <div data-testid="avatar-gravity" style={{ color: "#cdd6e6" }}>
          Gravity <strong style={{ color: "#8fb4ff" }}>{surface.gravity.toFixed(2)} g</strong> · {surface.label}
        </div>
        <div style={{ color: "#aeb8cc", fontSize: 12, marginTop: 2 }}>
          Grip {surface.grip.toFixed(2)} {surface.grip < 0.6 ? "· slippery" : ""}
        </div>
        <div style={{ color: "#7f8aa3", fontSize: 11, marginTop: 8 }}>
          WASD move · Space jump · drag to look
        </div>
      </div>
    </div>
  );
}
