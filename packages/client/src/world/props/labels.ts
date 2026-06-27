import type { PropKind } from "@meteor/shared";

/**
 * [tech props] Human-facing labels for each structure — the title + one-line blurb shown
 * in the hover tooltip ("what built this?"). Keyed by PROP_KIND so it's exhaustive
 * (TypeScript flags a missing entry). The tech that unlocked the structure is shown
 * separately from content (tech.name), so this is just the structure's own identity.
 */
export const PROP_LABELS: Record<PropKind, { title: string; blurb: string }> = {
  foundry: { title: "Foundry", blurb: "Heavy industry — smelts raw minerals into usable stock." },
  refinery: { title: "Refinery", blurb: "Refines raw output into alloys." },
  solar_array: { title: "Solar Array", blurb: "Grid power from photovoltaic fields." },
  reactor: { title: "Fusion Reactor", blurb: "Fusion power — a leap in energy output." },
  capitol: { title: "Capitol", blurb: "Seat of federal administration." },
  gov_spire: { title: "Government Spire", blurb: "Planetary government — central authority." },
  antenna: { title: "Sensor Antenna", blurb: "Basic sensors — extends your scan range." },
  dish_array: { title: "Deep-Space Dish", blurb: "Deep-space sensors — sees further into the dark." },
  biodome: { title: "Bio-Dome", blurb: "Bio-synthesis labs — life sciences." },
  launchpad: { title: "Launchpad", blurb: "Rocketry — the first step off the surface." },
  shipyard: { title: "Orbital Shipyard", blurb: "Orbital launch — builds and berths ships in orbit." },
  command_station: { title: "Command Station", blurb: "System command — coordinates a whole system." },
  senate_ring: { title: "Senate Ring", blurb: "Galactic senate — galaxy-tier authority." },
  warp_gate: { title: "Warp Gate", blurb: "Warp fundamentals — faster-than-light travel." },
  sensor_sat: { title: "Sensor Satellite", blurb: "Long-range array — deep scanning from orbit." },
  survey_net: { title: "Survey Net", blurb: "Galactic survey — charts the far galaxy." },
};
