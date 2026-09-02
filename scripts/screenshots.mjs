// Captures the store-listing screenshots the manifest declares (used by the
// richer install prompt on Android, by PWABuilder for Google Play, and by
// anyone deciding whether to tap Install). Runs against the built app in
// dist/ with a seeded, realistic log — never anyone's real data.
//
//   npm run build && node scripts/screenshots.mjs
//
// Needs Playwright (npx playwright install chromium once); writes
// public/screenshots/*.png at 390x844 @2x — the manifest's 780x1688.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "screenshots");
mkdirSync(out, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = 4173;
const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: join(here, ".."),
  stdio: "ignore",
});
const stop = () => { if (!preview.killed) preview.kill(); };
process.on("exit", stop);

async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://localhost:${PORT}/`);
      if (response.ok) return;
    } catch {
      // not yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("vite preview did not start");
}

// A fortnight of a six-week-old, shaped exactly like src/domain/types.ts.
function seed() {
  const now = new Date();
  const birth = new Date(now);
  birth.setDate(now.getDate() - 44);
  const activities = [];
  let n = 0;
  const at = (dayOffset, hour, minute) => {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  for (let offset = 13; offset >= 0; offset -= 1) {
    for (const [hour, minute, kind] of [[1, 10, "nursing"], [4, 30, "bottle"], [7, 45, "nursing"], [10, 50, "bottle"], [13, 40, "nursing"], [16, 30, "bottle"], [19, 20, "nursing"], [22, 15, "bottle"]]) {
      const started = at(offset, hour, minute);
      if (started > now) continue;
      const nursing = kind === "nursing";
      activities.push({
        id: `seed-${n++}`,
        type: nursing ? "nursing" : "bottle",
        startedAt: started.toISOString(),
        endedAt: nursing ? new Date(started.getTime() + (12 + (n % 5)) * 60_000).toISOString() : undefined,
        amount: nursing ? undefined : 90 + (n % 3) * 15,
        side: nursing ? (n % 2 ? "left" : "right") : undefined,
        milkType: nursing ? undefined : "formula",
      });
    }
    for (const [hour, kind] of [[3, "wet"], [8, "dirty"], [12, "wet"], [15, "both"], [18, "wet"], [21, "wet"], [23, "dirty"]]) {
      const started = at(offset, hour, 5 + (n % 20));
      if (started > now) continue;
      activities.push({ id: `seed-${n++}`, type: "diaper", diaperKind: kind, startedAt: started.toISOString() });
    }
    for (const [hour, minutes] of [[2, 150], [9, 80], [14, 95], [20, 120]]) {
      const started = at(offset, hour, 20);
      const ended = new Date(started.getTime() + minutes * 60_000);
      if (ended > now) continue;
      activities.push({ id: `seed-${n++}`, type: "sleep", startedAt: started.toISOString(), endedAt: ended.toISOString() });
    }
    if (offset % 7 === 6) {
      activities.push({ id: `seed-${n++}`, type: "growth", startedAt: at(offset, 11, 0).toISOString(), weightGrams: 4300 + (13 - offset) * 30, lengthCm: 54 + (13 - offset) * 0.1 });
    }
  }
  return {
    activities,
    profile: { name: "Mia", birthDate: birth.toISOString().slice(0, 10), feedingMode: "mixed" },
    nightMode: false,
    reminders: { feedEnabled: false, feedIntervalMinutes: 180 },
    onboardingComplete: true,
  };
}

try {
  await ready();
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/Athens",
  });
  // No service worker in the capture: its "Ready to use offline" toast would
  // sit on every picture. And a headless profile never persists storage, so
  // the "this browser may delete your log" banner is told otherwise.
  await context.route("**/sw.js", (route) => route.abort());
  const blob = JSON.stringify(seed());
  await context.addInitScript(([key, value, consentKey, releaseKey, latest]) => {
    if (navigator.storage) {
      navigator.storage.persist = async () => true;
      navigator.storage.persisted = async () => true;
    }
    window.localStorage.setItem(key, value);
    window.localStorage.setItem(consentKey, "denied");
    window.localStorage.setItem(releaseKey, latest);
    window.localStorage.setItem("numalog-protect-intro-v1", "1");
    window.localStorage.setItem("numa-baby-theme-v1", "light");
    // A backup "yesterday", so the backup nudge stays out of the pictures.
    window.localStorage.setItem("numa-baby-last-backup-v1", new Date(Date.now() - 86_400_000).toISOString());
  }, ["numa-baby-v1", blob, "numa-baby-consent-v1", "numa-baby-seen-release-v1", "2099-01-01"]);
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#today-heading");
  // Belt and braces for the offline-ready toast: a listing shows the app,
  // not the plumbing.
  await page.addStyleTag({ content: ".pwa-toast { display: none !important; }" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, "today.png") });

  await page.getByRole("button", { name: "Insights" }).click();
  await page.waitForSelector("#insights-heading");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, "insights.png") });

  await page.getByRole("button", { name: "Timeline" }).click();
  await page.waitForSelector("#timeline-heading");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, "timeline.png") });

  await browser.close();
  console.log(`wrote 3 screenshots to ${out}`);
} finally {
  stop();
}
