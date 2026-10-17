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

import { BAG_PAGE, DISCLAIMER, DOCTOR_PAGE, MILK_PAGE, SITE, SOURCES_CHECKED, SOURCES_PAGE, STAGES } from "./pages.mjs";

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
.age{font:600 .8rem/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.06em;
text-transform:uppercase;color:var(--ink-3);margin:22px 0 10px}
.numbers{font:600 1rem/1.5 ui-sans-serif,system-ui,sans-serif}
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

/** The "Source:" line under a claim. More than one only when a line takes
    its urgency from a second page (careGuidance.ts `alsoSource`); empty
    slots are skipped so callers can pass that field as it is. */
export function citeLine(...sources) {
  const given = sources.filter(Boolean);
  return `<cite>${given.length > 1 ? "Sources" : "Source"}: ${given
    .map((source) => `<a href="${esc(source.url)}" rel="noopener">${esc(source.name)}</a>`).join(" · ")}</cite>`;
}

/** One claim with its source under it — never a numbered footnote. An
    assistant lifting the sentence should lift the citation with it. */
export function claim(text, ...sources) {
  return `<li>${esc(text)}${citeLine(...sources)}</li>`;
}

// Who publishes each cited page, matched from its address. Used twice: as the
// citation's publisher in the markup, and to name in the footer exactly the
// bodies this page cites — the old footer said "the AAP, the WHO or the NHS"
// on pages that cited the AAO, and on pages that cited nothing at all.
const SOURCE_ORGS = [
  { match: /healthychildren\.org|aap\.org/, name: "American Academy of Pediatrics", url: "https://www.aap.org/" },
  { match: /who\.int/, name: "World Health Organization", url: "https://www.who.int/" },
  { match: /nhs\.uk/, name: "NHS", url: "https://www.nhs.uk/" },
  { match: /aao\.org/, name: "American Academy of Ophthalmology", url: "https://www.aao.org/" },
];
const orgOf = (source) => SOURCE_ORGS.find((org) => org.match.test(source.url));

/** "the A, the B or the C" — the bodies behind this page's citations, in a
    fixed order so two pages citing the same bodies say the same thing. */
function citedBodies(sources) {
  const names = SOURCE_ORGS.filter((org) => sources.some((s) => orgOf(s) === org)).map((org) => `the ${org.name}`);
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

const HOME = `${SITE.origin}/`;
const IMAGE = { "@type": "ImageObject", url: `${SITE.origin}/og-baby-tracker.png`, width: 1200, height: 630 };
const PUBLISHER = {
  "@type": "Organization",
  "@id": `${SITE.origin}/#organization`,
  name: SITE.name,
  url: HOME,
  logo: { "@type": "ImageObject", url: `${SITE.origin}/icon-512.png`, width: 512, height: 512 },
};

/**
 * The page's schema.org description, as one @graph: the page and its
 * breadcrumb. Prototyped and run past the schema.org vocabulary check before
 * it came here. What it no longer says, and why:
 *
 *   MedicalCondition "Infant development and care" — not a condition, and
 *   not a real one; `about` is now plain Things with the Wikipedia article
 *   that names them. Patient as the audience — the reader is a parent.
 *   "Guides" twice in the hub's breadcrumb. An Article with an author —
 *   that waits until the name to put on it has been decided.
 *
 * MedicalWebPage only where the page is health guidance (the stages, the
 * doctor page, the milk page): a packing list is a WebPage, and the hub and
 * the sources list are collections. A page marked noindex gets nothing — the
 * 404 describes no thing.
 *
 * @param opts {kind: "medical"|"page"|"collection", crumb, sources, about,
 *              list: pages for an ItemList, noindex}
 */
export function structuredData(page, opts = {}) {
  if (opts.noindex) return null;
  const url = `${SITE.origin}/${page.slug}`;
  const kind = opts.kind ?? "medical";
  const isHub = page.slug === "guides";
  const sources = opts.sources ?? [];
  const webpage = {
    "@type": { medical: "MedicalWebPage", page: "WebPage", collection: "CollectionPage" }[kind],
    "@id": `${url}#webpage`,
    url,
    name: page.title,
    headline: page.h1,
    description: page.description,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", "@id": `${SITE.origin}/#website`, name: SITE.name, url: HOME },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    primaryImageOfPage: IMAGE,
    dateModified: page.updated,
    publisher: PUBLISHER,
    ...(opts.about && { about: opts.about }),
    ...(kind === "medical" && {
      specialty: "https://schema.org/Pediatric",
      audience: { "@type": "PeopleAudience", audienceType: "Parents and caregivers of babies" },
    }),
    ...(opts.list && {
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: opts.list.length,
        itemListElement: opts.list.map((p, i) => ({
          "@type": "ListItem", position: i + 1, url: `${SITE.origin}/${p.slug}`, name: p.title,
        })),
      },
    }),
    ...(sources.length > 0 && {
      citation: sources.map((source) => {
        const org = orgOf(source);
        return {
          "@type": "WebPage",
          // "AAP · Fever and Your Baby" is how the app labels a link; the
          // page's own name is the part after the dot, and the publisher
          // says who it is.
          name: source.name.replace(/^(AAP|NHS|WHO) · /, ""),
          url: source.url,
          ...(org && { publisher: { "@type": "Organization", name: org.name, url: org.url } }),
        };
      }),
    }),
  };
  // The last crumb is the page itself, so it carries no `item`: Google reads
  // an item-less final crumb as "you are here".
  const crumbs = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: HOME },
      ...(isHub ? [] : [{ "@type": "ListItem", position: 2, name: "Guides", item: `${SITE.origin}/guides` }]),
      { "@type": "ListItem", position: isHub ? 2 : 3, name: opts.crumb ?? page.h1 },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [webpage, crumbs] };
}

/**
 * "Diaper" is the word the app, and most of the families using it, say; the
 * NHS and much of the world say "nappy". Each page glosses its first diaper
 * once — "diapers (nappies)" — so both searches find it and nobody reads the
 * gloss twice. Text only: never inside a tag, a link, a heading or a
 * citation (an NHS page title stays exactly as published), and never "diaper
 * bag", which no one calls a nappy bag (diaper bag checklist).
 */
function glossFirstDiaper(html) {
  let done = false;
  let skip = 0;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<")) {
      if (/^<(a|h[1-6]|cite)\b/i.test(part)) skip += 1;
      else if (/^<\/(a|h[1-6]|cite)>/i.test(part)) skip -= 1;
      return part;
    }
    if (done || skip > 0) return part;
    return part.replace(/\b(diaper)(s?)\b(?! bag)/i, (word, _stem, plural) => {
      done = true;
      return `${word} (${plural ? "nappies" : "nappy"})`;
    });
  }).join("");
}

/**
 * @param page  {slug, title, h1, description, lead, updated, cta?}
 * @param body  the rendered HTML between the H1 and the footer
 * @param opts  {sources: FactSource[], crumb: string, kind, about, list, noindex}
 */
export function render(page, body, opts = {}) {
  const url = `${SITE.origin}/${page.slug}`;
  const sources = opts.sources ?? [];
  // The suffix only when the whole title still fits: past about 60
  // characters a result page cuts the end off, and the end is the part that
  // says what the page is about.
  const suffixed = `${page.title} · ${SITE.name}`;
  const title = [...suffixed].length <= 60 ? suffixed : page.title;
  const ld = structuredData(page, opts);
  const isHub = page.slug === "guides";
  const cta = {
    text: "Track feeds, diapers and sleep",
    sub: "Free, no account, works offline. Your entries stay on your device.",
    ...page.cta,
  };
  const main = glossFirstDiaper(`${page.lead ? `<p class="lead">${esc(page.lead)}</p>` : ""}
${body}`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}" />
${opts.noindex ? '<meta name="robots" content="noindex, follow" />' : `<link rel="canonical" href="${esc(url)}" />`}
<meta name="theme-color" content="#fdf5f2" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(page.title)}" />
<meta property="og:description" content="${esc(page.description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${SITE.origin}/og-baby-tracker.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
<style>${STYLE}</style>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<div class="wrap">
<header class="site">
  <a href="/">${esc(SITE.name)}</a>
  <a class="open" href="/">Open the app →</a>
</header>
<nav class="crumbs"><a href="/">${esc(SITE.name)}</a> › ${isHub ? "Guides" : `<a href="/guides">Guides</a> › ${esc(opts.crumb ?? page.h1)}`}</nav>
<main>
<h1>${esc(page.h1)}</h1>
${main}
<p class="note">${esc(DISCLAIMER)}</p>
<a class="cta" href="/?via=${esc(cta.via ?? page.slug)}">${esc(cta.text)}
  <small>${esc(cta.sub)}</small></a>
</main>
<footer>
  <nav class="links" aria-label="Guides">
    <a href="/guides">All guides</a>
    <a href="/${DOCTOR_PAGE.slug}">When to call a doctor</a>
    <a href="/${MILK_PAGE.slug}">How much milk</a>
    <a href="/${BAG_PAGE.slug}">Diaper bag checklist</a>
    <a href="/${SOURCES_PAGE.slug}">Sources</a>
  </nav>
  <nav class="links" aria-label="Ages">
    ${STAGES.map((stage) => `<a href="/${stage.slug}">${esc(stage.age)}</a>`).join("\n    ")}
  </nav>
  ${sources.length ? `<p>Every claim on this page cites ${esc(citedBodies(sources))} page it came from. Sources last checked ${esc(SOURCES_CHECKED)}.</p>` : ""}
  <p>Numalog is a tracking tool and general information, not a medical device and not
  medical advice. Every baby is different — for anything about your own baby, follow
  your pediatrician, midwife or health visitor.</p>
</footer>
</div>
</body>
</html>`;
}

export { esc };
