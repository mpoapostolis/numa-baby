/// <reference types="@cloudflare/workers-types" />
import { createClient } from "@libsql/client/web";
import { handleAdmin } from "./admin";
import { refreshStats } from "./adminStats";
import { budgetKey } from "./budgetKey";
import { handleFeedback } from "./feedback";
import {
  handleEmailLink,
  handleEmailRecoverRequest,
  handleEmailRedeem,
} from "./magicLink";
import {
  handleGoogleLink,
  handleGoogleRecover,
  handleGoogleUnlink,
  handleRecoveryStatus,
} from "./googleRecovery";
import {
  ensureDeviceLink,
  handleLeave,
  handleListDevices,
  handleRevokeDevice,
} from "./devices";

// Family Sync API — the doorman between the PWA and the Turso database.
// Same origin as the static app: /api/* is handled here, everything else
// falls through to the assets binding (SPA fallback included).
//
// Auth model: one bearer token per family, minted at create/join, stored
// only as a SHA-256 hash server-side. Invite codes are 6 digits, single
// use, and expire in 15 minutes.

type Env = {
  ASSETS: Fetcher;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  /** Operator password for /admin. Unset means the page does not exist. */
  ADMIN_PASSWORD?: string;
  /** Public OAuth client id. Unset means Google recovery does not exist. */
  GOOGLE_CLIENT_ID?: string;
  /** Email Sending binding. Unset means magic-link recovery does not exist. */
  EMAIL?: {
    send: (message: {
      to: string;
      from: { email: string; name: string };
      subject: string;
      text: string;
      html?: string;
    }) => Promise<unknown>;
  };
  /** Optional second factor. Set it and the password alone will not get in. */
  ADMIN_TOTP_SECRET?: string;
  /** Optional comma-separated allowlist. Set it and every other address is
      told /admin does not exist. */
  ADMIN_ALLOW_IPS?: string;
};

const INVITE_TTL_MS = 15 * 60 * 1000;
const MAX_PUSH_BATCH = 500;
const MAX_PAYLOAD_BYTES = 8_192;
// Generous on purpose: whole carriers share one IP behind mobile NAT, and a
// real family must never be locked out by a stranger's typos — while thirty
// tries against a million codes stays a lottery ticket.
const JOIN_TRIES_PER_HOUR = 30;
// Wrong codes across the WHOLE door per hour. A family mistypes a handful;
// six hundred is a loop — and a loop with a thousand addresses used to have
// a thousand budgets.
const JOIN_FAILURES_PER_HOUR = 600;
// New families per address per hour. Creating one is free, so it is bounded:
// a family is a bearer token, and a bearer token is a way to put questions
// to the authenticated endpoints.
const CREATES_PER_HOUR = 60;
// Mirrors FUTURE_TOLERANCE_MS in src/domain/validate.ts: a write stamp this
// far past the server's clock is a broken clock, not a newer write.
const FUTURE_TOLERANCE_MS = 48 * 60 * 60 * 1000;
const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// activities predates received_at. Rows carry two clocks on purpose:
// updated_at is the CLIENT's stamp and decides LWW conflicts; received_at is
// the SERVER's stamp and decides what a pull has already seen. Filtering
// pulls by the client stamp was the second half of the lost-restore bug: a
// merged backup pushes rows whose updated_at sits months in the past, so
// every partner's cursor had already sailed past them — pushed, stored, and
// never delivered. SQLite has no ADD COLUMN IF NOT EXISTS; the duplicate is
// caught and treated as success. Old rows backfill to NOW, not to their
// client stamp: every device re-pulls its family's log exactly once (the
// merge is idempotent, so this costs a few reads and loses nothing), which
// closes any hole a pre-migration restore had already punched.
let receivedAtReady = false;
async function ensureReceivedAt(client: ReturnType<typeof createClient>) {
  if (receivedAtReady) return;
  try {
    await client.execute("ALTER TABLE activities ADD COLUMN received_at TEXT");
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
  // The one-time NULL backfill ran on 30 Aug 2026 and every row written
  // since is stamped at insert — the UPDATE that used to sit here scanned
  // the whole table again on EVERY isolate cold start, which on Workers
  // means constantly. Catalog-only statements below are the cheap kind.
  //
  // Pulls filter on received_at; this index makes an empty poll cost an
  // index probe instead of the family's whole log. The devices index kills
  // the other per-pull scan (the device-count).
  await client
    .execute("CREATE INDEX IF NOT EXISTS idx_activities_family_received ON activities(family_id, received_at)")
    .catch(() => undefined);
  // Pull pages are ordered by (received_at, id); this is that order.
  await client
    .execute("CREATE INDEX IF NOT EXISTS idx_activities_family_received_id ON activities(family_id, received_at, id)")
    .catch(() => undefined);
  await client
    .execute("CREATE INDEX IF NOT EXISTS idx_devices_family ON devices(family_id)")
    .catch(() => undefined);
  receivedAtReady = true;
}

function db(env: Env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      // public/_headers covers only what the asset layer serves; the API's
      // own answers carry their own belt and braces.
      "x-content-type-options": "nosniff",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    },
  });
}

function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function inviteCode(): string {
  // 6 digits, rejection-sampled for a uniform distribution.
  const buf = new Uint32Array(1);
  let n = 0;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= 4_000_000_000);
  return String(n % 1_000_000).padStart(6, "0");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Caller = { familyId: string; tokenHash: string };

async function authFamily(env: Env, request: Request): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const hash = await sha256(token);
  const result = await db(env).execute({
    sql: "SELECT family_id FROM device_tokens WHERE token_hash = ?",
    args: [hash],
  });
  return result.rows.length
    ? { familyId: String(result.rows[0].family_id), tokenHash: hash }
    : null;
}

// How stale last_seen_at may be before a request bothers to refresh it. It is
// only ever read at minute and day granularity (the device list, the
// dashboard), yet every 60-second poll used to write it unconditionally —
// a write transaction to the primary per phone per minute, six times the
// real entry writes of a newborn family.
const TOUCH_INTERVAL_MS = 10 * 60_000;

async function touchDevice(env: Env, familyId: string, deviceId: string | undefined) {
  if (!deviceId) return;
  const now = new Date();
  await db(env).execute({
    sql: "UPDATE devices SET last_seen_at = ? WHERE id = ? AND family_id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)",
    args: [now.toISOString(), deviceId, familyId, new Date(now.getTime() - TOUCH_INTERVAL_MS).toISOString()],
  }).catch(() => undefined);
}

async function handleCreateFamily(env: Env, request: Request): Promise<Response> {
  const ip = budgetKey(request.headers.get("cf-connecting-ip") ?? "unknown");
  if (!(await spendBudget(db(env), `create:${ip}`, CREATES_PER_HOUR))) {
    return bad("Too many new families from this connection — wait a while and try again.", 429);
  }
  await ensureDeviceLink(db(env));
  const body = (await request.json().catch(() => ({}))) as { deviceLabel?: string };
  const familyId = crypto.randomUUID();
  const token = randomToken();
  const deviceId = crypto.randomUUID();
  const tokenHash = await sha256(token);
  const client = db(env);
  await client.batch(
    [
      {
        sql: "INSERT INTO families (id, token_hash) VALUES (?, ?)",
        args: [familyId, tokenHash],
      },
      // Every device carries its own token: losing one phone never forces
      // the other to re-pair — and the device_id is what makes revoking just
      // that one possible.
      {
        sql: "INSERT INTO device_tokens (family_id, token_hash, device_id) VALUES (?, ?, ?)",
        args: [familyId, tokenHash, deviceId],
      },
      {
        sql: "INSERT INTO devices (id, family_id, label) VALUES (?, ?, ?)",
        args: [deviceId, familyId, String(body.deviceLabel ?? "").slice(0, 60)],
      },
    ],
    "write",
  );
  return json({ familyId, token, deviceId });
}

// One place mints device keys, however the person proved themselves — an
// invite code from a partner's phone, or a Google credential after a
// disaster. Divergence here is how one door gets weaker than the other.
async function mintDevice(env: Env, familyId: string, deviceLabel: string) {
  const client = db(env);
  await ensureDeviceLink(client);
  const token = randomToken();
  const deviceId = crypto.randomUUID();
  await client.batch(
    [
      {
        sql: "INSERT INTO device_tokens (family_id, token_hash, device_id) VALUES (?, ?, ?)",
        args: [familyId, await sha256(token), deviceId],
      },
      {
        sql: "INSERT INTO devices (id, family_id, label) VALUES (?, ?, ?)",
        args: [deviceId, familyId, deviceLabel.slice(0, 60)],
      },
    ],
    "write",
  );
  return { familyId, token, deviceId };
}

async function handleInvite(env: Env, familyId: string): Promise<Response> {
  const code = inviteCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const client = db(env);
  // One live invite per family: newer replaces older.
  await client.batch(
    [
      { sql: "DELETE FROM invites WHERE family_id = ?", args: [familyId] },
      {
        sql: "INSERT INTO invites (code, family_id, expires_at) VALUES (?, ?, ?)",
        args: [code, familyId, expiresAt],
      },
    ],
    "write",
  );
  return json({ code, expiresAt });
}

let budgetTableReady = false;
async function ensureBudgetTable(client: ReturnType<typeof db>) {
  if (budgetTableReady) return;
  await client
    .execute(
      "CREATE TABLE IF NOT EXISTS join_budget (ip TEXT PRIMARY KEY, window_start TEXT NOT NULL, tries INTEGER NOT NULL)",
    )
    .catch(() => undefined);
  budgetTableReady = true;
}

// Six digits is a million codes and a 15-minute window — safe against a
// human, farmable by a loop. An hourly budget per key is a family mistyping
// freely and a brute force getting nowhere. The budget is spent BEFORE the
// answer is known, in one atomic statement, so a thousand simultaneous
// guesses draw a thousand different numbers. Rows past their window are
// swept in the same batch: the table lists who is knocking now, not everyone
// who ever did.
async function spendBudget(client: ReturnType<typeof db>, key: string, max: number): Promise<boolean> {
  await ensureBudgetTable(client);
  const windowStart = new Date(Date.now() - 3600_000).toISOString();
  const [, result] = await client.batch(
    [
      { sql: "DELETE FROM join_budget WHERE window_start < ? AND ip <> 'global'", args: [windowStart] },
      {
        sql: `INSERT INTO join_budget (ip, window_start, tries) VALUES (?, ?, 1)
              ON CONFLICT(ip) DO UPDATE SET
                tries = CASE WHEN join_budget.window_start < ? THEN 1 ELSE join_budget.tries + 1 END,
                window_start = CASE WHEN join_budget.window_start < ? THEN excluded.window_start ELSE join_budget.window_start END
              RETURNING tries`,
        args: [key, new Date().toISOString(), windowStart, windowStart],
      },
    ],
    "write",
  );
  return Number(result.rows[0]?.tries ?? max + 1) <= max;
}

/** Has the whole door seen too many WRONG codes this hour? Read-only: a
    right code must never count against anyone, and a family's own retries
    are budgeted per address above. */
async function joinDoorOpen(client: ReturnType<typeof db>): Promise<boolean> {
  await ensureBudgetTable(client);
  const windowStart = new Date(Date.now() - 3600_000).toISOString();
  const found = await client.execute({ sql: "SELECT tries, window_start FROM join_budget WHERE ip = 'global'", args: [] });
  if (!found.rows.length) return true;
  const row = found.rows[0];
  return String(row.window_start) < windowStart || Number(row.tries) < JOIN_FAILURES_PER_HOUR;
}

function noteWrongCode(client: ReturnType<typeof db>): Promise<unknown> {
  return spendBudget(client, "global", JOIN_FAILURES_PER_HOUR).catch(() => undefined);
}

async function handleJoin(env: Env, request: Request): Promise<Response> {
  await ensureDeviceLink(db(env));
  const body = (await request.json().catch(() => ({}))) as { code?: string; deviceLabel?: string };
  const code = String(body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) return bad("Enter the 6-digit code from the other phone.");
  const client = db(env);
  const ip = budgetKey(request.headers.get("cf-connecting-ip") ?? "unknown");
  if (!(await spendBudget(client, ip, JOIN_TRIES_PER_HOUR))) {
    return bad("Too many attempts from this connection — wait a while and try again.", 429);
  }
  if (!(await joinDoorOpen(client))) {
    return bad("Pairing is busy right now — wait a little while and try again.", 429);
  }
  const found = await client.execute({
    sql: "SELECT family_id, expires_at, used_at FROM invites WHERE code = ?",
    args: [code],
  });
  if (!found.rows.length) {
    await noteWrongCode(client);
    return bad("That code isn't valid. Ask for a fresh one.", 404);
  }
  const row = found.rows[0];
  if (row.used_at) {
    await noteWrongCode(client);
    return bad("That code was already used. Ask for a fresh one.", 409);
  }
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    await noteWrongCode(client);
    return bad("That code expired. Ask for a fresh one.", 410);
  }
  const familyId = String(row.family_id);
  const token = randomToken();
  const deviceId = crypto.randomUUID();
  await client.batch(
    [
      { sql: "UPDATE invites SET used_at = ? WHERE code = ?", args: [new Date().toISOString(), code] },
      {
        sql: "INSERT INTO device_tokens (family_id, token_hash, device_id) VALUES (?, ?, ?)",
        args: [familyId, await sha256(token), deviceId],
      },
      {
        sql: "INSERT INTO devices (id, family_id, label) VALUES (?, ?, ?)",
        args: [deviceId, familyId, String(body.deviceLabel ?? "").slice(0, 60)],
      },
    ],
    "write",
  );
  return json({ familyId, token, deviceId });
}

async function handlePull(env: Env, request: Request, familyId: string, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const since = url.searchParams.get("since") ?? "";
  // The second half of the page cursor: the id of the last row the client
  // already holds at exactly `since`. Arrival stamps tie — every row the
  // one-time backfill touched carries the same one — and a page ordered by
  // stamp alone re-served the first 2000 of them for ever. A client that
  // predates the parameter simply never sends it.
  const after = url.searchParams.get("after") ?? "";
  const deviceId = url.searchParams.get("device") ?? undefined;
  // The device count is decoration for the Settings card, not sync state —
  // counting it on every 60-second poll was a table scan a minute per phone.
  // A full pull (no cursor) and any pull that ASKS (the client asks on open,
  // unlock, Sync now and while the invite screen waits for the other phone)
  // carry it; polls omit it and the client keeps the number it already has.
  const wantCount = !since || url.searchParams.get("count") === "1";
  const client = db(env);
  // Off the request path. The self-heal is a no-op on every existing
  // database (schema.sql is the record), and awaiting it put three sequential
  // round trips in front of the first pull of every cold isolate — which on
  // a low-traffic Worker is most of the 3am opens.
  ctx.waitUntil(ensureReceivedAt(client));
  // Filter and order by the SERVER clock: "give me what arrived after my
  // cursor" is the only question a pull can ask that a backfilled restore
  // (old client stamps, fresh arrival) still answers correctly.
  const [rows, meta, devices] = await Promise.all([
    client.execute({
      sql: since
        ? after
          ? "SELECT id, payload, updated_at, deleted, received_at FROM activities WHERE family_id = ? AND (received_at > ? OR (received_at = ? AND id > ?)) ORDER BY received_at, id LIMIT 2000"
          : "SELECT id, payload, updated_at, deleted, received_at FROM activities WHERE family_id = ? AND received_at > ? ORDER BY received_at, id LIMIT 2000"
        : "SELECT id, payload, updated_at, deleted, received_at FROM activities WHERE family_id = ? ORDER BY received_at, id LIMIT 2000",
      args: since ? (after ? [familyId, since, since, after] : [familyId, since]) : [familyId],
    }),
    client.execute({ sql: "SELECT profile, updated_at FROM family_meta WHERE family_id = ?", args: [familyId] }),
    wantCount
      ? client.execute({ sql: "SELECT COUNT(*) AS n FROM devices WHERE family_id = ?", args: [familyId] })
      : Promise.resolve(null),
  ]);
  // After the answer, not before it: the touch is bookkeeping.
  ctx.waitUntil(touchDevice(env, familyId, deviceId));
  return json({
    activities: rows.rows.map((r) => ({
      id: String(r.id),
      payload: JSON.parse(String(r.payload)),
      updatedAt: String(r.updated_at),
      deleted: Number(r.deleted) === 1,
      receivedAt: String(r.received_at),
    })),
    profile: meta.rows.length && meta.rows[0].profile ? JSON.parse(String(meta.rows[0].profile)) : null,
    profileUpdatedAt: meta.rows.length ? meta.rows[0].updated_at : null,
    ...(devices ? { deviceCount: Number(devices.rows[0]?.n ?? 0) } : {}),
    serverTime: new Date().toISOString(),
  });
}

async function handlePush(env: Env, request: Request, familyId: string, ctx: ExecutionContext): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    activities?: Array<{ id: string; payload: unknown; updatedAt: string; deleted?: boolean }>;
    profile?: unknown;
    profileUpdatedAt?: string;
    deviceId?: string;
  } | null;
  if (!body || !Array.isArray(body.activities)) return bad("Malformed sync payload.");
  if (body.activities.length > MAX_PUSH_BATCH) return bad("Batch too large.", 413);
  ctx.waitUntil(ensureReceivedAt(db(env)));

  const receivedAt = new Date().toISOString();
  // A write stamp past this is a phone whose clock is wrong, not a newer
  // write. It is stored as "arrived now": the entry is kept, but it can no
  // longer win every conflict for ever — a partner's later deletion or edit
  // must be able to beat it. A stored stamp already past the fence has lost
  // that immortality too (the last clause of the guard), so a row a broken
  // clock planted before this rule existed can finally be corrected.
  const futureFence = new Date(Date.now() + FUTURE_TOLERANCE_MS).toISOString();
  const statements = [];
  for (const activity of body.activities) {
    if (typeof activity.id !== "string" || typeof activity.updatedAt !== "string") continue;
    // ISO shape or nothing: the guard below compares strings, and a string
    // that merely sorts high would out-rank every real stamp.
    if (!ISO_STAMP.test(activity.updatedAt)) continue;
    const updatedAt = activity.updatedAt > futureFence ? receivedAt : activity.updatedAt;
    const payload = JSON.stringify(activity.payload ?? {});
    if (payload.length > MAX_PAYLOAD_BYTES) continue;
    // Server-side LWW guard: an older write can never clobber a newer row.
    // On an EXACT timestamp tie the tombstone wins — mirrors the client
    // merge, so server and phones always converge to the same answer.
    // received_at is stamped with the server's own clock either way, so
    // partners' pulls see the arrival even when updated_at is months old.
    statements.push({
      sql: `INSERT INTO activities (family_id, id, payload, updated_at, deleted, received_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(family_id, id) DO UPDATE SET
              payload = excluded.payload,
              updated_at = excluded.updated_at,
              deleted = excluded.deleted,
              received_at = excluded.received_at
            WHERE excluded.updated_at > activities.updated_at
               OR (excluded.updated_at = activities.updated_at AND excluded.deleted > activities.deleted)
               OR activities.updated_at > ?`,
      args: [familyId, activity.id, payload, updatedAt, activity.deleted ? 1 : 0, receivedAt, futureFence],
    });
  }
  if (body.profile && typeof body.profileUpdatedAt === "string" && ISO_STAMP.test(body.profileUpdatedAt)) {
    const profileText = JSON.stringify(body.profile);
    // The profile rides every pull for every phone; a runaway one is a
    // cost every phone in the family pays each minute.
    if (profileText.length <= MAX_PAYLOAD_BYTES) {
      const profileUpdatedAt = body.profileUpdatedAt > futureFence ? receivedAt : body.profileUpdatedAt;
      statements.push({
        sql: `INSERT INTO family_meta (family_id, profile, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(family_id) DO UPDATE SET
                profile = excluded.profile,
                updated_at = excluded.updated_at
              WHERE excluded.updated_at > family_meta.updated_at
                 OR family_meta.updated_at > ?`,
        args: [familyId, profileText, profileUpdatedAt, futureFence],
      });
    }
  }
  if (statements.length) await db(env).batch(statements, "write");
  ctx.waitUntil(touchDevice(env, familyId, body.deviceId));
  return json({ accepted: statements.length, serverTime: new Date().toISOString() });
}

export default {
  /**
   * The nightly run (see the cron in wrangler.jsonc). It exists so that the
   * dashboard's expensive half is computed once a day by the service rather
   * than by whoever happens to open the page — which is what made looking at
   * the numbers the most expensive thing the service did.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      refreshStats(db(env), Date.now()).then(
        () => undefined,
        (error) => { console.error("nightly stats failed", error); },
      ),
    );
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // One address in the address bar. www is registered only to catch typing;
    // everything it might serve lives at the apex.
    if (url.hostname === "www.numalog.app") {
      url.hostname = "numalog.app";
      return Response.redirect(url.toString(), 301);
    }

    // The operator page and its endpoints, gated in one place: allowlist,
    // then lockout, then password, then one-time code. With no ADMIN_PASSWORD
    // set the whole thing answers 404 — a secret that was never configured
    // must not become an open door.
    if (url.pathname === "/admin" || url.pathname.startsWith("/api/admin/")) {
      return await handleAdmin(db(env), env, request, url, Date.now());
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (url.pathname === "/api/family/create" && request.method === "POST") {
        return await handleCreateFamily(env, request);
      }
      if (url.pathname === "/api/family/join" && request.method === "POST") {
        return await handleJoin(env, request);
      }
      // Unauthenticated on purpose: the people most likely to need this are
      // the ones who never paired a second phone.
      if (url.pathname === "/api/feedback" && request.method === "POST") {
        return await handleFeedback(db(env), request);
      }
      // Also unauthenticated, also on purpose: the phone that held the token
      // is the thing that was lost. The verified Google credential is the key.
      if (url.pathname === "/api/family/google-recover" && request.method === "POST") {
        return await handleGoogleRecover(db(env), request, env.GOOGLE_CLIENT_ID, json, (familyId, label) =>
          mintDevice(env, familyId, label),
        );
      }
      // The magic-link pair: asking for a link needs no auth (the inbox is
      // the lock), and redeeming one carries its own proof.
      if (url.pathname === "/api/family/email-recover-request" && request.method === "POST") {
        return await handleEmailRecoverRequest(db(env), request, env.EMAIL, url.origin, json);
      }
      if (url.pathname === "/api/family/email-redeem" && request.method === "POST") {
        return await handleEmailRedeem(db(env), request, json, (familyId, label) =>
          mintDevice(env, familyId, label),
        );
      }

      const caller = await authFamily(env, request);
      if (!caller) return bad("Not paired. Create or join a family first.", 401);
      const { familyId, tokenHash } = caller;

      // Handing a key back, and taking one away from a phone that is gone.
      if (url.pathname === "/api/family/leave" && request.method === "POST") {
        return await handleLeave(db(env), familyId, tokenHash);
      }
      if (url.pathname === "/api/family/devices" && request.method === "GET") {
        return await handleListDevices(db(env), familyId, tokenHash);
      }
      if (url.pathname === "/api/family/devices/revoke" && request.method === "POST") {
        return await handleRevokeDevice(db(env), familyId, tokenHash, request);
      }

      if (url.pathname === "/api/family/google-link" && request.method === "POST") {
        return await handleGoogleLink(db(env), request, familyId, env.GOOGLE_CLIENT_ID, json);
      }
      if (url.pathname === "/api/family/google-unlink" && request.method === "POST") {
        return await handleGoogleUnlink(db(env), familyId, json);
      }
      if (url.pathname === "/api/family/recovery-status" && request.method === "GET") {
        return await handleRecoveryStatus(db(env), familyId, json);
      }
      if (url.pathname === "/api/family/email-link" && request.method === "POST") {
        return await handleEmailLink(db(env), request, familyId, env.EMAIL, url.origin, json);
      }
      if (url.pathname === "/api/family/invite" && request.method === "POST") {
        return await handleInvite(env, familyId);
      }
      if (url.pathname === "/api/sync/pull" && request.method === "GET") {
        return await handlePull(env, request, familyId, ctx);
      }
      if (url.pathname === "/api/sync/push" && request.method === "POST") {
        return await handlePush(env, request, familyId, ctx);
      }
      return bad("Unknown endpoint.", 404);
    } catch (error) {
      console.error("api error", url.pathname, error);
      return bad("Something went wrong on our side. Nothing was lost — try again.", 500);
    }
  },
};
