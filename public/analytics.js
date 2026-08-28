// Google Analytics bootstrap, served from our own origin on purpose.
//
// The tag's own snippet is an INLINE script, and allowing inline scripts would
// mean 'unsafe-inline' in script-src — the single biggest XSS protection this
// app has, dropped, on a page that holds a family's health log. Keeping the
// configuration in a same-origin file lets script-src stay strict and only
// allow googletagmanager.com as a named source.
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag("js", new Date());
gtag("config", "G-X94KW80ZGY");
