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
  "index-*.js": 118_500,
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
