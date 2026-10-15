// The conversation with the person who built this, as this phone holds it.
//
// Writing used to be one-way: a parent asked something and the only answer
// they could ever get was a line in News, or an email if they had left one.
// Now the first message makes up a random key, kept here and nowhere else;
// the server stores only a hash of it next to each message, and showing the
// key again is how this phone reads the answers. No account, no family id —
// the conversation is tied to this phone and to nothing about the baby.
//
// Loaded lazily: the bubble on the boot path only checks whether a
// conversation exists (INBOX_STORE, below) before asking for this module.

import { toast } from "../lib/toast";

export type ThreadMessage = { id: string; at: string; from: "you" | "dev"; text: string };

export type Inbox = {
  key: string;
  /** The newest reply the parent has had in front of them. */
  seenAt: string;
  /** The newest reply already announced with a toast, so it is announced once. */
  toastedAt: string;
  /** When the server was last asked, by this phone's clock. */
  checkedAt: number;
  thread: ThreadMessage[];
};

export const INBOX_STORE = "numalog-inbox-v1";
/** Fired when this phone writes for the first time. Mirrored in FeedbackBubble. */
export const INBOX_STARTED = "numalog-inbox-started";
/** How often a phone that has written asks whether there is an answer. */
const CHECK_EVERY_MS = 10 * 60_000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

// Storage is the truth; `inbox` is what it held the last time it was read
// (`raw`). Reading it again on every look costs a string compare, and it
// means "Erase all data", which sweeps storage without a reload, takes the
// conversation with it — a copy kept only in memory came back after an
// erase, key and all, and wrote itself back.
let inbox: Inbox | null = null;
let raw: string | null | undefined;
const listeners = new Set<() => void>();

function isMessage(value: unknown): value is ThreadMessage {
  const m = value as ThreadMessage;
  return Boolean(m) && typeof m.id === "string" && typeof m.at === "string" &&
    (m.from === "you" || m.from === "dev") && typeof m.text === "string";
}

function parse(text: string | null): Inbox | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Partial<Inbox>;
    if (typeof parsed.key !== "string" || !KEY_PATTERN.test(parsed.key)) return null;
    return {
      key: parsed.key,
      seenAt: typeof parsed.seenAt === "string" ? parsed.seenAt : "",
      toastedAt: typeof parsed.toastedAt === "string" ? parsed.toastedAt : "",
      checkedAt: typeof parsed.checkedAt === "number" ? parsed.checkedAt : 0,
      thread: Array.isArray(parsed.thread) ? parsed.thread.filter(isMessage) : [],
    };
  } catch {
    return null;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

function write(next: Inbox) {
  inbox = next;
  try {
    const text = JSON.stringify(next);
    window.localStorage.setItem(INBOX_STORE, text);
    raw = text;
  } catch {
    // Kept for this session: `raw` still matches what storage holds, so the
    // copy in memory stands. A full or blocked storage costs the answers to
    // these messages, and nothing else.
  }
  notify();
}

export function getInbox(): Inbox | null {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(INBOX_STORE);
  } catch {
    return inbox;
  }
  if (stored !== raw) {
    raw = stored;
    inbox = parse(stored);
  }
  return inbox;
}

/** Another tab wrote, read the replies, or cleared everything (key null):
    this one follows. */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== INBOX_STORE) return;
  notify();
}

export function subscribeInbox(listener: () => void): () => void {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

function newestReply(current: Inbox | null): string {
  let newest = "";
  for (const m of current?.thread ?? []) if (m.from === "dev" && m.at > newest) newest = m.at;
  return newest;
}

export function unreadReplies(current: Inbox | null): number {
  if (!current) return 0;
  return current.thread.filter((m) => m.from === "dev" && m.at > current.seenAt).length;
}

/** The key, made the first time this phone writes. */
export function inboxKey(): string {
  const current = getInbox();
  if (current) return current.key;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const key = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  write({ key, seenAt: "", toastedAt: "", checkedAt: 0, thread: [] });
  // The bubble only looks for answers on a phone that has written; this one
  // just did, maybe from Settings, where the bubble cannot see it happen.
  window.dispatchEvent(new Event(INBOX_STARTED));
  return key;
}

// How many conversation views are on screen right now — the bubble's dialog,
// the Settings card, the Thanks dialog. An answer arriving while one is in
// front of the parent needs no announcing: it is already there to read.
let onScreen = 0;

/** A conversation view came into sight (+1) or went out of it (-1). */
export function conversationOnScreen(change: 1 | -1) {
  onScreen = Math.max(0, onScreen + change);
}

/** "Erase all data": forget the conversation, in memory as well as in
    storage — a copy kept only in memory (storage was full) would otherwise
    outlive the erase and write itself back. */
export function forgetInbox() {
  inbox = null;
  raw = undefined;
  inFlight = null;
  try {
    window.localStorage.removeItem(INBOX_STORE);
  } catch {
    // Nothing stored, then.
  }
  notify();
}

/** A message the server has just taken, shown before the next check. */
export function addSent(message: ThreadMessage) {
  const current = getInbox();
  if (!current || current.thread.some((m) => m.id === message.id)) return;
  write({ ...current, thread: [...current.thread, message] });
}

/** The replies on screen have been seen: the dot goes. */
export function markInboxSeen() {
  const current = getInbox();
  const newest = newestReply(current);
  if (!current || !newest || newest <= current.seenAt) return;
  write({ ...current, seenAt: newest, toastedAt: newest > current.toastedAt ? newest : current.toastedAt });
}

let inFlight: Promise<void> | null = null;

/**
 * Ask the server for the conversation. Unforced, at most once every ten
 * minutes — a phone that wrote once should not knock on every open for ever.
 * Offline, or the server down, is the same as no news.
 */
export function refreshInbox(force = false): Promise<void> {
  const current = getInbox();
  if (!current) return Promise.resolve();
  if (!force && Math.abs(Date.now() - current.checkedAt) < CHECK_EVERY_MS) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const response = await fetch("/api/feedback/thread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: current.key }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { messages?: unknown };
      if (!Array.isArray(body.messages)) return;
      const thread = body.messages.filter(isMessage);
      // Read again: a reply may have been marked seen while this was out.
      const latest = getInbox();
      if (!latest || latest.key !== current.key) return;
      // A message sent while this was out is kept until the next answer has it.
      const sentMeanwhile = latest.thread.filter(
        (m) => m.from === "you" && !thread.some((t) => t.id === m.id) && m.at > (thread.at(-1)?.at ?? ""),
      );
      write({ ...latest, checkedAt: Date.now(), thread: [...thread, ...sentMeanwhile] });
    } catch {
      // No connection: the conversation on screen is the one from last time.
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * The bubble's half: check now and whenever the app comes back to the
 * front, and say so once when an answer arrives — a dot alone is easy to
 * miss. `show` gets the unread count and whether there is a conversation at
 * all; `open` shows it. While `quiet()` — a log sheet open, or the
 * conversation itself already on screen — nothing is announced; `announce`
 * is called again when that ends.
 */
export function watchInbox(
  show: (unread: number, talking: boolean) => void,
  open: () => void,
  quiet: () => boolean,
): { stop: () => void; announce: () => void } {
  const update = () => {
    const current = getInbox();
    show(unreadReplies(current), Boolean(current?.thread.length));
  };
  const unsubscribe = subscribeInbox(update);
  update();
  function announce() {
    const current = getInbox();
    const newest = newestReply(current);
    if (!current || !newest || newest <= current.seenAt || newest <= current.toastedAt) return;
    if (quiet() || onScreen > 0) return;
    write({ ...current, toastedAt: newest });
    toast("Apostolis replied to your message", {
      duration: 10_000,
      action: { label: "Read", onClick: open },
    });
  }
  function check() {
    if (document.visibilityState === "hidden") return;
    void refreshInbox().then(announce);
  }
  check();
  document.addEventListener("visibilitychange", check);
  return {
    announce,
    stop: () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", check);
    },
  };
}

/** Start from nothing — for tests. */
export function forgetInboxForTest() {
  inbox = null;
  raw = undefined;
  inFlight = null;
  onScreen = 0;
}
