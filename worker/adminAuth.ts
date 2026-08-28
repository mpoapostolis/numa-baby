/// <reference types="@cloudflare/workers-types" />
// The lock on the operator's door.
//
// The repository is public, so /admin, /api/admin/login and every line below
// are known to anyone who cares to look. That is fine — and it is also the
// whole design constraint: the only thing an attacker must not have is the
// secret, so nothing here may leak it, and guessing it must be hopeless
// rather than merely slow.
//
// Four independent gates, each optional-but-on by default in the order they
// are cheapest to fail:
//
//   1. IP allowlist   (ADMIN_ALLOW_IPS)   — if set, everyone else gets a 404
//   2. Lockout        (always)            — per-IP and global, exponential
//   3. Password       (ADMIN_PASSWORD)    — PBKDF2, compared in constant time
//   4. One-time code  (ADMIN_TOTP_SECRET) — if set, the password alone is not
//                                            enough to get in
//
// Gate 2 is the one that actually kills brute force, so it is the one with no
// off switch: the budget is SPENT BEFORE the password is looked at, in a
// single atomic statement, and the database every colo shares is what holds
// it. Spending first is the whole trick — a thousand simultaneous guesses each
// take a distinct number from the same counter, so only the first few ever
// reach a password comparison at all. Counting failures afterwards would have
// let all thousand through for the price of one.
//
// Gates 1 and 4 exist because "only me" is a stronger claim than "only someone
// who knows the password", and both are enabled simply by setting a secret.

import type { Client } from "@libsql/client/web";

/** How long a signed-in session lasts before it must be earned again. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const COOKIE = "nb_admin";

/** Attempts inside this window count together; older ones are forgiven. */
export const ATTEMPT_WINDOW_MS = 15 * 60_000;
/** One address gets this many tries per window before it is put on the step. */
export const IP_MAX_ATTEMPTS = 5;
/** …and the endpoint as a whole gets this many, so a botnet cannot buy more
    guesses simply by bringing more addresses. */
export const GLOBAL_MAX_ATTEMPTS = 20;
/** First lock. Every subsequent lock on the same ADDRESS doubles it… */
export const BASE_LOCK_MS = 15 * 60_000;
/** …up to here, so a determined attacker faces days, not minutes. */
export const MAX_LOCK_MS = 24 * 60 * 60_000;

// Deliberately modest: this is defence in depth, not the defence. The budget
// is spent before this code runs, so at most a handful of guesses ever reach
// it — which means the iteration count buys almost nothing against a network
// attacker and would cost a great deal if it pushed a login past the smallest
// Workers CPU budget (10 ms). A cold isolate derives twice, so the figure is
// chosen to leave room for both. Nothing derived here is ever stored, so the
// salt is a constant.
const PBKDF2_ITERATIONS = 20_000;
const PBKDF2_SALT = "numa-admin-v1";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/** Compare over a fixed length, so a wrong answer cannot be found one
    character at a time by watching how long the answer takes. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

async function derive(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(PBKDF2_SALT), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return hex(bits);
}

// The secret does not change between requests, so its derivation is paid for
// once per isolate rather than once per attempt — the cost belongs to the
// guess, not to us.
let derivedSecret: { secret: string; value: string } | null = null;

export async function verifyPassword(secret: string, supplied: string): Promise<boolean> {
  if (!derivedSecret || derivedSecret.secret !== secret) {
    derivedSecret = { secret, value: await derive(secret) };
  }
  return timingSafeEqual(await derive(supplied), derivedSecret.value);
}

export function randomId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

// ---------------------------------------------------------------------------
// One-time codes (RFC 6238)
// ---------------------------------------------------------------------------

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode a base32 secret as an authenticator app writes it: any case, spaces
    and padding tolerated. Returns null if it contains anything else. */
export function base32Decode(input: string): Uint8Array | null {
  const clean = input.toUpperCase().replace(/[\s=]/g, "");
  if (!clean.length) return null;
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/** The 6-digit code for a given 30-second counter. */
export async function totpCode(secretBase32: string, counter: number): Promise<string | null> {
  const secret = base32Decode(secretBase32);
  if (!secret || secret.length === 0) return null;
  const message = new Uint8Array(8);
  // Counters stay far below 2^32 for the next few thousand years, so the high
  // word is zero and the low word is written big-endian by hand.
  new DataView(message.buffer).setUint32(4, counter >>> 0, false);
  const key = await crypto.subtle.importKey(
    "raw",
    secret as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message as unknown as BufferSource));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

export const TOTP_STEP_SECONDS = 30;

/**
 * Check a supplied code against the current window and its neighbours.
 * Returns the counter it matched — the caller stores that so the same code
 * cannot be replayed inside its own 30 seconds by anyone watching.
 */
export async function verifyTotp(
  secretBase32: string,
  supplied: string,
  now: number,
  skew = 1,
): Promise<number | null> {
  if (!/^\d{6}$/.test(supplied)) return null;
  const current = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  let matched: number | null = null;
  // Every candidate is evaluated, never short-circuited: the number of
  // comparisons must not depend on which one was right.
  for (let step = -skew; step <= skew; step++) {
    const expected = await totpCode(secretBase32, current + step);
    if (expected && timingSafeEqual(expected, supplied)) matched = current + step;
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Lockout policy — pure, so it can be tested without a database
// ---------------------------------------------------------------------------

/**
 * How long a lock lasts.
 *
 * Per address it doubles every time the same address comes back, because an
 * attacker who is willing to wait fifteen minutes forever should not get to.
 * The shared lock never doubles: it is the one a stranger could use to shut
 * the owner out too, so it stays a flat quarter of an hour. That still leaves
 * a botnet with twenty guesses per quarter hour — under two thousand a day
 * against a password that should have far more than two thousand candidates.
 *
 * @param strikes how many times this scope was locked BEFORE this one
 */
export function lockDurationMs(strikes: number, escalate: boolean): number {
  if (!escalate) return BASE_LOCK_MS;
  return Math.min(BASE_LOCK_MS * 2 ** Math.max(0, strikes), MAX_LOCK_MS);
}

/** Attempts stamped before this are from an old window and are forgiven. */
export function windowFloor(now: number): number {
  return now - ATTEMPT_WINDOW_MS;
}

// A colo that has just refused someone refuses the next one for free. Purely
// an optimisation — the database remains the authority, and an empty cache
// (new isolate, another colo) is always safe.
const lockCache = new Map<string, number>();

export function cachedLockRemainingMs(scope: string, now: number): number {
  const until = lockCache.get(scope);
  if (!until) return 0;
  if (until <= now) {
    lockCache.delete(scope);
    return 0;
  }
  return until - now;
}

export function rememberLock(scope: string, lockedUntil: number | null) {
  if (lockedUntil) lockCache.set(scope, lockedUntil);
  else lockCache.delete(scope);
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

let ensured = false;

/** The admin tables are created on first use, like every other table the
    worker owns, so a fresh database needs no migration step. */
export async function ensureAdminTables(client: Client) {
  if (ensured) return;
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS admin_sessions (
         id_hash TEXT PRIMARY KEY,
         created_at TEXT NOT NULL,
         expires_at TEXT NOT NULL,
         last_seen_at TEXT,
         ip TEXT, country TEXT, user_agent TEXT
       )`,
      `CREATE TABLE IF NOT EXISTS admin_lockouts (
         scope TEXT PRIMARY KEY,
         failures INTEGER NOT NULL DEFAULT 0,
         strikes INTEGER NOT NULL DEFAULT 0,
         window_start TEXT NOT NULL,
         locked_until TEXT
       )`,
      `CREATE TABLE IF NOT EXISTS admin_audit (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         at TEXT NOT NULL,
         event TEXT NOT NULL,
         ip TEXT, country TEXT, asn TEXT, user_agent TEXT
       )`,
      `CREATE TABLE IF NOT EXISTS admin_totp_used (
         counter INTEGER PRIMARY KEY,
         at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_admin_audit_at ON admin_audit(at)`,
    ],
    "write",
  );
  ensured = true;
}

export type Reservation = {
  allowed: boolean;
  /** How long the caller must wait, when they must wait. */
  retryAfterMs: number;
};

/**
 * Spend one attempt from a scope's budget, and say whether it may be used.
 *
 * The counter moves in ONE statement, so a thousand requests arriving together
 * are handed a thousand distinct numbers rather than all reading zero. That is
 * the difference between a lockout and the appearance of one: everything else
 * here — the password, the code, the timing — assumes only a handful of
 * guesses per window ever get this far, and this is what makes that true.
 *
 * @param escalate double the lock each time this scope is locked (addresses,
 *                 yes; the shared counter, no — see lockDurationMs)
 */
export async function reserveAttempt(
  client: Client,
  scope: string,
  now: number,
  maxAttempts: number,
  escalate: boolean,
): Promise<Reservation> {
  const cached = cachedLockRemainingMs(scope, now);
  if (cached > 0) return { allowed: false, retryAfterMs: cached };

  const nowIso = iso(now);
  const floorIso = iso(windowFloor(now));
  const result = await client.execute({
    // While a lock stands, the count is frozen: hammering a locked door must
    // not run the strike count up, or the wait would grow without the
    // attacker ever getting another guess out of it.
    sql: `INSERT INTO admin_lockouts (scope, failures, strikes, window_start, locked_until)
          VALUES (?, 1, 0, ?, NULL)
          ON CONFLICT(scope) DO UPDATE SET
            failures = CASE
              WHEN admin_lockouts.locked_until IS NOT NULL AND admin_lockouts.locked_until > ?
                THEN admin_lockouts.failures
              WHEN admin_lockouts.window_start < ? THEN 1
              ELSE admin_lockouts.failures + 1 END,
            window_start = CASE
              WHEN admin_lockouts.locked_until IS NOT NULL AND admin_lockouts.locked_until > ?
                THEN admin_lockouts.window_start
              WHEN admin_lockouts.window_start < ? THEN ?
              ELSE admin_lockouts.window_start END,
            locked_until = CASE
              WHEN admin_lockouts.locked_until IS NOT NULL AND admin_lockouts.locked_until <= ?
                THEN NULL
              ELSE admin_lockouts.locked_until END
          RETURNING failures, strikes, locked_until`,
    args: [scope, nowIso, nowIso, floorIso, nowIso, floorIso, nowIso, nowIso],
  });

  const row = result.rows[0];
  const lockedUntil = row?.locked_until ? new Date(String(row.locked_until)).getTime() : 0;
  if (lockedUntil > now) {
    rememberLock(scope, lockedUntil);
    return { allowed: false, retryAfterMs: lockedUntil - now };
  }

  const attempts = Number(row?.failures ?? 1);
  if (attempts <= maxAttempts) return { allowed: true, retryAfterMs: 0 };

  const strikes = Number(row?.strikes ?? 0);
  const until = now + lockDurationMs(strikes, escalate);
  await client.execute({
    // Guarded on the lock still being open, so two requests that crossed the
    // line together cannot each add a strike.
    sql: `UPDATE admin_lockouts
          SET strikes = strikes + 1, failures = 0, window_start = ?, locked_until = ?
          WHERE scope = ? AND (locked_until IS NULL OR locked_until <= ?)`,
    args: [nowIso, iso(until), scope, nowIso],
  });
  rememberLock(scope, until);
  return { allowed: false, retryAfterMs: until - now };
}

/** The right answer clears the budget. For an address it clears the record
    too: someone who just proved they are the owner is not on their fifth
    strike. The shared counter keeps its history — it is not about one person. */
export async function clearAttempts(client: Client, scope: string, forgiveStrikes: boolean) {
  rememberLock(scope, null);
  await client
    .execute({
      sql: forgiveStrikes
        ? "UPDATE admin_lockouts SET failures = 0, strikes = 0, locked_until = NULL WHERE scope = ?"
        : "UPDATE admin_lockouts SET failures = 0, locked_until = NULL WHERE scope = ?",
      args: [scope],
    })
    .catch(() => undefined);
}

export type Caller = { ip: string; country: string; asn: string; userAgent: string };

export function callerOf(request: Request): Caller {
  const cf = (request as { cf?: Record<string, unknown> }).cf ?? {};
  return {
    ip: request.headers.get("cf-connecting-ip") ?? "unknown",
    country: String(cf.country ?? "??"),
    asn: String(cf.asn ?? ""),
    // Trimmed: enough to tell a browser from a script, not a fingerprint.
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 120),
  };
}

export async function audit(client: Client, event: string, caller: Caller, now: number) {
  await client
    .execute({
      sql: "INSERT INTO admin_audit (at, event, ip, country, asn, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
      args: [iso(now), event, caller.ip, caller.country, caller.asn, caller.userAgent],
    })
    .catch(() => undefined);
}

/**
 * Is this address allowed to reach the door at all?
 *
 * Unset means "anyone may knock", which is the default. Set to a comma
 * separated list and everyone else is told the page does not exist.
 */
export function ipAllowed(allowList: string | undefined, ip: string): boolean {
  if (!allowList || !allowList.trim()) return true;
  return allowList
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => entry === ip);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(
  client: Client,
  caller: Caller,
  now: number,
): Promise<string> {
  const id = randomId();
  await client.execute({
    sql: `INSERT INTO admin_sessions (id_hash, created_at, expires_at, last_seen_at, ip, country, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      await sha256Hex(id),
      iso(now),
      iso(now + SESSION_TTL_SECONDS * 1000),
      iso(now),
      caller.ip,
      caller.country,
      caller.userAgent,
    ],
  });
  return id;
}

function cookieValue(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${COOKIE}=`)) return trimmed.slice(COOKIE.length + 1);
  }
  return null;
}

/** True if this request carries a live session. Also refreshes last_seen so
    the dashboard can show which sessions are actually being used. */
export async function sessionValid(client: Client, request: Request, now: number): Promise<boolean> {
  const raw = cookieValue(request.headers.get("cookie"));
  // Shape-checked before it is hashed: a session id is 43 base64url chars.
  if (!raw || !/^[A-Za-z0-9_-]{20,64}$/.test(raw)) return false;
  const hash = await sha256Hex(raw);
  const result = await client.execute({
    sql: "SELECT expires_at FROM admin_sessions WHERE id_hash = ?",
    args: [hash],
  });
  const row = result.rows[0];
  if (!row) return false;
  if (new Date(String(row.expires_at)).getTime() <= now) {
    // Expired rows are removed on sight rather than by a sweeper.
    await client.execute({ sql: "DELETE FROM admin_sessions WHERE id_hash = ?", args: [hash] });
    return false;
  }
  await client
    .execute({ sql: "UPDATE admin_sessions SET last_seen_at = ? WHERE id_hash = ?", args: [iso(now), hash] })
    .catch(() => undefined);
  return true;
}

export async function destroySession(client: Client, request: Request, all: boolean) {
  const raw = cookieValue(request.headers.get("cookie"));
  if (all) {
    await client.execute("DELETE FROM admin_sessions");
    return;
  }
  if (!raw) return;
  await client.execute({
    sql: "DELETE FROM admin_sessions WHERE id_hash = ?",
    args: [await sha256Hex(raw)],
  });
}
