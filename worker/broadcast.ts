/// <reference types="@cloudflare/workers-types" />
// Announcements: the one message the operator can put on every lock screen.
//
// worker/push.ts is a phone reminding itself. This is the other direction,
// and it is the most abusable surface in the app — a megaphone straight onto
// a lock screen in a room with a sleeping baby. So it is built to make the
// dangerous things hard rather than to make sending easy:
//
//   • It goes out to a table that holds no family, no device and no baby, so
//     an announcement CANNOT be aimed at anyone. Everyone or nobody.
//   • One at a time. A second is refused while one is still going out, so a
//     double tap cannot become two notifications.
//   • It is queued, never sent from the request that asked for it. The cron
//     drains it BEHIND the reminders, because a feed reminder is
//     time-critical and an announcement never is.
//   • The tap target is a path inside this app, never a URL, because an
//     announcement that can open anywhere is a phishing kit with a cron.
//   • Every one is kept for ever with the time it went out, so "what did we
//     send that night" has an answer.

import type { Client } from "@libsql/client/web";
import { type PushMessage, type Target, type VapidEnv, deliver, isGone, isSent, vapidKeys } from "./push";

/** Nobody reads more than this on a lock screen. Hard caps rather than
    truncation: a sentence cut in half is worse than a refusal. */
export const BROADCAST_TITLE_MAX = 60;
export const BROADCAST_BODY_MAX = 160;

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  cursor: string;
  sent: number;
  gone: number;
  failed: number;
  finishedAt: string | null;
};

let tableReady = false;

export async function ensureBroadcastTable(client: Client): Promise<void> {
  if (tableReady) return;
  await client
    .execute(
      `CREATE TABLE IF NOT EXISTS broadcasts (
         id TEXT PRIMARY KEY,
         title TEXT NOT NULL,
         body TEXT NOT NULL,
         url TEXT NOT NULL DEFAULT '/',
         created_at TEXT NOT NULL,
         cursor TEXT NOT NULL DEFAULT '',
         sent INTEGER NOT NULL DEFAULT 0,
         gone INTEGER NOT NULL DEFAULT 0,
         failed INTEGER NOT NULL DEFAULT 0,
         finished_at TEXT
       )`,
    )
    .catch(() => undefined);
  tableReady = true;
}

function toBroadcast(row: Record<string, unknown>): Broadcast {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    url: String(row.url ?? "/"),
    createdAt: String(row.created_at),
    cursor: String(row.cursor ?? ""),
    sent: Number(row.sent ?? 0),
    gone: Number(row.gone ?? 0),
    failed: Number(row.failed ?? 0),
    finishedAt: row.finished_at == null ? null : String(row.finished_at),
  };
}

/** The one still going out, if any. */
export async function pendingBroadcast(client: Client): Promise<Broadcast | null> {
  await ensureBroadcastTable(client);
  const result = await client
    .execute("SELECT * FROM broadcasts WHERE finished_at IS NULL ORDER BY created_at LIMIT 1")
    .catch(() => null);
  const row = result?.rows[0];
  return row ? toBroadcast(row as unknown as Record<string, unknown>) : null;
}

/** What was ever sent, newest first. */
export async function broadcastHistory(client: Client, limit = 20): Promise<Broadcast[]> {
  await ensureBroadcastTable(client);
  const result = await client
    .execute({ sql: "SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT ?", args: [limit] })
    .catch(() => null);
  return (result?.rows ?? []).map((row) => toBroadcast(row as unknown as Record<string, unknown>));
}

export type BroadcastDraft = { title?: unknown; body?: unknown; url?: unknown };

/** Control characters have no business in a notification, and are how a
    one-line message becomes three on somebody's lock screen. */
function hasControl(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** What this Worker is willing to put in front of a stranger. */
export function readDraft(draft: BroadcastDraft): { title: string; body: string; url: string } | null {
  const title = typeof draft.title === "string" ? draft.title.trim() : "";
  const body = typeof draft.body === "string" ? draft.body.trim() : "";
  if (!title || !body) return null;
  if (title.length > BROADCAST_TITLE_MAX || body.length > BROADCAST_BODY_MAX) return null;
  if (hasControl(title) || hasControl(body)) return null;
  // A path inside this app, never a URL. "//evil.example" is a protocol-
  // relative URL that looks like a path, which is why it is refused too.
  const url = typeof draft.url === "string" && draft.url ? draft.url : "/";
  if (!url.startsWith("/") || url.startsWith("//") || url.length > 120) return null;
  if (hasControl(url)) return null;
  return { title, body, url };
}

/**
 * Queue one.
 *
 * Returns the id, never a "sent" count — nothing has been sent yet, and
 * saying otherwise would be a lie the operator acts on.
 */
export async function queueBroadcast(
  client: Client,
  draft: BroadcastDraft,
  now: number,
): Promise<{ id: string } | { error: string }> {
  const message = readDraft(draft);
  if (!message) {
    return { error: "A title and a message are needed, short enough for a lock screen and on one line." };
  }
  await ensureBroadcastTable(client);
  if (await pendingBroadcast(client)) {
    return { error: "One announcement is still going out. Wait for it to finish." };
  }
  const id = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO broadcasts (id, title, body, url, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, message.title, message.body, message.url, new Date(now).toISOString()],
  });
  return { id };
}

/** Stop one that is part-way out. The rows already reached keep it; this is
    the brake, not an undo — a notification cannot be recalled. */
export async function stopBroadcast(client: Client, now: number): Promise<boolean> {
  const broadcast = await pendingBroadcast(client);
  if (!broadcast) return false;
  await client.execute({
    sql: "UPDATE broadcasts SET finished_at = ? WHERE id = ?",
    args: [new Date(now).toISOString(), broadcast.id],
  });
  return true;
}

/** Endpoints after the cursor in a stable order, so the chunks of one
    announcement cover every phone exactly once. */
async function nextTargets(client: Client, cursor: string, limit: number): Promise<Target[]> {
  const rows = await client.execute({
    sql: `SELECT endpoint, p256dh, auth FROM push_subscriptions
          WHERE endpoint > ? ORDER BY endpoint LIMIT ?`,
    args: [cursor, limit],
  });
  return rows.rows.map((row) => ({
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
  }));
}

export type ChunkResult = { id: string; sent: number; gone: number; failed: number; done: boolean };

/**
 * Send the next slice of the announcement that is going out.
 *
 * `limit` is whatever subrequests the reminders left behind. A slice shorter
 * than the limit means the end of the table, so the announcement is marked
 * finished — which is also what unblocks the next one.
 */
export async function sendBroadcastChunk(
  client: Client,
  env: VapidEnv,
  now: number,
  limit: number,
): Promise<ChunkResult | null> {
  if (limit <= 0) return null;
  const broadcast = await pendingBroadcast(client);
  if (!broadcast) return null;

  const vapid = await vapidKeys(client, env);
  if (!vapid) return null;

  const targets = await nextTargets(client, broadcast.cursor, limit);
  if (!targets.length) {
    await client.execute({
      sql: "UPDATE broadcasts SET finished_at = ? WHERE id = ?",
      args: [new Date(now).toISOString(), broadcast.id],
    });
    return { id: broadcast.id, sent: 0, gone: 0, failed: 0, done: true };
  }
  const done = targets.length < limit;

  const message: PushMessage = {
    title: broadcast.title,
    body: broadcast.body,
    // Its own tag, so an announcement never replaces a feed reminder and two
    // announcements never stack.
    tag: "announcement",
    url: broadcast.url,
  };
  // A day to live: a phone that was off overnight should still get it, a
  // phone that was off for a week should not.
  const results = await deliver(vapid, targets, () => message, 24 * 60 * 60);

  const statements: Array<{ sql: string; args: unknown[] }> = [];
  let sent = 0;
  let gone = 0;
  let failed = 0;
  for (const { row, status } of results) {
    if (isGone(status)) {
      gone += 1;
      statements.push({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [row.endpoint] });
    } else if (isSent(status)) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  // The cursor advances past everything ATTEMPTED, refusals included. A row
  // that would not take this announcement will not take it five minutes from
  // now either, and retrying for ever means the queue never drains.
  statements.push({
    sql: `UPDATE broadcasts
          SET cursor = ?, sent = sent + ?, gone = gone + ?, failed = failed + ?, finished_at = ?
          WHERE id = ?`,
    args: [
      targets[targets.length - 1].endpoint,
      sent,
      gone,
      failed,
      done ? new Date(now).toISOString() : null,
      broadcast.id,
    ],
  });
  await client.batch(statements as never, "write");

  return { id: broadcast.id, sent, gone, failed, done };
}
