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
  /** The chosen households, or null for everyone. */
  audience: string[] | null;
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
  // Added with the checkbox list. NULL means everyone, which is what every
  // row written before this existed meant too.
  await client.execute("ALTER TABLE broadcasts ADD COLUMN audience TEXT").catch(() => undefined);
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
    audience: (() => {
      if (row.audience == null) return null;
      try {
        const parsed = JSON.parse(String(row.audience));
        return Array.isArray(parsed) ? (parsed as string[]) : null;
      } catch {
        return null;
      }
    })(),
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

export type BroadcastDraft = { title?: unknown; body?: unknown; url?: unknown; audience?: unknown };

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
  // Absent means everyone. An EMPTY list means the operator opened the
  // chooser and ticked nothing, which is a mistake worth refusing rather
  // than quietly promoting to "send to all of them".
  const audience = draft.audience === undefined ? null : readAudience(draft.audience);
  // readAudience answers null for anything that is not a list — a string, an
  // object, a null — and null means EVERYONE. So a malformed selection was
  // quietly promoted to the widest possible send, which is the same footgun
  // the empty list below is refused for.
  if (draft.audience !== undefined && audience === null) {
    return { error: "That is not a list of households." };
  }
  if (audience !== null && audience.length === 0) {
    return { error: "No households are ticked, so there is nobody to send to." };
  }
  const id = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO broadcasts (id, title, body, url, created_at, audience) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, message.title, message.body, message.url, new Date(now).toISOString(),
      audience === null ? null : JSON.stringify(audience)],
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
async function nextTargets(
  client: Client,
  cursor: string,
  limit: number,
  audience: string[] | null,
): Promise<Target[]> {
  // The cursor still pages over endpoints, so a chosen-household send resumes
  // exactly where it left off like any other.
  const narrow = audience === null
    ? ""
    : ` AND family_id IN (${audience.map(() => "?").join(",")})`;
  const rows = await client.execute({
    sql: `SELECT endpoint, p256dh, auth FROM push_subscriptions
          WHERE endpoint > ?${narrow} ORDER BY endpoint LIMIT ?`,
    args: audience === null ? [cursor, limit] : [cursor, ...audience, limit],
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

  const targets = await nextTargets(client, broadcast.cursor, limit, broadcast.audience);
  if (!targets.length) {
    await client.execute({
      sql: "UPDATE broadcasts SET finished_at = COALESCE(finished_at, ?) WHERE id = ?",
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
  // "finished_at IS NULL" is the guard, and it is the brake working.
  //
  // deliver() posts up to SEND_LIMIT pushes at once, so there is a real
  // window between reading the pending broadcast and writing this row — and
  // that window is exactly when an operator hits Stop. Writing finished_at
  // unconditionally set it back to NULL and the announcement carried on to
  // everybody: the brake released itself. The counts are still recorded,
  // because those phones really were reached.
  statements.push({
    sql: `UPDATE broadcasts
          SET cursor = ?, sent = sent + ?, gone = gone + ?, failed = failed + ?,
              finished_at = COALESCE(finished_at, ?)
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

// ---------------------------------------------------------------------------
// One family.
//
// The broadcast above reaches everyone and can aim at nobody, which is what
// makes it safe. This is the opposite and needs its own care: it is the one
// place in this service where the operator picks a household.
//
// It works only for families that turned Family Sync on, because only they
// have an id at all, and only for phones that PROVED the link with a token
// (see saveSchedule). A local-only family cannot be addressed here — there is
// nothing in the database that could address them, which is the design
// working rather than a gap in it.
//
// Sent immediately rather than queued: a family is two or three phones, not
// two or three thousand.

/** Nobody has more phones than this, and an operator typing a prefix that
    matched more than one family should not discover it by sending. */
const FAMILY_DEVICE_CAP = 10;

export type FamilyNotifyResult =
  | { error: string }
  | { sent: number; gone: number; failed: number; phones: number };

/**
 * Resolve what the operator typed to exactly one family.
 *
 * The dashboard shows ids truncated to eight characters — deliberately, so
 * that a column of them is not a directory of who — so a prefix is what an
 * operator can actually copy. Ambiguity is refused rather than guessed at:
 * sending a note to the wrong household is not recoverable.
 */
export async function resolveFamily(client: Client, typed: unknown): Promise<{ id: string } | { error: string }> {
  const prefix = typeof typed === "string" ? typed.trim().toLowerCase() : "";
  if (prefix.length < 6) return { error: "Give at least the first six characters of a family id." };
  if (!/^[a-z0-9-]{6,64}$/.test(prefix)) return { error: "That is not a family id." };
  const rows = await client.execute({
    sql: "SELECT id FROM families WHERE id LIKE ? LIMIT 5",
    args: [`${prefix}%`],
  });
  if (!rows.rows.length) return { error: "No family starts with that." };
  if (rows.rows.length > 1) return { error: "More than one family starts with that. Type more of it." };
  return { id: String(rows.rows[0].id) };
}

/**
 * Send one note to one family's phones.
 *
 * The message is the operator's words, checked by the same readDraft as a
 * broadcast: still no name, still one line, still a path inside this app.
 * Being able to aim at a household is not a licence to say more to it — the
 * server does not know a baby's name here either.
 */
export async function notifyFamily(
  client: Client,
  env: VapidEnv,
  typedId: unknown,
  draft: BroadcastDraft,
): Promise<FamilyNotifyResult> {
  const message = readDraft(draft);
  if (!message) {
    return { error: "A title and a message are needed, short enough for a lock screen and on one line." };
  }
  const family = await resolveFamily(client, typedId);
  if ("error" in family) return family;

  const rows = await client.execute({
    sql: `SELECT endpoint, p256dh, auth FROM push_subscriptions
          WHERE family_id = ? ORDER BY endpoint LIMIT ?`,
    args: [family.id, FAMILY_DEVICE_CAP],
  });
  const targets: Target[] = rows.rows.map((row) => ({
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
  }));
  if (!targets.length) {
    return { error: "That family has no phone with reminders on, so there is nothing to ring." };
  }

  const vapid = await vapidKeys(client, env);
  if (!vapid) return { error: "No signing key, so nothing can be sent." };

  const results = await deliver(
    vapid,
    targets,
    () => ({ title: message.title, body: message.body, tag: "note", url: message.url }),
    24 * 60 * 60,
  );

  const statements: Array<{ sql: string; args: unknown[] }> = [];
  let sent = 0;
  let gone = 0;
  let failed = 0;
  for (const { row, status } of results) {
    if (isGone(status)) {
      gone += 1;
      statements.push({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [row.endpoint] });
    } else if (isSent(status)) sent += 1;
    else failed += 1;
  }
  if (statements.length) await client.batch(statements as never, "write");
  return { sent, gone, failed, phones: targets.length };
}

// ---------------------------------------------------------------------------
// Choosing who.
//
// Everything below shows a NAME and an AGE to whoever is holding the laptop,
// which nothing else in this service does: the dashboard truncates family ids
// to eight characters precisely so a column of them is not a directory of
// children. That was a deliberate decision and this is a deliberate exception
// to it, asked for and understood. Two things follow from that:
//
//   • It is served only to the local composer (tools/broadcast), behind the
//     admin password, on a machine somebody had to start a program on. It is
//     NOT on the dashboard, and it must not drift there.
//   • It lists only families that BOTH turned Family Sync on and have a phone
//     with reminders on. A local-only family is not in here, because nothing
//     about them ever reached this server.

export type Recipient = { familyId: string; name: string; ageDays: number | null; phones: number };

/** How many households the composer will list. Past this the checkbox list is
    not a way to choose anyway, and the broadcast is the right tool. */
const RECIPIENT_CAP = 500;

export async function recipients(client: Client, now: number): Promise<Recipient[]> {
  await ensureBroadcastTable(client);
  const rows = await client
    .execute({
      sql: `SELECT s.family_id AS id, COUNT(*) AS phones, m.profile AS profile
            FROM push_subscriptions s
            LEFT JOIN family_meta m ON m.family_id = s.family_id
            WHERE s.family_id IS NOT NULL
            GROUP BY s.family_id
            ORDER BY phones DESC, s.family_id
            LIMIT ?`,
      args: [RECIPIENT_CAP],
    })
    .catch(() => null);

  return (rows?.rows ?? []).map((row) => {
    let name = "";
    let ageDays: number | null = null;
    try {
      const profile = JSON.parse(String(row.profile ?? "null")) as { name?: unknown; birthDate?: unknown } | null;
      if (profile && typeof profile.name === "string") name = profile.name.slice(0, 40);
      if (profile && typeof profile.birthDate === "string") {
        const born = Date.parse(`${profile.birthDate}T00:00:00Z`);
        if (Number.isFinite(born)) ageDays = Math.max(0, Math.floor((now - born) / 86_400_000));
      }
    } catch {
      // A profile that will not parse is a family with no name to show, not
      // a family that cannot be sent to.
    }
    return { familyId: String(row.id), name, ageDays, phones: Number(row.phones ?? 0) };
  });
}

/** The chosen households, as the broadcast stores them: null means everyone. */
export function readAudience(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((id): id is string => typeof id === "string" && /^[a-z0-9-]{6,64}$/i.test(id))
    .slice(0, RECIPIENT_CAP);
  // An empty selection is not "everyone" — it is a mistake, and treating it
  // as everyone would be the worst possible way to resolve one.
  return ids.length ? ids : [];
}
