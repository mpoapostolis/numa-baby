// The two doors "Continue with Google" opens, and the one it must never.
//
// LINK (authenticated device): "this Google account now guards this family".
// RECOVER (no auth — the phone is gone, that is the point): a fresh, valid
// Google credential IS the authentication; if its account guards a family,
// the caller gets a new device key to it, exactly as if a partner had
// handed them an invite code.
//
// What is deliberately absent: any way to ASK which families exist, any
// lookup by email string alone (the credential's signature is required), and
// any data flowing toward Google — see googleAuth.ts.

import { Client } from "@libsql/client";
import { verifyGoogleCredential } from "./googleAuth";

type JsonResponder = (data: unknown, status?: number) => Response;

let tableReady = false;
async function ensureTable(client: Client) {
  if (tableReady) return;
  await client.execute(
    `CREATE TABLE IF NOT EXISTS recovery_identities (
       google_sub TEXT PRIMARY KEY,
       family_id TEXT NOT NULL REFERENCES families(id),
       email TEXT NOT NULL,
       created_at TEXT NOT NULL
     )`,
  );
  tableReady = true;
}

async function identityFrom(
  body: { credential?: unknown },
  clientId: string | undefined,
  json: JsonResponder,
): Promise<{ sub: string; email: string } | Response> {
  if (!clientId) return json({ error: "Google recovery is not configured." }, 501);
  if (typeof body.credential !== "string" || !body.credential) {
    return json({ error: "Missing the Google credential." }, 400);
  }
  let outcome: Awaited<ReturnType<typeof verifyGoogleCredential>>;
  try {
    outcome = await verifyGoogleCredential(body.credential, clientId);
  } catch {
    // Google unreachable is OUR problem, and must not read as "bad token".
    return json({ error: "Could not reach Google to check the sign-in. Try again in a minute." }, 502);
  }
  if (typeof outcome === "string") return json({ error: outcome }, 401);
  return outcome;
}

/** POST /api/family/google-link — bind the caller's family to this account. */
export async function handleGoogleLink(
  client: Client,
  request: Request,
  familyId: string,
  clientId: string | undefined,
  json: JsonResponder,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { credential?: unknown };
  const identity = await identityFrom(body, clientId, json);
  if (identity instanceof Response) return identity;
  await ensureTable(client);
  // The guard never moves silently — and the two registries are ONE lock:
  // an address that guards a family through the magic-link door must refuse
  // here exactly as a sub that guards one through this door. Otherwise a
  // second phone tapping "Protect" would quietly strip recovery from a log
  // that may have no other protection left.
  await client
    .execute(
      "CREATE TABLE IF NOT EXISTS recovery_emails (email TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), created_at TEXT NOT NULL)",
    )
    .catch(() => undefined);
  const existing = await client.execute({
    sql: `SELECT family_id FROM recovery_identities WHERE google_sub = ?
          UNION ALL
          SELECT family_id FROM recovery_emails WHERE email = ?`,
    args: [identity.sub, identity.email],
  });
  if (existing.rows.some((row) => String(row.family_id) !== familyId)) {
    return json({
      error:
        "This Google account already protects another log. To bring that log onto this phone, use Restore on a fresh phone or Join with a code — or remove its protection from the other device first.",
    }, 409);
  }
  // The upsert only lands when the binding stays on the SAME family, and the
  // read-back arbitrates: two concurrent links can both pass the check above,
  // but only one binding survives, and the loser hears the same 409.
  await client.execute({
    sql: `INSERT INTO recovery_identities (google_sub, family_id, email, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(google_sub) DO UPDATE SET
            email = excluded.email,
            created_at = excluded.created_at
          WHERE recovery_identities.family_id = excluded.family_id`,
    args: [identity.sub, familyId, identity.email, new Date().toISOString()],
  });
  const settled = await client.execute({
    sql: "SELECT family_id FROM recovery_identities WHERE google_sub = ?",
    args: [identity.sub],
  });
  if (!settled.rows.length || String(settled.rows[0].family_id) !== familyId) {
    return json({
      error:
        "This Google account already protects another log. To bring that log onto this phone, use Restore on a fresh phone or Join with a code — or remove its protection from the other device first.",
    }, 409);
  }
  return json({ email: identity.email });
}

/** POST /api/family/google-unlink — remove every guard from this family. */
export async function handleGoogleUnlink(
  client: Client,
  familyId: string,
  json: JsonResponder,
): Promise<Response> {
  await ensureTable(client);
  // Both doors: "Remove" means no address of any kind can reach this family.
  await client.batch(
    [
      { sql: "DELETE FROM recovery_identities WHERE family_id = ?", args: [familyId] },
      { sql: "CREATE TABLE IF NOT EXISTS recovery_emails (email TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), created_at TEXT NOT NULL)" },
      { sql: "DELETE FROM recovery_emails WHERE family_id = ?", args: [familyId] },
    ],
    "write",
  );
  return json({ ok: true });
}

/** GET /api/family/recovery-status — which address guards this family, if any. */
export async function handleRecoveryStatus(
  client: Client,
  familyId: string,
  json: JsonResponder,
): Promise<Response> {
  await ensureTable(client);
  await client.execute(
    "CREATE TABLE IF NOT EXISTS recovery_emails (email TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), created_at TEXT NOT NULL)",
  );
  const rows = await client.execute({
    sql: `SELECT email, created_at FROM recovery_identities WHERE family_id = ?
          UNION ALL
          SELECT email, created_at FROM recovery_emails WHERE family_id = ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [familyId, familyId],
  });
  return json({ email: rows.rows.length ? String(rows.rows[0].email) : null });
}

/**
 * POST /api/family/google-recover — the disaster door. No bearer token: the
 * verified credential is the key. Mints a device exactly like an invite join.
 */
export async function handleGoogleRecover(
  client: Client,
  request: Request,
  clientId: string | undefined,
  json: JsonResponder,
  mintDevice: (familyId: string, deviceLabel: string) => Promise<{ familyId: string; token: string; deviceId: string }>,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    credential?: unknown;
    deviceLabel?: unknown;
    /** true = answer "does this account guard anything?" without minting —
        the UI asks BEFORE showing the merge-or-adopt dialog, so nobody is
        made to choose over a log that doesn't exist. */
    probe?: unknown;
  };
  const identity = await identityFrom(body, clientId, json);
  if (identity instanceof Response) return identity;
  await ensureTable(client);
  // The sub is the primary key; the verified address is the shared lock —
  // a family guarded by this email through the OTHER door opens here too.
  await client
    .execute(
      "CREATE TABLE IF NOT EXISTS recovery_emails (email TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), created_at TEXT NOT NULL)",
    )
    .catch(() => undefined);
  const rows = await client.execute({
    sql: `SELECT family_id, created_at FROM recovery_identities WHERE google_sub = ?
          UNION ALL
          SELECT family_id, created_at FROM recovery_emails WHERE email = ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [identity.sub, identity.email],
  });
  if (body.probe === true) return json({ guarded: rows.rows.length > 0 });
  if (!rows.rows.length) {
    return json({ error: "No log is protected by this Google account. If you used a different address, sign in with that one." }, 404);
  }
  const minted = await mintDevice(
    String(rows.rows[0].family_id),
    typeof body.deviceLabel === "string" ? body.deviceLabel : "",
  );
  return json(minted);
}
