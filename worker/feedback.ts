/// <reference types="@cloudflare/workers-types" />
// "Need anything? Tell me." — the only channel a parent has to reach the
// author. Until this existed, someone whose app broke at 3am in Manila had
// no way to say so.
//
// Stored thin on purpose: the message, and a contact only if they offered
// one. No family id, no device id, nothing that joins a bug report to a
// baby's log — reporting a problem must not mean handing over a child's
// health record.
//
// Replies come back the same way. The phone makes up a random key the first
// time it writes and keeps it; only a hash of it is stored here, against each
// message. Showing that key again is the only way to read the conversation:
// it joins one phone's messages to each other and to the answers, and to
// nothing else — not to a family, not to a sync token.

import { Client } from "@libsql/client/web";
import { brandedHtml, MAIL_FROM, normaliseEmail, sha256, type SendEmail } from "./magicLink";

const MAX_MESSAGE = 2_000;
const MAX_CONTACT = 200;
const MAX_REPLY = 4_000;
/** What one conversation shows. A thread longer than this is a pen pal. */
const THREAD_LIMIT = 200;
/** The phone's key: 32 random bytes, base64url. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
/** The name the dashboard gives an answer before sending it. */
const REPLY_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

// The tables are created on first use rather than requiring a manual
// migration before the feature works. Every statement is idempotent, and the
// flag keeps it to one round per isolate rather than one per request.
let ensured = false;

export async function ensureFeedbackTables(client: Client) {
  if (ensured) return;
  await client.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      message TEXT NOT NULL,
      contact TEXT,
      app_version TEXT,
      handled INTEGER NOT NULL DEFAULT 0,
      reader TEXT
    )
  `);
  // A database from before replies has the table without the column. The
  // ALTER fails, harmlessly, everywhere it is already there.
  await client.execute("ALTER TABLE feedback ADD COLUMN reader TEXT").catch(() => undefined);
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS feedback_replies (
         id TEXT PRIMARY KEY,
         feedback_id TEXT NOT NULL,
         reader TEXT,
         created_at TEXT NOT NULL,
         body TEXT NOT NULL,
         emailed_to TEXT
       )`,
      // With the time in the index, "the newest 200 of this phone's" stops
      // reading at 200 — a key that wrote a thousand times costs no more.
      "CREATE INDEX IF NOT EXISTS feedback_by_reader ON feedback (reader, created_at)",
      "CREATE INDEX IF NOT EXISTS feedback_replies_by_reader ON feedback_replies (reader, created_at)",
      "CREATE INDEX IF NOT EXISTS feedback_replies_by_message ON feedback_replies (feedback_id)",
      // "The address this phone last left" walks only the messages that
      // carry one, however many came without.
      "CREATE INDEX IF NOT EXISTS feedback_contact_by_reader ON feedback (reader, created_at) WHERE contact IS NOT NULL",
    ],
    "write",
  );
  ensured = true;
}

/** Forget that the tables were made — for tests that start a fresh database. */
export function resetFeedbackTablesForTest() {
  ensured = false;
}

/**
 * Per-address limits for the feedback endpoints, kept in this isolate's
 * memory and nowhere else. A budget row in the database would hold the
 * address beside the moment the message arrived — and the photo and join
 * budgets hold the same address beside a family id, which would join the
 * message to a family. Memory forgets; each isolate counts on its own, so
 * a determined sender gets a few isolates' worth, and the service-wide
 * ceiling in index.ts bounds the rest.
 */
export function makeLimiter(maxKeys = 5_000) {
  const counts = new Map<string, { hour: number; n: number }>();
  return {
    allow(key: string, max: number, now: number): boolean {
      const hour = Math.floor(now / 3_600_000);
      const seen = counts.get(key);
      if (!seen || seen.hour !== hour) {
        // An hour's worth of addresses at most: the oldest go first.
        if (!seen && counts.size >= maxKeys) counts.delete(counts.keys().next().value as string);
        counts.set(key, { hour, n: 1 });
        return true;
      }
      seen.n += 1;
      return seen.n <= max;
    },
  };
}

export const feedbackLimiter = makeLimiter();

function respond(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function readerOf(key: unknown): Promise<string | null> {
  return typeof key === "string" && KEY_PATTERN.test(key) ? sha256(key) : null;
}

export type ThreadMessage = { id: string; at: string; from: "you" | "dev"; text: string };

export async function handleFeedback(client: Client, request: Request, now = Date.now()): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  const version = typeof body.appVersion === "string" ? body.appVersion.slice(0, 40) : null;

  if (message.length < 3) return respond({ error: "Write a little more." }, 400);

  await ensureFeedbackTables(client);
  const id = crypto.randomUUID();
  const at = new Date(now).toISOString();
  const text = message.slice(0, MAX_MESSAGE);
  await client.execute({
    sql: "insert into feedback (id, created_at, message, contact, app_version, reader) values (?, ?, ?, ?, ?, ?)",
    args: [id, at, text, contact ? contact.slice(0, MAX_CONTACT) : null, version, await readerOf(body.key)],
  });

  // The message as the conversation will show it, so the phone can put it
  // there without asking again.
  const sent: ThreadMessage = { id, at, from: "you", text };
  return respond({ ok: true, message: sent });
}

/** Everything one phone has said and been told, oldest first. */
export async function readThread(client: Client, reader: string): Promise<ThreadMessage[]> {
  const [mine, replies] = await client.batch(
    [
      {
        sql: "select id, created_at, message from feedback where reader = ? order by created_at desc limit ?",
        args: [reader, THREAD_LIMIT],
      },
      {
        sql: "select id, created_at, body from feedback_replies where reader = ? order by created_at desc limit ?",
        args: [reader, THREAD_LIMIT],
      },
    ],
    "read",
  );
  const thread: ThreadMessage[] = [
    ...mine.rows.map((row) => ({ id: String(row.id), at: String(row.created_at), from: "you" as const, text: String(row.message) })),
    ...replies.rows.map((row) => ({ id: String(row.id), at: String(row.created_at), from: "dev" as const, text: String(row.body) })),
  ];
  thread.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return thread.slice(-THREAD_LIMIT);
}

/**
 * POST /api/feedback/thread {key}: the conversation behind that key. A POST so
 * the key never sits in a URL, a log line or a browser history. A key that
 * has written nothing reads as an empty conversation — the same answer a
 * wrong one gets.
 */
export async function handleThread(client: Client, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reader = await readerOf(body.key);
  if (!reader) return respond({ error: "That is not a conversation key." }, 400);
  await ensureFeedbackTables(client);
  return respond({ messages: await readThread(client, reader) });
}

export type ReplyResult =
  | { error: string }
  | {
      ok: true;
      reply: ThreadMessage;
      inApp: boolean;
      emailedTo: string | null;
      emailError?: string;
      /** Sent, but the conversation could not be ticked off. */
      unticked?: boolean;
      /** This answer had already arrived on an earlier try; nothing was sent again. */
      already?: boolean;
    };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Paragraphs a mail client shows as typed: escaped, then line breaks kept. */
function asHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

/**
 * The answer, mailed — for a parent who left an address.
 *
 * No button into the app, on purpose. The conversation lives in the storage
 * of the app the parent wrote from, and a link cannot reach it: on an iPhone
 * a link opens Safari, which never shares storage with the app on the home
 * screen, and older installs live on another address altogether. A button
 * would open an empty app — which reads as a lost log. So the email says
 * where to look instead.
 */
export function replyEmail(reply: string, original: string, inApp: boolean): { subject: string; text: string; html: string } {
  const quoted = original.length > 600 ? `${original.slice(0, 600)}…` : original;
  const where = inApp
    ? "The whole conversation is in the app too: open Numalog on the phone you wrote from and tap the speech bubble at the bottom. To answer, write there — this address is not read."
    : "To answer, open Numalog and tap the speech bubble at the bottom — this address is not read.";
  return {
    subject: "A reply to your message about Numalog",
    text: `${reply}\n\n— You wrote:\n${quoted.replace(/^/gm, "> ")}\n\n${where}`,
    html: brandedHtml({
      heading: "A reply to your message",
      body:
        `<div style="text-align:left;color:#2b2426;">${asHtml(reply)}</div>` +
        `<div style="text-align:left;margin-top:18px;padding-left:12px;border-left:3px solid #f0e8ea;color:#a08c92;">` +
        `You wrote:<br>${asHtml(quoted)}</div>`,
      footnote: escapeHtml(where),
    }),
  };
}

/**
 * The operator answers one message — the newest one the dashboard showed for
 * that conversation. The answer joins that phone's conversation (when the
 * phone sent a key — every version since replies existed does) and, if asked
 * and an address was left, goes by email as well. Answering ticks off what
 * the operator had in front of them, and nothing that arrived since.
 *
 * The reply is stored BEFORE the email goes, so a database that fails can
 * never leave a sent email looking unsent — the one way to mail a parent the
 * same answer twice.
 */
export async function replyToFeedback(
  client: Client,
  email: SendEmail | undefined,
  body: Record<string, unknown>,
  now = Date.now(),
): Promise<ReplyResult> {
  const feedbackId = typeof body.id === "string" ? body.id : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!feedbackId) return { error: "Which message?" };
  if (!text) return { error: "Write the reply first." };
  if (text.length > MAX_REPLY) return { error: `A reply this long will not be read — keep it under ${MAX_REPLY} characters.` };

  await ensureFeedbackTables(client);
  const found = await client.execute({
    sql: "select id, created_at, message, contact, reader from feedback where id = ?",
    args: [feedbackId],
  });
  const row = found.rows[0];
  if (!row) return { error: "That message is not there any more." };
  const reader = row.reader == null ? null : String(row.reader);
  const answeredUpTo = String(row.created_at);

  // The address to write to: the latest one this phone left, since a parent
  // who typed it once is not asked again.
  let address = normaliseEmail(row.contact);
  if (reader) {
    const contacts = await client.execute({
      sql: "select contact from feedback where reader = ? and contact is not null order by created_at desc limit 20",
      args: [reader],
    });
    for (const candidate of contacts.rows) {
      const valid = normaliseEmail(candidate.contact);
      if (valid) {
        address = valid;
        break;
      }
    }
  }
  const wantsEmail = body.email !== false && Boolean(address);
  if (!reader && !wantsEmail) {
    return {
      error: address
        ? "This came from an older version of the app, so the reply can only go by email — tick the email box."
        : "This came from an older version of the app with no email, so there is no way to reach them. Answer in News.",
    };
  }
  if (!reader && !email) return { error: "Email is not set up on this deployment, and it is the only way to reach them." };

  // The dashboard names each answer before sending it, and sends the same
  // name again when it cannot tell whether the first try arrived (a dropped
  // connection). An answer already stored under that name is not stored, or
  // mailed, twice.
  const named = typeof body.replyId === "string" && REPLY_ID_PATTERN.test(body.replyId) ? body.replyId : null;
  if (named) {
    const earlier = await client.execute({
      sql: "select id, created_at, body, emailed_to from feedback_replies where id = ?",
      args: [named],
    });
    const done = earlier.rows[0];
    if (done) {
      return {
        ok: true,
        reply: { id: named, at: String(done.created_at), from: "dev", text: String(done.body) },
        inApp: Boolean(reader),
        emailedTo: done.emailed_to == null ? null : String(done.emailed_to),
        already: true,
      };
    }
  }
  const id = named ?? crypto.randomUUID();
  const at = new Date(now).toISOString();
  await client.execute({
    sql: "insert into feedback_replies (id, feedback_id, reader, created_at, body, emailed_to) values (?, ?, ?, ?, ?, null)",
    args: [id, feedbackId, reader, at, text],
  });

  let emailedTo: string | null = null;
  let emailError: string | undefined;
  if (wantsEmail && address) {
    if (!email) {
      emailError = "Email is not set up on this deployment.";
    } else {
      const mail = replyEmail(text, String(row.message), Boolean(reader));
      try {
        await email.send({ to: address, from: MAIL_FROM, subject: mail.subject, text: mail.text, html: mail.html });
        emailedTo = address;
      } catch (error) {
        emailError = error instanceof Error ? error.message.slice(0, 200) : "The email did not send.";
      }
    }
    // With nowhere in the app to put it, an answer that did not go out by
    // email went nowhere: take it back and say so.
    if (!reader && !emailedTo) {
      await client.execute({ sql: "delete from feedback_replies where id = ?", args: [id] }).catch(() => undefined);
      return { error: emailError ?? "The email did not send." };
    }
  }

  // The bookkeeping after the answer has gone. If it fails the answer still
  // went — the result says so rather than inviting a second send.
  let unticked = false;
  try {
    await client.batch(
      [
        ...(emailedTo
          ? [{ sql: "update feedback_replies set emailed_to = ? where id = ?", args: [emailedTo, id] }]
          : []),
        reader
          ? { sql: "update feedback set handled = 1 where reader = ? and created_at <= ?", args: [reader, answeredUpTo] }
          : { sql: "update feedback set handled = 1 where id = ?", args: [feedbackId] },
      ],
      "write",
    );
  } catch {
    unticked = true;
  }

  return {
    ok: true,
    reply: { id, at, from: "dev", text },
    inApp: Boolean(reader),
    emailedTo,
    ...(emailError ? { emailError } : {}),
    ...(unticked ? { unticked: true } : {}),
  };
}

/** Tick a conversation off, or back on. Ticking covers the message the
    operator ticked and everything that phone said before it — not a message
    that arrived after the dashboard was drawn. Un-ticking reopens all of it. */
export async function markFeedback(client: Client, id: string, handled: boolean): Promise<void> {
  await ensureFeedbackTables(client);
  await client.execute(
    handled
      ? {
          sql: `update feedback set handled = 1
                where id = ?
                   or (reader is not null
                       and reader = (select reader from feedback where id = ?)
                       and created_at <= (select created_at from feedback where id = ?))`,
          args: [id, id, id],
        }
      : {
          sql: `update feedback set handled = 0
                where id = ?
                   or (reader is not null and reader = (select reader from feedback where id = ?))`,
          args: [id, id],
        },
  );
}
