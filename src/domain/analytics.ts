// Product analytics: which parts of the app actually get used.
//
// Three rules this file exists to enforce, in every call site:
//
//   1. NOTHING ABOUT THE BABY. No names, no birth dates, no timestamps, no
//      amounts, no weights. Only which action happened and coarse shape —
//      "a bottle was logged", never "110 ml at 03:14". A feed log is health
//      data about a child and it does not belong in an analytics account.
//   2. CONSENT FIRST. Every event is dropped unless the visitor said yes.
//      Consent Mode alone would still emit cookieless pings; this refuses to
//      call gtag at all, which is what the app's own copy promises.
//   3. NEVER THROWS. Analytics failing must never break a 3am log, so every
//      path is guarded and silent.

import { readConsent } from "./consent";

type Gtag = (...args: unknown[]) => void;

// Read once at boot, then kept in step by setTrackingEnabled — a localStorage
// hit on every tap of a one-tap app is a waste.
let enabled = readConsent() === "granted";
let suppressed = false;

/** Debug preview drives fake data through the real handlers; none of it is real usage. */
export function suppressTracking() {
  suppressed = true;
}

export function setTrackingEnabled(next: boolean) {
  enabled = next;
}

/**
 * Record a product event.
 *
 * @param name snake_case, past tense — "bottle_logged", not "logBottle"
 * @param params coarse, non-identifying dimensions only
 */
export function track(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!enabled || suppressed) return;
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    gtag?.("event", name, params);
  } catch {
    // Measurement is never worth an interrupted log.
  }
}

/** Millilitres bucketed, so a volume is useful in aggregate but never a fingerprint. */
export function mlBucket(ml: number | undefined): string {
  if (!ml) return "none";
  if (ml < 60) return "under_60";
  if (ml < 120) return "60_119";
  if (ml < 180) return "120_179";
  return "180_plus";
}

/** Minutes bucketed the same way, for timer durations. */
export function minuteBucket(minutes: number): string {
  if (minutes < 5) return "under_5";
  if (minutes < 15) return "5_14";
  if (minutes < 30) return "15_29";
  return "30_plus";
}
