/// <reference types="@cloudflare/workers-types" />
// Revoking access.
//
// Until this existed, "Leave family" was a local goodbye: the phone forgot the
// family, and the server went on accepting its token forever. For an app
// holding a named infant's feeding and health log, a lost phone meant
// permanent access with no way to take it back.
//
// Three ways out, in increasing severity:
//   leave        — this phone hands its own key back
//   revoke       — remove one other phone, chosen from the list
//   revokeOthers — the lost-phone button: every key except this one dies,
//                  and the others must be re-invited
//
// A token is stored only as a hash, so revocation deletes the row rather than
// marking it — there is nothing to keep.

import { Client } from "@libsql/client/web";

// device_tokens predates this feature and has no device_id. The column is
// added on first use; SQLite has no ADD COLUMN IF NOT EXISTS, so a duplicate
// is caught and treated as success.
let migrated = false;

export async function ensureDeviceLink(client: Client) {
  if (migrated) return;
  try {
    await client.execute("ALTER TABLE device_tokens ADD COLUMN device_id TEXT");
  } catch (error) {
    const message = String(error).toLowerCase();
    // Any other failure is real and must not be swallowed.
    if (!message.includes("duplicate column")) throw error;
  }
  migrated = true;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** The phone hands its own key back. Works for tokens minted before device_id existed. */
export async function handleLeave(
  client: Client,
  familyId: string,
  tokenHash: string,
): Promise<Response> {
  await client.execute({
    sql: "delete from device_tokens where token_hash = ? and family_id = ?",
    args: [tokenHash, familyId],
  });
  // The device row goes too, so the family's device count tells the truth.
  await client.execute({
    sql: "delete from devices where family_id = ? and id = (select device_id from device_tokens where token_hash = ?)",
    args: [familyId, tokenHash],
  }).catch(() => undefined);
  return json({ ok: true });
}

export async function handleListDevices(
  client: Client,
  familyId: string,
  tokenHash: string,
): Promise<Response> {
  await ensureDeviceLink(client);
  const [devices, mine] = await Promise.all([
    client.execute({
      sql: `select d.id, d.label, substr(d.joined_at, 1, 10) as joined,
                   substr(d.last_seen_at, 1, 16) as last_seen,
                   (select count(*) from device_tokens t where t.device_id = d.id) as revocable
            from devices d where d.family_id = ? order by d.joined_at`,
      args: [familyId],
    }),
    client.execute({
      sql: "select device_id from device_tokens where token_hash = ?",
      args: [tokenHash],
    }),
  ]);
  const thisDevice = mine.rows.length ? mine.rows[0].device_id : null;
  return json({
    devices: devices.rows.map((row) => ({ ...row, isThisDevice: row.id === thisDevice })),
  });
}

export async function handleRevokeDevice(
  client: Client,
  familyId: string,
  tokenHash: string,
  request: Request,
): Promise<Response> {
  await ensureDeviceLink(client);
  const body = (await request.json().catch(() => ({}))) as { deviceId?: unknown; all?: unknown };

  // The lost-phone button: everything except the key being used right now.
  if (body.all === true) {
    await client.execute({
      sql: "delete from device_tokens where family_id = ? and token_hash <> ?",
      args: [familyId, tokenHash],
    });
    await client.execute({
      sql: `delete from devices where family_id = ? and id not in
              (select device_id from device_tokens where family_id = ? and device_id is not null)`,
      args: [familyId, familyId],
    }).catch(() => undefined);
    return json({ ok: true, revoked: "others" });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (!deviceId) return json({ error: "Which device?" }, 400);

  // Scoped to the caller's family: a token can never revoke a stranger.
  const removed = await client.execute({
    sql: "delete from device_tokens where family_id = ? and device_id = ? and token_hash <> ?",
    args: [familyId, deviceId, tokenHash],
  });
  await client.execute({
    sql: "delete from devices where family_id = ? and id = ?",
    args: [familyId, deviceId],
  });
  return json({ ok: true, revoked: removed.rowsAffected });
}
