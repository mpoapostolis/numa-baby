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
//   1. Look EVERY TIME the app is opened, not only on a cold start and not
//      only once an hour. An installed app is opened by returning to it, and
//      returning to it is the moment to ask whether it is still current.
//   2. Apply a version that was already waiting at that moment — right then,
//      while they are opening it, when a reload costs a flash and nothing else.
//   3. Otherwise apply it when the app is put down. Never mid-use: a page that
//      reloads itself at 3am while you are counting minutes is its own small
//      betrayal.
//
// Between them, the worst case is one session behind and the usual case is
// none. The prompt stays for anyone who wants it sooner.

/** A phone on a home screen may never be opened cold. Ask anyway. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** How long after opening the app a found update still counts as "they are
    still opening it", and can be applied on the spot. Long enough for the
    round trip to the server, short enough that nobody has started logging. */
const JUST_OPENED_MS = 12_000;

export function PwaStatus() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const updateApp = useRef<() => Promise<void>>(async () => undefined);
  // Read by the visibility handler, which must not be re-bound on every render.
  const waiting = useRef(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  // When the app last came to the front. A check started then is allowed to
  // finish and apply itself, because the parent is still watching it open.
  // Stamped in the effect, not at render: a clock read during render is
  // impure, and this one only needs to be right from the moment the service
  // worker is registered anyway.
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = Date.now();
    const updateSW = registerSW({
      immediate: true,
      onOfflineReady: () => setOfflineReady(true),
      onNeedRefresh: () => {
        // Found while they are still opening the app: take it now. The reload
        // lands inside the launch they are already waiting through, so it
        // costs nothing and they are current from the first tap rather than
        // from the next visit.
        if (Date.now() - openedAt.current < JUST_OPENED_MS) {
          void updateApp.current();
          return;
        }
        waiting.current = true;
        setNeedsRefresh(true);
      },
      onRegisteredSW: (_url, reg) => {
        if (!reg) return;
        registration.current = reg;
        // A backstop for an app left open all day, which a baby tracker often is.
        window.setInterval(() => void reg.update(), UPDATE_CHECK_MS);
      },
    });
    updateApp.current = () => updateSW(true);

    const onVisibilityChange = () => {
      const ready = waiting.current || Boolean(registration.current?.waiting);

      if (document.visibilityState === "hidden") {
        // On the way out: apply, so the next open is current.
        if (ready) {
          waiting.current = false;
          void updateApp.current();
        }
        return;
      }

      // Coming back to it. If a version was already waiting, this is the
      // cheapest possible moment to take it — they are opening the app, so a
      // reload reads as the app opening.
      if (ready) {
        waiting.current = false;
        void updateApp.current();
        return;
      }
      // Nothing waiting: ask. This is the check that was previously only
      // happening on a cold start, which an installed app rarely gets. If the
      // answer comes back "yes" in the next few seconds, onNeedRefresh applies
      // it immediately rather than saving it for later.
      openedAt.current = Date.now();
      void registration.current?.update();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
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
