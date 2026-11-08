// Build step: turn the app's own data into pages that exist at a URL.
//
// Runs after `vite build`, writes into dist/, and imports the SAME modules the
// app renders from — so a fact can never say one thing in the app and another
// on the web. Change babyFacts.ts and both move together.
//
//   node scripts/prerender.mjs

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  BAG_PAGE, CONTENT_SLUGS, DOCTOR_PAGE, INDEX_PAGE, MILK_PAGE, PRIVACY_PAGE, SITE, SOURCES_CHECKED, SOURCES_PAGE, STAGES,
} from "./prerender/pages.mjs";
import { citeLine, claim, esc, render } from "./prerender/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const tmp = join(here, "..", "node_modules", ".cache", "prerender.mjs");

// TypeScript, bundled to something node can import. Cheaper and more honest
// than keeping a second copy of the data in JavaScript. Bundled by rolldown —
// the bundler Vite 8 already ships — rather than by `npx esbuild`, which was
// not in the lockfile at all and fetched an unpinned esbuild from the
// registry on every clean build, deploy included.
mkdirSync(dirname(tmp), { recursive: true });
execFileSync(process.execPath, [
  join(here, "..", "node_modules", "rolldown", "bin", "cli.mjs"),
  join(here, "prerender", "entry.ts"),
  "--format", "esm",
  "--file", tmp,
  "--logLevel", "silent",
], { stdio: "inherit" });
const data = await import(pathToFileURL(tmp).href);

/** slug → the day that page last changed, for the sitemap. */
const pages = new Map();
// Flat files, not slug/index.html. Cloudflare's asset handling serves
// `guides.html` at /guides with a 200, while a directory gets a 307 to
// /guides/ — an extra hop on every arrival, and a canonical tag pointing at a
// URL that redirects. Verified against the real runtime, not assumed.
function emit(page, html) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, `${page.slug}.html`), html);
  pages.set(page.slug, page.updated);
}

/** Every distinct source cited anywhere, deduplicated by URL. */
function sourcesOf(...groups) {
  const byUrl = new Map();
  for (const group of groups.flat()) {
    for (const source of [group?.source, group?.alsoSource]) if (source) byUrl.set(source.url, source);
  }
  return [...byUrl.values()];
}

/** A babyFacts "doing" fragment as a line of its own. The fragments are
    written to follow "Your baby may be…" — which is how the app's
    FactOfTheDay still shows them, so they are not rewritten — and that
    prefix made headings and lists here read like a form letter. */
const asSentence = (fragment) =>
  `${fragment[0].toUpperCase()}${fragment.slice(1)}${/[.!?]$/.test(fragment) ? "" : "."}`;

/** A care bracket's age, for when a stage straddles two of them. Named from
    where the brackets meet, so the label says what changes and when. */
function careLabel(group, index, groups) {
  const months = (day) => Math.round(day / 30);
  if (index === 0) {
    const next = groups[1].bracket.fromDay;
    return next >= 30 ? `Before ${months(next)} months` : `Days ${group.bracket.fromDay}–${group.bracket.toDay}`;
  }
  const from = group.bracket.fromDay;
  return from >= 30 ? `From ${months(from)} months` : `From day ${from}`;
}

const cardHtml = (card) => `<div class="card"><h3>${esc(card.title)}</h3>
<p>${esc(card.body)}</p><p class="do"><strong>What to do:</strong> ${esc(card.action)}</p>
${citeLine(card.source, card.alsoSource)}</div>`;

// What the markup says each kind of page is about: plain Things, each with
// the Wikipedia article that names it, rather than a made-up condition.
const thing = (name, article) => ({ "@type": "Thing", name, sameAs: `https://en.wikipedia.org/wiki/${article}` });
const ABOUT_STAGE = [thing("Infant", "Infant"), thing("Child development", "Child_development")];
const ABOUT_DOCTOR = [thing("Fever", "Fever"), thing("Dehydration", "Dehydration"), thing("Neonatal jaundice", "Neonatal_jaundice")];
const ABOUT_MILK = [thing("Infant formula", "Infant_formula"), thing("Breastfeeding", "Breastfeeding")];

// --- the eight stage pages ----------------------------------------------
STAGES.forEach((stage, index) => {
  const bracket = data.FACT_BRACKETS.find((b) => b.fromDay === stage.fromDay);
  if (!bracket) throw new Error(`No fact bracket starts at day ${stage.fromDay}`);
  // Care advice is bracketed differently from facts, so take every care
  // bracket that overlaps this stage's age range rather than assuming they
  // line up — but keep each bracket's cards together under its own age, and
  // show a card once. Flattened, /5-months said "milk is still the whole
  // meal" and "first foods start now" side by side with nothing to say which
  // age each was for, and /newborn showed two cards twice.
  const seen = new Set();
  const groups = data.CARE_BRACKETS
    .filter((b) => b.fromDay <= bracket.toDay && b.toDay >= bracket.fromDay)
    .map((b) => ({
      bracket: b,
      cards: b.cards.filter((card) => !seen.has(card.title) && seen.add(card.title)),
    }))
    .filter((group) => group.cards.length > 0);
  const cards = groups.flatMap((group) => group.cards);
  const previous = STAGES[index - 1];
  const next = STAGES[index + 1];

  const body = `
<h2>What can ${esc(stage.ageNoun)} do?</h2>
<ul>${bracket.doing.map((f) => claim(asSentence(f.text), f.source)).join("")}</ul>

${groups.length ? `<h2>What does ${esc(stage.ageNoun)} need?</h2>
${groups.map((group, i) => `${groups.length > 1 ? `<p class="age">${esc(careLabel(group, i, groups))}</p>\n` : ""}${
    group.cards.map(cardHtml).join("")}`).join("\n")}` : ""}

<h2>Things worth knowing about ${esc(stage.ageNoun)}</h2>
<ul>${bracket.facts.map((f) => claim(f.text, f.source)).join("")}</ul>

<h2>When should I call a doctor?</h2>
<p>Some signs mean get help now, whatever the stage — call an emergency number: a baby who
is difficult to wake, has difficulty breathing or has a rash that does not fade when you
press it, or a baby 3 months or younger with a rectal temperature of 38.0 °C (100.4 °F) or
higher. Others mean call your doctor today, such as jaundice that appears after the first
day.
<a href="/${DOCTOR_PAGE.slug}">The full list, with thresholds and sources</a>.</p>

<p>${previous ? `Before this: <a href="/${previous.slug}">${esc(previous.title)}</a>. ` : ""}${
    next ? `Next: <a href="/${next.slug}">${esc(next.title)}</a>.` : ""}</p>`;

  emit(stage, render(stage, body, {
    kind: "medical",
    about: ABOUT_STAGE,
    sources: sourcesOf(bracket.doing, bracket.facts, cards),
    crumb: stage.age,
  }));
});

// --- when to call a doctor ----------------------------------------------
// The tiers, their headings and the closing rule all come from
// careGuidance.ts, so the app's Growth guide and this page say one thing.
const watchSource = (fragment) => {
  const found = data.WATCH_FOR.find((item) => item.source.name.includes(fragment));
  if (!found) throw new Error(`No watch-list source matching "${fragment}" — did a citation change?`);
  return found.source;
};
const AAP_FEVER = watchSource("Fever and Your Baby");
const NHS_URGENT = data.WATCH_INSTINCT.source;

emit(DOCTOR_PAGE, render(DOCTOR_PAGE, `
${data.WATCH_TIERS.map(({ tier, heading, how }) => `<h2>${esc(heading)}</h2>
${how ? `<p class="numbers">${esc(how)}</p>\n` : ""}<ul>${data.WATCH_FOR.filter((item) => item.tier === tier)
    .map((item) => claim(item.sign, item.source, item.alsoSource)).join("")}</ul>`).join("\n")}
<p class="note">${esc(data.WATCH_INSTINCT.text)}${citeLine(NHS_URGENT)}</p>

<h2>Fever by age</h2>
<p>The AAP's thresholds, by the baby's age:</p>
<ul>
${claim("3 months or younger: a rectal temperature of 38.0 °C (100.4 °F) or higher. Call your pediatrician immediately, even if your baby shows no other signs of being ill — a doctor needs to examine them to rule out a serious infection.", AAP_FEVER)}
${claim("Between 3 and 6 months: a temperature of 38.3 °C (101 °F) or higher. You may need to contact your doctor.", AAP_FEVER)}
${claim("Older than 6 months: a temperature of 39.4 °C (103 °F) or higher. You may need to contact your doctor — a temperature that high may point to a significant infection or dehydration, which may need treatment.", AAP_FEVER)}
</ul>
<p>The NHS draws the same 38 °C line under 3 months, adds 39 °C or higher at 3 to 6
months, and lists both among its reasons to call 999 or go to A&amp;E.${citeLine(NHS_URGENT)}</p>

<h2>Why the threshold is lower for a newborn</h2>
<p>Under three months a fever is treated as urgent on its own, without any other symptom,
because a very young baby's immune system gives fewer warnings and an infection can move
quickly. Above three months the same temperature is read alongside how the baby looks and
behaves rather than on its own.</p>
<p>Stage by stage guidance is on <a href="/${INDEX_PAGE.slug}">the guides page</a>.</p>`,
  { kind: "medical", about: ABOUT_DOCTOR, sources: sourcesOf(data.WATCH_FOR), crumb: "When to call a doctor" }));

// --- how much milk ------------------------------------------------------
const ML_PER_OZ = 29.5735;
const LB_PER_KG = 2.20462;
const perKg = Math.round(data.ML_PER_KG_PER_DAY);
// The AAP's own unit, recovered from the same constant rather than retyped:
// 75 ml per 453 g is 2.5 oz per lb.
const ozPerLb = (data.ML_PER_KG_PER_DAY / LB_PER_KG / ML_PER_OZ).toFixed(1);
const ceilingOz = Math.round(data.DAILY_ML_CEILING / ML_PER_OZ);
const allCards = data.CARE_BRACKETS.flatMap((b) => b.cards);
/** Pick a named source out of the app's own data rather than retyping a URL
    here — a second copy is a second thing to go stale. Searched across every
    card rather than the feeding ones: "is my baby getting enough milk" is a
    feeding question the app happens to file under diapers, because diapers are
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
  return `<li><strong>${kg} kg (${(kg * LB_PER_KG).toFixed(1)} lb)</strong> — about ${daily} ml (${
    Math.round(daily / ML_PER_OZ)} oz) a day${
    daily === data.DAILY_ML_CEILING ? " (the ceiling: more weight does not mean more milk)" : ""}</li>`;
}).join("");

emit(MILK_PAGE, render({
  ...MILK_PAGE,
  description: `A formula-fed baby needs about ${perKg} ml per kg (${ozPerLb} oz per lb) a day, up to about ${data.DAILY_ML_CEILING} ml (${ceilingOz} oz). It is a guide for the whole day, not a target per feed.`,
  lead: `A formula-fed baby needs roughly ${perKg} ml per kilogram of body weight per day (${ozPerLb} oz per pound) — the AAP's figure of about 75 ml for every 453 g — spread over however many feeds they ask for. That climbs with weight up to an average of about ${data.DAILY_ML_CEILING} ml (${ceilingOz} oz) in 24 hours, and then stops climbing. It is a guide for a whole day, not a target for any one feed.`,
}, `
<p>${citeLine(FORMULA_AMOUNT)}</p>

<h2>How much per day, by weight?</h2>
<ul>${rows}</ul>
<p>Work it out from the most recent weight you have, and read it across the whole day
rather than per feed — babies cluster some evenings and skip others, and the day is what
counts.${citeLine(FORMULA_AMOUNT)}</p>

<h2>How much formula per feed, by age?</h2>
<p>The AAP's figures for a formula-fed baby, per feed:</p>
<ul>
${claim("In the first week: no more than about 1 to 2 oz (30 to 60 ml) per feed.", FORMULA_AMOUNT)}
${claim("By the end of the first month: at least 3 to 4 oz (90 to 120 ml) per feed, about every 3 to 4 hours.", FORMULA_AMOUNT)}
${claim("By 6 months: 6 to 8 oz (180 to 240 ml) at each of 4 or 5 feeds in 24 hours.", FORMULA_AMOUNT)}
</ul>

<h2>Does this apply if I am breastfeeding?</h2>
<p>No. There is no number to hit at the breast, and trying to measure one is a good way to
become anxious about a baby who is doing fine. What tells you it is working is diapers,
weight gain and a baby who settles after feeds — not millilitres.${citeLine(ENOUGH_MILK)}</p>

<h2>What if my baby takes less than this?</h2>
<p>A day under the figure is ordinary. What matters more than any total is the pattern over
a week, steady weight gain, and enough wet diapers. If those are right, the millilitres can
be wrong. Feed to your baby's cues rather than to the clock or the
bottle.${citeLine(HOW_OFTEN)}</p>

<p>See also <a href="/${DOCTOR_PAGE.slug}">the signs that mean call a doctor</a>.</p>`,
  { kind: "medical", about: ABOUT_MILK, sources: [FORMULA_AMOUNT, ENOUGH_MILK, HOW_OFTEN], crumb: "How much milk" }));

// --- sources ------------------------------------------------------------
const everySource = sourcesOf(
  data.FACT_BRACKETS.flatMap((b) => [...b.doing, ...b.facts]),
  data.CARE_BRACKETS.flatMap((b) => b.cards),
  data.WATCH_FOR,
).sort((a, b) => a.name.localeCompare(b.name));
emit(SOURCES_PAGE, render(SOURCES_PAGE, `
<h2>Every page cited</h2>
<ul>${everySource.map((s) =>
  `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a></li>`).join("")}</ul>
<p>Last fetched and read on ${esc(SOURCES_CHECKED)}. Where a source has since moved, the
link points at the page that replaced it rather than at a redirect.</p>`,
  { kind: "collection", sources: everySource, crumb: "Sources" }));

// --- privacy ------------------------------------------------------------
// Every sentence here was checked against the code on PRIVACY_PAGE.updated.
// Change what the app sends or keeps, and this page changes in the same
// commit — a policy that drifts from the code is worse than none.
emit(PRIVACY_PAGE, render(PRIVACY_PAGE, `
<h2>The short version</h2>
<ul>
<li>Without Family Sync, your baby's log and photos stay on your phone. Nothing from the log is sent anywhere.</li>
<li>Family Sync, which you turn on yourself, keeps the log on a server so two phones can share it.</li>
<li>Usage statistics are collected only if you tap Allow, and never include your baby's name, birth date, notes or photos.</li>
<li>There are no ads, and your data is never sold.</li>
<li>You can have everything deleted. How is at the end of this page.</li>
</ul>

<h2>On your phone</h2>
<p>Everything you log — entries, notes, the baby's profile, reminder settings — is kept in your browser's storage on this phone, and photos in the browser's own database. Photos are re-saved before they are kept, which removes their location data. "Erase all data" in Settings deletes all of it from this phone.</p>

<h2>Family Sync</h2>
<p>When you turn on Family Sync (or protect your log with Google or an email address, which turns it on for this phone), this is sent to the server and kept there:</p>
<ul>
<li>every entry, in full, including notes, medicine names and doses, measurements and temperatures;</li>
<li>the baby's profile: name, birth date, sex if you set it, feeding method, daily routines and profile photo;</li>
<li>photos you add to entries, months or the profile;</li>
<li>each phone's name (such as "Mia's tracker") and when it last synced.</li>
</ul>
<p><strong>Where:</strong> entries and the profile are in a Turso database on Amazon Web Services in Ireland (eu-west-1). Photos are in Cloudflare R2, in its Eastern Europe region. The app's server runs on Cloudflare.</p>
<p><strong>How it is protected:</strong> everything travels over HTTPS, and both Turso and Cloudflare encrypt stored data (AES-256). Phones join a family with a six-digit code that expires after 15 minutes, works once, and allows only a limited number of tries. Each phone then gets its own random key; the server keeps only a hash of it, never the key itself, and a phone can be removed from the family on its own.</p>
<p><strong>What it is not:</strong> the data is not end-to-end encrypted. The server has to read it to keep two phones in step, so as the person running it I technically can too. I do not read families' logs. The admin dashboard shows counts — how many families, entries and phones — not their content. Two tools can see more: the one I use to send announcements sees a baby's first name and age, so a message reaches the families it is meant for, and the one I use to help a family that has lost access can look a family up by the baby's name and birth date.</p>
<p><strong>Deleted entries:</strong> when you delete an entry, the server keeps a marked-as-deleted copy so the other phone learns it is gone. These copies are not cleared automatically yet. A photo is removed from the server when you delete its entry or remove the photo.</p>
<p><strong>Leaving:</strong> "Leave family" disconnects this phone and stops syncing; it does not delete the family's data from the server. To have that deleted, see the last section.</p>

<h2>Protecting your log with Google or email</h2>
<p>If you choose Google, the server keeps your Google account id and email address; if you choose email, it keeps the email address. They are used only to send you a link back to your log on a new phone. Sign-in emails are sent through Cloudflare. When the screen that offers this protection appears, it loads Google's sign-in script from accounts.google.com, even before you tap anything.</p>

<h2>Reminders</h2>
<p>If you turn on feed or diaper reminders, your browser gives the app an address at its push service (Apple, Google, Mozilla or Microsoft). The server keeps that address, its keys, the time the next reminder is due and, if the phone is in a family, which family. The reminder text is fixed and contains nothing from your log. Turning both reminders off deletes this.</p>

<h2>Messages to me</h2>
<p>When you write to me from the app, the server keeps your message, the app version and — only if you add it — a way to reach you. If you leave an email address, my reply is also emailed to you. Messages are kept until you ask me to delete them.</p>

<h2>Usage statistics</h2>
<p>Only if you tap Allow, the app uses Google Analytics to count how it is used: which screens are opened and which buttons are tapped, with coarse details such as the type of entry, a bottle size range, a diaper type or a milestone reached ("3 months"). It never sends the baby's name, birth date, notes, photos or any entry as written. Google Analytics sets cookies; ad features and Google signals are off. If you decline, nothing is loaded and nothing is sent. You can change your answer at any time in Settings.</p>

<h2>IP addresses</h2>
<p>Like any website, the server sees your IP address with each request. To stop abuse — someone guessing pairing codes, for example — it keeps addresses for about an hour, then deletes them. Cloudflare, which hosts the app, keeps its own request logs under <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">its privacy policy</a>.</p>

<h2>Who else handles it</h2>
<ul>
<li><a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare</a>: hosting, photo storage, sign-in emails.</li>
<li><a href="https://turso.tech/privacy-policy" rel="noopener">Turso</a>: the database, on Amazon Web Services.</li>
<li><a href="https://policies.google.com/privacy" rel="noopener">Google</a>: usage statistics, only if you allow them; sign-in, only if you protect your log with Google.</li>
<li>Your browser's push service, to deliver reminders you turned on.</li>
</ul>

<h2>Why it is allowed</h2>
<p>Family Sync, protection, reminders and messages run because you asked for them; usage statistics because you allowed them; the short-lived IP records to keep the service safe. A baby's log is health information, which is why none of it leaves your phone unless you choose a feature that needs it.</p>

<h2>Deleting your data, and your other rights</h2>
<ul>
<li><strong>On this phone:</strong> Settings → "Erase all data".</li>
<li><strong>A copy of your data:</strong> Settings → download a backup. It contains every entry.</li>
<li><strong>Everything on the server</strong> — the family's entries, profile, photos, recovery email or Google link, reminders and messages: write to me from the app's message bubble and I will delete it and tell you when it is done.</li>
</ul>
<p>You can also ask me what I hold about you, or ask me to correct it. If you are unhappy with how your data is handled, you can complain to the data protection authority where you live.</p>

<h2>The code</h2>
<p>Numalog is open source, so every statement here can be checked: <a href="https://github.com/mpoapostolis/numa-baby" rel="noopener">github.com/mpoapostolis/numa-baby</a>. You can also run your own copy, with your own Cloudflare account and Turso database, so that nothing passes through mine; the README explains how, though it takes some technical knowledge.</p>

<h2>Changes</h2>
<p>When this page changes in substance, the app's News says so. Last updated ${esc(PRIVACY_PAGE.updated)}.</p>`,
  { kind: "page", standalone: true, crumb: "Privacy" }));

// --- the hub ------------------------------------------------------------
emit(INDEX_PAGE, render(INDEX_PAGE, `
<h2>By age</h2>
<ul>${STAGES.map((s) => `<li><a href="/${s.slug}">${esc(s.title)}</a></li>`).join("")}</ul>
<h2>By question</h2>
<ul>
<li><a href="/${DOCTOR_PAGE.slug}">${esc(DOCTOR_PAGE.h1)}</a></li>
<li><a href="/${MILK_PAGE.slug}">${esc(MILK_PAGE.h1)}</a></li>
<li><a href="/${BAG_PAGE.slug}">${esc(BAG_PAGE.h1)}</a></li>
<li><a href="/${SOURCES_PAGE.slug}">Every source behind these pages</a></li>
</ul>`, { kind: "collection", list: [...STAGES, DOCTOR_PAGE, MILK_PAGE, BAG_PAGE], crumb: "Guides" }));

// --- the bag checklist ---------------------------------------------------
// Practical packing advice, not medical claims, so no citations are required
// or pretended. Asked for, verbatim, by a mother of two under the post that
// brought most of this app's families in: "sana meron din checklist for
// travel or outside gala … para din sa dads pag lumabas wala malilimutan."
emit(BAG_PAGE, render(BAG_PAGE, `
<h2>The core, every time</h2>
<ul>
<li><strong>Diapers</strong> — one per hour out, plus one. The spare is for the one that fails.</li>
<li><strong>Wipes and diaper sacks</strong> — more wipes than seems reasonable.</li>
<li><strong>Portable changing mat</strong> — a folded muslin works; the floor of a public toilet does not.</li>
<li><strong>Full change of clothes</strong> — vest AND outfit. Blowouts do not respect layers. From experience: pack two vests.</li>
<li><strong>A muslin or burp cloth</strong> — shoulder cover, sun shade, emergency bib, all one square of cloth.</li>
</ul>
<h2>Feeding</h2>
<ul>
<li><strong>Bottle-fed</strong> — one made-up feed more than the outing needs, or water plus formula powder in a dispenser. A cool bag in summer.</li>
<li><strong>Breastfed</strong> — a cover if you want one, and a snack and water for the person doing the feeding, who always forgets themselves.</li>
<li><strong>Started solids?</strong> — a pouch or small tub, one spoon, and a bib that wipes clean.</li>
</ul>
<h2>Weather and comfort</h2>
<ul>
<li><strong>Hat</strong> — sun hat or warm hat; a baby's head is a lot of their surface area.</li>
<li><strong>Blanket or extra layer</strong> — rooms are colder than streets, and the reverse.</li>
<li><strong>The pacifier, if used</strong> — and its clip, or budget for losing it.</li>
<li><strong>One small familiar toy</strong> — for the queue you did not plan for.</li>
</ul>
<h2>For whoever carries the bag</h2>
<ul>
<li><strong>Hand sanitiser</strong> — for changes away from a sink.</li>
<li><strong>Phone, keys, cards</strong> — in the bag's outside pocket, because your hands are full now.</li>
<li><strong>A spare top for you</strong> — for longer trips. The blowout does not always stay on the baby.</li>
</ul>
<p class="note">Restock the bag when you get home, not when you leave — leaving is the moment you
have a baby on one arm. A packed bag by the door is the whole trick.</p>
<p>Stage by stage care guidance is on <a href="/${INDEX_PAGE.slug}">the guides page</a>.</p>`,
  { kind: "page", about: [thing("Diaper bag", "Diaper_bag")], crumb: "Diaper bag checklist" }));

// The prerender, the service worker's denylist and the workers.dev redirect
// all read CONTENT_SLUGS. A page emitted here but missing from it would be
// served as the app shell to anyone with the app installed, so stop the build.
const missing = [...pages.keys()].filter((slug) => !CONTENT_SLUGS.includes(slug));
const unwritten = CONTENT_SLUGS.filter((slug) => !pages.has(slug));
if (missing.length || unwritten.length) {
  throw new Error(`CONTENT_SLUGS disagrees with the pages written: not listed ${missing.join(", ") || "none"}; listed but not written ${unwritten.join(", ") || "none"}`);
}

// --- the app's own routes, and the page for everything else ---------------
// /handoff is a real client route (domain/handoff.ts), so it needs a real file
// now that unknown URLs 404 instead of falling back to the shell.
copyFileSync(join(dist, "index.html"), join(dist, "handoff.html"));

// A 404 that says so, with somewhere to go. It is deliberately NOT in the
// sitemap and carries noindex — a not-found page that gets indexed is how a
// site ends up ranking for its own mistakes. For the same reason it carries
// no canonical and no structured data: it is not a page about anything.
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
<li><a href="/${DOCTOR_PAGE.slug}">${esc(DOCTOR_PAGE.h1)}</a></li>
<li><a href="/${MILK_PAGE.slug}">${esc(MILK_PAGE.h1)}</a></li>
<li><a href="/${BAG_PAGE.slug}">${esc(BAG_PAGE.h1)}</a></li>
<li><a href="/${SOURCES_PAGE.slug}">Every source behind these pages</a></li>
</ul>`,
  { crumb: "Not found", noindex: true },
));

// --- sitemap ------------------------------------------------------------
// robots.txt is a static file in public/, and llms.txt is deliberately absent
// (commit ea7ac05: Search ignores it). The home page's lastmod is the latest
// "What's new" release — the day the app itself last changed.
const lastmod = new Map([["", data.LATEST_RELEASE_ID.slice(0, 10)], ...pages]);
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...lastmod].map(([slug, updated]) => `  <url>
    <loc>${SITE.origin}/${slug}</loc>
    <lastmod>${updated}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${slug === "" ? "1.0" : "0.8"}</priority>
  </url>`).join("\n")}
</urlset>
`);

rmSync(tmp, { force: true });
console.log(`prerendered ${pages.size} pages: ${[...pages.keys()].join(", ")}`);
