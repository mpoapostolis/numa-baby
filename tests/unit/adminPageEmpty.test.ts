/**
 * @vitest-environment jsdom
 */
// The dashboard on a service whose nightly job has never run.
//
// This is the state the whole change exists for: opening the page must NOT
// compute anything. It says so, offers the button, and still shows the half
// that is always live — messages and the door — because those never waited
// for a nightly run in the first place.

import { beforeAll, describe, expect, it, vi } from "vitest";
import { adminPageHtml } from "../../worker/adminPage";

const EMPTY = {
  heavyComputedAt: null,
  previous: null,
  trendDays: 30,
  feedback: [{ id: "m1", sent: "2026-09-02 10:00", handled: 0, app_version: "", contact: "", message: "Hello" }],
  auditLog: [{ at: "2026-09-02 09:00:00", event: "login_ok", ip: "1.2.3.4", country: "GR", asn: "AS1", user_agent: "x" }],
  lockouts: [],
  sessions: [],
  knownBrowsers: [],
  generatedAt: "2026-09-02T10:05:00.000Z",
};

const posted: string[] = [];

beforeAll(async () => {
  const html = adminPageHtml("test-nonce");
  const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
  const script = body.slice(body.indexOf('<script nonce="test-nonce">') + '<script nonce="test-nonce">'.length,
    body.lastIndexOf("</script>"));
  document.body.innerHTML = body.slice(0, body.indexOf("<script"));
  vi.stubGlobal("fetch", (url: string) => {
    posted.push(url);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes("/stats") ? EMPTY : { ok: true }) });
  });
  vi.stubGlobal("setInterval", () => 0);
  new Function(script)();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("before the first nightly run", () => {
  it("says nothing has been computed instead of pretending to zeros", () => {
    const text = document.getElementById("dash")!.textContent ?? "";
    expect(text).toContain("Not computed yet");
    expect(text).toContain("once a night and stored");
    // None of the heavy cards may appear with empty data behind them.
    for (const heading of ["Pulse", "Weekly cohorts", "Are they still here?", "Families ·"]) {
      expect(text).not.toContain(heading);
    }
    expect(document.getElementById("stamp")!.textContent).toBe("Waiting for the first nightly run.");
  });

  it("still shows the half that is always live", () => {
    const text = document.getElementById("dash")!.textContent ?? "";
    expect(text).toContain("Messages");
    expect(text).toContain("Hello");
    expect(text).toContain("Who has been at this door");
    // And its one button still works, which is the point of wiring it here.
    expect(document.querySelectorAll(".mark")).toHaveLength(1);
  });

  it("asks for the computation only when the operator presses the button", () => {
    expect(posted.filter((url) => url.includes("/stats/refresh"))).toHaveLength(0);
    posted.length = 0;
    (document.getElementById("recompute") as HTMLButtonElement).click();
    expect(posted[0]).toBe("/api/admin/stats/refresh");
  });
});
