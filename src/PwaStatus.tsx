import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

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
        {needsRefresh && <button onClick={() => updateApp.current()}>Update</button>}
        <button onClick={() => { setOfflineReady(false); setNeedsRefresh(false); }}>Dismiss</button>
      </div>
    </aside>
  );
}
