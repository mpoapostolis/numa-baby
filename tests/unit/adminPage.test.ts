/**
 * @vitest-environment jsdom
 */
// The operator's dashboard builds its HTML by hand, in the browser, out of
// strings that came from the database — feedback somebody typed, a user agent
// somebody sent, a family id. So the test that matters is not "does it look
// right", it is "can any of those strings stop being text".
//
// The page is rendered here the way the browser renders it: the real markup,
// the real inline script, a stubbed fetch, and fixture rows written to be
// hostile.

import { beforeAll, describe, expect, it, vi } from "vitest";
import { adminCsp } from "../../worker/admin";
import { adminPageHtml } from "../../worker/adminPage";

const XSS = '<img src=x onerror="window.__pwned = true">';

const STATS = {
  totals: {
    families: 3, devices: 4, keys: 4, entries: 120, tombstones: 2, profiles: 3,
    messages: 2, messages_open: 1, payload_bytes: 4096, paired: 1,
    active_1d: 1, active_7d: 2, active_30d: 3,
  },
  invites: { total: 5, used: 3, open: 1, expired: 1 },
  retention: { total: 3, d1: 1, d7: 2, d30: 3, never: 0 },
  deviceFreshness: { total: 4, d1: 1, d7: 2, d30: 3, never: 1 },
  spread: { b0: 0, b1: 1, b10: 1, b50: 1, b200: 0, b1000: 0, most: 90, mean: 40, median: 30 },
  activityByDay: [{ day: "2026-08-27", entries: 10, families: 2 }, { day: "2026-08-28", entries: 4, families: 1 }],
  familiesByDay: [{ day: "2026-08-28", n: 1 }],
  devicesByDay: [{ day: "2026-08-28", n: 2 }],
  cohorts: [{ week: "2026-W34", starts: "2026-08-24", joined: 3, ever_logged: 2, paired: 1, active_7d: 2 }],
  kinds: [{ kind: "bottle", n: 60 }, { kind: XSS, n: 1 }],
  hours: [{ hour: "03", n: 9 }],
  families: [
    { family: "a1b2c3d4", created: "2026-08-01", devices: 2, entries: 90, deleted: 1,
      first_entry: "2026-08-01", last_entry: "2026-08-28 09:10", last_seen: "2026-08-28 10:00", has_profile: 1 },
  ],
  feedback: [
    { id: "plain-id", sent: "2026-08-27 10:04", handled: 0, app_version: "1.4.2",
      contact: "someone@example.com", message: "Pls also put a reminder to change diaper?" },
    // Every field on this row is an attack: the id is round-tripped into an
    // attribute and then back out into a fetch body.
    { id: '"><img src=x onerror="window.__pwned = true">', sent: "2026-08-26 21:40", handled: 1,
      app_version: XSS, contact: XSS, message: `${XSS}\nSecond line & an ampersand.` },
  ],
  auditLog: [{ at: "2026-08-28 21:40:00", event: "login_bad", ip: "5.6.7.8", country: "RU", asn: "9999", user_agent: XSS }],
  lockouts: [{ scope: `ip:${XSS}`, failures: 0, strikes: 2, window_start: "", locked_until: "2026-08-28 22:09:00" }],
  sessions: [{ created: "2026-08-28 22:01", expires: "2026-08-29 10:01", last_seen: "2026-08-28 22:33",
    ip: "1.2.3.4", country: "GR", user_agent: XSS }],
  trendDays: 30,
  generatedAt: "2026-08-28T22:33:00.000Z",
};

const posted: Array<{ url: string; body: unknown }> = [];

beforeAll(async () => {
  const html = adminPageHtml("test-nonce");
  const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
  const script = body.slice(body.indexOf('<script nonce="test-nonce">') + '<script nonce="test-nonce">'.length,
    body.lastIndexOf("</script>"));

  document.body.innerHTML = body.slice(0, body.indexOf("<script"));
  vi.stubGlobal("fetch", (url: string, init?: { body?: string }) => {
    posted.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    const payload = url.includes("/stats") ? STATS : { ok: true };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
  });
  vi.stubGlobal("setInterval", () => 0);

  // jsdom will not run a script inserted through innerHTML, which is the very
  // protection being tested — so it is executed the way the browser would.
  new Function(script)();
  // load() is two promises deep before it paints.
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("the dashboard renders", () => {
  it("paints every section", () => {
    const text = document.getElementById("dash")!.textContent ?? "";
    for (const heading of [
      "Pulse", "Entries synced", "New families", "Are they still here?",
      "How much do they log?", "Weekly cohorts", "What gets logged", "Hour of day",
      "Pairing", "Phones", "Messages", "Families", "Who has been at this door",
    ]) {
      expect(text).toContain(heading);
    }
  });

  it("shows the figures, not just the labels", () => {
    const text = document.getElementById("dash")!.textContent ?? "";
    expect(text).toContain("120"); // entries
    expect(text).toContain("Median 30");
    expect(text).toContain("60% of invite codes were scanned");
  });

  it("swaps the login form for the dashboard", () => {
    expect((document.getElementById("login") as HTMLElement).style.display).toBe("none");
    expect(document.getElementById("dash")!.className).toBe("");
  });
});

describe("hostile database values stay text", () => {
  it("never lets a stored string become an element", () => {
    expect(document.querySelectorAll("img").length).toBe(0);
    expect(document.querySelectorAll("#dash script").length).toBe(0);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it("shows the attack as the words it is", () => {
    const messages = [...document.querySelectorAll(".msg p")].map((p) => p.textContent);
    expect(messages[1]).toContain('<img src=x onerror="window.__pwned = true">');
    expect(messages[1]).toContain("Second line & an ampersand.");
  });

  it("does not let an id break out of the attribute it is written into", () => {
    const buttons = [...document.querySelectorAll(".mark")] as HTMLElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons[1].getAttribute("data-id")).toBe('"><img src=x onerror="window.__pwned = true">');
  });

  it("sends that id back unchanged when the message is ticked off", () => {
    posted.length = 0;
    (document.querySelectorAll(".mark")[1] as HTMLElement).click();
    expect(posted[0].url).toBe("/api/admin/feedback");
    expect((posted[0].body as { id: string }).id).toBe('"><img src=x onerror="window.__pwned = true">');
  });
});

describe("the content policy", () => {
  const csp = adminCsp("abc123");

  it("lets the page's own script and style run, and nothing else", () => {
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-abc123'");
    expect(csp).toContain("style-src 'nonce-abc123'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("allows style attributes, without which every chart renders flat", () => {
    // A nonce covers <style> and never style="". style-src-attr falls back to
    // style-src, so leaving this out silently drops every bar height on the
    // page — with nothing in the console to say why. It is the kind of bug
    // that only shows up on the deployed site, which is why it is tested here.
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
  });

  it("really does use style attributes for the bar heights", () => {
    // If this ever stops being true, the exception above should go.
    expect(adminPageHtml("abc123")).toContain("style=\"height:");
  });
});
