/// <reference types="@cloudflare/workers-types" />
// Reminders that arrive with the app closed.
//
// Until now a reminder was a setTimeout inside the page: close the tab and
// nothing ever fired, which for an app whose whole point is 3am is close to
// having no reminders at all. Web Push moves the alarm clock to the push
// service — Apple's or Google's — which rings the phone whether or not this
// app is running.
//
// WHAT THE SERVER LEARNS, AND NOTHING MORE.
//
// This app is local-first: for a family that never turned Family Sync on,
// the server has never seen a single entry, and that must stay true. So a
// phone does not tell the server when its baby fed. It tells it ONE THING:
// "wake me at 17:20". The row below holds a push endpoint, its two keys, and
// up to two future timestamps. No family id, no device label, no baby, no
// entry, ever. And the notification text is fixed here, in this file — the
// server could not personalise it if it wanted to, because it does not know
// anything to personalise it with. That is also why it is safe on a lock
// screen in a shared room.
//
// The push endpoint is a URL this Worker will POST to, so it is checked
// against the real push services and nothing else: an unauthenticated
// endpoint that stores arbitrary URLs and later fetches them is a
// server-side request forgery with extra steps.

import type { Client } from "@libsql/client/web";
import { buildPushPayload } from "@block65/webcrypto-web-push";

/** The kinds of reminder a phone can ask for. Both are optional and off by
    default; the copy for each lives here and only here. */
export const REMINDERS = {
  feed: {
    title: "Time to check feeding cues",
    // No name, ever: this shows on a lock screen that other people see.
    body: "A feed reminder is due. Follow your baby’s cues and care plan.",
    tag: "feed-reminder",
  },
  diaper: {
    title: "Diaper check",
    body: "It has been a while since the last change.",
    tag: "diaper-reminder",
  },
} as const;

export type ReminderKind = keyof typeof REMINDERS;

/**
 * The push services a real browser subscription can point at. Anything else
 * is either a mistake or someone trying to make this Worker fetch a URL of
 * their choosing.
 */
const PUSH_HOSTS = [
  // Chrome, Edge and every Chromium browser on Android and desktop.
  "fcm.googleapis.com",
  "android.googleapis.com",
  // Safari, iOS and macOS.
  ".push.apple.com",
  // Firefox.
  ".push.services.mozilla.com",
  // Edge legacy and Windows.
  ".notify.windows.com",
  ".push.services.microsoft.com",
];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (endpoint.length > 700) return false;
  return PUSH_HOSTS.some((host) => (host.startsWith(".") ? url.hostname.endsWith(host) : url.hostname === host));
}

let tableReady = false;

export async function ensurePushTable(client: Client): Promise<void> {
  if (tableReady) return;
  await client
    .execute(
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
         endpoint TEXT PRIMARY KEY,
         p256dh TEXT NOT NULL,
         auth TEXT NOT NULL,
         feed_due_at TEXT,
         diaper_due_at TEXT,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         failures INTEGER NOT NULL DEFAULT 0
       )`,
    )
    .catch(() => undefined);
  // The cron asks one question — "what is due?" — of both columns.
  await client
    .execute("CREATE INDEX IF NOT EXISTS idx_push_feed_due ON push_subscriptions(feed_due_at)")
    .catch(() => undefined);
  await client
    .execute("CREATE INDEX IF NOT EXISTS idx_push_diaper_due ON push_subscriptions(diaper_due_at)")
    .catch(() => undefined);
  tableReady = true;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** A due time this Worker will accept: a real stamp, in the future, and not
    so far ahead that a wrong clock parks a notification in the next decade. */
export function dueAt(value: unknown, now: number): string | null {
  if (typeof value !== "string" || !ISO.test(value)) return null;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  if (at <= now) return null;
  if (at > now + 7 * 86_400_000) return null;
  return value;
}

export type ScheduleBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  feedDueAt?: unknown;
  diaperDueAt?: unknown;
};

/** Store (or update) one phone's alarm clock. */
export async function saveSchedule(client: Client, body: ScheduleBody, now: number): Promise<boolean> {
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!isPushEndpoint(endpoint) || !p256dh || !auth) return false;
  if (p256dh.length > 200 || auth.length > 100) return false;
  const at = new Date(now).toISOString();
  await ensurePushTable(client);
  await client.execute({
    sql: `INSERT INTO push_subscriptions (endpoint, p256dh, auth, feed_due_at, diaper_due_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            feed_due_at = excluded.feed_due_at,
            diaper_due_at = excluded.diaper_due_at,
            updated_at = excluded.updated_at,
            failures = 0`,
    args: [endpoint, p256dh, auth, dueAt(body.feedDueAt, now), dueAt(body.diaperDueAt, now), at, at],
  });
  return true;
}

export async function forgetSubscription(client: Client, endpoint: unknown): Promise<void> {
  if (typeof endpoint !== "string" || !endpoint) return;
  await ensurePushTable(client);
  await client.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [endpoint] });
}

/**
 * How many pushes one cron run may send.
 *
 * Each send is a subrequest, and the Workers free plan allows fifty per
 * invocation. Forty-five leaves room for the database round trips in the
 * same run. Anything still due is picked up by the next run five minutes
 * later — a reminder five minutes late is a reminder; a run that dies
 * halfway through is not.
 */
export const SEND_LIMIT = 45;

/** A reminder more than this far past its time is not sent at all: the
    parent has long since fed the baby, and a notification about a feed two
    hours ago is noise at best and alarming at worst. */
const STALE_AFTER_MS = 45 * 60_000;

export type DueRow = { endpoint: string; p256dh: string; auth: string; kind: ReminderKind };

/** The rows whose time has come, oldest first, capped. */
export async function findDue(client: Client, now: number, limit = SEND_LIMIT): Promise<DueRow[]> {
  await ensurePushTable(client);
  const at = new Date(now).toISOString();
  const floor = new Date(now - STALE_AFTER_MS).toISOString();
  const rows = await client.execute({
    sql: `SELECT endpoint, p256dh, auth, 'feed' AS kind, feed_due_at AS due FROM push_subscriptions
            WHERE feed_due_at IS NOT NULL AND feed_due_at <= ? AND feed_due_at > ?
          UNION ALL
          SELECT endpoint, p256dh, auth, 'diaper' AS kind, diaper_due_at AS due FROM push_subscriptions
            WHERE diaper_due_at IS NOT NULL AND diaper_due_at <= ? AND diaper_due_at > ?
          ORDER BY due LIMIT ?`,
    args: [at, floor, at, floor, limit],
  });
  return rows.rows.map((row) => ({
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
    kind: String(row.kind) === "diaper" ? "diaper" : "feed",
  }));
}

/** Clear a fired alarm, so the next run does not ring it again. */
function clearDue(kind: ReminderKind, endpoint: string) {
  return {
    sql: `UPDATE push_subscriptions SET ${kind === "feed" ? "feed_due_at" : "diaper_due_at"} = NULL WHERE endpoint = ?`,
    args: [endpoint],
  };
}

export type VapidEnv = { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };

export type VapidKeys = { subject: string; publicKey: string; privateKey: string };

/**
 * Who a push service should complain to if this app ever floods it
 * (RFC 8292 §2.1). Unlike the key pair, this is not an identity phones
 * remember, so it can change between deploys without unsubscribing anyone —
 * which is why it reads the environment every time and the keys do not.
 */
const SUBJECT_FALLBACK = "https://numalog.app";

const b64url = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * A fresh VAPID identity: a P-256 pair in the two shapes web push wants —
 * the public key as the raw 65-byte point a browser is handed at subscribe
 * time, the private key as the JWK `d` that signs every send.
 */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  // The workers-types signatures are unions covering both a single key and a
  // pair, and both raw and JWK exports; an asymmetric algorithm with these
  // arguments only ever produces the halves named here.
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publicKey = b64url((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return { publicKey, privateKey: jwk.d ?? "" };
}

let secretsReady = false;

async function ensureSecretsTable(client: Client): Promise<void> {
  if (secretsReady) return;
  await client
    .execute(
      `CREATE TABLE IF NOT EXISTS app_secrets (
         id TEXT PRIMARY KEY,
         payload TEXT NOT NULL,
         created_at TEXT NOT NULL
       )`,
    )
    .catch(() => undefined);
  secretsReady = true;
}

type StoredKeys = { publicKey: string; privateKey: string; createdAt: string };

async function readStoredKeys(client: Client): Promise<StoredKeys | null> {
  const result = await client
    .execute("SELECT payload, created_at FROM app_secrets WHERE id = 'vapid'")
    .catch(() => null);
  const row = result?.rows[0];
  if (!row || typeof row.payload !== "string") return null;
  try {
    const stored = JSON.parse(row.payload) as { publicKey?: unknown; privateKey?: unknown };
    if (typeof stored.publicKey !== "string" || !stored.publicKey) return null;
    if (typeof stored.privateKey !== "string" || !stored.privateKey) return null;
    return { publicKey: stored.publicKey, privateKey: stored.privateKey, createdAt: String(row.created_at ?? "") };
  } catch {
    return null;
  }
}

let cachedKeys: StoredKeys | null = null;

/**
 * The identity this app signs its pushes with — decided once, then never
 * again.
 *
 * A VAPID pair is not a password: it is the name a phone learned this app by
 * when it subscribed. Change it and every phone that ever said yes goes
 * silent, with no error anywhere — the push service simply refuses a
 * signature it does not recognise. So the pair is written down on first use,
 * and from then on the STORED pair wins, including over the environment.
 *
 * Setting VAPID_PRIVATE_KEY seeds that first write, and is worth doing if you
 * would rather hold the key yourself than have it live in the database
 * (`node scripts/vapid-keys.mjs` prints a pair). Setting it afterwards changes
 * nothing, because by then phones are already answering to the old name. To
 * rotate on purpose — and it costs every existing subscription — delete the
 * row: DELETE FROM app_secrets WHERE id = 'vapid'.
 *
 * Null means the database could not be reached, which callers treat exactly
 * as they treat a phone that refused permission: no push, and the app falls
 * back to its own in-page timer.
 */
export async function vapidKeys(client: Client, env: VapidEnv): Promise<VapidKeys | null> {
  const subject = env.VAPID_SUBJECT?.trim() || SUBJECT_FALLBACK;
  if (cachedKeys) return { subject, publicKey: cachedKeys.publicKey, privateKey: cachedKeys.privateKey };
  await ensureSecretsTable(client);

  const existing = await readStoredKeys(client);
  if (existing) {
    cachedKeys = existing;
    return { subject, publicKey: existing.publicKey, privateKey: existing.privateKey };
  }

  const seed =
    env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim()
      ? { publicKey: env.VAPID_PUBLIC_KEY.trim(), privateKey: env.VAPID_PRIVATE_KEY.trim() }
      : await generateVapidKeys();
  // INSERT OR IGNORE, then read back what actually landed: two isolates that
  // reach this line in the same second both defer to whichever row won, so a
  // phone is never handed one public key and then pushed with another.
  await client
    .execute({
      sql: "INSERT OR IGNORE INTO app_secrets (id, payload, created_at) VALUES ('vapid', ?, ?)",
      args: [JSON.stringify(seed), new Date().toISOString()],
    })
    .catch(() => undefined);

  const settled = await readStoredKeys(client);
  if (!settled) return null;
  cachedKeys = settled;
  return { subject, publicKey: settled.publicKey, privateKey: settled.privateKey };
}

/**
 * What the operator's dashboard shows. Deliberately NOT vapidKeys(): the
 * dashboard only ever looks, so opening it can never be what mints the pair,
 * and it is handed the public half alone — the private key has no business
 * leaving this file.
 */
export async function storedVapid(client: Client): Promise<{ publicKey: string; createdAt: string } | null> {
  const stored = cachedKeys ?? (await readStoredKeys(client).catch(() => null));
  return stored ? { publicKey: stored.publicKey, createdAt: stored.createdAt } : null;
}

/**
 * Send everything that is due. Called by the cron; returns what happened so
 * the operator's dashboard can say whether the alarm clock is working.
 *
 * A push service that answers 404 or 410 is telling us the subscription is
 * dead — the app was uninstalled, or permission was withdrawn — and the row
 * is deleted rather than retried for ever.
 */
export async function sendDue(client: Client, env: VapidEnv, now: number): Promise<{ sent: number; gone: number; failed: number }> {
  // Ask what is due before asking who we are: on the overwhelming majority of
  // runs nothing is, and a cron with nothing to do should touch nothing.
  const due = await findDue(client, now);
  if (!due.length) return { sent: 0, gone: 0, failed: 0 };

  const vapid = await vapidKeys(client, env);
  if (!vapid) return { sent: 0, gone: 0, failed: 0 };

  const statements: Array<{ sql: string; args: unknown[] }> = [];
  let sent = 0;
  let gone = 0;
  let failed = 0;

  const results = await Promise.all(
    due.map(async (row) => {
      const copy = REMINDERS[row.kind];
      try {
        const payload = await buildPushPayload(
          {
            data: { title: copy.title, body: copy.body, tag: copy.tag, url: "/" },
            options: { ttl: 30 * 60, urgency: "high" },
          },
          { endpoint: row.endpoint, expirationTime: null, keys: { p256dh: row.p256dh, auth: row.auth } },
          vapid,
        );
        const response = await fetch(row.endpoint, {
          method: "POST",
          headers: payload.headers,
          body: payload.body as unknown as BodyInit,
        });
        return { row, status: response.status };
      } catch {
        return { row, status: 0 };
      }
    }),
  );

  for (const { row, status } of results) {
    if (status === 404 || status === 410) {
      gone += 1;
      statements.push({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [row.endpoint] });
      continue;
    }
    if (status >= 200 && status < 300) {
      sent += 1;
      statements.push(clearDue(row.kind, row.endpoint));
      continue;
    }
    // A refusal we do not understand: clear the alarm anyway. Leaving it set
    // would ring the same broken bell every five minutes for ever.
    failed += 1;
    statements.push(clearDue(row.kind, row.endpoint));
    statements.push({
      sql: "UPDATE push_subscriptions SET failures = failures + 1 WHERE endpoint = ?",
      args: [row.endpoint],
    });
  }

  if (statements.length) await client.batch(statements as never, "write");
  return { sent, gone, failed };
}
