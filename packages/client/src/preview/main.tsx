import React from "react";
import { createRoot } from "react-dom/client";
import { PreviewApp } from "./PreviewApp";
import { useSim } from "../sim/store";
import { useSelection } from "../sim/selection";
import { usePropHover } from "../sim/propHover";
import "../index.css";

// [harness] The preview is the agent runtime-smoke surface (see PREVIEW_HARNESS): expose the
// REAL stores so a headless smoke can install a specific GameState (a mid-game world with
// tech unlocked), frame an entity, or assert the hover tooltip — all against the REAL render,
// no product/test fork. Preview-only (these mounts never ship in the game bundle).
const harness = window as unknown as {
  __sim?: typeof useSim;
  __selection?: typeof useSelection;
  __propHover?: typeof usePropHover;
};
harness.__sim = useSim;
harness.__selection = useSelection;
harness.__propHover = usePropHover;

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>,
);
