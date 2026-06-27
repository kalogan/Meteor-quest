import type { CSSProperties } from "react";
import { COMMON_RESOURCES, RARE_RESOURCES, type ResourceId } from "@meteor/shared";

/**
 * Shared HUD look + small helpers. The overlay is a glassy dark panel set; the
 * intent is that it reads cleanly at God-view (few controls, big aggregate moves)
 * and only exposes the dense micro when authority sits low.
 */

export const panel: CSSProperties = {
  position: "absolute",
  background: "rgba(10,14,22,0.86)",
  border: "1px solid #1d2740",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: "#e8edf6",
  pointerEvents: "auto",
  backdropFilter: "blur(4px)",
};

export const heading: CSSProperties = {
  fontWeight: 700,
  marginBottom: 8,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  fontSize: 11,
  opacity: 0.6,
};

export const subtle: CSSProperties = { opacity: 0.6 };

export function button(active = false, enabled = true): CSSProperties {
  return {
    background: active ? "#2b6cff" : "#1a2236",
    color: enabled ? "#fff" : "#6b7488",
    border: active ? "1px solid #5b8cff" : "1px solid #28324c",
    borderRadius: 4,
    padding: "4px 8px",
    cursor: enabled ? "pointer" : "not-allowed",
    fontWeight: active ? 700 : 400,
    fontSize: 12,
    opacity: enabled ? 1 : 0.5,
  };
}

/** Resources the player commonly steers production toward (focus/policy choices). */
export const FOCUSABLE_RESOURCES: ResourceId[] = [...COMMON_RESOURCES];

export const ALL_RESOURCES: ResourceId[] = [...COMMON_RESOURCES, ...RARE_RESOURCES];

/** A short glyph for severity, so event prompts read at a glance. */
export function severityLabel(severity: number): string {
  if (severity >= 8) return "critical";
  if (severity >= 4) return "serious";
  return "minor";
}
