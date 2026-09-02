import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { captureInstallPrompt } from "./domain/install";
import App from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { PwaStatus } from "./PwaStatus";
import "./styles.css";

// Before render: Chrome fires beforeinstallprompt once, early, and only
// hands it to a listener that already exists.
captureInstallPrompt();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
      <PwaStatus />
    </AppErrorBoundary>
  </StrictMode>,
);
