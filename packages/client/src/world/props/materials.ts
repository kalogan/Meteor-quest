/**
 * [tech props] Shared material vocabulary for the procedural prop family, so every
 * structure reads as built by the same civilisation as the Ship + MiningProbe (cool
 * faceted metals + a glow accent, flat-shaded low-poly). Components reach for these
 * constants instead of hardcoding hexes, keeping the whole catalogue coherent.
 */

/** Hull metals, light → dark. Mirrors Ship.tsx's nose/fuselage/engine ramp. */
export const METAL_LIGHT = "#c9d4e8";
export const METAL_MID = "#8a97b4";
export const METAL_DARK = "#566079";

/** Darker structural members (gantries, frames, struts). */
export const STRUT = "#3c4660";

/** Warm utility accents (hazard stripes, rocket bodies) where a non-tint pop helps. */
export const WARM = "#e8b15a";

/** Cool "energy" accent for panels/coolant where the biome tint isn't used. */
export const COOLANT = "#5cf2d6";

/** Standard panel/glass green for bio structures. */
export const FOLIAGE = "#6fce8a";
