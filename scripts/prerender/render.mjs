// One HTML template, no JavaScript.
//
// These pages exist to be read by three kinds of visitor with very different
// patience: a parent holding a baby at 3am, a search crawler, and an assistant
// looking for a passage it can quote. All three want the same thing, which is
// convenient — the answer first, in plain words, with the source next to the
// claim rather than in a footnote.
//
// So: no framework, no bundle, no client script at all. The stylesheet is
// inlined because it is smaller than the request that would fetch it, and
// every citation sits inside the sentence it supports, because an assistant
// quoting a line should carry the source with it.

import { DISCLAIMER, SITE } from "./pages.mjs";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const STYLE = `
:root{color-scheme:light dark;--bg:#fdf5f2;--card:#fffdfc;--ink:#221a1d;--ink-2:#5f5057;
--ink-3:#8d7c83;--line:#ecdcd6;--signal:#8d2f57;--warn-bg:#fff6ee;--warn-line:#e8c9a8}
@media(prefers-color-scheme:dark){:root{--bg:#120c0f;--card:#1c1418;--ink:#f4e9ec;
--ink-2:#c0aeb5;--ink-3:#8a767d;--line:#33262b;--signal:#f0a8c0;--warn-bg:#231a12;--warn-line:#4a3620}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:17px/1.62 ui-serif,Georgia,"Times New Roman",serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:44rem;margin:0 auto;padding:20px 20px 72px}
header.site{display:flex;align-items:center;justify-content:space-between;gap:16px;
padding:14px 0 22px;border-bottom:1px solid var(--line);margin-bottom:28px;
font-family:ui-sans-serif,system-ui,sans-serif}
header.site a{color:inherit;text-decoration:none;font-weight:650;letter-spacing:-.01em}
header.site .open{font-size:.875rem;color:var(--signal);font-weight:600}
nav.crumbs{font:500 .8125rem/1.5 ui-sans-serif,system-ui,sans-serif;color:var(--ink-3);margin-bottom:10px}
nav.crumbs a{color:var(--ink-3)}
h1{font-size:1.9rem;line-height:1.22;margin:0 0 14px;letter-spacing:-.02em;font-weight:650}
h2{font-size:1.22rem;line-height:1.3;margin:38px 0 12px;letter-spacing:-.01em;font-weight:650}
h3{font-size:1rem;margin:24px 0 6px;font-weight:650;
font-family:ui-sans-serif,system-ui,sans-serif}
p{margin:0 0 16px}
.lead{font-size:1.11rem;color:var(--ink)}
a{color:var(--signal)}
ul{margin:0 0 18px;padding:0;list-style:none}
li{position:relative;padding-left:20px;margin-bottom:11px}
li::before{content:"";position:absolute;left:3px;top:.66em;width:6px;height:6px;
border-radius:50%;background:var(--signal);opacity:.5}
cite{display:block;font:400 .78rem/1.5 ui-sans-serif,system-ui,sans-serif;
font-style:normal;color:var(--ink-3);margin-top:3px}
cite a{color:var(--ink-3)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;
padding:18px 20px;margin:0 0 14px}
.card h3{margin-top:0}
.card p{margin-bottom:8px;font-size:.97rem}
.card .do{font-family:ui-sans-serif,system-ui,sans-serif;font-size:.9rem;color:var(--ink-2)}
.note{background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:14px;
padding:16px 18px;margin:26px 0;font:400 .9rem/1.6 ui-sans-serif,system-ui,sans-serif;color:var(--ink-2)}
.cta{display:block;background:var(--signal);color:#fff;text-decoration:none;text-align:center;
border-radius:14px;padding:16px;margin:34px 0;font:600 1rem ui-sans-serif,system-ui,sans-serif}
.cta small{display:block;font-weight:400;opacity:.85;font-size:.82rem;margin-top:3px}
footer{margin-top:44px;padding-top:22px;border-top:1px solid var(--line);
font:400 .875rem/1.7 ui-sans-serif,system-ui,sans-serif;color:var(--ink-3)}
footer a{color:var(--ink-2)}
footer .links{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:14px}
`.replace(/\n/g, "");

/** One claim with its source under it — never a numbered footnote. An
    assistant lifting the sentence should lift the citation with it. */
export function claim(text, source) {
  return `<li>${esc(text)}<cite>Source: <a href="${esc(source.url)}" rel="noopener">${esc(source.name)}</a></cite></li>`;
}

/**
 * @param page  {slug, title, h1, description, lead}
 * @param body  the rendered HTML between the H1 and the footer
 * @param opts  {sources: FactSource[], crumb: string, updated: ISO date}
 */
export function render(page, body, opts = {}) {
  const url = `${SITE.origin}/${page.slug}`;
  const sources = opts.sources ?? [];
  const updated = opts.updated;

  // MedicalWebPage rather than Article: this is health information about a
  // named subject, and the citation list is the part that matters — it is what
  // lets an assistant see the claims are attributed rather than invented.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: page.title,
    headline: page.h1,
    description: page.description,
    url,
    inLanguage: "en",
    dateModified: updated,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: `${SITE.origin}/` },
    about: { "@type": "MedicalCondition", name: "Infant development and care" },
    audience: { "@type": "Patient", name: "Parents and carers of infants" },
    citation: sources.map((source) => ({
      "@type": "WebPage",
      name: source.name,
      url: source.url,
    })),
  };

  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: `${SITE.origin}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE.origin}/guides` },
      { "@type": "ListItem", position: 3, name: opts.crumb ?? page.h1, item: url },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(page.title)} · ${esc(SITE.name)}</title>
<meta name="description" content="${esc(page.description)}" />
<link rel="canonical" href="${esc(url)}" />
${opts.noindex ? '<meta name="robots" content="noindex, follow" />' : ""}
<meta name="theme-color" content="#fdf5f2" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(page.title)}" />
<meta property="og:description" content="${esc(page.description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${SITE.origin}/og-baby-tracker.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/icon-192.png" />
<style>${STYLE}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
</head>
<body>
<div class="wrap">
<header class="site">
  <a href="/">${esc(SITE.name)}</a>
  <a class="open" href="/">Open the app →</a>
</header>
<nav class="crumbs"><a href="/">Home</a> › <a href="/guides">Guides</a> › ${esc(opts.crumb ?? page.h1)}</nav>
<main>
<h1>${esc(page.h1)}</h1>
${page.lead ? `<p class="lead">${esc(page.lead)}</p>` : ""}
${body}
<p class="note">${esc(DISCLAIMER)}</p>
<a class="cta" href="/">Track feeds, nappies and sleep — free
  <small>No account, works offline, your entries stay on your device</small></a>
</main>
<footer>
  <div class="links">
    <a href="/guides">All stages</a>
    <a href="/when-to-call-a-doctor">When to call a doctor</a>
    <a href="/how-much-milk-does-my-baby-need">How much milk</a>
    <a href="/sources">Sources</a>
  </div>
  <p>Every claim on this page cites the American Academy of Pediatrics, the World Health
  Organization or the NHS page it came from${updated ? `. Sources last checked ${esc(updated)}` : ""}.</p>
</footer>
</div>
</body>
</html>`;
}

export { esc };
