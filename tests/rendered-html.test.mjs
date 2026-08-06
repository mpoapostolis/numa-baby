import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import test from "node:test";

const project = new URL("../", import.meta.url);
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
  assert.equal(manifest.icons.length, 2);
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

test("preserves local data compatibility and critical one-handed flows", async () => {
  const [app, css, packageText, themeInit, sidebar] = await Promise.all([
    readFile(new URL("src/App.tsx", project), "utf8"),
    readFile(new URL("src/styles.css", project), "utf8"),
    readFile(new URL("package.json", project), "utf8"),
    readFile(new URL("public/theme-init.js", project), "utf8"),
    readFile(new URL("src/components/ui/sidebar.tsx", project), "utf8"),
  ]);
  const packageJson = JSON.parse(packageText);

  assert.match(app, /const STORAGE_KEY = "numa-baby-v1"/);
  assert.match(app, /function parseStoredData/);
  assert.match(app, /function persistSnapshot/);
  assert.match(app, /type BootState = "loading" \| "onboarding" \| "ready" \| "recovery"/);
  assert.match(app, /onboardingComplete/);
  assert.match(app, /Start tracking/);
  assert.doesNotMatch(app, /function demoData|demo-feed-|demo-diaper-|Preview data/);
  assert.match(app, /Notification\.requestPermission/);
  assert.match(app, /registration\.showNotification/);
  assert.match(app, /<form/);
  assert.match(app, /nursingEntryMode/);
  assert.match(app, /value="manual"/);
  assert.match(app, /function saveNursing/);
  assert.match(app, /endedAt/);
  assert.match(app, /saveDiaper\(diaperKind\)/);
  assert.match(app, /<Tabs value=\{activeTab\}/);
  assert.match(app, /<ToggleGroup type="single"/);
  assert.match(app, /<AlertDialog>/);
  assert.match(app, /<Card className=/);
  assert.match(app, /<SidebarProvider/);
  assert.match(app, /<FieldGroup/);
  assert.match(app, /<InputGroup>/);
  assert.match(app, /<ItemGroup/);
  assert.match(app, /What may be next/);
  assert.match(app, /const feedPatternReady/);
  assert.match(app, /const sleepPatternReady/);
  assert.match(app, /Patterns, not a schedule/);
  assert.match(app, /Safe sleep: back, firm flat surface/);
  assert.doesNotMatch(app, /<button\b/);
  assert.doesNotMatch(app, /refreshTimers/);
  assert.doesNotMatch(app, /serviceWorker\.register/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(min-width: 1440px\)/);
  assert.match(css, /--shell-header-height: 64px/);
  assert.match(css, /Numa product system/);
  assert.match(css, /\[data-state="collapsed"\].*\[data-sidebar="menu-button"\]/s);
  assert.match(css, /\.onboarding-layout/);
  assert.doesNotMatch(css, /\.demo-banner/);
  assert.match(themeInit, /document\.documentElement\.classList\.toggle\("dark"/);
  assert.match(sidebar, /const SIDEBAR_WIDTH = "15rem"/);
  assert.match(sidebar, /const SIDEBAR_WIDTH_ICON = "3\.5rem"/);
  assert.doesNotMatch(css, /\.recent-list\s*\{[^}]*grid-template-columns/s);
  assert.match(app, /function EditActivityForm/);
  assert.match(app, /const timelineGroups = useMemo/);
  assert.match(css, /\.secondary-actions/);
  for (const dependency of [
    "radix-ui",
    "shadcn",
    "class-variance-authority",
    "sonner",
    "tailwind-merge",
  ]) {
    assert.ok(packageJson.dependencies[dependency], `${dependency} must be installed`);
  }
  assert.ok(packageJson.devDependencies.tailwindcss);
});

test("keeps the initial production UI bundle lightweight", async () => {
  const assetFiles = await readdir(new URL("assets/", dist));
  const initialFiles = assetFiles.filter((file) => /^(index-.*\.(js|css))$/.test(file));
  const compressedSizes = await Promise.all(initialFiles.map(async (file) => {
    const contents = await readFile(new URL(`assets/${file}`, dist));
    return gzipSync(contents).byteLength;
  }));
  const totalGzip = compressedSizes.reduce((sum, size) => sum + size, 0);

  assert.ok(totalGzip < 165_000, `Initial JS + CSS is ${totalGzip} gzip bytes`);
});
