// The one sentence the app says about itself when it is handed onward.
// Shared by every "Tell another parent" surface so they can never drift.

export const APP_SHARE = {
  title: "Numalog",
  text: "A calm, free baby tracker — no account, no ads, works offline.",
  url: "https://numalog.app",
};

/**
 * The address a shared thing carries, tagged with where it came from — a
 * milestone card, a week, a doctor's summary — so the analytics can say
 * which picture actually brings the next family in. App.tsx reads `via`
 * once at boot and strips it; the parent never sees it again.
 */
export function shareLink(via: string): string {
  return `${APP_SHARE.url}/?via=${encodeURIComponent(via)}`;
}
