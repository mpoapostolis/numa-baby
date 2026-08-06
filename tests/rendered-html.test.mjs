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

test("ships offline assets, security headers and SPA fallback", async () => {
  const [files, headers, workerText] = await Promise.all([
    readdir(dist),
    readFile(new URL("_headers", dist), "utf8"),
    readFile(new URL("server/index.js", dist), "utf8"),
  ]);

  assert.ok(files.includes("sw.js"));
  assert.ok(files.some((file) => file.startsWith("workbox-") && file.endsWith(".js")));
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(workerText, /env\.ASSETS\.fetch/);
  assert.match(workerText, /\/index\.html/);
});

test("preserves local data compatibility and critical one-handed flows", async () => {
  const [app, css, packageText] = await Promise.all([
    readFile(new URL("src/App.tsx", project), "utf8"),
    readFile(new URL("src/styles.css", project), "utf8"),
    readFile(new URL("package.json", project), "utf8"),
  ]);
  const packageJson = JSON.parse(packageText);

  assert.match(app, /const STORAGE_KEY = "numa-baby-v1"/);
  assert.match(app, /function parseStoredData/);
  assert.match(app, /Start \{nursingSide\} timer/);
  assert.match(app, /saveDiaper\(diaperKind\)/);
  assert.match(app, /aria-current=\{active \? "page"/);
  assert.doesNotMatch(app, /refreshTimers/);
  assert.doesNotMatch(app, /serviceWorker\.register/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(min-width: 1440px\)/);
  assert.doesNotMatch(css, /\.recent-list\s*\{[^}]*grid-template-columns/s);
  assert.match(app, /function EditActivityForm/);
  assert.match(app, /const timelineGroups = useMemo/);
  assert.match(css, /\.secondary-actions/);
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), [
    "class-variance-authority",
    "clsx",
    "lucide-react",
    "react",
    "react-dom",
  ]);
});

test("keeps the initial production UI bundle lightweight", async () => {
  const assetFiles = await readdir(new URL("assets/", dist));
  const initialFiles = assetFiles.filter((file) => /^(index-.*\.(js|css))$/.test(file));
  const compressedSizes = await Promise.all(initialFiles.map(async (file) => {
    const contents = await readFile(new URL(`assets/${file}`, dist));
    return gzipSync(contents).byteLength;
  }));
  const totalGzip = compressedSizes.reduce((sum, size) => sum + size, 0);

  assert.ok(totalGzip < 90_000, `Initial JS + CSS is ${totalGzip} gzip bytes`);
});
