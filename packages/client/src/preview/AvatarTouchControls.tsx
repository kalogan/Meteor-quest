import { useRef, useState } from "react";
import { avatarInput } from "./avatarInput";

const BASE_SIZE = 120;
const THUMB_SIZE = 52;
// Max drag distance from center = base radius - thumb radius.
const R = BASE_SIZE / 2 - THUMB_SIZE / 2;

export function AvatarTouchControls() {
  const baseRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [thumb, setThumb] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const reset = () => {
    draggingRef.current = false;
    setThumb({ x: 0, y: 0 });
    avatarInput.touchX = 0;
    avatarInput.touchZ = 0;
    avatarInput.touchActive = false;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    avatarInput.touchActive = true;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const mag = Math.hypot(dx, dy);
    if (mag > R && mag > 0) {
      const scale = R / mag;
      dx *= scale;
      dy *= scale;
    }
    setThumb({ x: dx, y: dy });
    avatarInput.touchX = dx / R;
    // Dragging UP on screen (negative dy) = forward = +1.
    avatarInput.touchZ = -dy / R;
    avatarInput.touchActive = true;
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    reset();
  };

  const onJumpDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    avatarInput.jumpQueued = true;
  };

  return (
    <>
      <div
        ref={baseRef}
        role="application"
        aria-label="Move joystick"
        data-testid="avatar-joystick"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          position: "absolute",
          left: "max(18px, env(safe-area-inset-left))",
          bottom: "max(24px, env(safe-area-inset-bottom))",
          width: BASE_SIZE,
          height: BASE_SIZE,
          borderRadius: "50%",
          background: "rgba(10,14,22,0.55)",
          border: "1px solid #2a3a5e",
          backdropFilter: "blur(4px)",
          touchAction: "none",
          pointerEvents: "auto",
          color: "#e8edf6",
        }}
      >
        <div
          data-testid="avatar-joystick-thumb"
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            marginLeft: -THUMB_SIZE / 2,
            marginTop: -THUMB_SIZE / 2,
            borderRadius: "50%",
            background: "rgba(120,150,220,0.85)",
            border: "1px solid #5b8cff",
            transform: `translate(${thumb.x}px, ${thumb.y}px)`,
            pointerEvents: "none",
          }}
        />
      </div>

      <button
        type="button"
        aria-label="Jump"
        data-testid="avatar-jump"
        onPointerDown={onJumpDown}
        onClick={() => {
          avatarInput.jumpQueued = true;
        }}
        style={{
          position: "absolute",
          right: "max(18px, env(safe-area-inset-right))",
          bottom: "max(24px, env(safe-area-inset-bottom))",
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: "rgba(47,102,234,0.85)",
          border: "1px solid #5b8cff",
          color: "#ffffff",
          font: "700 14px system-ui",
          touchAction: "none",
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        JUMP
      </button>
    </>
  );
}
