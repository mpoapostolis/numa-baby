import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { captureInstallPrompt } from "./domain/install";
import { initLocale } from "./i18n";
import App from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { PwaStatus } from "./PwaStatus";
import "./styles.css";

// Before render: Chrome fires beforeinstallprompt once, early, and only
// hands it to a listener that already exists.
captureInstallPrompt();

// The dictionary must exist before the first render — t() is synchronous on
// purpose — and initLocale resolves immediately for English, so only a phone
// set to Greek waits, for one precached chunk. Render on failure too:
// English beats blank.
void initLocale().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
        <PwaStatus />
      </AppErrorBoundary>
    </StrictMode>,
  );
});
