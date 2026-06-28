import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startAudioEngine } from "./audio/audioEngine";
import { startJournalLog } from "./sim/journalLog";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Procedural music + SFX. Idempotent + silent until the first user gesture (browser
// autoplay policy); no-ops where Web Audio is unavailable.
startAudioEngine();

// Travel-journal observer: records when each world was first logged + queues toasts for
// newly-charted worlds. Read-only over the sim; persists timestamps per seed.
startJournalLog();
