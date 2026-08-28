// The visitor's answer to the cookie question, and the only place that talks
// to Google's Consent Mode.
//
// Two rules the law is specific about and that shape this file: nothing may
// be measured before an explicit yes, and withdrawing must be as easy as
// giving — so the choice is re-openable from Settings rather than being a
// one-time gate the visitor can never revisit.

const KEY = "numa-baby-consent-v1";

export type ConsentChoice = "granted" | "denied";

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | null {
  const found = (window as unknown as { gtag?: Gtag }).gtag;
  return typeof found === "function" ? found : null;
}

/** The stored answer, or null when the visitor has not been asked yet. */
export function readConsent(): ConsentChoice | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    // Storage blocked: treat it as unanswered rather than as consent.
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // The banner still applies the choice for this session.
  }
  // Advertising signals are never granted — this app has no ads.
  gtag()?.("consent", "update", {
    analytics_storage: choice === "granted" ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}
