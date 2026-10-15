import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, test } from "vitest";

// public/notification-sw.js is plain JavaScript the service worker imports, so
// it is run here as the phone runs it: in its own scope, with a `self` that
// records what it was asked to do.

const source = readFileSync(new URL("../../public/notification-sw.js", import.meta.url), "utf8");

type Listener = (event: Record<string, unknown>) => void;
type Shown = { title: string; options: Record<string, unknown> };

function serviceWorker({ openAt = "https://numalog.app/", hasGetNotifications = true } = {}) {
  const listeners: Record<string, Listener> = {};
  const calls: string[] = [];
  const shown: Shown[] = [];
  const open = [{ tag: "feed-reminder", close: () => calls.push("close feed-reminder") }];
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
  vm.runInNewContext(source, { self, URL, Promise });

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
