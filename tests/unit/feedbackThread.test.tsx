/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FeedbackBubble } from "@/components/FeedbackBubble";
import { FeedbackCard } from "@/components/FeedbackCard";
import {
  forgetInbox,
  forgetInboxForTest,
  getInbox,
  inboxKey,
  INBOX_STORE,
  refreshInbox,
  type ThreadMessage,
} from "@/domain/feedbackInbox";
import { attachToaster, detachToaster } from "@/lib/toast";
import { stubBrowser } from "./appHarness";

// The parent's half of an answer: the dot on the bubble, the conversation in
// the dialog, and a first message that makes the phone a conversation.

const KEY = "k".repeat(43);
const asked: ThreadMessage = { id: "m1", at: "2026-10-15T08:00:00.000Z", from: "you", text: "Tummy time timer please" };
const answered: ThreadMessage = { id: "r1", at: "2026-10-15T09:00:00.000Z", from: "dev", text: "It is in today’s update!" };

let serverThread: ThreadMessage[] = [];
const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
const toasts: string[] = [];

function seed(thread: ThreadMessage[], seenAt = "") {
  window.localStorage.setItem(INBOX_STORE, JSON.stringify({ key: KEY, seenAt, toastedAt: "", checkedAt: 0, thread }));
}

beforeEach(() => {
  stubBrowser();
  window.localStorage.clear();
  forgetInboxForTest();
  requests.length = 0;
  toasts.length = 0;
  serverThread = [];
  vi.stubGlobal("__APP_VERSION__", "test");
  attachToaster((message) => { toasts.push(message); });
  vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    requests.push({ url, body });
    if (url === "/api/feedback/thread") return new Response(JSON.stringify({ messages: serverThread }));
    if (url === "/api/feedback") {
      const message: ThreadMessage = { id: "m-new", at: "2026-10-15T11:00:00.000Z", from: "you", text: body.message };
      serverThread = [...serverThread, message];
      return new Response(JSON.stringify({ ok: true, message }));
    }
    return new Response("{}", { status: 404 });
  });
});

afterEach(() => {
  cleanup();
  detachToaster();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("an answer puts a count on the bubble and says so once", async () => {
  seed([asked]);
  serverThread = [asked, answered];
  render(<FeedbackBubble hidden={false} />);

  const bubble = await screen.findByRole("button", { name: "Messages — 1 new reply" }, { timeout: 4_000 });
  expect(bubble.querySelector(".feedback-badge")!.textContent).toBe("1");
  expect(toasts).toEqual(["Apostolis replied to your message"]);
  // Only the phone's own key went to the server.
  expect(requests[0].body).toEqual({ key: KEY });
});

test("opening it shows the conversation, and the count goes", async () => {
  seed([asked, answered]);
  serverThread = [asked, answered];
  render(<FeedbackBubble hidden={false} />);
  fireEvent.click(await screen.findByRole("button", { name: "Messages — 1 new reply" }, { timeout: 4_000 }));

  expect(await screen.findByRole("heading", { name: "Messages" })).toBeTruthy();
  const said = await screen.findAllByRole("listitem");
  expect(said.map((li) => li.textContent)).toEqual([
    expect.stringMatching(/^You · .*Tummy time timer please$/),
    expect.stringMatching(/^Apostolis · .*It is in today’s update!$/),
  ]);
  await waitFor(() => expect(document.querySelector(".feedback-badge")).toBeNull());
  // Read here, so not announced again on the next open.
  expect(JSON.parse(window.localStorage.getItem(INBOX_STORE)!).seenAt).toBe(answered.at);
});

test("a first message makes the phone a conversation", async () => {
  render(<FeedbackBubble hidden={false} />);
  // A phone that never wrote asks the server nothing.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1_700)); });
  expect(requests).toEqual([]);

  fireEvent.click(screen.getByRole("button", { name: "Send feedback to the developer" }));
  expect(await screen.findByRole("heading", { name: "Need anything?" })).toBeTruthy();
  fireEvent.change(await screen.findByLabelText("Your message"), { target: { value: "Can I edit a medicine?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText(/The answer will show up right here/)).toBeTruthy();
  const sent = requests.find((r) => r.url === "/api/feedback")!;
  expect(sent.body).toMatchObject({ message: "Can I edit a medicine?", key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
  // What was said is on screen, and the box is ready for the next line.
  expect((await screen.findAllByRole("listitem")).map((li) => li.textContent)).toEqual([
    expect.stringMatching(/Can I edit a medicine\?$/),
  ]);
  expect(screen.getByRole("heading", { name: "Messages" })).toBeTruthy();
  expect(screen.queryByLabelText(/Email/)).toBeNull();
});

// "Erase all data" sweeps storage without a reload. A copy of the
// conversation kept in memory used to survive it, key and all, and write
// itself back the next time it was looked at.
test("erasing everything takes the conversation with it", async () => {
  seed([asked, answered]);
  serverThread = [asked, answered];
  expect(getInbox()?.key).toBe(KEY);

  window.localStorage.removeItem(INBOX_STORE);
  expect(getInbox()).toBeNull();
  await refreshInbox(true);
  expect(window.localStorage.getItem(INBOX_STORE)).toBeNull();
  expect(requests).toEqual([]);
});

// The bubble only watches a phone that has written. A first message from
// Settings has to tell it so, or the promised dot never comes that session.
test("a first message from Settings starts the bubble watching", async () => {
  const { rerender } = render(<><FeedbackBubble hidden={false} /><FeedbackCard /></>);
  fireEvent.change(await screen.findByLabelText("Your message"), { target: { value: "Hello from Settings" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText(/The answer will show up right here/)).toBeTruthy();
  // Back to Today: the conversation is no longer on screen to be read.
  rerender(<><FeedbackBubble hidden={false} /></>);

  // The bubble starts looking at once, without a tap.
  await waitFor(() => expect(requests.some((r) => r.url === "/api/feedback/thread")).toBe(true), { timeout: 4_000 });

  serverThread = [...serverThread, { ...answered, at: "2026-10-15T12:00:00.000Z" }];
  // Ten minutes later the app comes back to the front.
  const later = Date.now() + 11 * 60_000;
  vi.spyOn(Date, "now").mockReturnValue(later);
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(await screen.findByRole("button", { name: "Messages — 1 new reply" }, { timeout: 4_000 })).toBeTruthy();
});

// Nothing is announced over a log sheet: the bubble hides while one is open,
// and the news waits until it closes.
test("an answer waits for the open sheet to close before it is announced", async () => {
  seed([asked]);
  serverThread = [asked, answered];
  const { rerender } = render(<FeedbackBubble hidden />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2_000)); });
  expect(toasts).toEqual([]);

  rerender(<FeedbackBubble hidden={false} />);
  await waitFor(() => expect(toasts).toEqual(["Apostolis replied to your message"]));
});

// Nor over the conversation itself.
test("no announcement over the conversation it is about", async () => {
  seed([asked]);
  serverThread = [asked];
  render(<FeedbackBubble hidden={false} />);
  const bubble = await screen.findByRole("button", { name: "Messages" }, { timeout: 4_000 });
  // The answer lands while the parent opens the conversation.
  serverThread = [asked, answered];
  fireEvent.click(bubble);
  await screen.findByText("It is in today’s update!", {}, { timeout: 4_000 });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  expect(toasts).toEqual([]);
}, 10_000);

// Nor over the same conversation shown in Settings: the parent left the app
// there, and comes back to the answer already on screen.
test("no announcement over the conversation in Settings", async () => {
  // As a browser does it: the observer answers a frame after it is asked.
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: Array<{ isIntersecting: boolean }>) => void) {}
    observe() { setTimeout(() => this.callback([{ isIntersecting: true }]), 16); }
    disconnect() {}
  });
  seed([asked]);
  serverThread = [asked];
  render(<><FeedbackBubble hidden={false} /><FeedbackCard /></>);
  await screen.findByRole("button", { name: "Messages" }, { timeout: 4_000 });

  serverThread = [asked, answered];
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60_000);
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await screen.findByText("It is in today’s update!", {}, { timeout: 4_000 });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  expect(toasts).toEqual([]);
}, 10_000);

// Storage full when the phone first wrote: the key lived only in memory.
// Erase all must still take it — it used to write itself back afterwards.
test("erasing everything forgets a conversation that only lived in memory", async () => {
  const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("full", "QuotaExceededError");
  });
  const key = inboxKey();
  expect(getInbox()?.key).toBe(key);
  setItem.mockRestore();

  forgetInbox();
  expect(getInbox()).toBeNull();
  await refreshInbox(true);
  expect(window.localStorage.getItem(INBOX_STORE)).toBeNull();
  expect(requests).toEqual([]);
});

test("a refusal says why instead of blaming the connection", async () => {
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ error: "Too many messages from this connection — try again in an hour." }), { status: 429 }));
  render(<FeedbackCard />);
  fireEvent.change(await screen.findByLabelText("Your message"), { target: { value: "Hello there" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Too many messages from this connection");
});
