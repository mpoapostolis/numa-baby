// Magic-link recovery — the door for every family without a Google account.
//
// Same shape as the Google door (googleRecovery.ts), different proof: there
// the credential is Google vouching for an address; here the proof is that
// the person can read the address's inbox. We mail a link carrying a
// one-time token; tapping it within fifteen minutes is the signature.
//
// The vows, shared with the admin door's design:
//  - the token is 128 bits and only its SHA-256 lives in the database, so a
//    database leak mints nothing;
//  - single use, fifteen-minute expiry, and the budget is spent BEFORE the
//    outcome is known (three sends per address per hour, atomically), so
//    neither the inbox nor the table can be farmed;
//  - the reply to "send me a link" is the same whether the address guards a
//    family or not — an enumeration attempt learns nothing. The email
//    itself tells the truth instead: a guarded address gets the link, an
//    unknown one gets "no log is protected by this address", which is
//    useful to the real owner and invisible to the attacker.

import { Client } from "@libsql/client";

const TOKEN_TTL_MS = 15 * 60_000;
const SENDS_PER_HOUR = 3;

type SendEmail = {
  send: (message: {
    to: string;
    from: { email: string; name: string };
    subject: string;
    text: string;
    html?: string;
  }) => Promise<unknown>;
};

type JsonResponder = (data: unknown, status?: number) => Response;

let ready = false;
async function ensureTables(client: Client) {
  if (ready) return;
  await client.batch(
    [
      // Which address guards which family. Bound via a link the same way it
      // is redeemed — proof of inbox both times.
      `CREATE TABLE IF NOT EXISTS recovery_emails (
         email TEXT PRIMARY KEY,
         family_id TEXT NOT NULL REFERENCES families(id),
         created_at TEXT NOT NULL
       )`,
      // Outstanding links. token_hash only; purpose is "link" (bind a family
      // from a signed-in device) or "recover" (mint a device from nothing).
      `CREATE TABLE IF NOT EXISTS magic_tokens (
         token_hash TEXT PRIMARY KEY,
         email TEXT NOT NULL,
         family_id TEXT,
         purpose TEXT NOT NULL,
         expires_at TEXT NOT NULL,
         used_at TEXT
       )`,
      `CREATE TABLE IF NOT EXISTS magic_budget (
         email TEXT PRIMARY KEY,
         window_start TEXT NOT NULL,
         sends INTEGER NOT NULL
       )`,
    ],
    "write",
  );
  ready = true;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalise(raw: unknown): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/** Spend one send from the address's hourly budget; false means exhausted. */
async function reserveSend(client: Client, email: string, now: number): Promise<boolean> {
  const windowStart = new Date(now - 3600_000).toISOString();
  const result = await client.execute({
    sql: `INSERT INTO magic_budget (email, window_start, sends) VALUES (?, ?, 1)
          ON CONFLICT(email) DO UPDATE SET
            sends = CASE WHEN magic_budget.window_start < ? THEN 1 ELSE magic_budget.sends + 1 END,
            window_start = CASE WHEN magic_budget.window_start < ? THEN excluded.window_start ELSE magic_budget.window_start END
          RETURNING sends`,
    args: [email, new Date(now).toISOString(), windowStart, windowStart],
  });
  return Number(result.rows[0]?.sends ?? SENDS_PER_HOUR + 1) <= SENDS_PER_HOUR;
}

function linkEmail(origin: string, token: string, guarded: boolean): { subject: string; text: string; html: string } {
  if (!guarded) {
    return {
      subject: "Numalog — no log is protected by this address",
      text:
        "Someone (probably you) asked to recover a Numalog baby log with this email address, " +
        "but no log is protected by it. If you set up protection with a different address, try that one. " +
        "If this wasn't you, you can ignore this email — nothing happened.",
      html: "",
    };
  }
  const url = `${origin}/#recover=${token}`;
  const text =
    "Tap this link on the phone that should hold your baby's log:\n\n" +
    `${url}\n\n` +
    "It works once and expires in 15 minutes. If you didn't ask for it, ignore this email — nothing happens without the link.";
  return {
    subject: "Your Numalog recovery link",
    text,
    html:
      `<p>Tap this link on the phone that should hold your baby’s log:</p>` +
      `<p><a href="${url}"><strong>Restore my Numalog</strong></a></p>` +
      `<p>It works once and expires in 15 minutes. If you didn’t ask for it, ignore this email — nothing happens without the link.</p>`,
  };
}

/**
 * POST /api/family/email-link (authenticated): bind the caller's family to an
 * address — by mailing a link whose tap completes the binding, proving the
 * inbox is really theirs before the guard exists.
 */
export async function handleEmailLink(
  client: Client,
  request: Request,
  familyId: string,
  email_service: SendEmail | undefined,
  origin: string,
  json: JsonResponder,
): Promise<Response> {
  if (!email_service) return json({ error: "Email recovery is not configured." }, 501);
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = normalise(body.email);
  if (!email) return json({ error: "That doesn't look like an email address." }, 400);
  await ensureTables(client);
  const now = Date.now();
  if (!(await reserveSend(client, email, now))) {
    return json({ error: "Too many emails to that address just now — try again in an hour." }, 429);
  }
  const token = newToken();
  await client.execute({
    sql: `INSERT INTO magic_tokens (token_hash, email, family_id, purpose, expires_at) VALUES (?, ?, ?, 'link', ?)`,
    args: [await sha256(token), email, familyId, new Date(now + TOKEN_TTL_MS).toISOString()],
  });
  const url = `${origin}/#confirm-email=${token}`;
  await email_service.send({
    to: email,
    from: { email: "hello@numalog.app", name: "Numalog" },
    subject: "Confirm your Numalog recovery email",
    text:
      "Tap to confirm this address can recover your baby's log:\n\n" +
      `${url}\n\n` +
      "It works once and expires in 15 minutes. If you didn't ask for this, ignore it — nothing happens without the link.",
  });
  return json({ sent: true });
}

/**
 * POST /api/family/email-recover-request (no auth): mail a recovery link if
 * the address guards a family. The HTTP answer never says which.
 */
export async function handleEmailRecoverRequest(
  client: Client,
  request: Request,
  email_service: SendEmail | undefined,
  origin: string,
  json: JsonResponder,
): Promise<Response> {
  if (!email_service) return json({ error: "Email recovery is not configured." }, 501);
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = normalise(body.email);
  if (!email) return json({ error: "That doesn't look like an email address." }, 400);
  await ensureTables(client);
  const now = Date.now();
  if (!(await reserveSend(client, email, now))) return json({ sent: true });
  const guard = await client.execute({
    sql: "SELECT family_id FROM recovery_emails WHERE email = ?",
    args: [email],
  });
  const guarded = guard.rows.length > 0;
  let token = "";
  if (guarded) {
    token = newToken();
    await client.execute({
      sql: `INSERT INTO magic_tokens (token_hash, email, family_id, purpose, expires_at) VALUES (?, ?, ?, 'recover', ?)`,
      args: [await sha256(token), email, String(guard.rows[0].family_id), new Date(now + TOKEN_TTL_MS).toISOString()],
    });
  }
  const message = linkEmail(origin, token, guarded);
  await email_service.send({
    to: email,
    from: { email: "hello@numalog.app", name: "Numalog" },
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  });
  return json({ sent: true });
}

/**
 * POST /api/family/email-redeem (no auth): the tap. A 'link' token completes
 * the binding; a 'recover' token also mints a device into the family.
 */
export async function handleEmailRedeem(
  client: Client,
  request: Request,
  json: JsonResponder,
  mintDevice: (familyId: string, deviceLabel: string) => Promise<{ familyId: string; token: string; deviceId: string }>,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; deviceLabel?: unknown };
  const raw = String(body.token ?? "");
  if (!/^[0-9a-f]{32}$/.test(raw)) return json({ error: "That link is not valid." }, 400);
  await ensureTables(client);
  const now = new Date().toISOString();
  // Housekeeping rides the redeem: expired or day-old-used rows are dead
  // hashes sitting next to email addresses, and dead PII is still PII.
  await client
    .execute({
      sql: "DELETE FROM magic_tokens WHERE expires_at < ? OR used_at < ?",
      args: [now, new Date(Date.now() - 24 * 3600_000).toISOString()],
    })
    .catch(() => undefined);
  // Claiming atomically: the row is marked used in the same statement that
  // reads it, so two taps of one link cannot both win.
  const claimed = await client.execute({
    sql: `UPDATE magic_tokens SET used_at = ?
          WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
          RETURNING email, family_id, purpose`,
    args: [now, await sha256(raw), now],
  });
  if (!claimed.rows.length) {
    return json({ error: "That link expired or was already used. Ask for a fresh one." }, 410);
  }
  const row = claimed.rows[0];
  const email = String(row.email);
  const familyId = row.family_id === null ? null : String(row.family_id);
  if (!familyId) return json({ error: "That link is not valid." }, 400);

  // Either purpose confirms the binding — a recover tap proves the inbox
  // just as well as a confirm tap does.
  await client.execute({
    sql: `INSERT INTO recovery_emails (email, family_id, created_at) VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET family_id = excluded.family_id, created_at = excluded.created_at`,
    args: [email, familyId, now],
  });
  if (String(row.purpose) === "link") return json({ confirmed: true, email });
  const minted = await mintDevice(familyId, typeof body.deviceLabel === "string" ? body.deviceLabel : "");
  return json({ ...minted, email });
}
