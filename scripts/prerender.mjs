// Build step: turn the app's own data into pages that exist at a URL.
//
// Runs after `vite build`, writes into dist/, and imports the SAME modules the
// app renders from — so a fact can never say one thing in the app and another
// on the web. Change babyFacts.ts and both move together.
//
//   node scripts/prerender.mjs

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DOCTOR_PAGE, INDEX_PAGE, MILK_PAGE, SITE, SOURCES_CHECKED, SOURCES_PAGE, STAGES,
} from "./prerender/pages.mjs";
import { claim, esc, render } from "./prerender/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const tmp = join(here, "..", "node_modules", ".cache", "prerender.mjs");

// TypeScript, bundled to something node can import. Cheaper and more honest
// than keeping a second copy of the data in JavaScript.
mkdirSync(dirname(tmp), { recursive: true });
execFileSync("npx", ["esbuild", join(here, "prerender", "entry.ts"),
  "--bundle", "--format=esm", `--outfile=${tmp}`, "--log-level=error"], { stdio: "inherit" });
const data = await import(pathToFileURL(tmp).href);

const pages = [];
// Flat files, not slug/index.html. Cloudflare's asset handling serves
// `guides.html` at /guides with a 200, while a directory gets a 307 to
// /guides/ — an extra hop on every arrival, and a canonical tag pointing at a
// URL that redirects. Verified against the real runtime, not assumed.
function emit(slug, html) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, `${slug}.html`), html);
  pages.push(slug);
}

/** Every distinct source cited anywhere, deduplicated by URL. */
function sourcesOf(...groups) {
  const byUrl = new Map();
  for (const group of groups.flat()) if (group?.source) byUrl.set(group.source.url, group.source);
  return [...byUrl.values()];
}

// --- the eight stage pages ----------------------------------------------
STAGES.forEach((stage, index) => {
  const bracket = data.FACT_BRACKETS.find((b) => b.fromDay === stage.fromDay);
  if (!bracket) throw new Error(`No fact bracket starts at day ${stage.fromDay}`);
  // Care advice is bracketed differently from facts, so take every care
  // bracket that overlaps this stage's age range rather than assuming they line up.
  const care = data.CARE_BRACKETS.filter((b) => b.fromDay <= bracket.toDay && b.toDay >= bracket.fromDay);
  const cards = care.flatMap((b) => b.cards);
  const previous = STAGES[index - 1];
  const next = STAGES[index + 1];

  const body = `
<h2>What is my baby doing at ${esc(stage.age.toLowerCase())}?</h2>
<ul>${bracket.doing.map((f) => claim(`Your baby may be ${f.text}.`, f.source)).join("")}</ul>

${cards.length ? `<h2>What does a baby need at this stage?</h2>
${cards.map((card) => `<div class="card"><h3>${esc(card.title)}</h3>
<p>${esc(card.body)}</p><p class="do"><strong>What to do:</strong> ${esc(card.action)}</p>
<cite>Source: <a href="${esc(card.source.url)}" rel="noopener">${esc(card.source.name)}</a></cite></div>`).join("")}` : ""}

<h2>Things worth knowing at ${esc(stage.age.toLowerCase())}</h2>
<ul>${bracket.facts.map((f) => claim(f.text, f.source)).join("")}</ul>

<h2>When should I call a doctor?</h2>
<p>Some signs mean call the same day whatever the stage — a rectal temperature of
38.0 °C (100.4 °F) or higher under three months, fewer wet nappies with a dry mouth,
or a baby who is unusually hard to wake.
<a href="/${DOCTOR_PAGE.slug}">The full list, with thresholds and sources</a>.</p>

<p>${previous ? `Before this: <a href="/${previous.slug}">${esc(previous.title)}</a>. ` : ""}${
    next ? `Next: <a href="/${next.slug}">${esc(next.title)}</a>.` : ""}</p>`;

  emit(stage.slug, render(
    { ...stage, description: `${stage.lead.split(". ")[0]}. What a baby does and needs at ${stage.age.toLowerCase()}, sourced to the AAP, WHO and NHS.`.slice(0, 154) },
    body,
    { sources: sourcesOf(bracket.doing, bracket.facts, cards), crumb: stage.age, updated: SOURCES_CHECKED },
  ));
});

// --- when to call a doctor ----------------------------------------------
emit(DOCTOR_PAGE.slug, render(DOCTOR_PAGE, `
<h2>Which signs mean call today?</h2>
<ul>${data.WATCH_FOR.map((item) => claim(item.sign, item.source)).join("")}</ul>
<p class="note">If your baby is struggling to breathe, will not wake, or has a rash that
does not fade when you press a glass against it, do not wait for a call back — that is
an emergency number, today, now.</p>
<h2>Why the threshold is lower for a newborn</h2>
<p>Under three months a fever is treated as urgent on its own, without any other symptom,
because a very young baby's immune system gives fewer warnings and an infection can move
quickly. Above three months the same temperature is read alongside how the baby looks and
behaves rather than on its own.</p>
<p>Stage by stage guidance is on <a href="/${INDEX_PAGE.slug}">the guides page</a>.</p>`,
  { sources: sourcesOf(data.WATCH_FOR), crumb: "When to call a doctor", updated: SOURCES_CHECKED }));

// --- how much milk ------------------------------------------------------
const perKg = Math.round(data.ML_PER_KG_PER_DAY);
const allCards = data.CARE_BRACKETS.flatMap((b) => b.cards);
/** Pick a named source out of the app's own data rather than retyping a URL
    here — a second copy is a second thing to go stale. Searched across every
    card rather than the feeding ones: "is my baby getting enough milk" is a
    feeding question the app happens to file under nappies, because nappies are
    how it is answered. Throwing rather than returning undefined is deliberate —
    a page that shipped with a missing citation would look fine. */
const namedSource = (fragment) => {
  const found = allCards.find((c) => c.source.name.toLowerCase().includes(fragment.toLowerCase()));
  if (!found) throw new Error(`No care source matching "${fragment}" — did a citation change?`);
  return found.source;
};
const FORMULA_AMOUNT = namedSource("Amount and Schedule");
const ENOUGH_MILK = namedSource("enough milk");
const HOW_OFTEN = namedSource("How Often");

const rows = [3, 4, 5, 6, 7, 8].map((kg) => {
  const daily = Math.min(Math.round(kg * data.ML_PER_KG_PER_DAY), data.DAILY_ML_CEILING);
  return `<li><strong>${kg} kg</strong> — about ${daily} ml a day${
    daily === data.DAILY_ML_CEILING ? " (the ceiling: more weight does not mean more milk)" : ""}</li>`;
}).join("");

emit(MILK_PAGE.slug, render({
  ...MILK_PAGE,
  lead: `A formula-fed baby needs roughly ${perKg} ml per kilogram of body weight per day — the AAP's figure of about 75 ml for every 453 g — spread over however many feeds they ask for. That climbs with weight up to an average of about ${data.DAILY_ML_CEILING} ml in 24 hours, and then stops climbing. It is a guide for a whole day, not a target for any one feed.`,
}, `
<p><cite>Source: <a href="${esc(FORMULA_AMOUNT.url)}" rel="noopener">${esc(FORMULA_AMOUNT.name)}</a></cite></p>

<h2>How much per day, by weight?</h2>
<ul>${rows}</ul>
<p>Work it out from the most recent weight you have, and read it across the whole day
rather than per feed — babies cluster some evenings and skip others, and the day is what
counts.<cite>Source: <a href="${esc(FORMULA_AMOUNT.url)}" rel="noopener">${esc(FORMULA_AMOUNT.name)}</a></cite></p>

<h2>Does this apply if I am breastfeeding?</h2>
<p>No. There is no number to hit at the breast, and trying to measure one is a good way to
become anxious about a baby who is doing fine. What tells you it is working is nappies,
weight gain and a baby who settles after feeds — not millilitres.<cite>Source:
<a href="${esc(ENOUGH_MILK.url)}" rel="noopener">${esc(ENOUGH_MILK.name)}</a></cite></p>

<h2>What if my baby takes less than this?</h2>
<p>A day under the figure is ordinary. What matters more than any total is the pattern over
a week, steady weight gain, and enough wet nappies. If those are right, the millilitres can
be wrong. Feed to your baby's cues rather than to the clock or the
bottle.<cite>Source: <a href="${esc(HOW_OFTEN.url)}" rel="noopener">${esc(HOW_OFTEN.name)}</a></cite></p>

<p>See also <a href="/${DOCTOR_PAGE.slug}">the signs that mean call a doctor</a>.</p>`,
  { sources: [FORMULA_AMOUNT, ENOUGH_MILK, HOW_OFTEN], crumb: "How much milk", updated: SOURCES_CHECKED }));

// --- sources ------------------------------------------------------------
const everySource = sourcesOf(
  data.FACT_BRACKETS.flatMap((b) => [...b.doing, ...b.facts]),
  data.CARE_BRACKETS.flatMap((b) => b.cards),
  data.WATCH_FOR,
).sort((a, b) => a.name.localeCompare(b.name));
emit(SOURCES_PAGE.slug, render(SOURCES_PAGE, `
<h2>Every page cited</h2>
<ul>${everySource.map((s) =>
  `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a></li>`).join("")}</ul>
<p>Last fetched and read on ${esc(SOURCES_CHECKED)}. Where a source has since moved, the
link points at the page that replaced it rather than at a redirect.</p>`,
  { sources: everySource, crumb: "Sources", updated: SOURCES_CHECKED }));

// --- the hub ------------------------------------------------------------
emit(INDEX_PAGE.slug, render(INDEX_PAGE, `
<h2>By age</h2>
<ul>${STAGES.map((s) =>
  `<li><a href="/${s.slug}">${esc(s.title)}</a> — ${esc(s.range)}</li>`).join("")}</ul>
<h2>By question</h2>
<ul>
<li><a href="/${DOCTOR_PAGE.slug}">When to call a doctor about your baby</a></li>
<li><a href="/${MILK_PAGE.slug}">How much milk does my baby need?</a></li>
<li><a href="/${SOURCES_PAGE.slug}">Every source behind these pages</a></li>
</ul>`, { sources: [], crumb: "Guides", updated: SOURCES_CHECKED }));

// --- the app's own routes, and the page for everything else ---------------
// /handoff is a real client route (domain/handoff.ts), so it needs a real file
// now that unknown URLs 404 instead of falling back to the shell.
copyFileSync(join(dist, "index.html"), join(dist, "handoff.html"));

// A 404 that says so, with somewhere to go. It is deliberately NOT in the
// sitemap and carries noindex — a not-found page that gets indexed is how a
// site ends up ranking for its own mistakes.
writeFileSync(join(dist, "404.html"), render(
  {
    slug: "404",
    title: "Page not found",
    h1: "That page is not here",
    description: "The page you were looking for does not exist on Numalog.",
    lead: "The address may have changed, or the link may have been mistyped. Everything this site holds is listed below.",
  },
  `<h2>What is here</h2>
<ul>${STAGES.map((s) => `<li><a href="/${s.slug}">${esc(s.title)}</a></li>`).join("")}
<li><a href="/${DOCTOR_PAGE.slug}">When to call a doctor about your baby</a></li>
<li><a href="/${MILK_PAGE.slug}">How much milk does my baby need?</a></li>
<li><a href="/${SOURCES_PAGE.slug}">Every source behind these pages</a></li>
</ul>`,
  { sources: [], crumb: "Not found", updated: SOURCES_CHECKED, noindex: true },
));

// --- sitemap, robots, llms ----------------------------------------------
const urls = ["", ...pages];
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((slug) => `  <url>
    <loc>${SITE.origin}/${slug}</loc>
    <lastmod>${SOURCES_CHECKED}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${slug === "" ? "1.0" : "0.8"}</priority>
  </url>`).join("\n")}
</urlset>
`);

rmSync(tmp, { force: true });
console.log(`prerendered ${pages.length} pages: ${pages.join(", ")}`);
