// Google Analytics, gated on consent.
//
// Loaded before the app's own module and kept in a same-origin file rather
// than the inline snippet Google ships, so the Content-Security-Policy can
// go on refusing inline scripts. That matters more than usual here: the page
// holds a family's health log.
//
// Everything starts denied. Nothing is measured until someone taps Accept,
// and the choice is remembered so the banner is asked once — not on every
// visit to an app people open six times a night.
//
// The tag itself (gtag.js, about a hundred kilobytes of somebody else's
// JavaScript) is fetched ONLY for a visitor who has said yes. It used to be
// downloaded and parsed on every open by everyone, including families who
// had declined — the app refuses to call gtag without consent anyway, so for
// them it was pure weight on the one radio the 3am log needs.
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

function loadTag() {
  if (document.getElementById("ga-tag")) return;
  var script = document.createElement("script");
  script.id = "ga-tag";
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-X94KW80ZGY";
  document.head.appendChild(script);
}
// The consent banner calls this the moment a visitor taps Allow.
window.numalogLoadAnalytics = loadTag;

// A previous "yes" is restored before the tag loads, so a returning visitor
// is measured from their first page view rather than from their second.
try {
  if (window.localStorage.getItem("numa-baby-consent-v1") === "granted") {
    gtag("consent", "update", { analytics_storage: "granted" });
    loadTag();
  }
} catch {
  // Private mode, or storage blocked. Staying denied is the safe answer.
}

gtag("js", new Date());
// Advertising signals stay off whatever the visitor chooses: this app has no
// ads and never sends one.
gtag("config", "G-X94KW80ZGY", { allow_google_signals: false });
