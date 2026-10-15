/**
 * @vitest-environment jsdom
 */
// Answering from the dashboard: messages read as conversations, the answer
// goes to the message it is for, and a half-written answer survives every
// re-render the page does on its own.

import { beforeAll, describe, expect, it, vi } from "vitest";
import { adminPageHtml } from "../../worker/adminPage";

const STATS = {
  heavyComputedAt: null,
  previous: null,
  trendDays: 30,
  workerBuild: "2026-10-15",
  feedback: [
    // Newest first, as the server sends them. Two from one phone...
    { id: "m3", at: "2026-10-15T10:00:00.000Z", sent: "2026-10-15T10:00", handled: 0, app_version: "2026-10-15",
      contact: null, message: "Thank you!!", thread: "aaaa" },
    { id: "m1", at: "2026-10-15T08:00:00.000Z", sent: "2026-10-15T08:00", handled: 1, app_version: "2026-10-14",
      contact: "mum@example.com", message: "Tummy time timer please", thread: "aaaa" },
    // ...one from an older app that left an address...
    { id: "old-mail", at: "2026-10-01T08:00:00.000Z", sent: "2026-10-01T08:00", handled: 0, app_version: "2026-09-01",
      contact: "dad@example.com", message: "Old app, with email", thread: null },
    // ...and one with no way back at all.
    { id: "old-silent", at: "2026-09-01T08:00:00.000Z", sent: "2026-09-01T08:00", handled: 1, app_version: "2026-09-01",
      contact: null, message: "Old app, no email", thread: null },
    // A phone whose address is on a message older than the two hundred shown:
    // the server sends it along as thread_contact.
    { id: "far", at: "2026-08-01T08:00:00.000Z", sent: "2026-08-01T08:00", handled: 1, app_version: "2026-10-15",
      contact: null, thread_contact: "far@example.com", message: "Writing again", thread: "bbbb" },
  ] as Array<Record<string, unknown>>,
  replies: [
    { id: "r1", feedback_id: "m1", at: "2026-10-15T09:00:00.000Z", sent: "2026-10-15T09:00",
      body: "It is in today's update", emailed_to: "mum@example.com", thread: "aaaa" },
  ],
  auditLog: [],
  lockouts: [],
  sessions: [],
  knownBrowsers: [],
  generatedAt: "2026-10-15T10:05:00.000Z",
};

const posted: Array<{ url: string; body: Record<string, unknown> | null }> = [];
let replyAnswer: Record<string, unknown> = { ok: true, inApp: true, emailedTo: "mum@example.com" };
let replyOk = true;

async function settle() {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeAll(async () => {
  const html = adminPageHtml("test-nonce");
  const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
  const script = body.slice(body.indexOf('<script nonce="test-nonce">') + '<script nonce="test-nonce">'.length,
    body.lastIndexOf("</script>"));
  document.body.innerHTML = body.slice(0, body.indexOf("<script"));
  vi.stubGlobal("fetch", (url: string, init?: { body?: string }) => {
    posted.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    const isReply = url.includes("/feedback/reply");
    const payload = url.includes("/stats") ? STATS : isReply ? replyAnswer : { ok: true };
    return Promise.resolve({ ok: isReply ? replyOk : true, json: () => Promise.resolve(payload) });
  });
  vi.stubGlobal("setInterval", () => 0);
  new Function(script)();
  await settle();
});

const conversations = () => [...document.querySelectorAll("#dash .msg")] as HTMLElement[];
// Everything on a conversation is found by the conversation, as the page does.
const conv = (selector: string, key: string) =>
  [...document.querySelectorAll(selector)].find((b) => b.getAttribute("data-conv") === key) as HTMLElement;
const box = (key: string) => conv(".reply-box", key) as HTMLTextAreaElement;
const sendButton = (key: string) => conv(".reply button.send", key) as HTMLButtonElement;
const tick = (key: string) => conv(".reply-mail", key) as HTMLInputElement;
const note = (key: string) => conv(".reply-note", key);
const PHONE = "t:aaaa";
const OLD_MAIL = "m:old-mail";

describe("messages as conversations", () => {
  it("puts one phone's messages and the answers together, in order", () => {
    const first = conversations()[0];
    const said = [...first.querySelectorAll(".bub")].map((b) => [b.classList.contains("me") ? "me" : "them", b.querySelector("p")!.textContent]);
    expect(said).toEqual([
      ["them", "Tummy time timer please"],
      ["me", "It is in today's update"],
      ["them", "Thank you!!"],
    ]);
    expect(first.textContent).toContain("emailed to mum@example.com");
    // The address from earlier in the conversation is the one shown.
    expect(first.textContent).toContain("mum@example.com");
  });

  it("puts what is waiting first, and counts it", () => {
    expect(conversations().map((c) => c.querySelector(".pill")!.textContent)).toEqual(["Waiting", "Waiting", "Handled", "Handled"]);
    const heading = [...document.querySelectorAll("#dash h2")].find((h) => /^Messages/.test(h.textContent ?? ""))!;
    expect(heading.textContent).toBe("Messages · 4 · 2 waiting");
  });

  it("says where each answer will go", () => {
    const [phone, olderWithMail, olderSilent] = conversations();
    expect(phone.querySelector(".reach")!.textContent).toContain("see it in the app");
    expect(olderWithMail.querySelector(".reach")!.textContent).toContain("only go by email");
    // The email box cannot be unticked when email is the only way.
    expect((olderWithMail.querySelector(".reply-mail") as HTMLInputElement).disabled).toBe(true);
    expect(olderSilent.querySelector(".reply-box")).toBeNull();
    expect(olderSilent.textContent).toContain("Answer it in News");
  });

  it("offers email when the address is only on an older message", () => {
    expect(tick("t:bbbb").disabled).toBe(false);
    expect(conversations()[3].textContent).toContain("Also email far@example.com");
  });
});

describe("a parent writing again while an answer is half-typed", () => {
  it("keeps the words and the unticked email box on the same conversation", async () => {
    replyOk = true;
    replyAnswer = { ok: true, inApp: true, emailedTo: null };
    box(PHONE).value = "Working on it";
    box(PHONE).dispatchEvent(new Event("input", { bubbles: true }));
    tick(PHONE).checked = false;
    tick(PHONE).dispatchEvent(new Event("change", { bubbles: true }));

    // The parent's follow-up arrives with the next refresh.
    STATS.feedback.unshift({ id: "m4", at: "2026-10-15T10:30:00.000Z", sent: "2026-10-15T10:30", handled: 0,
      app_version: "2026-10-15", contact: null, message: "Oh and one more thing", thread: "aaaa" });
    (conversations()[1].querySelector(".mark") as HTMLElement).click();
    await settle();

    expect(box(PHONE).value).toBe("Working on it");
    expect(tick(PHONE).checked).toBe(false);
    // And the answer now goes to the newest message on screen.
    expect(sendButton(PHONE).getAttribute("data-id")).toBe("m4");
    box(PHONE).value = "";
    box(PHONE).dispatchEvent(new Event("input", { bubbles: true }));
    tick(PHONE).checked = true;
    tick(PHONE).dispatchEvent(new Event("change", { bubbles: true }));
  });
});

describe("sending an answer", () => {
  it("keeps a half-written answer through a re-render", async () => {
    const area = box(PHONE);
    area.value = "Half an answer";
    area.dispatchEvent(new Event("input", { bubbles: true }));
    // Ticking another conversation off re-renders the whole card.
    (conversations()[1].querySelector(".mark") as HTMLElement).click();
    await settle();
    expect(box(PHONE).value).toBe("Half an answer");
  });

  it("answers the latest message of the conversation, with the email box as left", async () => {
    replyAnswer = { ok: true, inApp: true, emailedTo: "mum@example.com" };
    expect(tick(PHONE).checked).toBe(true);
    box(PHONE).value = "Glad it helps!";
    posted.length = 0;
    sendButton(PHONE).click();
    // A second press while it is on its way sends nothing more.
    sendButton(PHONE).click();
    await settle();
    const replies = posted.filter((p) => p.url === "/api/admin/feedback/reply");
    expect(replies).toHaveLength(1);
    expect(replies[0].body).toEqual({ id: "m4", text: "Glad it helps!", email: true });
    // Sent: the box is empty after the reload and the page says where it went.
    expect(box(PHONE).value).toBe("");
    expect(note(PHONE).textContent).toBe("Sent ✓ — in the app and to mum@example.com.");
  });

  it("keeps the words and says why when the answer is refused", async () => {
    replyOk = false;
    replyAnswer = { error: "The email did not send." };
    box(OLD_MAIL).value = "Sorry for the wait";
    sendButton(OLD_MAIL).click();
    await settle();
    expect(box(OLD_MAIL).value).toBe("Sorry for the wait");
    expect(note(OLD_MAIL).textContent).toBe("The email did not send.");
    expect(sendButton(OLD_MAIL).disabled).toBe(false);
  });
});
