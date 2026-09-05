import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-numa-baby/b74a79ef-cb85-5c95-95df-2a25f62dfbaa/scratchpad";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 420, height: 950 }, locale: "el-GR", timezoneId: "Europe/Athens" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", String(e)));
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
await page.addInitScript((seed) => {
  localStorage.setItem("numa-baby-v1", JSON.stringify(seed));
  localStorage.setItem("numa-baby-seen-release-v1", "9999-12-31");
}, {
  activities: [
    { id: "f1", type: "bottle", startedAt: iso(now - 2 * 3600e3), updatedAt: iso(now - 2 * 3600e3), amount: 90, milkType: "formula" },
    { id: "f2", type: "bottle", startedAt: iso(now - 5 * 3600e3), updatedAt: iso(now - 5 * 3600e3), amount: 100, milkType: "formula" },
    { id: "d1", type: "diaper", startedAt: iso(now - 3 * 3600e3), updatedAt: iso(now - 3 * 3600e3), diaperKind: "wet" },
    { id: "s1", type: "sleep", startedAt: iso(now - 9 * 3600e3), endedAt: iso(now - 7 * 3600e3), updatedAt: iso(now - 7 * 3600e3) },
  ],
  profile: { name: "Σεραφίνα", birthDate: new Date(now - 38 * 86400e3).toISOString().slice(0, 10), feedingMode: "bottle", sex: "girl",
    routines: [{ id: "βιταμίνη d", label: "Βιταμίνη D" }] },
  reminders: { feedEnabled: false, feedIntervalMinutes: 120 }, nightMode: false, onboardingComplete: true,
});
await page.goto("http://127.0.0.1:4171/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
console.log("headline:", await page.locator("h1").first().innerText());
await page.screenshot({ path: `${OUT}/el-today-1.png` });
await page.evaluate(() => window.scrollBy(0, 850));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/el-today-2.png` });
await browser.close();
