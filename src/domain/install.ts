// Getting the app ONTO the phone — the most-asked question under the
// Facebook post that brought most of these families here ("Pwede ba
// i-download as an app? Paano po??", four people, zero answers), and also a
// data-safety issue wearing a UX hat: entries in a browser tab live in
// script-writable storage that iOS is allowed to evict after seven days of
// not visiting; a home-screen app is exempt.

import { isStandalone } from "./platform";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome fires this once, early, and only hands the mic to whoever was
// already listening — so the capture starts at module load, not at render.
let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });
}

/** Whether the native browser install dialog can be shown right now. */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null && !isStandalone();
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  await prompt.prompt();
  const choice = await prompt.userChoice;
  // One shot per capture: Chrome will fire the event again later if declined.
  deferredPrompt = null;
  return choice.outcome;
}

/**
 * The Facebook and Instagram in-app browsers. Most of this app's families
 * arrive through a shared Facebook post, and that webview is the worst place
 * to live: there is no "Add to Home Screen" in it at all, and its storage is
 * tied to the Facebook app — clearing or reinstalling Facebook takes the
 * baby's log with it. The one useful thing to do there is say so, and help
 * the person out to a real browser.
 */
export function inAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(ua);
}

/** iOS Safari has no install prompt: the path is Share -> Add to Home Screen. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !inAppBrowser();
}
