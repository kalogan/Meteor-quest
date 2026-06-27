import React from "react";
import { createRoot } from "react-dom/client";
import { PreviewApp } from "./PreviewApp";
import { useSim } from "../sim/store";
import "../index.css";

// [harness] The preview is the agent runtime-smoke surface (see PREVIEW_HARNESS): expose
// the REAL sim store so a headless smoke can install a specific GameState (e.g. a mid-game
// world with tech unlocked) and assert the REAL render — no product/test fork. Preview-only.
(window as unknown as { __sim?: typeof useSim }).__sim = useSim;

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>,
);
