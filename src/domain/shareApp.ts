// The app handing itself onward — the native half.
//
// Tiny and in the main bundle on purpose: on phones this is the whole
// feature (the share sheet), and the fallback dialog chunk never loads.

import { track } from "./analytics";

export const APP_SHARE = {
  title: "Numalog",
  text: "A calm, free baby tracker — no account, no ads, works offline.",
  url: "https://numalog.app",
};

/** Native share where it exists; false = caller opens the fallback dialog. */
export function shareAppNatively(): boolean {
  if (!navigator.share) return false;
  track("app_shared", { via: "native" });
  void navigator.share(APP_SHARE).catch(() => {
    // Cancelled the sheet — an answer, not an error.
  });
  return true;
}
