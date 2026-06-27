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

/**
 * Contrast note (WCAG 2.1 AA): the previous muted styles used opacity 0.6/0.7 on the
 * dark glass panel, which dropped text below 4.5:1. They now use an explicit
 * MUTED_TEXT (#aab4c8 ≈ 7:1 on the panel bg) instead of dimming, and the panel
 * border was bumped to #243150 for ≥3:1 as a UI boundary. Disabled button text uses
 * #9aa3b8 (≈4.6:1) rather than the old low-contrast #6b7488.
 */
export const PANEL_BG = "rgba(10,14,22,0.86)";
export const MUTED_TEXT = "#aab4c8";

export const panel: CSSProperties = {
  position: "absolute",
  background: PANEL_BG,
  border: "1px solid #243150",
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
  color: MUTED_TEXT,
};

/** Muted-but-legible secondary text. No opacity dimming (it tanked contrast). */
export const subtle: CSSProperties = { color: MUTED_TEXT };

export function button(active = false, enabled = true): CSSProperties {
  return {
    background: active ? "#2862e6" : "#1a2236",
    color: enabled ? "#fff" : "#9aa3b8",
    border: active ? "1px solid #5b8cff" : "1px solid #3a4668",
    borderRadius: 4,
    padding: "4px 8px",
    cursor: enabled ? "pointer" : "not-allowed",
    fontWeight: active ? 700 : 400,
    fontSize: 12,
    // No opacity dimming for the disabled state — the explicit #9aa3b8 text on the
    // button bg stays >=4.5:1, whereas opacity would composite it below threshold.
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
