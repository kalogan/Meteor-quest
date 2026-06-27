/**
 * [preview avatar] Shared INPUT SEAM. Keyboard (AvatarMode) and the on-screen touch controls
 * (AvatarTouchControls) both write here; the AvatarMode physics controller reads it each
 * frame. A plain mutable singleton — no React state, so writing it never re-renders.
 *
 * Axes are avatar-local intent, resolved to camera-relative motion by the controller:
 *   x = strafe (+1 right), z = forward (+1 forward). Magnitudes are analog -1..1 (the
 *   joystick) or digital ±1 (WASD). `jumpQueued` is edge-triggered: a writer sets it true,
 *   the controller consumes it (sets false) on the next grounded jump.
 */
export interface AvatarInput {
  keyX: number;
  keyZ: number;
  touchX: number;
  touchZ: number;
  touchActive: boolean;
  jumpQueued: boolean;
}

export const avatarInput: AvatarInput = {
  keyX: 0,
  keyZ: 0,
  touchX: 0,
  touchZ: 0,
  touchActive: false,
  jumpQueued: false,
};

/** The effective move vector this frame — touch joystick wins when engaged, else WASD. */
export function effectiveMove(): { x: number; z: number } {
  if (avatarInput.touchActive) return { x: avatarInput.touchX, z: avatarInput.touchZ };
  return { x: avatarInput.keyX, z: avatarInput.keyZ };
}

export function resetAvatarInput(): void {
  avatarInput.keyX = 0;
  avatarInput.keyZ = 0;
  avatarInput.touchX = 0;
  avatarInput.touchZ = 0;
  avatarInput.touchActive = false;
  avatarInput.jumpQueued = false;
}
