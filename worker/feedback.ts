/// <reference types="@cloudflare/workers-types" />
// "Need anything? Tell me." — the only channel a parent has to reach the
// author. Until this existed, someone whose app broke at 3am in Manila had
// no way to say so.
//
// Stored thin on purpose: the message, and a contact only if they offered
// one. No family id, no device id, nothing that joins a bug report to a
// baby's log — reporting a problem must not mean handing over a child's
// health record.

import { Client } from "@libsql/client/web";

const MAX_MESSAGE = 2_000;
const MAX_CONTACT = 200;

// The table is created on first use rather than requiring a manual migration
// before the feature works. CREATE TABLE IF NOT EXISTS is idempotent, and the
// flag keeps it to one statement per isolate rather than one per request.
let ensured = false;

async function ensureTable(client: Client) {
  if (ensured) return;
  await client.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      message TEXT NOT NULL,
      contact TEXT,
      app_version TEXT,
      handled INTEGER NOT NULL DEFAULT 0
    )
  `);
  ensured = true;
}

export async function handleFeedback(client: Client, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  const version = typeof body.appVersion === "string" ? body.appVersion.slice(0, 40) : null;

  if (message.length < 3) {
    return new Response(JSON.stringify({ error: "Write a little more." }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  await ensureTable(client);
  await client.execute({
    sql: "insert into feedback (id, message, contact, app_version) values (?, ?, ?, ?)",
    args: [
      crypto.randomUUID(),
      message.slice(0, MAX_MESSAGE),
      contact ? contact.slice(0, MAX_CONTACT) : null,
      version,
    ],
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
