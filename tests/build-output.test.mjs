import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import test from "node:test";

const dist = new URL("../dist/", import.meta.url);

test("builds a complete installable application shell", async () => {
  const [html, manifestText] = await Promise.all([
    readFile(new URL("index.html", dist), "utf8"),
    readFile(new URL("manifest.webmanifest", dist), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(html, /<title>Baby Tracker — Calm, private baby logging<\/title>/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /og-baby-tracker\.png/i);
  assert.match(html, /assets\/index-[^"']+\.js/i);
  assert.equal(manifest.id, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.length >= 2);
  assert.ok(manifest.icons.some((icon) => icon.purpose?.includes("maskable")));
});

test("ships offline assets, security headers, reminders and SPA fallback", async () => {
  const [files, headers, workerText, notificationWorker] = await Promise.all([
    readdir(dist),
    readFile(new URL("_headers", dist), "utf8"),
    readFile(new URL("server/index.js", dist), "utf8"),
    readFile(new URL("notification-sw.js", dist), "utf8"),
  ]);

  assert.ok(files.includes("sw.js"));
  assert.ok(files.includes("notification-sw.js"));
  assert.ok(files.some((file) => file.startsWith("workbox-") && file.endsWith(".js")));
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(workerText, /env\.ASSETS\.fetch/);
  assert.match(workerText, /\/index\.html/);
  assert.match(notificationWorker, /notificationclick/);
  assert.match(notificationWorker, /clients\.openWindow/);
});

test("keeps the initial production UI bundle lightweight", async () => {
  const assetFiles = await readdir(new URL("assets/", dist));
  const initialFiles = assetFiles.filter((file) => /^(index-.*\.(js|css))$/.test(file));
  const compressedSizes = await Promise.all(initialFiles.map(async (file) => {
    const contents = await readFile(new URL(`assets/${file}`, dist));
    return gzipSync(contents).byteLength;
  }));
  const totalGzip = compressedSizes.reduce((sum, size) => sum + size, 0);

  // +7KB allowance over the old 165_000 pin: safety fixes (fever advice on the
  // edit path, single-timer guards, recovery banners) plus the W3 accessibility
  // work (visible focus indicators, reduced-motion, accessible names).
  //
  // +500B on top of that for the overlay-clearance rules: the consent banner,
  // the update toast and the feedback bubble each float over the bottom corner
  // and were covering the last line of real screens.
  //
  // Worth knowing before this is raised again: 31KB gzip of the 172KB is CSS,
  // and insights/settings/growth-guide/timeline stylesheets are all eager even
  // though their screens are lazy. Splitting them is worth ~6KB, far more than
  // any shaving here — but they share classes with eager components
  // (insights.css with TodayScreen, timeline.css with ActivityRow), so it is a
  // real refactor and not a line move. Do that before granting more headroom.
  assert.ok(totalGzip < 172_500, `Initial JS + CSS is ${totalGzip} gzip bytes`);
});
