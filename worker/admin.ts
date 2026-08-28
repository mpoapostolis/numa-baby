/// <reference types="@cloudflare/workers-types" />
// The operator's door and the room behind it.
//
// This file is only the routing and the order of the gates; the lock itself
// lives in adminAuth.ts, the questions asked of the database in adminStats.ts,
// and the page in adminPage.ts.

import { Client } from "@libsql/client/web";
import {
  audit,
  callerOf,
  clearAttempts,
  createSession,
  destroySession,
  ensureAdminTables,
  GLOBAL_MAX_ATTEMPTS,
  ipAllowed,
  IP_MAX_ATTEMPTS,
  randomId,
  reserveAttempt,
  sessionValid,
  SESSION_TTL_SECONDS,
  verifyPassword,
  verifyTotp,
  type Caller,
} from "./adminAuth";
import { adminPageHtml } from "./adminPage";
import { collectStats } from "./adminStats";

export type AdminEnv = {
  /** Unset means the page does not exist at all. */
  ADMIN_PASSWORD?: string;
  /** Set it and the password stops being enough on its own. */
  ADMIN_TOTP_SECRET?: string;
  /** Set it and every other address is told there is nothing here. */
  ADMIN_ALLOW_IPS?: string;
};

const COOKIE_FLAGS = "Path=/; HttpOnly; Secure; SameSite=Strict";

/**
 * The page has no dependencies, so it is allowed no connections: the only
 * script and style that may run are the two carrying this nonce.
 *
 * `style-src-attr` is not decoration. A nonce covers `<style>` and never
 * `style=""`, and under CSP3 style-src-attr falls back to style-src — so
 * without that line the browser silently drops every bar height on the page
 * and all ten charts render flat, with nothing in the console to say why. The
 * attribute values are numbers this worker computes; no database text ever
 * reaches them.
 */
export function adminCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function headers(extra: HeadersInit = {}): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    ...extra,
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: headers({ "content-type": "application/json", ...extra }),
  });
}

/** The answer to "there is nothing here", used both for an unconfigured
    password and for an address that is not on the list — an attacker learns
    the same thing from both, which is nothing. */
function notFound(): Response {
  return new Response("Not found", { status: 404, headers: headers() });
}

function tooManyTries(remainingMs: number): Response {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return json({ error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` }, 429, {
    "retry-after": String(Math.ceil(remainingMs / 1000)),
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------

async function login(
  client: Client,
  env: AdminEnv,
  request: Request,
  caller: Caller,
  now: number,
): Promise<Response> {
  const secret = env.ADMIN_PASSWORD as string;
  const ipScope = `ip:${caller.ip}`;

  await ensureAdminTables(client);

  // The budget is spent HERE, before a single character is compared, and each
  // scope moves its counter in one atomic statement. A thousand simultaneous
  // guesses therefore draw a thousand different numbers and only the first few
  // are allowed to go on and be checked. Counting failures after the check —
  // the obvious way to write this — would have let all thousand through.
  const [byAddress, overall] = await Promise.all([
    reserveAttempt(client, ipScope, now, IP_MAX_ATTEMPTS, true),
    reserveAttempt(client, "global", now, GLOBAL_MAX_ATTEMPTS, false),
  ]);
  // Not audited: a refusal costs nothing to send, so writing a row for each
  // one would hand an attacker a way to grow the table for free. The lock
  // itself is on the dashboard, and so are the attempts that caused it.
  if (!byAddress.allowed) return tooManyTries(byAddress.retryAfterMs);

  const body = await readBody(request);
  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const passwordOk = await verifyPassword(secret, password);

  // The one-time code, if one is configured. Note what is NOT here: an early
  // return when the password was wrong. Skipping this work in that case would
  // make a right password measurably slower than a wrong one, which is exactly
  // the oracle the second factor exists to remove — so the same work happens
  // either way, and the two answers are combined at the end.
  let codeOk = true;
  // Set only by a code that was genuine AND unspent — something a stranger
  // cannot manufacture at any price.
  let codeProven = false;
  if (env.ADMIN_TOTP_SECRET) {
    const counter = await verifyTotp(env.ADMIN_TOTP_SECRET, code, now);
    if (counter === null) {
      codeOk = false;
    } else {
      // A code is good once, whoever presented it. Someone reading it off a
      // shoulder or a screen share cannot use it in the seconds it has left.
      const claim = await client.execute({
        sql: "INSERT INTO admin_totp_used (counter, at) VALUES (?, ?) ON CONFLICT(counter) DO NOTHING",
        args: [counter, new Date(now).toISOString()],
      });
      if (claim.rowsAffected) codeProven = true;
      else codeOk = false;
    }
  }

  // The shared lock is the one a stranger can trip deliberately, and tripping
  // it would shut the owner out along with them. So it is the one lock a
  // current one-time code walks past — a botnet cannot produce one, and
  // whoever can is the person this door is for. The per-address lock above is
  // not negotiable this way.
  if (!overall.allowed && !codeProven) return tooManyTries(overall.retryAfterMs);

  if (!passwordOk || !codeOk) {
    // The dashboard is allowed to know which half was wrong. The person at the
    // door is not: one message, one status, no count of tries left — a counter
    // is a map of how hard to push.
    await audit(client, passwordOk ? "login_bad_code" : "login_bad", caller, now);
    return json({ error: "Wrong password or code." }, 401);
  }

  const session = await createSession(client, caller, now);
  await Promise.all([
    clearAttempts(client, ipScope, true),
    clearAttempts(client, "global", false),
    audit(client, "login_ok", caller, now),
    client
      .execute({
        sql: "DELETE FROM admin_totp_used WHERE at < ?",
        args: [new Date(now - 10 * 60_000).toISOString()],
      })
      .catch(() => undefined),
  ]);
  return json({ ok: true }, 200, {
    "set-cookie": `nb_admin=${session}; ${COOKIE_FLAGS}; Max-Age=${SESSION_TTL_SECONDS}`,
  });
}

// ---------------------------------------------------------------------------

export async function handleAdmin(
  client: Client,
  env: AdminEnv,
  request: Request,
  url: URL,
  now: number,
): Promise<Response> {
  try {
    return await route(client, env, request, url, now);
  } catch (error) {
    // If the database cannot be reached, the budget cannot be spent — and an
    // attempt that was never paid for must never be checked. Failing shut is
    // the only safe direction here, and the reason says nothing.
    console.error("admin error", url.pathname, error);
    return json({ error: "The service is not answering. Try again shortly." }, 503);
  }
}

async function route(
  client: Client,
  env: AdminEnv,
  request: Request,
  url: URL,
  now: number,
): Promise<Response> {
  // No password configured means no dashboard — a secret nobody set must
  // never become an open door.
  if (!env.ADMIN_PASSWORD) return notFound();

  const caller = callerOf(request);
  // Deliberately before anything else, and deliberately silent: a blocked
  // address gets a 404 without a database round trip, so it cannot fill the
  // audit table or cost anything by trying.
  if (!ipAllowed(env.ADMIN_ALLOW_IPS, caller.ip)) return notFound();

  if (url.pathname === "/admin" && request.method === "GET") {
    const nonce = randomId();
    return new Response(adminPageHtml(nonce), {
      headers: headers({
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": adminCsp(nonce),
      }),
    });
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    return await login(client, env, request, caller, now);
  }

  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    const body = await readBody(request);
    await ensureAdminTables(client);
    // "Everywhere" empties the session table, so it is the one thing here that
    // a stranger must not be able to reach: without a live session this can
    // only delete the row matching a cookie the caller already holds, which
    // is to say their own, which is to say nothing.
    const signedIn = await sessionValid(client, request, now);
    await destroySession(client, request, signedIn && body.all === true);
    return json({ ok: true }, 200, { "set-cookie": `nb_admin=; ${COOKIE_FLAGS}; Max-Age=0` });
  }

  // Everything past here needs a live session.
  await ensureAdminTables(client);
  if (!(await sessionValid(client, request, now))) {
    return json({ error: "Not signed in." }, 401);
  }

  if (url.pathname === "/api/admin/stats" && request.method === "GET") {
    return json(await collectStats(client, now));
  }

  // The one write the dashboard makes: a message can be ticked off. Nothing
  // here deletes anything — not a message, and certainly not a family's log.
  if (url.pathname === "/api/admin/feedback" && request.method === "POST") {
    const body = await readBody(request);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return json({ error: "Which message?" }, 400);
    await client.execute({
      sql: "UPDATE feedback SET handled = ? WHERE id = ?",
      args: [body.handled ? 1 : 0, id],
    });
    return json({ ok: true });
  }

  return notFound();
}
