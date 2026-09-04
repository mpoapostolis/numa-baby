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
    { family: "b0000000", created: "2026-07-04", devices: 1, entries: 900, deleted: 0,
      first_entry: "2026-07-04", last_entry: "2026-08-27 08:00", last_seen: "2026-08-27 08:05", has_profile: 0 },
    { family: "c0000000", created: "2026-06-09", devices: 3, entries: 5, deleted: 0,
      first_entry: null, last_entry: null, last_seen: null, has_profile: 0 },
  ],
  feedback: [
    { id: "plain-id", sent: "2026-08-27 10:04", handled: 0, app_version: "1.4.2",
      contact: "someone@example.com", message: "Pls also put a reminder to change diaper?" },
    // Every field on this row is an attack: the id is round-tripped into an
    // attribute and then back out into a fetch body.
    { id: '"><img src=x onerror="window.__pwned = true">', sent: "2026-08-26 21:40", handled: 1,
      app_version: XSS, contact: XSS, message: `${XSS}\nSecond line & an ampersand.` },
  ],
  auditLog: [
    { at: "2026-08-28 21:40:00", event: "login_bad", ip: "5.6.7.8", country: "RU", asn: "9999", user_agent: XSS },
    // The audit log now records the operator's OWN wording — worker/admin.ts
    // writes `broadcast queued: <title>` — so a stored event is a string that
    // came from a text box and lands in a class attribute and a cell.
    { at: "2026-08-28 22:10:00", event: `broadcast queued: ${XSS}`, ip: "1.2.3.4", country: "GR", asn: "1234",
      user_agent: "curl/8" },
  ],
  lockouts: [{ scope: `ip:${XSS}`, failures: 0, strikes: 2, window_start: "", locked_until: "2026-08-28 22:09:00" }],
  sessions: [{ created: "2026-08-28 22:01", expires: "2026-08-29 10:01", last_seen: "2026-08-28 22:33",
    ip: "1.2.3.4", country: "GR", user_agent: XSS }],
  knownBrowsers: [{ trusted: "2026-08-28", last_seen: "2026-08-28 22:33", ip: "1.2.3.4",
    country: "GR", user_agent: XSS }],
  trendDays: 30,
  // The heavy half is computed by the nightly job and read from the cache;
  // a payload without this stamp is a service that has never run it.
  heavyComputedAt: "2026-08-28T03:12:00.000Z",
  previous: {
    at: XSS,
    totals: { families: 2, entries: 96 },
    funnel: { joined_7d: 1 },
  },
  funnel: { joined_7d: 2, joined_prev_7d: 1, activated_7d: 2, activated_prev_7d: 1,
    returning_7d: 2, stayed_a_week: 1, paired_7d: 1 },
  lifespan: { with_entries: 3, one_day: 1, under_week: 1, under_month: 1, over_month: 0 },
  // The alarm-clock panel. Both of these are read straight out of the database
  // and both are sliced before they are escaped, which is the order that has
  // to hold — a slice that lands mid-tag must still not become one.
  push: { phones: 3, feed_armed: 2, diaper_armed: 1, failing: 0, newest: XSS },
  vapid: { publicKey: '"><img src=x onerror="window.__pwned = true">', createdAt: XSS },
  workerBuild: XSS,
  // A title an operator typed, which is to say a string that must not be able
  // to stop being text — one still going out, one finished.
  announcements: [
    { id: "b2", title: XSS, createdAt: XSS, sent: 4, gone: 0, failed: 1, finishedAt: null },
    { id: "b1", title: "Reminders work closed now", createdAt: "2026-08-30T09:00:00.000Z", sent: 12, gone: 1, failed: 0,
      finishedAt: "2026-08-30T09:20:00.000Z" },
  ],
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
      "The week in words", "Pulse", "Entries synced", "New families", "Are they still here?",
      "How much do they log?", "Weekly cohorts", "What gets logged", "Hour of day",
      "Pairing", "Phones", "Messages", "Families", "Who has been at this door",
      "Browsers that skip the lockout",
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

  it("says what went on everybody's lock screen, and what is still going", () => {
    const text = document.getElementById("dash")!.textContent ?? "";
    expect(text).toContain("Announcements");
    expect(text).toContain("Reminders work closed now");
    // The counts that say whether it worked.
    expect(text).toMatch(/Reminders work closed now\s*12\s*1\s*0/);
    // One that has not finished is marked, because "sent 4" on its own reads
    // like the whole story when it is a quarter of it.
    expect(text).toContain("sending");
    // The signing identity, and never the private half. The key is sliced to
    // twelve characters and only THEN escaped, so the slice lands in the
    // middle of the tag — it must still arrive as words.
    expect(text).toContain('"><img src=x');
    expect(document.querySelectorAll("#dash code")[0].textContent).toBe('"><img src=x\u2026');
    expect(text).not.toContain("privateKey");
  });

  it("reads the report out of the nightly snapshot, and says which one", () => {
    const text = document.getElementById("dash")!.textContent ?? "";
    expect(text).toContain("2 families turned on Family Sync in the last seven days");
    expect(text).toContain("1 family has entries from one single day");
    // The delta against yesterday's stored snapshot, not a fresh query.
    expect(text).toMatch(/Against the last snapshot: 3 families\s*\+1 and 120 entries\s*\+24\./);
    expect(text).toContain("only families who turned Family Sync ON");
    expect(document.getElementById("stamp")!.textContent).toContain("opening it costs no computation");
  });

  it("swaps the sign-in screen for the dashboard", () => {
    expect(document.getElementById("gate")!.className).toContain("hide");
    expect(document.getElementById("dash")!.className).toBe("");
    expect(document.getElementById("head")!.className).toBe("row");
  });
});

describe("the families table answers to the operator", () => {
  const ids = () =>
    [...document.querySelectorAll("#dash table")]
      .find((t) => t.querySelector('.sortby[data-sort="entries"]'))!
      .querySelectorAll("tbody tr td:first-child");
  const idText = () => [...ids()].map((td) => td.textContent);

  it("opens newest first", () => {
    expect(idText()).toEqual(["a1b2c3d4", "b0000000", "c0000000"]);
  });

  it("sorts by a column when its header is clicked, and turns round on a second click", () => {
    const header = () => document.querySelector('.sortby[data-sort="entries"]') as HTMLElement;
    header().click();
    expect(idText()).toEqual(["b0000000", "a1b2c3d4", "c0000000"]);
    header().click();
    expect(idText()).toEqual(["c0000000", "a1b2c3d4", "b0000000"]);
    // The column in force says so; the others do not.
    expect(document.querySelectorAll(".sortby.on")).toHaveLength(1);
    expect(header().className).toContain("on");
  });

  it("keeps a family with no entries at the bottom whichever way the arrow points", () => {
    const header = () => document.querySelector('.sortby[data-sort="last_entry"]') as HTMLElement;
    header().click();
    expect(idText()[2]).toBe("c0000000");
    header().click();
    expect(idText()[2]).toBe("c0000000");
  });

  it("filters on what is typed, and says how many matched", () => {
    const box = document.getElementById("ffilter") as HTMLInputElement;
    box.value = "b000";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    expect(idText()).toEqual(["b0000000"]);
    const heading = [...document.querySelectorAll("#dash h2")].find((h) => /^Families/.test(h.textContent ?? ""));
    expect(heading!.textContent).toContain("1 matching");
    (document.getElementById("ffilter") as HTMLInputElement).value = "";
    document.getElementById("ffilter")!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(idText()).toHaveLength(3);
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

  // Everything below arrived with the announcement work: the alarm-clock
  // panel, the signing key, the announcement table, and the audit log now
  // carrying the operator's own wording ("broadcast queued: <title>").
  it("keeps the new alarm-clock and announcement fields as text", () => {
    const text = document.getElementById("dash")!.textContent ?? "";
    // push.newest, straight from the database into a sentence.
    expect(text).toContain('Newest schedule <img src=x onerror="window.__pwned = true">');
    // The announcement title and its stamp.
    const announcements = [...document.querySelectorAll("#dash table")]
      .find((t) => (t.textContent ?? "").includes("sending"))!;
    expect(announcements.textContent).toContain('<img src=x onerror="window.__pwned = true">');
    // The audit row whose event text is a title somebody typed into the
    // composer, written into a class attribute and a cell.
    const audit = [...document.querySelectorAll("#dash .pill")].map((p) => p.textContent);
    expect(audit).toContain('broadcast queued: <img src=x onerror="window.__pwned = true">');
    // The live build stamp.
    expect(text).toContain('Live build: <img src=x onerror="window.__pwned = true">');
    // Nothing above turned into an element, and no attribute was escaped from.
    expect(document.querySelectorAll("img, script, iframe, svg[onload]").length).toBe(0);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
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
