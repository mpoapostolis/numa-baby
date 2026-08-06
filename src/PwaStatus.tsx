import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { Button } from "./components/ui/button";

export function PwaStatus() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const updateApp = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onOfflineReady: () => setOfflineReady(true),
      onNeedRefresh: () => setNeedsRefresh(true),
    });
    updateApp.current = () => updateSW(true);
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 4_500);
    return () => window.clearTimeout(timer);
  }, [offlineReady]);

  if (!offlineReady && !needsRefresh) return null;

  return (
    <aside className="pwa-toast" role="status" aria-live="polite">
      <span>{needsRefresh ? "A safer, faster version is ready." : "Ready to use offline."}</span>
      <div>
        {needsRefresh && <Button onClick={() => updateApp.current()}>Update</Button>}
        <Button onClick={() => { setOfflineReady(false); setNeedsRefresh(false); }}>Dismiss</Button>
      </div>
    </aside>
  );
}
