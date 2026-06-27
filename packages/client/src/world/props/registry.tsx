import type { FunctionComponent } from "react";
import type { PropKind } from "@meteor/shared";
import type { PropProps } from "./types";
import {
  Antenna,
  Biodome,
  Capitol,
  DishArray,
  Foundry,
  GovSpire,
  Launchpad,
  Reactor,
  Refinery,
  SolarArray,
} from "./GroundProps";
import {
  CommandStation,
  SenateRing,
  SensorSat,
  Shipyard,
  SurveyNet,
  WarpGate,
} from "./OrbitProps";

/**
 * [tech props] The single map from a content prop `kind` (PROP_KINDS, shared) to the
 * procedural component that draws it. The schema guarantees `kind` is one of these, so
 * this record is exhaustive (TypeScript enforces every PropKind has an entry) — adding
 * a new prop is: add the kind to PROP_KINDS, author the component, register it here.
 */
export const PROP_COMPONENTS: Record<PropKind, FunctionComponent<PropProps>> = {
  // ground structures
  foundry: Foundry,
  refinery: Refinery,
  solar_array: SolarArray,
  reactor: Reactor,
  capitol: Capitol,
  gov_spire: GovSpire,
  antenna: Antenna,
  dish_array: DishArray,
  biodome: Biodome,
  launchpad: Launchpad,
  // orbital structures
  shipyard: Shipyard,
  command_station: CommandStation,
  senate_ring: SenateRing,
  warp_gate: WarpGate,
  sensor_sat: SensorSat,
  survey_net: SurveyNet,
};
