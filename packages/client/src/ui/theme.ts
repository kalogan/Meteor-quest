import type { CSSProperties } from "react";
import {
  COMMON_RESOURCES,
  RARE_RESOURCES,
  getContentPack,
  type GameState,
  type ResourceId,
} from "@meteor/shared";

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

/** [slice 2] Tactical-defense economy, read from content via the shared seam.
 * Mirrors the sim-core default so the build cost + yield shown to the player match
 * what `buildDefense` actually spends (the sim stays authoritative). */
export interface DefenseInfo {
  buildCost: Partial<Record<ResourceId, number>>;
  defensePerBuild: number;
}

const DEFAULT_DEFENSE: DefenseInfo = {
  buildCost: { alloy: 10, energy: 10 },
  defensePerBuild: 5,
};

export function defenseInfo(): DefenseInfo {
  const cfg = getContentPack().defense;
  if (!cfg) return DEFAULT_DEFENSE;
  return { buildCost: cfg.buildCost, defensePerBuild: cfg.defensePerBuild };
}

/** Can the player currently afford this resource cost given their stockpiles? */
export function canAfford(game: GameState, cost: Partial<Record<ResourceId, number>>): boolean {
  return Object.entries(cost).every(
    ([r, amount]) => (game.stockpiles[r as ResourceId] ?? 0) >= (amount ?? 0),
  );
}

/** Render a cost map compactly, e.g. "10 alloy · 10 energy". */
export function formatCost(cost: Partial<Record<ResourceId, number>>): string {
  return Object.entries(cost)
    .map(([r, amount]) => `${amount} ${r}`)
    .join(" · ");
}
