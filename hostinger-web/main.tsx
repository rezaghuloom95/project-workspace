/// <reference types="vite/client" />

import React from "react";
import { createRoot } from "react-dom/client";
import { ClubPlanner } from "../app/ClubPlanner";
import "../app/globals.css";
import "../app/friendly.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The application root is missing.");
}

async function start() {
  if (import.meta.env.DEV) {
    const { installPreviewApi } = await import("./preview-api");
    installPreviewApi();
  }
  createRoot(root as HTMLElement).render(
    <React.StrictMode>
      <ClubPlanner />
    </React.StrictMode>,
  );
}

void start();
