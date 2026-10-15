import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { BAG_PAGE, DOCTOR_PAGE, INDEX_PAGE, MILK_PAGE, SITE, SOURCES_PAGE, STAGES } from "../scripts/prerender/pages.mjs";

const dist = new URL("../dist/", import.meta.url);

test("builds a complete installable application shell", async () => {
  const [html, manifestText] = await Promise.all([
    readFile(new URL("index.html", dist), "utf8"),
    readFile(new URL("manifest.webmanifest", dist), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(html, /<title>Numalog — Calm, private baby tracker<\/title>/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /og-baby-tracker\.png/i);
  assert.match(html, /assets\/index-[^"']+\.js/i);
  // The latin face is preloaded so the first paint is in the app's own type.
  assert.match(html, /<link rel="preload" as="font"[^>]*geist-latin-wght-normal[^>]*\.woff2/);
  // gtag.js is fetched only after consent — never from the shell itself.
  assert.doesNotMatch(html, /googletagmanager\.com\/gtag\/js/);
  assert.equal(manifest.id, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.length >= 2);
  assert.ok(manifest.icons.some((icon) => icon.purpose?.includes("maskable")));
});

test("ships offline assets, security headers, reminders and a real 404", async () => {
  const [files, headers, notificationWorker, sw] = await Promise.all([
    readdir(dist),
    readFile(new URL("_headers", dist), "utf8"),
    readFile(new URL("notification-sw.js", dist), "utf8"),
    readFile(new URL("sw.js", dist), "utf8"),
  ]);

  assert.ok(files.includes("sw.js"));
  assert.ok(files.includes("notification-sw.js"));
  assert.ok(files.some((file) => file.startsWith("workbox-") && file.endsWith(".js")));
  assert.match(headers, /Content-Security-Policy:/);
  // Baby photos are shown from this phone's own storage as blob: URLs.
  // Without it in img-src they work on localhost and not on the live site.
  assert.match(headers, /img-src [^;]*\bblob:/);
  assert.match(headers, /Strict-Transport-Security:/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(notificationWorker, /notificationclick/);
  assert.match(notificationWorker, /clients\.openWindow/);
  // wrangler.jsonc answers unknown paths with a real 404 and the one client
  // route has its own file — so no SPA-fallback worker may be emitted, and a
  // test must never again bless one (the old Sites plugin's leftover was
  // asserted here for months while wrangler.jsonc forbade it).
  assert.ok(files.includes("404.html"), "404 page is emitted");
  assert.ok(files.includes("handoff.html"), "/handoff has its own file");
  assert.ok(!files.includes("server"), "no leftover fallback worker");
  // The offline promise covers the typeface, but not half a megabyte of
  // icons the OS reads once at install.
  assert.match(sw, /geist-latin-wght-normal-[^"']+\.woff2/);
  assert.doesNotMatch(sw, /icon-maskable-512\.png/);
  assert.doesNotMatch(sw, /geist-cyrillic/);
});

// Gzip budgets per initial chunk, not one aggregate: an accidental static
// import of a lazy screen could eat the whole margin and still pass a single
// number. Measured after the boot-path work: index-*.js 111 kB, index-*.css
// 26 kB. Raise a budget only after the split rule has been honoured (a lazy
// screen's stylesheet ships with its chunk) — see the history of this file.
const BUDGET_GZIP = {
  // 118_000 → 118_500 when the reminders announcement and the push-armed
  // handover landed. The split rule was honoured first: the card and its two
  // paragraphs of copy are both lazy, and only the rules that decide whether
  // to show it are on the boot path. A budget that never moves while the app
  // gains features is not a budget, it is a ratchet — but the 500 bytes are
  // owed back, and the cheapest place to find them is the two reminder
  // timers in App.tsx, which are the same effect written twice.
  // 118_500 → 115_000 on 2026-10-11, paid back with interest: every word of
  // "What's new" was on the boot path because App imported the changelog to
  // decide whether to show it. It needs only the dates (releaseIds.ts); the
  // words moved to the lazy news chunks and the shell lost 4.1 kB. Measured
  // after: 114.4 kB.
  // 115_000 → 115_500 on 2026-10-14 for baby photos, split rule honoured
  // first: compression, IndexedDB and upload load only when a photo is
  // chosen or shown (lib/photos.ts, via dynamic import). What stays on the
  // boot path is the avatar and the photo-id check every incoming profile
  // and entry must pass. Measured after: 115.0 kB.
  // 115_500 → 118_000 the same day for months and vaccinations, the split
  // rule honoured again: both screens are in the lazy LogSheet chunk, and
  // every photo routine loads on demand. On the boot path: the two rows on
  // Today that open them (and their icons), the camera badge on a row, and
  // the validation of the new fields. Measured after: 117.8 kB — still under
  // the 118.5 kB this budget stood at before the news split.
  // 118_000 → 119_000 the same day, and not for new code: the bundler folded
  // a 2.25 kB chunk of Radix primitives, until then preloaded beside the
  // shell, into it. The phone fetches the same bytes in one file fewer. All
  // the initial JS together went 134.6 → 136.4 kB for photos, months and
  // vaccinations; the shell itself 114.7 → 118.5 kB, and 118.8 kB with the
  // way into the months album under the baby's age on Today.
  // 119_000 → 119_500, still the same day, for what the review before the
  // first push found — and only what has to run before any tap: a back
  // gesture that closes a sheet opened from the News (not the app), a toast
  // tapped over any dialog not closing it, and the profile photo reaching a
  // partner phone that updated second. The photo-only parts of those fixes
  // load with the photo code. Measured after: 119.3 kB.
  // 119_500 → 119_750 the next day, for what two rounds of a first-click
  // test with three first-time parents asked of Today itself: a vaccine that
  // is due or late named at the top, the monthly photos beside the baby's
  // age, the baby's face opening the profile, and "Add photo" on the Diaper
  // card right after Dirty. Everything else that changed with it is in lazy
  // sheets, and the month-birthday maths stayed there. Measured after:
  // 119.72 kB.
  // 119_750 → 120_100 on 2026-10-15 for tummy time, asked for from the
  // feedback box: a timer of its own on Today, with today's total — Today is
  // the boot path, and the timer is the existing one, taught a fourth kind.
  // Measured after: 120.09 kB.
  "index-*.js": 120_100,
  "index-*.css": 29_000,
};
const LAZY_SCREENS = ["SettingsScreen", "GrowthGuideScreen", "InsightsScreen", "TimelineScreen", "LogSheet", "OnboardingScreen", "sonner", "FactOfTheDay"];

test("initial chunks stay inside their gzip budgets", async () => {
  const files = await readdir(new URL("assets/", dist));
  for (const [pattern, limit] of Object.entries(BUDGET_GZIP)) {
    const re = new RegExp(`^${pattern.replace(".", "\\.").replace("*", ".*")}$`);
    const file = files.find((name) => re.test(name));
    assert.ok(file, `no file matches ${pattern}`);
    const gz = gzipSync(await readFile(new URL(`assets/${file}`, dist))).byteLength;
    assert.ok(gz <= limit, `${file} is ${gz} gzip bytes, budget ${limit}`);
  }
});

test("lazy screens stay out of the shell", async () => {
  const files = await readdir(new URL("assets/", dist));
  const shell = files.find((name) => /^index-.*\.js$/.test(name));
  const source = await readFile(new URL(`assets/${shell}`, dist), "utf8");
  for (const screen of LAZY_SCREENS) {
    assert.ok(files.some((name) => name.startsWith(`${screen}-`)), `${screen} has its own chunk`);
    // A lazy chunk is referenced by the shell only through import() — its
    // file name appears in the preload map, never as a static `from`.
    assert.doesNotMatch(source, new RegExp(`from"\\./${screen}-`), `${screen} is not statically imported`);
  }
});

test("every prerendered page is whole", async () => {
  const files = new Set(await readdir(dist));
  for (const page of [...STAGES, DOCTOR_PAGE, MILK_PAGE, BAG_PAGE, SOURCES_PAGE, INDEX_PAGE]) {
    assert.ok(files.has(`${page.slug}.html`), `${page.slug}.html is emitted`);
    const html = await readFile(new URL(`${page.slug}.html`, dist), "utf8");
    assert.doesNotMatch(html, /undefined|\[object Object\]|NaN/, `${page.slug} has no leaked value`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE.origin}/${page.slug}"`), `${page.slug} canonical`);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ld, `${page.slug} has structured data`);
    JSON.parse(ld[1]);
    for (const [, href] of html.matchAll(/href="\/([a-z0-9-]+)"/g)) {
      assert.ok(files.has(`${href}.html`) || href === "handoff", `${page.slug} links to /${href}`);
    }
  }
});

test("an app one version behind can still find its sounds", async () => {
  // The noise moved from 8-second WAVs to 10-minute AAC on 2026-10-04. An
  // installed app can run one session on its old version before the update
  // lands, and that version asks for the WAVs — deleting them turned the
  // promised white noise into "your phone would not start the sound".
  // Safe to drop once nobody can still be on a build from before that date.
  const sounds = await readdir(new URL("sounds/", dist));
  for (const kind of ["white", "pink", "brown"]) {
    assert.ok(sounds.includes(`${kind}.m4a`), `${kind}.m4a ships`);
    assert.ok(sounds.includes(`${kind}.wav`), `${kind}.wav still ships for older versions`);
  }
});
