import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { PwaStatus } from "./PwaStatus";
import { TooltipProvider } from "./components/ui/tooltip";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <TooltipProvider>
        <App />
        <PwaStatus />
      </TooltipProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
