// Google Analytics, gated on consent.
//
// Loaded BEFORE gtag.js and without `async` on purpose: Consent Mode has to
// set its defaults before the tag processes anything, or the first page view
// is collected before the visitor has been asked.
//
// Everything starts denied. Nothing is measured until someone taps Accept,
// and the choice is remembered so the banner is asked once — not on every
// visit to an app people open six times a night.
//
// Kept in a same-origin file rather than the inline snippet Google ships so
// the Content-Security-Policy can keep refusing inline scripts. That matters
// more than usual here: the page holds a family's health log.
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = gtag;

gtag("consent", "default", {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  // Give a stored choice a moment to arrive before the first hit is decided.
  wait_for_update: 500,
});

// A previous "yes" is restored before the tag loads, so a returning visitor
// is measured from their first page view rather than from their second.
try {
  if (window.localStorage.getItem("numa-baby-consent-v1") === "granted") {
    gtag("consent", "update", { analytics_storage: "granted" });
  }
} catch {
  // Private mode, or storage blocked. Staying denied is the safe answer.
}

gtag("js", new Date());
// Advertising signals stay off whatever the visitor chooses: this app has no
// ads and never sends one.
gtag("config", "G-X94KW80ZGY", { allow_google_signals: false });
