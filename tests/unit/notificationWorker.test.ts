import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, test } from "vitest";

// public/notification-sw.js is plain JavaScript the service worker imports, so
// it is run here as the phone runs it: in its own scope, with a `self` that
// records what it was asked to do.

const source = readFileSync(new URL("../../public/notification-sw.js", import.meta.url), "utf8");

type Listener = (event: Record<string, unknown>) => void;
type Shown = { title: string; options: Record<string, unknown> };

function serviceWorker({ openAt = "https://numalog.app/", hasGetNotifications = true, openDue = null as string | null, legacyShownAgoMs = null as number | null } = {}) {
  const listeners: Record<string, Listener> = {};
  const calls: string[] = [];
  const shown: Shown[] = [];
  const open = [legacyShownAgoMs === null
    ? { tag: "feed-reminder", data: { due: openDue }, close: () => calls.push("close feed-reminder") }
    // Shown by an older version of the app, which kept no due time.
    : { tag: "feed-reminder", data: { url: "/" }, timestamp: Date.now() - legacyShownAgoMs, close: () => calls.push("close feed-reminder") }];
  const client = {
    url: openAt,
    focus: async () => { calls.push("focus"); return client; },
    navigate: async (url: string) => { calls.push(`navigate ${url}`); return client; },
  };
  const registration: Record<string, unknown> = {
    showNotification: async (title: string, options: Record<string, unknown>) => {
      calls.push(`show ${String(options.tag)}`);
      shown.push({ title, options });
    },
  };
  if (hasGetNotifications) {
    registration.getNotifications = async ({ tag }: { tag: string }) => open.filter((n) => n.tag === tag);
  }
  const self = {
    addEventListener: (type: string, listener: Listener) => { listeners[type] = listener; },
    registration,
    clients: {
      matchAll: async () => (openAt ? [client] : []),
      openWindow: async (url: string) => { calls.push(`open ${url}`); },
    },
    location: new URL("https://numalog.app/sw.js"),
  };
  vm.runInNewContext(source, { self, URL, Promise, Date });

  async function dispatch(type: string, event: Record<string, unknown>) {
    let work: Promise<unknown> = Promise.resolve();
    listeners[type]({ ...event, waitUntil: (promise: Promise<unknown>) => { work = promise; } });
    await work;
  }
  return {
    calls,
    shown,
    push: (payload: unknown) => dispatch("push", { data: { json: () => payload } }),
    tap: (url: string) => dispatch("notificationclick", { notification: { close: () => {}, data: { url } } }),
  };
}

const feed = { title: "Time to check feeding cues", body: "A feed reminder is due.", tag: "feed-reminder", url: "/" };

// The 3am reminder still sat in the shade when the 6am one arrived with the
// same tag, and a replacement with the same tag is silent unless asked: the
// parent slept through it.
test("a reminder that replaces one still in the shade rings again", async () => {
  const sw = serviceWorker();
  await sw.push(feed);

  expect(sw.shown).toHaveLength(1);
  expect(sw.shown[0].options).toMatchObject({ tag: "feed-reminder", renotify: true });
  // And where renotify is not honoured, the old one is closed first so the
  // new one is a fresh alert.
  expect(sw.calls).toEqual(["close feed-reminder", "show feed-reminder"]);
});

test("still shows the reminder where earlier notifications cannot be listed", async () => {
  const sw = serviceWorker({ hasGetNotifications: false });
  await sw.push(feed);
  expect(sw.calls).toEqual(["show feed-reminder"]);
});

test("never asks to renotify with an empty tag, which throws", async () => {
  const sw = serviceWorker();
  await sw.push({ ...feed, tag: "" });
  expect(sw.shown[0].options).toMatchObject({ tag: "numalog", renotify: true });
});

// Every reminder points at "/", where an open app already is. Navigating there
// is a full reload, which stopped the white noise and closed any open sheet.
test("tapping a reminder with the app open only brings it forward", async () => {
  const sw = serviceWorker({ openAt: "https://numalog.app/" });
  await sw.tap("/");
  expect(sw.calls).toEqual(["focus"]);
});

test("an announcement for another page still goes there", async () => {
  const sw = serviceWorker({ openAt: "https://numalog.app/" });
  await sw.tap("/insights");
  expect(sw.calls).toEqual(["navigate https://numalog.app/insights", "focus"]);
});

test("with the app closed, a tap opens it", async () => {
  const sw = serviceWorker({ openAt: "" });
  await sw.tap("/");
  expect(sw.calls).toEqual(["open /"]);
});

// The same reminder from the phone's own timer and from the server's push,
// or a resend: one alert, not two. Which reminder it is, is its due time.
test("the same reminder arriving twice replaces itself quietly", async () => {
  const sw = serviceWorker({ openDue: "2026-10-15T06:10:00.000Z" });
  await sw.push({ ...feed, due: "2026-10-15T06:10:00.000Z" });
  expect(sw.shown[0].options).toMatchObject({ tag: "feed-reminder", renotify: false });
  expect(sw.calls).toEqual(["show feed-reminder"]);
});

// A new reminder soon after the last — a feed logged in the past, a short
// interval — is a new reminder, and rings.
test("a different reminder rings, however soon after the last", async () => {
  const sw = serviceWorker({ openDue: "2026-10-15T06:10:00.000Z" });
  await sw.push({ ...feed, due: "2026-10-15T06:40:00.000Z" });
  expect(sw.shown[0].options).toMatchObject({ renotify: true });
  expect(sw.calls).toEqual(["close feed-reminder", "show feed-reminder"]);
});

// Right after the update, the reminder in the shade was shown by the older
// version, which kept no due time. Shown minutes ago, it is this reminder;
// hours ago, an earlier one.
test("a reminder shown by the older app minutes ago is not rung twice; hours ago it is replaced with a ring", async () => {
  const recent = serviceWorker({ legacyShownAgoMs: 3 * 60_000 });
  await recent.push({ ...feed, due: "2026-10-15T06:10:00.000Z" });
  expect(recent.shown[0].options).toMatchObject({ renotify: false });

  const older = serviceWorker({ legacyShownAgoMs: 3 * 60 * 60_000 });
  await older.push({ ...feed, due: "2026-10-15T06:10:00.000Z" });
  expect(older.shown[0].options).toMatchObject({ renotify: true });
  expect(older.calls).toEqual(["close feed-reminder", "show feed-reminder"]);
});
