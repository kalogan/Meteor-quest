import React from "react";
import { createRoot } from "react-dom/client";
import { PreviewApp } from "./PreviewApp";
import "../index.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>,
);
