import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { collectStats } from "../../worker/adminStats";
import {
  ensureFeedbackTables,
  handleFeedback,
  makeLimiter,
  handleThread,
  markFeedback,
  replyEmail,
  replyToFeedback,
  resetFeedbackTablesForTest,
  type ThreadMessage,
} from "../../worker/feedback";

// Answers to the "Need anything?" messages, run against a real SQLite: the
// migration, the hash-keyed conversation and the handled ticks are all SQL,
// and a fake database could only agree with itself.

type Statement = string | { sql: string; args?: unknown[] };

function sqliteClient(db = new DatabaseSync(":memory:")) {
  function run(statement: Statement) {
    const sql = typeof statement === "string" ? statement : statement.sql;
    const args = (typeof statement === "string" ? [] : (statement.args ?? [])) as SQLInputValue[];
    const prepared = db.prepare(sql);
    if (/^\s*(select|with|explain)/i.test(sql)) return { rows: prepared.all(...args) as Record<string, unknown>[] };
    prepared.run(...args);
    return { rows: [] };
  }
  const client = {
    execute: async (statement: Statement) => run(statement),
    batch: async (statements: Statement[]) => statements.map(run),
  };
  return { db, client: client as never };
}

const KEY = "k".repeat(43);
const OTHER_KEY = "z".repeat(43);

function post(body: unknown): Request {
  return new Request("https://numalog.app/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function send(client: never, body: Record<string, unknown>, at: string) {
  const response = await handleFeedback(client, post({ appVersion: "test", ...body }), Date.parse(at));
  expect(response.status).toBe(200);
  return ((await response.json()) as { message: ThreadMessage }).message;
}

async function thread(client: never, key: string): Promise<ThreadMessage[]> {
  const response = await handleThread(client, post({ key }));
  return ((await response.json()) as { messages: ThreadMessage[] }).messages;
}

function mailbox(fail = false) {
  const sent: Array<{ to: string; subject: string; text: string; html?: string }> = [];
  return {
    sent,
    service: {
      send: async (message: { to: string; subject: string; text: string; html?: string }) => {
        if (fail) throw new Error("mail service down");
        sent.push(message);
      },
    },
  };
}

beforeEach(() => {
  resetFeedbackTablesForTest();
});

describe("a parent's conversation", () => {
  it("shows the phone what it said, and only to the phone that said it", async () => {
    const { client } = sqliteClient();
    const sent = await send(client, { message: "Can I edit a medicine?", key: KEY }, "2026-10-15T08:00:00.000Z");
    expect(sent).toMatchObject({ from: "you", text: "Can I edit a medicine?", at: "2026-10-15T08:00:00.000Z" });

    expect(await thread(client, KEY)).toEqual([sent]);
    expect(await thread(client, OTHER_KEY)).toEqual([]);
  });

  it("never stores the key itself", async () => {
    const { client, db } = sqliteClient();
    await send(client, { message: "Hello there", key: KEY }, "2026-10-15T08:00:00.000Z");
    const row = db.prepare("select reader from feedback").get() as { reader: string };
    expect(row.reader).toMatch(/^[0-9a-f]{64}$/);
    expect(row.reader).not.toContain(KEY);
  });

  it("refuses a thread read without a proper key", async () => {
    const { client } = sqliteClient();
    expect((await handleThread(client, post({ key: "short" }))).status).toBe(400);
    expect((await handleThread(client, post({}))).status).toBe(400);
  });

  it("still takes a message from an older app that sends no key", async () => {
    const { client, db } = sqliteClient();
    await send(client, { message: "From the old build" }, "2026-10-15T08:00:00.000Z");
    expect(db.prepare("select reader from feedback").get()).toEqual({ reader: null });
  });
});

describe("answering", () => {
  it("puts the answer in the conversation and ticks it off", async () => {
    const { client, db } = sqliteClient();
    await send(client, { message: "Tummy time timer please", key: KEY }, "2026-10-15T08:00:00.000Z");
    const latest = await send(client, { message: "And a medicine edit", key: KEY }, "2026-10-15T08:05:00.000Z");

    // The dashboard answers the newest message it shows for the conversation.
    const result = await replyToFeedback(client, undefined, { id: latest.id, text: "Both are in today's update!" }, Date.parse("2026-10-15T09:00:00.000Z"));
    expect(result).toMatchObject({ ok: true, inApp: true, emailedTo: null });

    const messages = await thread(client, KEY);
    expect(messages.map((m) => [m.from, m.text])).toEqual([
      ["you", "Tummy time timer please"],
      ["you", "And a medicine edit"],
      ["dev", "Both are in today's update!"],
    ]);
    // Everything that phone had said by then is answered.
    expect(db.prepare("select handled from feedback").all()).toEqual([{ handled: 1 }, { handled: 1 }]);

    // A message after the answer is waiting again, on its own.
    await send(client, { message: "Thank you!!", key: KEY }, "2026-10-15T10:00:00.000Z");
    expect(db.prepare("select message from feedback where handled = 0").all()).toEqual([{ message: "Thank you!!" }]);
  });

  // The dashboard was drawn at 10:00 with A as the newest; B arrived at
  // 10:03; the answer to A goes at 10:05. B was never seen, so it waits.
  it("leaves waiting a message that arrived after the one answered", async () => {
    const { client, db } = sqliteClient();
    const seen = await send(client, { message: "A: the timer?", key: KEY }, "2026-10-15T10:00:00.000Z");
    await send(client, { message: "B: also, it crashed", key: KEY }, "2026-10-15T10:03:00.000Z");
    await replyToFeedback(client, undefined, { id: seen.id, text: "Fixed the timer" }, Date.parse("2026-10-15T10:05:00.000Z"));
    expect(db.prepare("select message from feedback where handled = 0").all()).toEqual([{ message: "B: also, it crashed" }]);
  });

  it("stores the answer before the email goes, so a sent email is never reported unsent", async () => {
    const { client, db } = sqliteClient();
    const first = await send(client, { message: "Hi there", contact: "me@example.com", key: KEY }, "2026-10-15T08:00:00.000Z");
    let storedWhenSent = -1;
    const service = {
      send: async () => {
        storedWhenSent = Number((db.prepare("select count(*) as n from feedback_replies").get() as { n: number }).n);
      },
    };
    const result = await replyToFeedback(client, service, { id: first.id, text: "Answer" });
    expect(storedWhenSent).toBe(1);
    expect(result).toMatchObject({ ok: true, emailedTo: "me@example.com" });
    expect(db.prepare("select emailed_to from feedback_replies").get()).toEqual({ emailed_to: "me@example.com" });
  });

  it("says it went, and asks for a tick by hand, when the bookkeeping fails after the email", async () => {
    const { client } = sqliteClient();
    const first = await send(client, { message: "Hi there", contact: "me@example.com", key: KEY }, "2026-10-15T08:00:00.000Z");
    const flaky = { ...(client as object), batch: async () => { throw new Error("Turso hiccup"); } } as never;
    const result = await replyToFeedback(flaky, mailbox().service, { id: first.id, text: "Answer" });
    expect(result).toMatchObject({ ok: true, emailedTo: "me@example.com", unticked: true });
  });

  // The dashboard names an answer before sending it and, when the
  // connection drops before the server's answer comes back, sends it again
  // under the same name: stored and mailed once.
  it("does not send an answer twice when it is sent again under the same name", async () => {
    const { client, db } = sqliteClient();
    const first = await send(client, { message: "Hi there", contact: "me@example.com", key: KEY }, "2026-10-15T08:00:00.000Z");
    const mail = mailbox();
    const name = "0f8e2c4a-1b3d-4e5f-9a7b-6c5d4e3f2a1b";
    const once = await replyToFeedback(client, mail.service, { id: first.id, text: "Answer", replyId: name });
    const twice = await replyToFeedback(client, mail.service, { id: first.id, text: "Answer", replyId: name });
    expect(once).toMatchObject({ ok: true, emailedTo: "me@example.com" });
    expect(twice).toMatchObject({ ok: true, already: true, emailedTo: "me@example.com" });
    expect(mail.sent).toHaveLength(1);
    expect(db.prepare("select count(*) as n from feedback_replies").get()).toEqual({ n: 1 });
  });

  // The first try's email never confirmed (still sending, or the Worker was
  // cut off): to a parent reachable only by email, that is not "sent".
  it("does not call an unconfirmed email-only answer sent on a retry", async () => {
    const { client, db } = sqliteClient();
    const old = await send(client, { message: "Old build", contact: "me@example.com" }, "2026-10-15T08:00:00.000Z");
    const name = "1f8e2c4a-1b3d-4e5f-9a7b-6c5d4e3f2a1b";
    // The first try stored its row, then hung on the email.
    void replyToFeedback(client, { send: () => new Promise(() => {}) }, { id: old.id, text: "Answer", replyId: name });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(db.prepare("select count(*) as n from feedback_replies").get()).toEqual({ n: 1 });

    const mail = mailbox();
    const retry = await replyToFeedback(client, mail.service, { id: old.id, text: "Answer", replyId: name });
    expect(retry).toHaveProperty("error");
    expect(mail.sent).toHaveLength(0);
  });

  // In the app the stored row is the answer; the email is told as it is.
  it("on a retry in the app, says the earlier email is unknown rather than sending it again", async () => {
    const { client, db } = sqliteClient();
    const first = await send(client, { message: "Hi there", contact: "me@example.com", key: KEY }, "2026-10-15T08:00:00.000Z");
    const name = "2f8e2c4a-1b3d-4e5f-9a7b-6c5d4e3f2a1b";
    void replyToFeedback(client, { send: () => new Promise(() => {}) }, { id: first.id, text: "Answer", replyId: name });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const mail = mailbox();
    const retry = await replyToFeedback(client, mail.service, { id: first.id, text: "Answer", replyId: name });
    expect(retry).toMatchObject({ ok: true, already: true, emailedTo: null, emailError: expect.stringContaining("not known") });
    expect(mail.sent).toHaveLength(0);
    // And the conversation is ticked off, as the first try never got to.
    expect(db.prepare("select handled from feedback").get()).toEqual({ handled: 1 });
  });

  it("does not show one phone's answers to another", async () => {
    const { client } = sqliteClient();
    const mine = await send(client, { message: "Mine", key: KEY }, "2026-10-15T08:00:00.000Z");
    await send(client, { message: "Theirs", key: OTHER_KEY }, "2026-10-15T08:01:00.000Z");
    await replyToFeedback(client, undefined, { id: mine.id, text: "For you" }, Date.parse("2026-10-15T09:00:00.000Z"));
    expect((await thread(client, OTHER_KEY)).map((m) => m.text)).toEqual(["Theirs"]);
  });

  it("emails it too when the parent left an address, to the latest one", async () => {
    const { client } = sqliteClient();
    const first = await send(client, { message: "Hi there", contact: "old@example.com", key: KEY }, "2026-10-15T08:00:00.000Z");
    await send(client, { message: "New address", contact: " New@Example.com ", key: KEY }, "2026-10-15T08:10:00.000Z");
    await send(client, { message: "No address this time", key: KEY }, "2026-10-15T08:20:00.000Z");
    const mail = mailbox();

    const result = await replyToFeedback(client, mail.service, { id: first.id, text: "Fixed <b>now</b>", email: true });
    expect(result).toMatchObject({ ok: true, inApp: true, emailedTo: "new@example.com" });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("new@example.com");
    expect(mail.sent[0].text).toContain("Fixed <b>now</b>");
    expect(mail.sent[0].html).toContain("Fixed &lt;b&gt;now&lt;/b&gt;");
  });

  it("leaves email out when told to", async () => {
    const { client } = sqliteClient();
    const first = await send(client, { message: "Hi there", contact: "me@example.com", key: KEY }, "2026-10-15T08:00:00.000Z");
    const mail = mailbox();
    const result = await replyToFeedback(client, mail.service, { id: first.id, text: "Answer", email: false });
    expect(result).toMatchObject({ ok: true, emailedTo: null });
    expect(mail.sent).toHaveLength(0);
  });

  it("keeps the answer in the app when the email fails, and says so", async () => {
    const { client } = sqliteClient();
    const first = await send(client, { message: "Hi there", contact: "me@example.com", key: KEY }, "2026-10-15T08:00:00.000Z");
    const result = await replyToFeedback(client, mailbox(true).service, { id: first.id, text: "Answer" });
    expect(result).toMatchObject({ ok: true, inApp: true, emailedTo: null, emailError: "mail service down" });
    expect((await thread(client, KEY)).at(-1)).toMatchObject({ from: "dev", text: "Answer" });
  });

  it("answers an older app's message by email only", async () => {
    const { client, db } = sqliteClient();
    const old = await send(client, { message: "Old build", contact: "me@example.com" }, "2026-10-15T08:00:00.000Z");
    const mail = mailbox();
    const result = await replyToFeedback(client, mail.service, { id: old.id, text: "Answer" });
    expect(result).toMatchObject({ ok: true, inApp: false, emailedTo: "me@example.com" });
    expect(db.prepare("select handled from feedback").get()).toEqual({ handled: 1 });
  });

  it("stores nothing when an older app's message cannot be reached", async () => {
    const { client, db } = sqliteClient();
    const silent = await send(client, { message: "No way back" }, "2026-10-15T08:00:00.000Z");
    expect(await replyToFeedback(client, mailbox().service, { id: silent.id, text: "Answer" }))
      .toHaveProperty("error");

    const typo = await send(client, { message: "Bad address", contact: "not an email" }, "2026-10-15T08:01:00.000Z");
    expect(await replyToFeedback(client, mailbox().service, { id: typo.id, text: "Answer" }))
      .toHaveProperty("error");

    // Email failing for a message with nowhere else to go is a failure, not a
    // reply that silently went nowhere.
    const failing = await send(client, { message: "Mail down", contact: "me@example.com" }, "2026-10-15T08:02:00.000Z");
    expect(await replyToFeedback(client, mailbox(true).service, { id: failing.id, text: "Answer" }))
      .toHaveProperty("error");

    expect(db.prepare("select count(*) as n from feedback_replies").get()).toEqual({ n: 0 });
  });

  it("refuses an empty answer, and one to a message that is not there", async () => {
    const { client } = sqliteClient();
    const first = await send(client, { message: "Hi there", key: KEY }, "2026-10-15T08:00:00.000Z");
    expect(await replyToFeedback(client, undefined, { id: first.id, text: "   " })).toHaveProperty("error");
    expect(await replyToFeedback(client, undefined, { id: "nope", text: "Answer" })).toHaveProperty("error");
  });
});

describe("ticking a conversation off", () => {
  it("ticks that phone's messages up to the one ticked, and only those", async () => {
    const { client, db } = sqliteClient();
    await send(client, { message: "One", key: KEY }, "2026-10-15T08:00:00.000Z");
    const two = await send(client, { message: "Two", key: KEY }, "2026-10-15T08:01:00.000Z");
    await send(client, { message: "Someone else", key: OTHER_KEY }, "2026-10-15T08:02:00.000Z");
    const legacy = await send(client, { message: "Old app" }, "2026-10-15T08:03:00.000Z");
    // Arrived after the dashboard showed Two as the newest.
    await send(client, { message: "Three", key: KEY }, "2026-10-15T08:04:00.000Z");

    await markFeedback(client, two.id, true);
    expect(db.prepare("select message from feedback where handled = 1 order by created_at").all())
      .toEqual([{ message: "One" }, { message: "Two" }]);

    // Un-ticking reopens the whole conversation.
    await markFeedback(client, legacy.id, true);
    await markFeedback(client, two.id, false);
    expect(db.prepare("select message from feedback where handled = 1").all()).toEqual([{ message: "Old app" }]);
  });
});

describe("reading a conversation", () => {
  // The newest two hundred are read by walking the index, not by sorting
  // every message a key has ever sent — the endpoint needs no account.
  it("stops at the newest two hundred without sorting all of them", async () => {
    const { client, db } = sqliteClient();
    await ensureFeedbackTables(client);
    for (const table of ["feedback", "feedback_replies"]) {
      const plan = db.prepare(`explain query plan select id from ${table} where reader = ? order by created_at desc limit 200`)
        .all("x").map((row) => String((row as { detail: string }).detail)).join(" | ");
      expect(plan).toContain("_by_reader");
      expect(plan).not.toContain("TEMP B-TREE");
    }
  });
});

describe("the dashboard's messages", () => {
  // The form asks for an address once, so it is often on a message far older
  // than the two hundred the dashboard shows — and it is looked up after the
  // limit, once per phone, not for every message ever stored.
  it("carries each phone's address from anywhere in the conversation", async () => {
    const { client } = sqliteClient();
    await send(client, { message: "First, with my address", contact: "mum@example.com", key: KEY }, "2026-10-01T08:00:00.000Z");
    for (let i = 0; i < 3; i++) {
      await send(client, { message: `Later message ${i}`, key: KEY }, `2026-10-1${i}T08:00:00.000Z`);
    }
    await send(client, { message: "No address here", key: OTHER_KEY }, "2026-10-14T08:00:00.000Z");
    await send(client, { message: "Old app", contact: "dad@example.com" }, "2026-10-14T09:00:00.000Z");

    const stats = await collectStats(client, Date.parse("2026-10-15T10:00:00.000Z"));
    const rows = stats.feedback as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.message)).toEqual([
      "Old app", "No address here", "Later message 2", "Later message 1", "Later message 0", "First, with my address",
    ]);
    expect(rows.find((r) => r.message === "Later message 2")).toMatchObject({ thread_contact: "mum@example.com", contact: null });
    expect(rows.find((r) => r.message === "No address here")).toMatchObject({ thread_contact: null });
    expect(rows.find((r) => r.message === "Old app")).toMatchObject({ thread: null, contact: "dad@example.com" });
  });

  it("finds that address through the messages that carry one", async () => {
    const { client, db } = sqliteClient();
    await ensureFeedbackTables(client);
    const plan = db.prepare(`explain query plan select contact from feedback
        where reader = ? and contact is not null and contact like '%_@_%._%' order by created_at desc limit 1`)
      .all("x").map((row) => String((row as { detail: string }).detail)).join(" | ");
    expect(plan).toContain("feedback_contact_by_reader");
  });
});

describe("the per-address limit", () => {
  // Kept in memory, never in the database: a stored address beside the time
  // a message arrived would join the message to a family through the other
  // budgets that hold the same address.
  it("lets an hour's allowance through, then refuses until the next hour", () => {
    const limiter = makeLimiter();
    const at = Date.parse("2026-10-15T10:05:00.000Z");
    for (let i = 0; i < 3; i++) expect(limiter.allow("write:203.0.113.5", 3, at)).toBe(true);
    expect(limiter.allow("write:203.0.113.5", 3, at)).toBe(false);
    expect(limiter.allow("write:198.51.100.7", 3, at)).toBe(true);
    expect(limiter.allow("write:203.0.113.5", 3, at + 3_600_000)).toBe(true);
  });

  it("keeps a bounded number of addresses", () => {
    const limiter = makeLimiter(2);
    const at = Date.now();
    limiter.allow("a", 1, at);
    limiter.allow("b", 1, at);
    limiter.allow("c", 1, at);
    // "a" was forgotten to make room, so it starts again.
    expect(limiter.allow("a", 1, at)).toBe(true);
  });
});

describe("a database from before replies", () => {
  it("gains the column and keeps every old message", async () => {
    const { client, db } = sqliteClient();
    db.exec(`CREATE TABLE feedback (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      message TEXT NOT NULL, contact TEXT, app_version TEXT, handled INTEGER NOT NULL DEFAULT 0)`);
    db.exec("INSERT INTO feedback (id, message) VALUES ('old', 'Before replies')");

    await ensureFeedbackTables(client);
    expect(db.prepare("select id, message, reader from feedback").all())
      .toEqual([{ id: "old", message: "Before replies", reader: null }]);
    // And a second isolate running the same migration is harmless.
    resetFeedbackTablesForTest();
    await ensureFeedbackTables(client);
  });
});

describe("the reply email", () => {
  it("carries the answer and what they wrote, with neither able to become markup", () => {
    const mail = replyEmail("Yes <script>alert(1)</script>\nSecond line", 'I wrote "<img src=x onerror=alert(1)>"', true);
    expect(mail.html).not.toMatch(/<script|<img src=x/);
    expect(mail.html).toContain("Yes &lt;script&gt;");
    expect(mail.html).toContain("<br>Second line");
    expect(mail.text).toContain("> I wrote");
  });

  // A link cannot reach the conversation: on an iPhone it opens Safari, whose
  // storage is not the home-screen app's, and older installs live on another
  // address. So the email says where to look, and links nowhere.
  it("sends the parent to the app they wrote from, not to a link", () => {
    const mail = replyEmail("Answer", "Question", true);
    expect(mail.html).not.toContain("#messages");
    expect(mail.text).not.toContain("http");
    expect(mail.text).toContain("open Numalog on the phone you wrote from and tap the speech bubble");
  });

  it("does not promise an older app's parent a conversation it cannot show", () => {
    const mail = replyEmail("Answer", "Question", false);
    expect(mail.text).not.toContain("conversation is in the app");
    expect(mail.text).toContain("To answer, open Numalog and tap the speech bubble");
  });
});
