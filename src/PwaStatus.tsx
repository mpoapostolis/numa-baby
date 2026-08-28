import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { Button } from "./components/ui/button";

// Getting a fix to the person who asked for it.
//
// Someone wrote in that sleep tracking was missing on their phone. It was —
// on their build, which was three hours older than the one that brought it
// back. They were not wrong; they were stale. An installed app that is never
// fully closed can sit on one version for days, because the browser only looks
// for a new service worker when it happens to look, and the new one then waits
// politely behind the old one until every window is gone.
//
// So two changes to how an update lands:
//
//   1. Look every hour, rather than only when the app is opened cold. A phone
//      that lives on a home screen may not be opened cold for a week.
//   2. If the offer is not taken, apply it the moment the app is put down.
//      Never while a parent is looking at it — a page that reloads itself at
//      3am while you are counting minutes is its own small betrayal — but the
//      next time they open it, it is the current version.
//
// The prompt stays for anyone who wants it immediately.

/** A phone on a home screen may never be opened cold. Ask anyway. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function PwaStatus() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const updateApp = useRef<() => Promise<void>>(async () => undefined);
  // Read by the visibility handler, which must not be re-bound on every render.
  const waiting = useRef(false);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onOfflineReady: () => setOfflineReady(true),
      onNeedRefresh: () => {
        waiting.current = true;
        setNeedsRefresh(true);
      },
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        window.setInterval(() => void registration.update(), UPDATE_CHECK_MS);
      },
    });
    updateApp.current = () => updateSW(true);

    // Applied on the way out, so the reload is never something a parent
    // watches happen.
    const applyWhenAway = () => {
      if (document.visibilityState === "hidden" && waiting.current) {
        waiting.current = false;
        void updateApp.current();
      }
    };
    document.addEventListener("visibilitychange", applyWhenAway);
    return () => document.removeEventListener("visibilitychange", applyWhenAway);
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 4_500);
    return () => window.clearTimeout(timer);
  }, [offlineReady]);

  if (!offlineReady && !needsRefresh) return null;

  return (
    <aside className="pwa-toast" role="status" aria-live="polite">
      <span>{needsRefresh ? "A newer version is ready." : "Ready to use offline."}</span>
      <div>
        {needsRefresh && <Button onClick={() => updateApp.current()}>Update now</Button>}
        {/* Dismiss hides the notice, not the update: it still lands the next
            time the app is put down. Nobody should have to remember to
            update a baby tracker. */}
        <Button onClick={() => { setOfflineReady(false); setNeedsRefresh(false); }}>Later</Button>
      </div>
    </aside>
  );
}
